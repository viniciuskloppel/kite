import { describe, test } from "node:test";
import { airdropIfRequired, confirmTransaction, connect } from "../..";
import { Address, generateKeyPairSigner } from "@solana/web3.js";
import assert from "node:assert";
import { SOL } from "../../lib/constants";

const LOCALHOST = "http://127.0.0.1:8899";

describe("confirmTransaction", () => {
  test("confirmTransaction works for a successful transaction", async () => {
    const connection = connect();
    const [sender, recipient] = await Promise.all([generateKeyPairSigner(), generateKeyPairSigner()]);
    const lamportsToAirdrop = 2n * SOL;
    await connection.airdrop(sender.address, lamportsToAirdrop);

    const signature = await sendAndConfirmTransaction(
      rpc,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1_000_000,
        }),
      ),
      [sender],
    );

    await confirmTransaction(rpc, signature);
  });
});

// describe("getSimulationComputeUnits", () => {
//   test("getSimulationComputeUnits returns 300 CUs for a SOL transfer, and 3888 for a SOL transfer with a memo", async () => {
//     const { rpc, rpcSubscriptions, sendAndConfirmTransaction } = connect();
//     const sender = generateKeyPairSigner();
//     await airdropIfRequired(connection, sender.publicKey, 1 * SOL, 1 * SOL);
//     const recipient = generateKeyPairSigner().publicKey;

//     const sendSol = SystemProgram.transfer({
//       fromPubkey: sender.publicKey,
//       toPubkey: recipient,
//       lamports: 1_000_000,
//     });

//     const sayThanks = new TransactionInstruction({
//       keys: [],
//       programId: MEMO_PROGRAM_ID,
//       data: Buffer.from("thanks"),
//     });

//     const computeUnitsSendSol = await getSimulationComputeUnits(rpc, [sendSol], sender.publicKey, []);

//     // TODO: it would be useful to have a breakdown of exactly how 300 CUs is calculated
//     assert.equal(computeUnitsSendSol, 300);

//     const computeUnitsSendSolAndSayThanks = await getSimulationComputeUnits(
//       rpc,
//       [sendSol, sayThanks],
//       sender.publicKey,
//       [],
//     );

//     // TODO: it would be useful to have a breakdown of exactly how 3888 CUs is calculated
//     // also worth reviewing why memo program seems to use so many CUs.
//     assert.equal(computeUnitsSendSolAndSayThanks, 3888);
//   });
// });
