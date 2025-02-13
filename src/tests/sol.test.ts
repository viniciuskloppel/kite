import { before, describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "..";
import { generateKeyPairSigner, lamports } from "@solana/web3.js";
import { SOL } from "../lib/constants";

describe("getBalance", () => {
  test("getBalance returns 0 for a new account", async () => {
    const keypairSigner = await generateKeyPairSigner();
    const connection = connect();
    const balance = await connection.getBalance(keypairSigner.address, "finalized");
    assert.equal(balance, 0n);
  });

  test("getBalance returns 1 SOL after 1 SOL is airdropped", async () => {
    const keypairSigner = await generateKeyPairSigner();
    const connection = connect();
    await connection.airdropIfRequired(keypairSigner.address, lamports(1n * SOL), lamports(1n * SOL));
    const balance = await connection.getBalance(keypairSigner.address, "finalized");
    assert.equal(balance, lamports(1n * SOL));
  });
});
