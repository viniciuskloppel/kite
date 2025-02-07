import {
  Address,
  airdropFactory,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  assertIsSignature,
  Commitment,
  CompilableTransactionMessage,
  createDefaultRpcTransport,
  createSignerFromKeyPair,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  KeyPairSigner,
  lamports,
  Lamports,
  pipe,
  RpcFromTransport,
  RpcTransport,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  Signature,
  signTransactionMessageWithSigners,
  SolanaRpcApiFromTransport,
  some,
  TransactionMessageWithBlockhashLifetime,
} from "@solana/web3.js";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";
import dotenv from "dotenv";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  // This is badly named. It's a function that returns an object.
  extension as getExtensionData,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMetadataPointerInstruction,
  getInitializeMintInstruction,
  getInitializeTokenMetadataInstruction,
  getMintSize,
  getMintToInstruction,
  getUpdateTokenMetadataFieldInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  tokenMetadataField,
} from "@solana-program/token-2022";

import { getTransferSolInstruction } from "@solana-program/system";
import { checkIsValidURL, encodeURL } from "./url";
import { addKeyPairSignerToEnvFile, grindKeyPair, loadWalletFromEnvironment, loadWalletFromFile } from "./keypair";
import { SOL } from "./constants";

export const DEFAULT_AIRDROP_AMOUNT = lamports(1n * SOL);
export const DEFAULT_MINIMUM_BALANCE = lamports(500_000_000n);
export const DEFAULT_ENV_KEYPAIR_VARIABLE_NAME = "PRIVATE_KEY";

// Make an object with a map of solana cluster names to subobjects, with the subobjects containing the URL and websocket URL
const CLUSTERS: Record<
  string,
  {
    httpURL: string;
    webSocketURL: string;
    // Whether this is the default cluster for the Solana Explorer
    isExplorerDefault: boolean;
    // Whether this cluster name is known to the Solana Explorer
    isNameKnownToSolanaExplorer: boolean;
    // The URL param name required for this cluster (eg for API keys)
    requiredParam: string | null;
    // The environment variable name used for requiredParam above.
    requiredParamEnvironmentVariable: string | null;
  }
> = {
  // Solana Labs RPCs
  "mainnet-beta": {
    httpURL: "https://api.mainnet-beta.solana.com",
    webSocketURL: "wss://api.mainnet-beta.solana.com",
    isExplorerDefault: true,
    isNameKnownToSolanaExplorer: true,
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
  },
  testnet: {
    httpURL: "https://api.testnet.solana.com",
    webSocketURL: "wss://api.testnet.solana.com",
    isExplorerDefault: false,
    isNameKnownToSolanaExplorer: true,
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
  },
  devnet: {
    httpURL: "https://api.devnet.solana.com",
    webSocketURL: "wss://api.devnet.solana.com",
    isExplorerDefault: false,
    isNameKnownToSolanaExplorer: true,
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
  },
  // Helius RPCs
  "helius-mainnet": {
    httpURL: "https://mainnet.helius-rpc.com/",
    webSocketURL: "wss://mainnet.helius-rpc.com/",
    isExplorerDefault: false,
    isNameKnownToSolanaExplorer: false,
    requiredParam: "api-key",
    requiredParamEnvironmentVariable: "HELIUS_API_KEY",
  },
  "helius-testnet": {
    httpURL: "https://testnet.helius-rpc.com/",
    webSocketURL: "wss://testnet.helius-rpc.com/",
    isExplorerDefault: false,
    isNameKnownToSolanaExplorer: false,
    requiredParam: "api-key",
    requiredParamEnvironmentVariable: "HELIUS_API_KEY",
  },
  "helius-devnet": {
    httpURL: "https://devnet.helius-rpc.com/",
    webSocketURL: "wss://devnet.helius-rpc.com/",
    isExplorerDefault: false,
    isNameKnownToSolanaExplorer: false,
    requiredParam: "api-key",
    requiredParamEnvironmentVariable: "HELIUS_API_KEY",
  },
  // Localnet
  localnet: {
    httpURL: "http://localhost:8899",
    webSocketURL: "ws://localhost:8900",
    isExplorerDefault: false,
    isNameKnownToSolanaExplorer: false,
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
  },
};

