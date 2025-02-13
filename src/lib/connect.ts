import {
  Address,
  airdropFactory,
  Commitment,
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
  sendAndConfirmTransactionFactory,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  some,
  IInstruction,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
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
  getTransferCheckedInstruction,
  fetchMint,
  getCreateAssociatedTokenInstruction,
} from "@solana-program/token-2022";
import { getTransferSolInstruction } from "@solana-program/system";
import { checkIsValidURL, encodeURL } from "./url";
import { addKeyPairSignerToEnvFile, grindKeyPair, loadWalletFromEnvironment, loadWalletFromFile } from "./keypair";
import {
  SOL,
  KNOWN_CLUSTER_NAMES,
  CLUSTERS,
  KNOWN_CLUSTER_NAMES_STRING,
  TOKEN_EXTENSIONS_PROGRAM,
  TOKEN_PROGRAM,
  DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
  DEFAULT_AIRDROP_AMOUNT,
} from "./constants";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { getComputeUnitEstimate, getPriorityFeeEstimate } from "./smart-transactions";

export const getExplorerLinkFactory = (clusterNameOrURL: string) => {
  const getExplorerLink = (linkType: "transaction" | "tx" | "address" | "block", id: string): string => {
    const searchParams: Record<string, string> = {};
    if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
      const clusterDetails = CLUSTERS[clusterNameOrURL];
      // If they're using Solana Labs mainnet-beta, we don't need to include the cluster name in the Solana Explorer URL
      // because it's the default
      if (!clusterDetails.features.isExplorerDefault) {
        if (clusterDetails.features.isNameKnownToSolanaExplorer) {
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
            if (!clusterDetails.features.isNameKnownToSolanaExplorer) {
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

const sendTransactionFromInstructionsFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  needsPriorityFees: boolean,
  supportsGetPriorityFeeEstimate: boolean,
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>,
) => {
  const sendTransactionFromInstructions = async (
    feePayer: KeyPairSigner,
    instructions: Array<IInstruction>,
    commitment: "confirmed" | "finalized" = "confirmed",
    skipPreflight: boolean = false,
    abortSignal: AbortSignal | null = null,
  ) => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send({ abortSignal });

    let transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (message) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      (message) => setTransactionMessageFeePayerSigner(feePayer, message),
      (message) => appendTransactionMessageInstructions(instructions, message),
    );

    if (needsPriorityFees) {
      const [priorityFeeEstimate, computeUnitEstimate] = await Promise.all([
        getPriorityFeeEstimate(rpc, supportsGetPriorityFeeEstimate, transactionMessage, abortSignal),
        getComputeUnitEstimate(rpc, transactionMessage, abortSignal),
      ]);

      const setComputeUnitPriceInstruction = getSetComputeUnitPriceInstruction({
        microLamports: BigInt(priorityFeeEstimate),
      });

      const setComputeUnitLimitInstruction = getSetComputeUnitLimitInstruction({
        units: Math.ceil(computeUnitEstimate * 1.1),
      });

      transactionMessage = appendTransactionMessageInstructions(
        [setComputeUnitPriceInstruction, setComputeUnitLimitInstruction],
        transactionMessage,
      );
    }

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

    await sendAndConfirmTransaction(signedTransaction, {
      commitment,
      skipPreflight,
    });

    const signature = getSignatureFromTransaction(signedTransaction);

    return signature;
  };
  return sendTransactionFromInstructions;
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
  ): Promise<string | null> => {
    if (airdropAmount < 0n) {
      throw new Error(`Airdrop amount must be a positive number, not ${airdropAmount}`);
    }
    if (minimumBalance === 0n) {
      const signature = await airdrop({
        commitment: "finalized",
        recipientAddress: address,
        lamports: airdropAmount,
      });
      return signature;
    }
    const balance = await getBalance(address, "finalized");

    if (balance >= minimumBalance) {
      return null;
    }
    const signature = await airdrop({
      commitment: "finalized",
      recipientAddress: address,
      lamports: airdropAmount,
    });

    return signature;
  };
  return airdropIfRequired;
};

interface CreateWalletOptions {
  prefix?: string | null;
  suffix?: string | null;
  envFileName?: string | null;
  envVariableName?: string;
  airdropAmount?: Lamports | null;
}

// See https://assets.fengsi.io/pr:sharp/rs:fill:1600:1067:1:1/g:ce/q:80/L2FwaS9qZGxlYXRoZXJnb29kcy9vcmlnaW5hbHMvYjZmNmU2ODAtNzY3OC00MDFiLWE1MzctODg4MWQyMmMzZWIyLmpwZw.jpg
const createWalletFactory = (airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>) => {
  const createWallet = async (options: CreateWalletOptions = {}): Promise<KeyPairSigner> => {
    const {
      prefix = null,
      suffix = null,
      envFileName = null,
      envVariableName = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
      airdropAmount = DEFAULT_AIRDROP_AMOUNT,
    } = options;

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

const createWalletsFactory = (createWallet: ReturnType<typeof createWalletFactory>) => {
  const createWallets = (amount: number, options: CreateWalletOptions = {}): Promise<Array<KeyPairSigner>> => {
    const walletPromises = Array.from({ length: amount }, () => createWallet(options));
    return Promise.all(walletPromises);
  };
  return createWallets;
};

const getLogsFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getLogs = async (signature: string): Promise<readonly string[]> => {
    const transaction = await rpc
      .getTransaction(signature, {
        commitment: "confirmed",
      })
      .send();

    if (!transaction?.meta) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    return transaction.meta.logMessages ?? [];
  };
  return getLogs;
};

const transferLamportsFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  // Adapted from https://solana.com/developers/docs/transactions/examples/transfer-sol-with-web3-js/
  const transferLamports = async (source: KeyPairSigner, destination: Address, amount: Lamports) => {
    const instruction = getTransferSolInstruction({
      amount,
      destination: destination,
      source: source,
    });

    const signature = await sendTransactionFromInstructions(source, [instruction]);

    return signature;
  };
  return transferLamports;
};

const transferTokensFactory = (
  getMint: ReturnType<typeof getMintFactory>,
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  const transferTokens = async (sender: KeyPairSigner, destination: Address, mintAddress: Address, amount: bigint) => {
    const mint = await getMint(mintAddress);

    if (!mint) {
      throw new Error(`Mint not found: ${mintAddress}`);
    }

    const decimals = mint.data.decimals;

    const sourceAssociatedTokenAddress = await getTokenAccountAddress(sender.address, mintAddress, true);

    const destinationAssociatedTokenAddress = await getTokenAccountAddress(destination, mintAddress, true);

    // TODO: check if the destination associated token account exists before sending

    // Create an associated token account for the receiver
    const createAssociatedTokenInstruction = getCreateAssociatedTokenInstruction({
      ata: destinationAssociatedTokenAddress,
      mint: mintAddress,
      owner: destination,
      payer: sender,
    });

    const transferInstruction = getTransferCheckedInstruction({
      source: sourceAssociatedTokenAddress,
      mint: mintAddress,
      destination: destinationAssociatedTokenAddress,
      authority: sender.address,
      amount,
      decimals,
    });

    const signature = await sendTransactionFromInstructions(sender, [
      createAssociatedTokenInstruction,
      transferInstruction,
    ]);

    return signature;
  };
  return transferTokens;
};

const getTokenAccountAddress = async (wallet: Address, mint: Address, useTokenExtensions: boolean = false) => {
  const tokenProgram = useTokenExtensions ? TOKEN_EXTENSIONS_PROGRAM : TOKEN_PROGRAM;

  // Slightly misnamed, it returns an address and a seed
  const [address] = await findAssociatedTokenPda({
    mint: mint,
    owner: wallet,
    tokenProgram,
  });

  return address;
};

const makeTokenMintFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
): ((
  mintAuthority: KeyPairSigner,
  decimals: number,
  name: string,
  symbol: string,
  uri: string,
  additionalMetadata?: Record<string, string> | Map<string, string>,
) => Promise<Address>) => {
  const makeTokenMint = async (
    mintAuthority: KeyPairSigner,
    decimals: number,
    name: string,
    symbol: string,
    uri: string,
    additionalMetadata: Record<string, string> | Map<string, string> = {},
  ) => {
    // See https://solana.stackexchange.com/questions/19747/how-do-i-make-a-token-with-metadata-using-web3-js-version-2/19792#19792 - big thanks to John for helping me turn the unit tests into a working example

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

    // Order of instructions to add to transaction
    const instructions = [
      createAccountInstruction,
      initializeMetadataPointerInstruction,
      initializeMintInstruction,
      initializeTokenMetadataInstruction,
      updateTokenMetadataInstruction,
    ];

    await sendTransactionFromInstructions(mintAuthority, instructions);

    return mint.address;
  };

  return makeTokenMint;
};

