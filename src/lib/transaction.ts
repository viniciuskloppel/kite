import {
  appendTransactionMessageInstructions,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  getSignatureFromTransaction,
  IInstruction,
  KeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/web3.js";

export const sendAndConfirmSimpleTransaction = async (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  feePayer: KeyPairSigner,
  instructions: Array<IInstruction>,
) => {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

  await rpc.sendAndConfirmTransaction(signedTransaction, {
    commitment: "confirmed",
    skipPreflight: true,
  });

  const signature = getSignatureFromTransaction(signedTransaction);

  return signature;
};
