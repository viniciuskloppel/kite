import {
  Address,
  airdropFactory,
  Commitment,
  CompilableTransactionMessage,
  createDefaultRpcTransport,
  createSignerFromKeyPair,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  getSignatureFromTransaction,
  KeyPairSigner,
  lamports,
  Lamports,
  RpcFromTransport,
  RpcTransport,
  sendAndConfirmTransactionFactory,
  Signature,
  signTransactionMessageWithSigners,
  SolanaRpcApiFromTransport,
  TransactionMessageWithBlockhashLifetime,
} from "@solana/web3.js";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

import { checkIsValidURL, encodeURL } from "./url";
import { log, stringify } from "./utils";
import { createWalletOptions } from "./types";
import {
  addKeyPairSignerToEnvFile,
  generateExtractableKeyPair,
  getKeyPairSignerFromEnvironment,
  getKeyPairSignerFromFile,
} from "./keypair";
import { SOL } from "./constants";

export const DEFAULT_AIRDROP_AMOUNT = lamports(1n * SOL);
export const DEFAULT_MINIMUM_BALANCE = lamports(500_000_000n);
export const DEFAULT_ENV_KEYPAIR_VARIABLE_NAME = "PRIVATE_KEY";

// Make an object with a map of solana cluster names to subobjects, with the subobjects containing the URL and websocket URL
const CLUSTER_NAME_TO_URLS: Record<string, { httpURL: string; webSocketURL: string }> = {
  // Postel's law: be liberal in what you accept
  mainnet: {
    httpURL: "https://api.mainnet-beta.solana.com",
    webSocketURL: "wss://api.mainnet-beta.solana.com",
  },
  "mainnet-beta": {
    httpURL: "https://api.mainnet-beta.solana.com",
    webSocketURL: "wss://api.mainnet-beta.solana.com",
  },
  testnet: {
    httpURL: "https://api.testnet.solana.com",
    webSocketURL: "wss://api.testnet.solana.com",
  },
  devnet: {
    httpURL: "https://api.devnet.solana.com",
    webSocketURL: "wss://api.devnet.solana.com",
  },
  localnet: {
    httpURL: "http://localhost:8899",
    webSocketURL: "ws://localhost:8900",
  },
};

const KNOWN_CLUSTER_NAMES = Object.keys(CLUSTER_NAME_TO_URLS);

export const getExplorerLinkFactory = (clusterNameOrURL: string) => {
  const getExplorerLink = (linkType: "transaction" | "tx" | "address" | "block", id: string): string => {
    const searchParams: Record<string, string> = {};
    // Technically it's officially 'mainnet-beta' till Solana gets Firedancer + 1 year 100% availability but we'll accept 'mainnet' too
    if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
      // If they're using mainnet-beta, we don't need to include the cluster name in the Explorer URL
      // because it's the default
      if (["testnet", "devnet"].includes(clusterNameOrURL)) {
        searchParams["cluster"] = clusterNameOrURL;
      }
      // localnet technically isn't a cluster, so requires special handling
      if (clusterNameOrURL === "localnet") {
        searchParams["cluster"] = "custom";
        // We don't have to set searchParams["customUrl"] - Explorer will connect to localhost by default in this case
      }
    } else {
      if (checkIsValidURL(clusterNameOrURL)) {
        searchParams["cluster"] = "custom";
        // searchParams["customUrl"] = encodeURIComponent(clusterNameOrURL);
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

// TODO: work out whetehr we want this
// Inspired by Quicknode's https://github.com/quiknode-labs/qn-guide-examples/blob/main/solana/web3.js-2.0/helpers/index.ts
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
  // Plain 'airdrop' is exported as we don't want to encourage people to
  // request airdrops when they don't need them, ie - don't bother
  // the faucet unless you really need to!
  //
  // Note rpc.requestAirdrop is broken, the finalized paramater doesn't do anything
  // despite the docs repeatedly referring to rpc.requestAirdrop
  // https://github.com/solana-labs/solana-web3.js/issues/3683
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
      const airdropTransactionSignature = await airdrop({
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
    const airdropTransactionSignature = await airdrop({
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
  const createWallet = async (options?: createWalletOptions): Promise<KeyPairSigner> => {
    const {
      keyPairPath,
      envFileName,
      envVariableName = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
      airdropAmount = DEFAULT_AIRDROP_AMOUNT,
      minimumBalance = DEFAULT_MINIMUM_BALANCE,
    } = options || {};

    let keyPairSigner: KeyPairSigner;

    if (keyPairPath) {
      keyPairSigner = await getKeyPairSignerFromFile(keyPairPath);
    } else if (process.env[envVariableName]) {
      keyPairSigner = await getKeyPairSignerFromEnvironment(envVariableName);
    } else {
      // TODO: we should make a temporary keyPair and write it to the environment
      // then reload the one from the environment as non-extractable
      const keyPair = await generateExtractableKeyPair();
      keyPairSigner = await createSignerFromKeyPair(keyPair);
      await addKeyPairSignerToEnvFile(keyPairSigner, envVariableName, envFileName);
    }

    if (airdropAmount) {
      await airdropIfRequired(keyPairSigner.address, airdropAmount, minimumBalance);
    }

    return keyPairSigner;
  };

  return createWallet;
};

export const connect = (
  clusterNameOrURL: string = "localnet",
  clusterWebSocketURL: string | null = null,
): Connection => {
  let httpURL: string | null = null;
  let webSocketURL: string | null = null;
  if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
    const clusterURLS = CLUSTER_NAME_TO_URLS[clusterNameOrURL];
    httpURL = clusterURLS.httpURL;
    webSocketURL = clusterURLS.webSocketURL;
  } else {
    if (!clusterWebSocketURL) {
      throw new Error(`Either provide a valid cluster name or two valid URLs.`);
    }
    if (checkIsValidURL(clusterNameOrURL) && checkIsValidURL(clusterWebSocketURL)) {
      httpURL = clusterNameOrURL;
      webSocketURL = clusterWebSocketURL;
    } else {
      throw new Error(`Unsupported cluster name or URL: ${clusterNameOrURL}`);
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

  return {
    rpc,
    rpcSubscriptions,
    sendAndConfirmTransaction,
    signSendAndConfirmTransaction: signSendAndConfirmTransactionFactory(sendAndConfirmTransaction),
    getBalance: getBalanceFactory(rpc),
    getExplorerLink: getExplorerLinkFactory(clusterNameOrURL),
    airdropIfRequired,
    createWallet,
    getRecentSignatureConfirmation,
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
}