const mintTokensFactory = (
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  const mintTokens = async (
    mintAddress: Address,
    mintAuthority: KeyPairSigner,
    amount: bigint,
    destination: Address,
  ) => {
    // Create Associated Token Account
    const createAtaInstruction = await getCreateAssociatedTokenInstructionAsync({
      payer: mintAuthority,
      mint: mintAddress,
      owner: mintAuthority.address,
    });

    // Derive destination associated token address
    // Instruction to mint tokens to associated token account
    const associatedTokenAddress = await getTokenAccountAddress(destination, mintAddress, true);

    const mintToInstruction = getMintToInstruction({
      mint: mintAddress,
      token: associatedTokenAddress,
      mintAuthority: mintAuthority.address,
      amount: amount,
    });

    const transactionSignature = await sendTransactionFromInstructions(mintAuthority, [
      createAtaInstruction,
      mintToInstruction,
    ]);

    return transactionSignature;
  };
  return mintTokens;
};

const getMintFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getMint = async (mintAddress: Address, commitment: Commitment = "confirmed") => {
    const mint = await fetchMint(rpc, mintAddress, { commitment });
    return mint;
  };

  return getMint;
};

export const connect = (
  clusterNameOrURL: string = "localnet",
  clusterWebSocketURL: string | null = null,
): Connection => {
  let httpURL: string | null = null;
  let webSocketURL: string | null = null;
  let supportsGetPriorityFeeEstimate: boolean = false;
  let needsPriorityFees: boolean = false;
  // Postel's law: be liberal in what you accept - so include 'mainnet' as well as 'mainnet-beta'
  if (clusterNameOrURL === "mainnet") {
    clusterNameOrURL = "mainnet-beta";
  }

  if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
    const clusterDetails = CLUSTERS[clusterNameOrURL];

    if (clusterDetails.features.supportsGetPriorityFeeEstimate) {
      supportsGetPriorityFeeEstimate = true;
    }

    if (clusterDetails.features.needsPriorityFees) {
      needsPriorityFees = true;
    }

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

  const sendTransactionFromInstructions = sendTransactionFromInstructionsFactory(
    rpc,
    needsPriorityFees,
    supportsGetPriorityFeeEstimate,
    sendAndConfirmTransaction,
  );

  const transferLamports = transferLamportsFactory(rpc, sendTransactionFromInstructions);

  const makeTokenMint = makeTokenMintFactory(rpc, sendTransactionFromInstructions);

  const getMint = getMintFactory(rpc);

  const transferTokens = transferTokensFactory(getMint, sendTransactionFromInstructions);

  const mintTokens = mintTokensFactory(sendTransactionFromInstructions);

  const createWallets = createWalletsFactory(createWallet);

  return {
    rpc,
    rpcSubscriptions,
    sendAndConfirmTransaction,
    sendTransactionFromInstructions,
    getBalance: getBalanceFactory(rpc),
    getExplorerLink: getExplorerLinkFactory(clusterNameOrURL),
    airdropIfRequired,
    createWallet,
    createWallets,
    getLogs,
    getRecentSignatureConfirmation,
    transferLamports,
    transferTokens,
    makeTokenMint,
    mintTokens,
    getTokenAccountAddress,
    loadWalletFromFile,
    loadWalletFromEnvironment,
    getMint,
  };
};

