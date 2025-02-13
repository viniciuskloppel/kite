import {
  appendTransactionMessageInstructions,
  Commitment,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  FullySignedTransaction,
  getSignatureFromTransaction,
  IInstruction,
  isSolanaError,
  KeyPairSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED,
  TransactionWithBlockhashLifetime,
} from "@solana/web3.js";
import { getComputeUnitEstimate, getPriorityFeeEstimate, sendTransactionWithRetries } from "./smart-transactions";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { DEFAULT_TRANSACTION_RETRIES } from "./constants";

interface SendTransactionFromInstructionsOptions {
  feePayer: KeyPairSigner;
  instructions: Array<IInstruction>;
  commitment?: Commitment;
  skipPreflight?: boolean;
  maximumClientSideRetries?: number;
  abortSignal?: AbortSignal | null;
}

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
  }: SendTransactionFromInstructionsOptions) => {
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