const KNOWN_CLUSTER_NAMES = Object.keys(CLUSTERS);
// For error messages
const KNOWN_CLUSTER_NAMES_STRING = KNOWN_CLUSTER_NAMES.join(", ");

export const getExplorerLinkFactory = (clusterNameOrURL: string) => {
  const getExplorerLink = (linkType: "transaction" | "tx" | "address" | "block", id: string): string => {
    const searchParams: Record<string, string> = {};
    if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
      const clusterDetails = CLUSTERS[clusterNameOrURL];
      // If they're using Solana Labs mainnet-beta, we don't need to include the cluster name in the Solana Explorer URL
      // because it's the default
      if (!clusterDetails.isExplorerDefault) {
        if (clusterDetails.isNameKnownToSolanaExplorer) {
          searchParams["cluster"] = clusterNameOrURL;
        } else {
          searchParams["cluster"] = "custom";
        }
        // We don't have to set searchParams["customUrl"] for localnet - Explorer will connect to localnet by default
        if (clusterNameOrURL !== "localnet") {
          if (clusterDetails.requiredParam) {
            const requiredParamEnvironmentVariable = clusterDetails.requiredParamEnvironmentVariable;
            if (!requiredParamEnvironmentVariable) {
              throw new Error(`Required param environment variable is not set for cluster ${clusterNameOrURL}`);
            }
            if (!process.env[requiredParamEnvironmentVariable]) {
              throw new Error(`Environment variable '${requiredParamEnvironmentVariable}' is not set.`);
            }
            const apiKey = process.env[requiredParamEnvironmentVariable];

            const params = new URLSearchParams({
              [clusterDetails.requiredParam]: apiKey,
            });
            const urlWithParams = `${clusterDetails.httpURL}?${params.toString()}`;
            searchParams["customUrl"] = urlWithParams;
          } else {
            if (!clusterDetails.isNameKnownToSolanaExplorer) {
              searchParams["customUrl"] = clusterDetails.httpURL;
            }
          }
        }
      }
    } else {
      if (checkIsValidURL(clusterNameOrURL)) {
        searchParams["cluster"] = "custom";
        searchParams["customUrl"] = clusterNameOrURL;
      } else {
        throw new Error(`Unsupported cluster name: ${clusterNameOrURL}`);
      }
    }

    let baseUrl: string = "";
    if (linkType === "address") {
      baseUrl = `https://explorer.solana.com/address/${id}`;
    }
    if (linkType === "transaction" || linkType === "tx") {
      baseUrl = `https://explorer.solana.com/tx/${id}`;
    }
    if (linkType === "block") {
      baseUrl = `https://explorer.solana.com/block/${id}`;
    }
    return encodeURL(baseUrl, searchParams);
  };

  return getExplorerLink;
};

export const signSendAndConfirmTransactionFactory = (
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>,
) => {
  const signSendAndConfirmTransaction = async (
    transactionMessage: CompilableTransactionMessage & TransactionMessageWithBlockhashLifetime,
    commitment: Commitment = "processed",
    skipPreflight: boolean = true,
  ): Promise<Signature> => {
    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    await sendAndConfirmTransaction(signedTransaction, {
      commitment,
      skipPreflight,
    });
    return getSignatureFromTransaction(signedTransaction);
  };
  return signSendAndConfirmTransaction;
};

const getBalanceFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getBalance = async (address: string, commitment: Commitment = "finalized"): Promise<Lamports> => {
    const getBalanceResponse = await rpc.getBalance(address, { commitment }).send();
    return getBalanceResponse.value;
  };
  return getBalance;
};

const airdropIfRequiredFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>,
) => {
  const getBalance = getBalanceFactory(rpc);
  // Plain 'airdrop' is not exported as we don't want to encourage people to
  // request airdrops when they don't need them, ie - don't bother
  // the faucet unless you really need to!
  //
  // Note rpc.requestAirdrop is broken, the commitment paramater doesn't do anything
  // despite the docs repeatedly referring to rpc.requestAirdrop
  // See https://github.com/solana-labs/solana-web3.js/issues/3683
  //
  // @ts-expect-error TODO need to work out devnet/mainnet typing issue re: airdrops
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  const airdropIfRequired = async (
    address: Address,
    airdropAmount: Lamports,
    minimumBalance: Lamports,
  ): Promise<Lamports> => {
    if (airdropAmount < 0n) {
      throw new Error(`Airdrop amount must be a positive number, not ${airdropAmount}`);
    }
    if (minimumBalance === 0n) {
      await airdrop({
        commitment: "finalized",
        recipientAddress: address,
        lamports: airdropAmount,
      });
      return getBalance(address, "finalized");
    }
    const balance = await getBalance(address, "finalized");

    if (balance >= minimumBalance) {
      return balance;
    }
    await airdrop({
      commitment: "finalized",
      recipientAddress: address,
      lamports: airdropAmount,
    });

    return getBalance(address, "finalized");
  };
  return airdropIfRequired;
};

// Formerly called initializeKeypair()
// See https://assets.fengsi.io/pr:sharp/rs:fill:1600:1067:1:1/g:ce/q:80/L2FwaS9qZGxlYXRoZXJnb29kcy9vcmlnaW5hbHMvYjZmNmU2ODAtNzY3OC00MDFiLWE1MzctODg4MWQyMmMzZWIyLmpwZw.jpg
const createWalletFactory = (airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>) => {
  const createWallet = async (
    prefix: string | null = null,
    suffix: string | null = null,
    envFileName: string | null = null,
    envVariableName: string = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
    airdropAmount: Lamports | null = DEFAULT_AIRDROP_AMOUNT,
  ): Promise<KeyPairSigner> => {
    let keyPairSigner: KeyPairSigner;

    if (envFileName) {
      // Important: we make a temporary extractable keyPair and write it to the environment file
      // We then reload the keypair from the environment as non-extractable
      // This is because the temporaryExtractableKeyPair's private key is extractable, and we want to keep it secret
      const temporaryExtractableKeyPair = await grindKeyPair(
        prefix,
        suffix,
        false,
        "yes I understand the risk of extractable private keys and will delete this keypair shortly after saving it to a file",
      );
      const temporaryExtractableKeyPairSigner = await createSignerFromKeyPair(temporaryExtractableKeyPair);
      await addKeyPairSignerToEnvFile(temporaryExtractableKeyPairSigner, envVariableName, envFileName);
      dotenv.config({ path: envFileName });
      keyPairSigner = await loadWalletFromEnvironment(envVariableName);
      // Once the block is exited, the variable will be dereferenced and no longer accessible. This means the memory used by the variable can be reclaimed by the garbage collector, as there are no other references to it outside the block. Goodbye temporaryExtractableKeyPair and temporaryExtractableKeyPairSigner!
    } else {
      const keyPair = await grindKeyPair(prefix, suffix);
      keyPairSigner = await createSignerFromKeyPair(keyPair);
    }

    if (airdropAmount) {
      // Since this is a brand new wallet (and has no existing balance), we can just use the airdrop amount for the minimum balance
      await airdropIfRequired(keyPairSigner.address, airdropAmount, airdropAmount);
    }

    return keyPairSigner;
  };

  return createWallet;
};

const getLogsFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getLogs = async (signature: string): Promise<Array<string>> => {
    assertIsSignature(signature);

    const transaction = await rpc
      .getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      })
      .send();

    if (!transaction.meta) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    return transaction.meta.logMessages ?? [];
  };
  return getLogs;
};

const transferLamportsFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  // Adapted from https://solana.com/developers/docs/transactions/examples/transfer-sol-with-web3-js/
  const transferLamports = async (source: KeyPairSigner, destination: Address, amount: Lamports) => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    // Step 1: create the transfer transaction
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (transaction) => {
        return setTransactionMessageFeePayer(source.address, transaction);
      },
      (transaction) => {
        return setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, transaction);
      },
      (transaction) => {
        const instruction = getTransferSolInstruction({
          amount,
          destination: destination,
          source: source,
        });
        return appendTransactionMessageInstruction(instruction, transaction);
      },
    );

    // Step 2: sign the transaction
    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

    // Step 3: send and confirm the transaction
    await rpc.sendAndConfirmTransaction(signedTransaction, {
      commitment: "confirmed",
    });

    const signature = getSignatureFromTransaction(signedTransaction);

    return signature;
  };
  return transferLamports;
};

const makeTokenMintFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>,
) => {
  const makeTokenMint = async (
    mintAuthority: KeyPairSigner,
    decimals: number,
    name: string,
    symbol: string,
    uri: string,
    additionalMetadata: Record<string, string> | Map<string, string> = {},
  ) => {
    // See https://github.com/solana-program/token-2022/tree/main/clients/js/test/_setup.ts
    // See https://github.com/solana-program/token-2022/tree/main/clients/js/test/extensions/tokenMetadata/updateTokenMetadataField.test.ts
    // See https://solana.stackexchange.com/questions/19747/how-do-i-make-a-token-with-metadata-using-web3-js-version-2/19792#19792

    // Generate keypairs for and mint
    const mint = await generateKeyPairSigner();

    // Convert additionalMetadata to a Map if it's a Record
    const additionalMetadataMap =
      additionalMetadata instanceof Map ? additionalMetadata : new Map(Object.entries(additionalMetadata));

    // Metadata Pointer Extension Data
    // Storing metadata directly in the mint account
    const metadataPointerExtensionData = getExtensionData("MetadataPointer", {
      authority: some(mintAuthority.address),
      metadataAddress: some(mint.address),
    });

    // Token Metadata Extension Data
    // Using this to calculate rent lamports up front
    const tokenMetadataExtensionData = getExtensionData("TokenMetadata", {
      updateAuthority: some(mintAuthority.address),
      mint: mint.address,
      name,
      symbol,
      uri,
      additionalMetadata: additionalMetadataMap,
    });

    // The amount of space required to initialize the mint account (with metadata pointer extension only)
    // Excluding the metadata extension intentionally
    // The metadata extension instruction MUST come after initialize mint instruction,
    // Including space for the metadata extension will result in
    // error: "invalid account data for instruction" when the initialize mint instruction is processed
    const spaceWithoutMetadata = BigInt(getMintSize([metadataPointerExtensionData]));

    // The amount of space required for the mint account and both extensions
    // Use to calculate total rent lamports that must be allocated to the mint account
    // The metadata extension instruction automatically does the space reallocation,
    // but DOES NOT transfer the rent lamports required to store the extra metadata
    const spaceWithMetadata = BigInt(getMintSize([metadataPointerExtensionData, tokenMetadataExtensionData]));

    // Calculate rent lamports for mint account with metadata pointer and token metadata extensions
    const rent = await rpc.getMinimumBalanceForRentExemption(spaceWithMetadata).send();

    // Instruction to create new account for mint (token 2022 program)
    // space: only for mint and metadata pointer extension, other wise initialize instruction will fail
    // lamports: for mint, metadata pointer extension, and token metadata extension (paying up front for simplicity)
    const createAccountInstruction = getCreateAccountInstruction({
      payer: mintAuthority,
      newAccount: mint,
      lamports: rent,
      space: spaceWithoutMetadata,
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    });

    // Instruction to initialize metadata pointer extension
    // This instruction must come before initialize mint instruction
    const initializeMetadataPointerInstruction = getInitializeMetadataPointerInstruction({
      mint: mint.address,
      authority: mintAuthority.address,
      metadataAddress: mint.address,
    });

    // Instruction to initialize base mint account data
    const initializeMintInstruction = getInitializeMintInstruction({
      mint: mint.address,
      decimals,
      mintAuthority: mintAuthority.address,
    });

    // Instruction to initialize token metadata extension
    // This instruction must come after initialize mint instruction
    // This ONLY initializes basic metadata fields (name, symbol, uri)
    const initializeTokenMetadataInstruction = getInitializeTokenMetadataInstruction({
      metadata: mint.address,
      updateAuthority: mintAuthority.address,
      mint: mint.address,
      mintAuthority: mintAuthority,
      name: tokenMetadataExtensionData.name,
      symbol: tokenMetadataExtensionData.symbol,
      uri: tokenMetadataExtensionData.uri,
    });

    // Instruction to update token metadata extension
    // This either updates existing fields or adds the custom additionalMetadata fields
    const updateTokenMetadataInstruction = getUpdateTokenMetadataFieldInstruction({
      metadata: mint.address,
      updateAuthority: mintAuthority,
      field: tokenMetadataField("Key", ["description"]),
      value: "Only Possible On Solana",
    });

    // Instruction to create Associated Token Account
    const createAtaInstruction = await getCreateAssociatedTokenInstructionAsync({
      payer: mintAuthority,
      mint: mint.address,
      owner: mintAuthority.address,
    });

    // Derive associated token address
    const [associatedTokenAddress] = await findAssociatedTokenPda({
      mint: mint.address,
      owner: mintAuthority.address,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });

    // Instruction to mint tokens to associated token account
    const mintToInstruction = getMintToInstruction({
      mint: mint.address,
      token: associatedTokenAddress,
      mintAuthority: mintAuthority.address,
      amount: 100n,
    });

    // Order of instructions to add to transaction
    const instructions = [
      createAccountInstruction,
      initializeMetadataPointerInstruction, // MUST come before initialize mint instruction
      initializeMintInstruction,
      initializeTokenMetadataInstruction, // MUST come after initialize mint instruction
      updateTokenMetadataInstruction, // MUST come after initialize token metadata instruction
      createAtaInstruction,
      mintToInstruction,
    ];

    // Get latest blockhash to include in transaction
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    // Create transaction message
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }), // Create transaction message
      (tx) => setTransactionMessageFeePayerSigner(mintAuthority, tx), // Set fee payer
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx), // Set transaction blockhash
      (tx) => appendTransactionMessageInstructions(instructions, tx), // Append instructions
    );

    // Sign transaction message with required signers (fee payer and mint keypair)
    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

    // Send and confirm transaction
    await sendAndConfirmTransaction(signedTransaction, {
      commitment: "confirmed",
      skipPreflight: true,
    });

    return mint.address;
  };

  return makeTokenMint;
};

