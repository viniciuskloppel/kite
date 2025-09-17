import { KNOWN_CLUSTER_NAMES, CLUSTERS } from "./clusters";
import { getClusterDetailsFromClusterConfig } from "./connect";
import { checkIsValidURL, encodeURL } from "./url";

export const getExplorerLinkFactory = (clusterNameOrURL: string) => {
  /**
   * Gets a link to view an address, transaction, or block on Solana Explorer.
   * The link will automatically use the current RPC configuration.
   * @param {("transaction" | "tx" | "address" | "block")} linkType - Type of entity to link to
   * @param {string} id - The address, signature, or block to link to
   * @returns {string} The complete Solana Explorer URL
   */
  const getExplorerLink = (linkType: "transaction" | "tx" | "address" | "block", id: string): string => {
    const searchParams: Record<string, string> = {};
    if (KNOWN_CLUSTER_NAMES.includes(clusterNameOrURL)) {
      const clusterConfig = CLUSTERS[clusterNameOrURL];
      const clusterDetails = getClusterDetailsFromClusterConfig(clusterNameOrURL, clusterConfig);
      // If they're using Solana Labs mainnet-beta, we don't need to include the cluster name in the Solana Explorer URL
      // because it's the default
      if (!clusterDetails.features.isExplorerDefault) {
        if (clusterDetails.features.isNameKnownToSolanaExplorer) {
          searchParams["cluster"] = clusterNameOrURL;
        } else {
          searchParams["cluster"] = "custom";
        }
        // Only set customUrl if the cluster is not known to Solana Explorer
        // We don't have to set searchParams["customUrl"] for localnet - Explorer will connect to localnet by default when the cluster is custom
        if (!clusterDetails.features.isNameKnownToSolanaExplorer && clusterNameOrURL !== "localnet") {
          searchParams["customUrl"] = clusterDetails.httpURL;
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
