import {
  airdropFactory,
  Commitment,
  CompilableTransactionMessage,
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  Signature,
  signTransactionMessageWithSigners,
  TransactionMessageWithBlockhashLifetime,
} from "@solana/web3.js";
import { checkIsValidURL, encodeURL } from "./url";

// Make an object with a map of solana cluster names to subobjects, with the subobjects containing the URL and websocket URL
const CLUSTER_NAME_TO_URLS: Record<
  string,
  { httpURL: string; webSocketURL: string }
> = {
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

// We could modify this to accept a URL instead of a cluster name
// however Explorer has some particular features like mainnet not needing to
// be explicit if it's mainnet-beta, so we'll keep it as a cluster name for now
export const getExplorerLinkFactory = (clusterNameOrURL: string) => {
  const getExplorerLink = (
    linkType: "transaction" | "tx" | "address" | "block",
    id: string,
  ): string => {
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
// Inspire by Quicknode's https://github.com/quiknode-labs/qn-guide-examples/blob/main/solana/web3.js-2.0/helpers/index.ts
export const createSignAndSendTransactionFactory = (
  sendAndConfirmTransaction: ReturnType<
    typeof sendAndConfirmTransactionFactory
  >,
) => {
  const createSignAndSendTransaction = async (
    transactionMessage: CompilableTransactionMessage &
      TransactionMessageWithBlockhashLifetime,
    commitment: Commitment = "processed",
    skipPreflight: boolean = true,
  ): Promise<Signature> => {
    const signedTransaction =
      await signTransactionMessageWithSigners(transactionMessage);
    await sendAndConfirmTransaction(signedTransaction, {
      commitment,
      skipPreflight,
    });
    return getSignatureFromTransaction(signedTransaction);
  };
  return createSignAndSendTransaction;
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
    if (
      checkIsValidURL(clusterNameOrURL) &&
      checkIsValidURL(clusterWebSocketURL)
    ) {
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
  return {
    rpc,
    rpcSubscriptions,
    sendAndConfirmTransaction,
    // See comment above createSignAndSendTransactionFactory
    // createSignAndSendTransaction: createSignAndSendTransactionFactory(
    //   sendAndConfirmTransaction,
    // ),
    getExplorerLink: getExplorerLinkFactory(clusterNameOrURL),
    airdrop: airdropFactory({ rpc, rpcSubscriptions }),
  };
};

export interface Connection {
  rpc: ReturnType<typeof createSolanaRpcFromTransport>;
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  sendAndConfirmTransaction: ReturnType<
    typeof sendAndConfirmTransactionFactory
  >;
  getExplorerLink: ReturnType<typeof getExplorerLinkFactory>;
  airdrop: ReturnType<typeof airdropFactory>;
}