export const connect = (
  clusterNameOrURL: string = "localnet",
  clusterWebSocketURL: string | null = null,
): Connection => {
  let httpURL: string | null = null;
  let webSocketURL: string | null = null;

  // Postel's law: be liberal in what you accept - so include 'mainnet' as well as 'mainnet-beta'
  if (clusterNameOrURL === "mainnet") {
    clusterNameOrURL = "mainnet-beta";
  }

  if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
    const clusterDetails = CLUSTERS[clusterNameOrURL];

    if (clusterDetails.requiredParamEnvironmentVariable) {
      const requiredParamEnvironmentVariable = process.env[clusterDetails.requiredParamEnvironmentVariable];
      if (!requiredParamEnvironmentVariable) {
        throw new Error(`Environment variable ${clusterDetails.requiredParamEnvironmentVariable} is not set.`);
      }
      // Add the URL param 'api-key' with the value of the environment variable
      // using a URLSearchParams object
      const queryParamsString = new URLSearchParams({
        "api-key": requiredParamEnvironmentVariable,
      });
      httpURL = `${clusterDetails.httpURL}?${queryParamsString}`;
      webSocketURL = `${clusterDetails.webSocketURL}?${queryParamsString}`;
    } else {
      httpURL = clusterDetails.httpURL;
      webSocketURL = clusterDetails.webSocketURL;
    }
  } else {
    if (!clusterWebSocketURL) {
      throw new Error(
        `Missing clusterWebSocketURL. Either provide a valid cluster name (${KNOWN_CLUSTER_NAMES_STRING}) or two valid URLs.`,
      );
    }
    if (checkIsValidURL(clusterNameOrURL) && checkIsValidURL(clusterWebSocketURL)) {
      httpURL = clusterNameOrURL;
      webSocketURL = clusterWebSocketURL;
    } else {
      throw new Error(
        `Unsupported cluster name (valid options are ${KNOWN_CLUSTER_NAMES_STRING}) or URL: ${clusterNameOrURL}. `,
      );
    }
  }

  const transport = createDefaultRpcTransport({
    url: httpURL,
  });

  // Create an RPC client using that transport.
  const rpc = createSolanaRpcFromTransport(transport);

  const rpcSubscriptions = createSolanaRpcSubscriptions(webSocketURL);
  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  // Let's avoid data types like 'Promise' into the function name
  // we're not using Hungarian notation, this isn't common TS behavior, and it's not necessary to do so
  const getRecentSignatureConfirmation = createRecentSignatureConfirmationPromiseFactory({
    rpc,
    rpcSubscriptions,
  });

  const airdropIfRequired = airdropIfRequiredFactory(rpc, rpcSubscriptions);

  const createWallet = createWalletFactory(airdropIfRequired);

  const getLogs = getLogsFactory(rpc);

  const transferLamports = transferLamportsFactory(rpc);

  const makeTokenMint = makeTokenMintFactory(rpc, sendAndConfirmTransaction);

  return {
    rpc,
    rpcSubscriptions,
    sendAndConfirmTransaction,
    signSendAndConfirmTransaction: signSendAndConfirmTransactionFactory(sendAndConfirmTransaction),
    getBalance: getBalanceFactory(rpc),
    getExplorerLink: getExplorerLinkFactory(clusterNameOrURL),
    airdropIfRequired,
    createWallet,
    getLogs,
    getRecentSignatureConfirmation,
    transferLamports,
    makeTokenMint,
    loadWalletFromFile,
    loadWalletFromEnvironment,
  };
};

