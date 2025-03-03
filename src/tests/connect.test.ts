import { before, describe, test } from "node:test";
import assert from "node:assert";
import { address as toAddress, generateKeyPairSigner, lamports, KeyPairSigner, Address } from "@solana/kit";

import dotenv from "dotenv";
import { unlink as deleteFile } from "node:fs/promises";
import { DEFAULT_AIRDROP_AMOUNT, SOL } from "../lib/constants";
import { connect, Connection } from "../lib/connect";

describe("connect", () => {
  test("connect returns a connection object", () => {
    const connection = connect();
    assert.ok(connection);
  });

  test("connect throws an error connecting to a cluster that requires an API key when the API key is not set", () => {
    assert.throws(() => connect("helius-mainnet"), Error);
  });

  test("connect returns a connection object with the correct URLs when two custom URLs are provided", () => {
    const connection = connect("https://mainnet.helius-rpc.com/", "wss://mainnet.helius-rpc.com/");
    assert.ok(connection);
  });

  test("connect returns a connection object when connecting to a cluster that requires an API key when the API key is set", () => {
    process.env.HELIUS_API_KEY = "fake-api-key";
    const connection = connect("helius-mainnet");
    assert.ok(connection);
  });

  test("connect returns a connection object with the correct URLs when a cluster name is provided", () => {
    const connection = connect("mainnet-beta");
  });

  test("connect throws an error when an invalid cluster name is provided", () => {
    assert.throws(() => connect("invalid-cluster-name"), Error);
  });
});

describe("getLogs", () => {
  test("getLogs works", async () => {
    const connection = connect();
    const keyPairSigner = await generateKeyPairSigner();

    const signature = await connection.airdropIfRequired(keyPairSigner.address, lamports(2n * SOL), lamports(1n * SOL));

    // Signature should never be null as we always need an airdrop
    assert.ok(signature);

    const logs = await connection.getLogs(signature);
    assert.deepEqual(logs, [
      "Program 11111111111111111111111111111111 invoke [1]",
      "Program 11111111111111111111111111111111 success",
    ]);
  });
});
