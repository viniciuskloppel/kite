import { describe, test } from "node:test";
import { generateKeyPairSigner, lamports } from "@solana/web3.js";
import assert from "node:assert";
import dotenv from "dotenv";
import { unlink as deleteFile } from "node:fs/promises";
import { SOL } from "../lib/constants";
import { connect, DEFAULT_AIRDROP_AMOUNT } from "../lib/connect";

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

describe("makeTokenMint", () => {
  test("makeTokenMint makes a new mint with the specified metadata", async () => {
    const connection = connect();

    const oneSol = lamports(1n * SOL);

    const mintAuthority = await connection.createWallet();

    await connection.airdropIfRequired(mintAuthority.address, oneSol, oneSol);

    const name = "Unit test token";
    const symbol = "TEST";
    const decimals = 9;
    const uri = "https://example.com";
    const additionalMetadata = {
      keyOne: "valueOne",
      keyTwo: "valueTwo",
    };
    const transactionSignature = await connection.makeTokenMint(
      mintAuthority,
      decimals,
      name,
      symbol,
      uri,
      additionalMetadata,
    );

    assert.ok(transactionSignature);

    // TODO: get the token metadata for the mint at transactionSignature
    // this code is web3.js version 1
    // const tokenMetadata = await getTokenMetadata(rpc, mintAddress);
    // if (!tokenMetadata) {
    //   throw new Error(`Token metadata not found for mint address ${mintAddress}`);
    // }
    // assert.equal(tokenMetadata.mint.toBase58(), mintAddress.toBase58());
    // // TODO was toBase58 but that doesn't exist on addresses
    // assert.equal(tokenMetadata.updateAuthority?.toBase58(), mintAuthority.address.toString());
    // assert.equal(tokenMetadata.name, name);
    // assert.equal(tokenMetadata.symbol, symbol);
    // assert.equal(tokenMetadata.uri, uri);
    // assert.deepEqual(tokenMetadata.additionalMetadata, Object.entries(additionalMetadata));
  });
});

describe("createWallet", () => {
  const connection = connect();
  const keyPairVariableName = "INITIALIZE_KEYPAIR_TEST";

  test("createWallet generates a new keyPair with a SOL balance", async () => {
    // Use a specific file name to avoid conflicts with other tests
    const envFileName = "../.env-unittest-create-wallet";

    const walletBefore = await connection.createWallet(
      null, // prefix
      null, // suffix
      envFileName,
      keyPairVariableName,
      DEFAULT_AIRDROP_AMOUNT,
    );

    // Check balance
    const balanceBefore = await connection.getBalance(walletBefore.address);

    assert.equal(balanceBefore, DEFAULT_AIRDROP_AMOUNT);

    // Check that the environment variable was created
    dotenv.config({ path: envFileName });
    const privateKeyString = process.env[keyPairVariableName];
    if (!privateKeyString) {
      throw new Error(`${privateKeyString} not found in environment`);
    }

    // Now reload the environment and check it matches our test keyPair
    const walletAfter = await connection.loadWalletFromEnvironment(keyPairVariableName);

    // Check the keyPair is the same
    assert(walletBefore.address === walletAfter.address);

    // Check balance has not changed
    const balanceAfter = await connection.getBalance(walletAfter.address);

    assert.equal(balanceBefore, balanceAfter);

    // Check there is a private key
    assert.ok(walletAfter.keyPair.privateKey);

    await deleteFile(envFileName);
  });

  describe("with prefix and suffix", () => {
    test("creates a wallet with a prefix", async () => {
      const prefix = "BE";
      const wallet = await connection.createWallet(prefix);

      assert.match(wallet.address, new RegExp(`^${prefix}`));
      assert.ok(wallet.keyPair.privateKey);
      assert.ok(wallet.address);
    });

    test("creates a wallet with a suffix", async () => {
      const suffix = "EN";
      const wallet = await connection.createWallet(null, suffix);

      assert.match(wallet.address, new RegExp(`${suffix}$`));
      assert.ok(wallet.keyPair.privateKey);
      assert.ok(wallet.address);
    });

    test("creates a wallet with both prefix and suffix", async () => {
      // See https://open.spotify.com/track/6kV5VZhLN5yVUXs1Qq40Lw?si=a73e329c7cb24404
      const prefix = "B";
      const suffix = "E";
      const wallet = await connection.createWallet(prefix, suffix);

      assert.match(wallet.address, new RegExp(`^${prefix}`));
      assert.match(wallet.address, new RegExp(`${suffix}$`));
      assert.ok(wallet.keyPair.privateKey);
    });

    test("throws error for invalid prefix characters", async () => {
      const prefix = "TEST!";

      await assert.rejects(async () => await connection.createWallet(prefix), {
        message: "Prefix must contain only base58 characters.",
      });
    });

    test("throws error for invalid suffix characters", async () => {
      const suffix = "@END";

      await assert.rejects(async () => await connection.createWallet(null, suffix), {
        message: "Suffix must contain only base58 characters.",
      });
    });
  });
});

