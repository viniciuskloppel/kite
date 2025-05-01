import { createSolanaRpcFromTransport } from "@solana/kit";
import { NOT_FOUND } from "./constants";

export const getLogsFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Retrieves logs for a transaction.
   * @param {string} signature - Transaction signature to get logs for
   * @returns {Promise<Array<string>>} Array of log messages from the transaction
   */
  const getLogs = async (signature: string): Promise<Array<string>> => {
    const transaction = await rpc
      .getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      })
      .send();

    if (!transaction?.meta) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    return transaction.meta.logMessages ?? [];
  };
  return getLogs;
};

/**
 * Extracts a user-friendly error message from transaction logs.
 * Looks for the pattern:
 * "Program <program> invoke [n]"
 * "Program log: Instruction: <instruction>"
 * "Program log: Error: <error>"
 *
 * @param logMessages Array of log messages from the transaction
 * @returns A formatted error message or null if no error found
 */
export const getErrorMessageFromLogs = (logMessages: Array<string>): string | null => {
  const errorIndex = logMessages.findIndex((logMessage: string) => logMessage.includes("Program log: Error: "));

  if (errorIndex === NOT_FOUND) {
    return null;
  }

  // Get the program name from the invoke log (usually 2 lines before the error)
  const programInvokeLog = logMessages[errorIndex - 2];
  const programName = programInvokeLog?.split("Program ")[1]?.split(" invoke")[0];

  // Get the instruction name from the instruction log (usually 1 line before the error)
  const instructionHandlerLog = logMessages[errorIndex - 1];
  const instructionHandlerName = instructionHandlerLog?.split("Instruction: ")[1];

  // Get the error message
  const errorMessage = logMessages[errorIndex].split("Program log: Error: ")[1]?.trim();

  if (!errorMessage || !programName || !instructionHandlerName) {
    return null;
  }

  return `${programName}.${instructionHandlerName}: ${errorMessage}`;
};
