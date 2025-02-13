import {
  appendTransactionMessageInstructions,
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
} from "@solana/web3.js";
import { getComputeUnitEstimate, getPriorityFeeEstimate } from "./smart-transactions";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";

export const sendTransactionFromInstructionsFactory = (
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
