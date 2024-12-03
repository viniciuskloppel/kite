// Example
// Transfer Lamports from one account to another with @solana/web3.js.

// Before running any of the examples in this monorepo, make sure to set up a test validator by
// running `pnpm test:live-with-test-validator:setup` in the root directory.

// To run this example, execute `pnpm start` in this directory.

import {
  Address,
  appendTransactionMessageInstruction,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  KeyPairSigner,
  Lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/web3.js";
import { getTransferSolInstruction } from "@solana-program/system";

interface Connection {
  rpc: ReturnType<typeof createSolanaRpc>;
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  sendAndConfirmTransaction: ReturnType<
    typeof sendAndConfirmTransactionFactory
  >;
}

export const transferLamports = async (
  connection: Connection,
  source: KeyPairSigner<string>,
  destination: Address,
  amount: Lamports,
) => {
  // Setup: transaction lifetime
  // Every transaction needs to specify a valid lifetime for it to be accepted for execution on the
  // network. For this transaction, we will fetch the latest block's hash as proof that this
  // transaction was prepared close in time to when we tried to execute it. The network will accept
  // transactions which include this hash until it progresses past the block specified as
  // `latestBlockhash.lastValidBlockHeight`.
  //  *
  // Tip: It is desirable for your program to fetch this block hash as late as possible before signing
  // and sending the transaction so as to ensure that it's as 'fresh' as possible.

  const { value: latestBlockhash } = await connection.rpc
    .getLatestBlockhash()
    .send();

  // Step 1: create the transfer transaction

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (transaction) => {
      return setTransactionMessageFeePayer(source.address, transaction);
    },
    (transaction) => {
      return setTransactionMessageLifetimeUsingBlockhash(
        latestBlockhash,
        transaction,
      );
    },
    (transaction) => {
      const instruction = getTransferSolInstruction({
        amount,
        destination: destination,
        source: source,
      });
      return appendTransactionMessageInstruction(instruction, transaction);
    },
  );

  // Step 2: sign the transaction
  // In order to prove that the owner of the account from which the tokens are being transferred
  // approves of the transfer itself, the transaction will need to include a cryptographic signature
  // that only the owner of that account could produce. We have already loaded the account owner's
  // key pair above, so we can sign the transaction now.

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  // Step 3: send and confirm the transaction
  // Now that the transaction is signed, we send it to an RPC. The RPC will relay it to the Solana
  // network for execution. The `sendAndConfirmTransaction` method will resolve when the transaction
  // is reported to have been confirmed. It will reject in the event of an error (eg. a failure to
  // simulate the transaction), or may timeout if the transaction lifetime is thought to have expired
  // (eg. the network has progressed past the `lastValidBlockHeight` of the transaction's blockhash
  // lifetime constraint).

  await connection.sendAndConfirmTransaction(signedTransaction, {
    commitment: "confirmed",
  });

  const signature = getSignatureFromTransaction(signedTransaction);

  return signature;
};
