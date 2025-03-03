import {
  appendTransactionMessageInstructions,
  Commitment,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  FullySignedTransaction,
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
import { DEFAULT_TRANSACTION_RETRIES } from "./constants";

export const sendTransactionFromInstructionsFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  needsPriorityFees: boolean,
  supportsGetPriorityFeeEstimate: boolean,
  enableClientSideRetries: boolean,
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>,
) => {
  /**
   * Sends a transaction containing one or more instructions. The transaction will be signed by the fee payer.
   * @param {Object} params - The transaction parameters
   * @param {KeyPairSigner} params.feePayer - The account that will pay for the transaction
   * @param {Array<IInstruction>} params.instructions - Array of instructions to include in the transaction
   * @param {Commitment} [params.commitment="confirmed"] - Desired confirmation level
   * @param {boolean} [params.skipPreflight=true] - Whether to skip preflight transaction checks
   * @param {number} [params.maximumClientSideRetries=0] - Maximum number of times to retry sending the transaction
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to abort the transaction
   * @returns {Promise<string>} Transaction signature
   */
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

    return signature;
  };
  return sendTransactionFromInstructions;
};
