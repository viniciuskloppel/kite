import { describe, test } from "node:test";
import {
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSignerFromKeyPair,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  executeRpcPubSubSubscriptionPlan,
  generateKeyPair,
  generateKeyPairSigner,
  getAddressFromPublicKey,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/web3.js";
import {
  airdropIfRequired,
  initializeCryptoKeyPair,
  transferLamports,
  type InitializeCryptoKeyPairOptions,
} from "../../src";
import assert from "node:assert";
import dotenv from "dotenv";
import { unlink as deleteFile } from "node:fs/promises";
// import { SystemProgram } from "@solana/web3.js";
// import { Transaction } from "@solana/web3.js";
import { SOL } from "../../src/lib/constants";
import { connect } from "../../src/lib/connect";
import { getTransferSolInstruction } from "@solana-program/system";
import { log, stringify } from "../../src/lib/utils";

const LOCALHOST = "http://127.0.0.1:8899";

// describe("initializeCryptoKeyPair", () => {
//   const { rpc, rpcSubscriptions, sendAndConfirmTransaction } = connect();
//   const keyPairVariableName = "INITIALIZE_KEYPAIR_TEST";

//   test("generates a new keyPair and airdrops needed amount", async () => {
//     // We need to use a specific file name to avoid conflicts with other tests
//     const envFileName = "../.env-unittest-initialize-crypto-keyPair";

//     const initializeCryptoKeyPairOptions: InitializeCryptoKeyPairOptions = {
//       envFileName,
//       envVariableName: keyPairVariableName,
//     };

//     const userBefore = await initializeCryptoKeyPair(
//       rpc,
//       initializeCryptoKeyPairOptions,
//     );

//     const addressBefore = await getAddressFromPublicKey(userBefore.publicKey);

//     // Check balance
//     const balanceBeforeResponse = await getBalance(addressBefore).send();

//     assert.ok(balanceBeforeResponse.value > 0);

//     // Check that the environment variable was created
//     dotenv.config({ path: envFileName });
//     const privateKeyString = process.env[keyPairVariableName];
//     if (!privateKeyString) {
//       throw new Error(`${privateKeyString} not found in environment`);
//     }

//     // Now reload the environment and check it matches our test keyPair
//     const userAfter = await initializeCryptoKeyPair(
//       rpc,
//       initializeCryptoKeyPairOptions,
//     );

//     const addressAfter = await getAddressFromPublicKey(userAfter.publicKey);

//     // Check the keyPair is the same
//     assert(addressBefore === addressAfter);

//     // Check balance has not changed
//     const balanceAfterResponse = await getBalance(addressAfter).send();

//     assert.equal(balanceBeforeResponse.value, balanceAfterResponse.value);

//     // Check there is a secret key
//     assert.ok(userAfter.privateKey);

//     await deleteFile(envFileName);
//   });
// });

describe("airdropIfRequired", () => {
  test("Checking the balance after airdropIfRequired", async () => {
    const connection = connect();
    const user = await generateKeyPairSigner();

    const originalBalanceResponse = await connection.rpc.getBalance(user.address).send();

    assert.equal(originalBalanceResponse.value, 0);
    const lamportsToAirdrop = lamports(1n * SOL);

    const minimumBalance = lamports(1n * SOL);

    await airdropIfRequired(connection, user.address, lamportsToAirdrop, minimumBalance);

    const getBalanceResponse = await connection.rpc.getBalance(user.address, { commitment: "finalized" }).send();

    const newBalance = getBalanceResponse.value;

    assert.equal(newBalance, lamportsToAirdrop);

    const recipient = await generateKeyPairSigner();

    // Spend our SOL now to ensure we can use the airdrop immediately
    const signature = await transferLamports(connection, user, recipient.address, lamports(1_000_000n));

    assert.ok(signature);
  });

  test("doesn't request unnecessary airdrops", async () => {
    const user = await generateKeyPairSigner();
    const connection = connect();
    const balance = await connection.getBalance(user.address);
    assert.equal(balance, 0n);
    const lamportsToAirdrop = lamports(1n * SOL);

    // First airdrop asks for 500_000 lamports
    await airdropIfRequired(connection.rpc, user.address, lamportsToAirdrop, lamports(500_000n));

    // Try a second airdrop if the balance is less than 1 SOL
    // Check second airdrop didn't happen (since we already had 1 SOL from first airdrop)
    const minimumBalance = lamports(1n * SOL);
    const finalBalance = await airdropIfRequired(connection, user.address, lamportsToAirdrop, minimumBalance);
    assert.equal(finalBalance, lamportsToAirdrop);
  });

  test("airdropIfRequired does airdrop when necessary", async () => {
    const user = await generateKeyPairSigner();

    const connection = connect();
    const originalBalance = await connection.getBalance(user.address, "finalized");
    assert.equal(originalBalance, 0);
    // Get 999_999_999 lamports if we have less than 500_000 lamports
    const lamportsToAirdrop = lamports(1n * SOL - 1n);
    const balanceAfterFirstAirdrop = await airdropIfRequired(
      connection,
      user.address,
      lamportsToAirdrop,
      lamports(500_000n),
    );
    assert.equal(balanceAfterFirstAirdrop, lamportsToAirdrop);

    // We only have 999_999_999 lamports, so we should need another airdrop
    // Check second airdrop happened
    const finalBalance = await airdropIfRequired(connection, user.address, lamports(1n * SOL), lamports(1n * SOL));
    assert.equal(finalBalance, lamports(2n * SOL - 1n));
  });
});
