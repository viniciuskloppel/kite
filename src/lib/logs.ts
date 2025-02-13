import { createSolanaRpcFromTransport } from "@solana/web3.js";

export const getLogsFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getLogs = async (signature: string): Promise<readonly Array<string>[]> => {
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