export interface Connection {
  rpc: ReturnType<typeof createSolanaRpcFromTransport>;
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>;
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>;
  getBalance: ReturnType<typeof getBalanceFactory>;
  getExplorerLink: ReturnType<typeof getExplorerLinkFactory>;
  getRecentSignatureConfirmation: ReturnType<typeof createRecentSignatureConfirmationPromiseFactory>;
  airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>;
  createWallet: ReturnType<typeof createWalletFactory>;
  createWallets: ReturnType<typeof createWalletsFactory>;
  getLogs: ReturnType<typeof getLogsFactory>;
  transferLamports: ReturnType<typeof transferLamportsFactory>;
  makeTokenMint: ReturnType<typeof makeTokenMintFactory>;
  mintTokens: ReturnType<typeof mintTokensFactory>;
  transferTokens: ReturnType<typeof transferTokensFactory>;
  // We expose these functions under Connection
  // simply because it's boring trying to remember what's a property of connection and what isn't,
  // They don't need to use 'ReturnType' because they're not factory functions
  getTokenAccountAddress: typeof getTokenAccountAddress;
  loadWalletFromFile: typeof loadWalletFromFile;
  loadWalletFromEnvironment: typeof loadWalletFromEnvironment;
  getMint: ReturnType<typeof getMintFactory>;
}
