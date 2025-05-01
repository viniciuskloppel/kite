import {
  appendTransactionMessageInstructions,
  Commitment,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  getSignatureFromTransaction,
  IInstruction,
  KeyPairSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getComputeUnitEstimate, getPriorityFeeEstimate, sendTransactionWithRetries } from "./smart-transactions";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { DEFAULT_TRANSACTION_RETRIES, NOT_FOUND } from "./constants";

export interface ErrorWithTransaction extends Error {
  // We add this ourselves, so users can see logs etc
  transaction: Awaited<ReturnType<ReturnType<typeof createSolanaRpcFromTransport>["getTransaction"]>>;
  // This is added by @solana/kit
  context: {
    __code: number;
    code: number;
    index: number;
  };
}

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

export const sendTransactionFromInstructionsFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  needsPriorityFees: boolean,
  supportsGetPriorityFeeEstimate: boolean,
  enableClientSideRetries: boolean,
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>,
) => {
  const sendTransactionFromInstructions = async ({
    feePayer,
    instructions,
    commitment = "confirmed",
    skipPreflight = true,
    maximumClientSideRetries = enableClientSideRetries ? DEFAULT_TRANSACTION_RETRIES : 0,
    abortSignal = null,
  }: {
    feePayer: KeyPairSigner;
    instructions: Array<IInstruction>;
    commitment?: Commitment;
    skipPreflight?: boolean;
    maximumClientSideRetries?: number;
    abortSignal?: AbortSignal | null;
  }) => {
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

    const signature = getSignatureFromTransaction(signedTransaction);

    try {
      if (maximumClientSideRetries) {
        await sendTransactionWithRetries(sendAndConfirmTransaction, signedTransaction, {
          maximumClientSideRetries,
          abortSignal,
          commitment,
        });
      } else {
        await sendAndConfirmTransaction(signedTransaction, {
          commitment,
          skipPreflight,
        });
      }
    } catch (thrownObject) {
      const error = thrownObject as ErrorWithTransaction;

      const transaction = await rpc
        .getTransaction(signature, {
          commitment,
          maxSupportedTransactionVersion: 0,
        })
        .send();

      error.transaction = transaction;

      // If we have a custom program error, try to find a better error message in the logs
      // TODO: honestly this should be fixed upstream in @solana/kit
      if (error.message.includes("custom program error") && transaction.meta?.logMessages) {
        const betterMessage = getErrorMessageFromLogs(transaction.meta.logMessages);
        if (betterMessage) {
          error.message = betterMessage;
        }
      }

      throw error;
    }

    return signature;
  };
  return sendTransactionFromInstructions;
};
