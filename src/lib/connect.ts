import {
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  sendAndConfirmTransactionFactory,
} from "@solana/web3.js";
import { createRecentSignatureConfirmationPromiseFactory } from "@solana/transaction-confirmation";

import { checkIsValidURL, encodeURL } from "./url";
import { loadWalletFromEnvironment, loadWalletFromFile } from "./keypair";
import { KNOWN_CLUSTER_NAMES, CLUSTERS, KNOWN_CLUSTER_NAMES_STRING } from "./constants";

import { sendTransactionFromInstructionsFactory } from "./transactions";
import { createWalletFactory, createWalletsFactory } from "./wallets";
import {
  getMintFactory,
  getTokenAccountAddress,
  createTokenMintFactory,
  mintTokensFactory,
  transferLamportsFactory,
  transferTokensFactory,
} from "./tokens";
import { getLogsFactory } from "./logs";
import { getExplorerLinkFactory } from "./explorer";
import { airdropIfRequiredFactory, getLamportBalanceFactory } from "./sol";

export const connect = (
  clusterNameOrURL: string = "localnet",
  clusterWebSocketURL: string | null = null,
): Connection => {
  let httpURL: string | null = null;
  let webSocketURL: string | null = null;
  let supportsGetPriorityFeeEstimate: boolean = false;
  let needsPriorityFees: boolean = false;
  let enableClientSideRetries: boolean = false;
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

    enableClientSideRetries = clusterDetails.features.enableClientSideRetries;

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

  const createWallets = createWalletsFactory(createWallet);

  const getLogs = getLogsFactory(rpc);

  const sendTransactionFromInstructions = sendTransactionFromInstructionsFactory(
    rpc,
    needsPriorityFees,
    supportsGetPriorityFeeEstimate,
    enableClientSideRetries,
    sendAndConfirmTransaction,
  );

  const transferLamports = transferLamportsFactory(sendTransactionFromInstructions);

  const createTokenMint = createTokenMintFactory(rpc, sendTransactionFromInstructions);

  const getMint = getMintFactory(rpc);

  const transferTokens = transferTokensFactory(getMint, sendTransactionFromInstructions);

  const mintTokens = mintTokensFactory(sendTransactionFromInstructions);

  return {
    rpc,
    rpcSubscriptions,
    sendAndConfirmTransaction,
    sendTransactionFromInstructions,
    getLamportBalance: getLamportBalanceFactory(rpc),
    getExplorerLink: getExplorerLinkFactory(clusterNameOrURL),
    airdropIfRequired,
    createWallet,
    createWallets,
    getLogs,
    getRecentSignatureConfirmation,
    transferLamports,
    transferTokens,
    createTokenMint,
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
  getLamportBalance: ReturnType<typeof getLamportBalanceFactory>;
  getExplorerLink: ReturnType<typeof getExplorerLinkFactory>;
  getRecentSignatureConfirmation: ReturnType<typeof createRecentSignatureConfirmationPromiseFactory>;
  airdropIfRequired: ReturnType<typeof airdropIfRequiredFactory>;
  createWallet: ReturnType<typeof createWalletFactory>;
  createWallets: ReturnType<typeof createWalletsFactory>;
  getLogs: ReturnType<typeof getLogsFactory>;
  transferLamports: ReturnType<typeof transferLamportsFactory>;
  createTokenMint: ReturnType<typeof createTokenMintFactory>;
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