export interface Connection {
  // ReturnType<typeof createSolanaRpcFromTransport> doesn't work here - it will be 'any'
  // So I've copied the return type of createSolanaRpcFromTransport manually.
  // See https://stackoverflow.com/questions/79276895/why-does-my-interface-using-returntype-have-any-as-a-type
  // TODO: work out why ReturnType<typeof createSolanaRpcFromTransport> doesn't work here and fix it
  rpc: RpcFromTransport<SolanaRpcApiFromTransport<RpcTransport>, RpcTransport>;
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>;
  signSendAndConfirmTransaction: ReturnType<typeof signSendAndConfirmTransactionFactory>;
  getBalance: ReturnType<typeof getBalanceFactory>;
  getExplorerLink: ReturnType<typeof getExplorerLinkFactory>;
  getRecentSignatureConfirmation: ReturnType<typeof createRecentSignatureConfirmationPromiseFactory>;
  airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>;
  createWallet: ReturnType<typeof createWalletFactory>;
  getLogs: ReturnType<typeof getLogsFactory>;
  transferLamports: ReturnType<typeof transferLamportsFactory>;
  makeTokenMint: ReturnType<typeof makeTokenMintFactory>;
  // We expose these functions under Connection
  // simply because it's borng trying to remember what's a property of connection and what isn't,
  // They don't need to use 'ReturnType' because they're not factory functions
  loadWalletFromFile: typeof loadWalletFromFile;
  loadWalletFromEnvironment: typeof loadWalletFromEnvironment;
}
