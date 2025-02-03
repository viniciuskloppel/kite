import { describe, test } from "node:test";
import { generateKeyPair, generateKeyPairSigner, lamports } from "@solana/web3.js";
import { connect, createAccountsMintsAndTokenAccounts, makeTokenMint } from "..";
import { getTokenMetadata } from "@solana/spl-token";
import assert from "node:assert";
import { getDefaultRpc } from "./connect";
import { SOL } from "../lib/constants";

const LOCALHOST = "http://127.0.0.1:8899";

// TODO: this is web3.js version 1
// describe("createAccountsMintsAndTokenAccounts", () => {
//   test("createAccountsMintsAndTokenAccounts works", async () => {
//     const payer = await generateKeyPairSigner();
//     const connection = connect();
//     await airdropIfRequired(connection, payer.address, lamports(100n * SOL), lamports(1n * SOL));

//     const SOL_BALANCE = lamports(BigInt(10n * SOL));

//     const usersMintsAndTokenAccounts = await createAccountsMintsAndTokenAccounts(
//       [
//         [1_000_000_000, 0], // User 0 has 1_000_000_000 of token A and 0 of token B
//         [0, 1_000_000_000], // User 1 has 0 of token A and 1_000_000_000 of token B
//       ],
//       SOL_BALANCE,
//       connection.rpc,
//       payer,
//     );

//     // Check all users have been created and have some SOL
//     const users = usersMintsAndTokenAccounts.users;
//     assert.equal(users.length, 2);
//     await Promise.all(
//       users.map(async (user) => {
//         const balance = await connection.getBalance(user.publicKey);
//         assert(balance === SOL_BALANCE);
//       }),
//     );

//     // Check the mints
//     assert.equal(usersMintsAndTokenAccounts.mints.length, 2);

//     // Check the token accounts
//     const tokenAccounts = usersMintsAndTokenAccounts.tokenAccounts;

//     // Get the balances of the token accounts for the first user
//     // (note there is no tokenAccountB balance yet)
//     const firstUserFirstTokenBalance = await connection.rpc.getTokenAccountBalance(
//       tokenAccounts[0][0], // First user, first token mint
//     );
//     assert(Number(firstUserFirstTokenBalance.value.amount) === 1_000_000_000);

//     // // Get the balances of the token accounts for the second user
//     // // (note there is no tokenAccountA account yet)
//     const secondUserSecondTokenBalance = await connection.rpc.getTokenAccountBalance(tokenAccounts[1][1]); // Second user, second token mint
//     assert(Number(secondUserSecondTokenBalance.value.amount) === 1_000_000_000);
//   });
// });