describe("airdropIfRequired", () => {
  test("Checking the balance after airdropIfRequired", async () => {
    const connection = connect();
    const user = await generateKeyPairSigner();

    const originalBalance = await connection.getBalance(user.address, "finalized");

    assert.equal(originalBalance, 0);
    const lamportsToAirdrop = lamports(1n * SOL);

    const minimumBalance = lamports(1n * SOL);

    const signature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, minimumBalance);
    assert.ok(signature, "Expected airdrop signature when balance is 0");

    const newBalance = await connection.getBalance(user.address, "finalized");

    assert.equal(newBalance, lamportsToAirdrop);

    const recipient = await generateKeyPairSigner();

    // Spend our SOL now to ensure we can use the airdrop immediately
    const transferSignature = await connection.transferLamports(user, recipient.address, lamports(1_000_000n));

    assert.ok(transferSignature);
  });

  test("airdropIfRequired doesn't request unnecessary airdrops", async () => {
    const user = await generateKeyPairSigner();
    const connection = connect();
    const balance = await connection.getBalance(user.address);
    assert.equal(balance, 0n);
    const lamportsToAirdrop = lamports(1n * SOL);

    // First airdrop asks for 500_000 lamports
    const firstSignature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, lamports(500_000n));
    assert.ok(firstSignature, "Expected signature from first airdrop");

    // Try a second airdrop if the balance is less than 1 SOL
    // Check second airdrop didn't happen (since we already had 1 SOL from first airdrop)
    const minimumBalance = lamports(1n * SOL);
    const secondSignature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, minimumBalance);
    assert.equal(secondSignature, null, "Expected no signature when balance is sufficient");

    const finalBalance = await connection.getBalance(user.address);
    assert.equal(finalBalance, lamportsToAirdrop);
  });

  test("airdropIfRequired does airdrop when necessary", async () => {
    const user = await generateKeyPairSigner();

    const connection = connect();
    const originalBalance = await connection.getBalance(user.address, "finalized");
    assert.equal(originalBalance, 0);
    // Get 999_999_999 lamports if we have less than 500_000 lamports
    const lamportsToAirdrop = lamports(1n * SOL - 1n);
    const firstSignature = await connection.airdropIfRequired(user.address, lamportsToAirdrop, lamports(500_000n));
    assert.ok(firstSignature, "Expected signature from first airdrop");

    const balanceAfterFirstAirdrop = await connection.getBalance(user.address);
    assert.equal(balanceAfterFirstAirdrop, lamportsToAirdrop);

    // We only have 999_999_999 lamports, so we should need another airdrop
    // Check second airdrop happened
    const secondSignature = await connection.airdropIfRequired(user.address, lamports(1n * SOL), lamports(1n * SOL));
    assert.ok(secondSignature, "Expected signature from second airdrop");

    const finalBalance = await connection.getBalance(user.address);
    assert.equal(finalBalance, lamports(2n * SOL - 1n));
  });
});

describe("getExplorerLink", () => {
  test("getExplorerLink works for a block on mainnet", () => {
    const { getExplorerLink } = connect("mainnet-beta");
    const link = getExplorerLink("block", "242233124");
    assert.equal(link, "https://explorer.solana.com/block/242233124");
  });

  test("getExplorerLink works for an address using helius-mainnet", () => {
    // This is a fake API key, don't use it
    // But I did test with a real one, and it worked, and you can test it yourself
    // by visiting the URL and replacing the API key with your own

    const FAKE_API_KEY = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
    process.env.HELIUS_API_KEY = FAKE_API_KEY;
    const { getExplorerLink } = connect("helius-mainnet");
    const link = getExplorerLink("address", "11111111111111111111111111111111");

    assert.equal(
      link,
      `https://explorer.solana.com/address/11111111111111111111111111111111?cluster=custom&customUrl=https%3A%2F%2Fmainnet.helius-rpc.com%2F%3Fapi-key%3D${FAKE_API_KEY}`,
    );
  });

  test("getExplorerLink works for an address on localnet when no network is supplied", () => {
    const { getExplorerLink } = connect();
    const link = getExplorerLink("address", "11111111111111111111111111111111");
    assert.equal(link, "https://explorer.solana.com/address/11111111111111111111111111111111?cluster=custom");
  });

  test("getExplorerLink works for an address on mainnet-beta", () => {
    const { getExplorerLink } = connect("mainnet-beta");
    const link = getExplorerLink("address", "dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");
    assert.equal(link, "https://explorer.solana.com/address/dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");
  });

  test("getExplorerLink works for an address on devnet", () => {
    const { getExplorerLink } = connect("devnet");
    const link = getExplorerLink("address", "dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8");
    assert.equal(
      link,
      "https://explorer.solana.com/address/dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8?cluster=devnet",
    );
  });

  test("getExplorerLink works for a transaction on mainnet-beta", () => {
    const { getExplorerLink } = connect("mainnet-beta");
    const link = getExplorerLink(
      "transaction",
      "4nzNU7YxPtPsVzeg16oaZvLz4jMPtbAzavDfEFmemHNv93iYXKKYAaqBJzFCwEVxiULqTYYrbjPwQnA1d9ZCTELg",
    );
    assert.equal(
      link,
      "https://explorer.solana.com/tx/4nzNU7YxPtPsVzeg16oaZvLz4jMPtbAzavDfEFmemHNv93iYXKKYAaqBJzFCwEVxiULqTYYrbjPwQnA1d9ZCTELg",
    );
  });

  test("getExplorerLink works for a block on mainnet-beta", () => {
    const { getExplorerLink } = connect("mainnet-beta");
    const link = getExplorerLink("block", "241889720");
    assert.equal(link, "https://explorer.solana.com/block/241889720");
  });

  test("getExplorerLink provides a localnet URL", () => {
    const { getExplorerLink } = connect("localnet");
    const link = getExplorerLink(
      "tx",
      "2QC8BkDVZgaPHUXG9HuPw7aE5d6kN5DTRXLe2inT1NzurkYTCFhraSEo883CPNe18BZ2peJC1x1nojZ5Jmhs94pL",
    );
    assert.equal(
      link,
      "https://explorer.solana.com/tx/2QC8BkDVZgaPHUXG9HuPw7aE5d6kN5DTRXLe2inT1NzurkYTCFhraSEo883CPNe18BZ2peJC1x1nojZ5Jmhs94pL?cluster=custom",
    );
  });
});

// TODO: this is debugging some test oddness on GitHub Actions
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
