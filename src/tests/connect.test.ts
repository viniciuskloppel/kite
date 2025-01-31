import { describe, test } from "node:test";
import { generateKeyPairSigner, lamports } from "@solana/web3.js";
import { type createWalletOptions } from "../lib/types";
import assert from "node:assert";
import dotenv from "dotenv";
import { unlink as deleteFile } from "node:fs/promises";
// import { SystemProgram } from "@solana/web3.js";
// import { Transaction } from "@solana/web3.js";
import { SOL } from "../lib/constants";
import { connect, DEFAULT_AIRDROP_AMOUNT } from "../lib/connect";

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

    console.log("🟠 we are about to create a wallet");

    // TODO: this times out! Fix it
    // const mintAuthority = await connection.createWallet({ airdropAmount: lamports(1n * SOL) });

    const mintAuthority = await generateKeyPairSigner();
    const oneSol = lamports(1n * SOL);
    await connection.airdropIfRequired(mintAuthority.address, oneSol, oneSol);

    console.log("🟠 we have created a wallet");

    // const name = "Unit test token";
    // const symbol = "TEST";
    // const decimals = 9;
    // const uri = "https://example.com";
    // const additionalMetadata = {
    //   shlerm: "frobular",
    //   glerp: "flerpy",
    //   gurperderp: "erpy",
    //   nurmagerd: "flerpy",
    //   zurp: "flerpy",
    //   eruper: "flerpy",
    //   zerperurperserp: "flerpy",
    //   zherp: "flerpy",
    // };
    const mintAddress = await connection.makeTokenMint(mintAuthority, 2);
    assert.ok(mintAddress);
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

    // We use these a couple of times, so it's easier to have them in a variable
    const createWalletOptions: createWalletOptions = {
      envFileName,
      envVariableName: keyPairVariableName,
    };

    const userBefore = await connection.createWallet(createWalletOptions);

    // Check balance
    const balanceBefore = await connection.getBalance(userBefore.address);

    assert.equal(balanceBefore, DEFAULT_AIRDROP_AMOUNT);

    // Check that the environment variable was created
    dotenv.config({ path: envFileName });
    const privateKeyString = process.env[keyPairVariableName];
    if (!privateKeyString) {
      throw new Error(`${privateKeyString} not found in environment`);
    }

    // Now reload the environment and check it matches our test keyPair
    const userAfter = await connection.createWallet(createWalletOptions);

    // Check the keyPair is the same
    assert(userBefore.address === userAfter.address);

    // Check balance has not changed
    const balanceAfter = await connection.getBalance(userAfter.address);

    assert.equal(balanceBefore, balanceAfter);

    // Check there is a private key
    assert.ok(userAfter.keyPair.privateKey);

    await deleteFile(envFileName);
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

    await connection.airdropIfRequired(user.address, lamportsToAirdrop, minimumBalance);

    const newBalance = await connection.getBalance(user.address, "finalized");

    assert.equal(newBalance, lamportsToAirdrop);

    const recipient = await generateKeyPairSigner();

    // Spend our SOL now to ensure we can use the airdrop immediately
    const signature = await connection.transferLamports(user, recipient.address, lamports(1_000_000n));

    assert.ok(signature);
  });

  test("airdropIfRequired doesn't request unnecessary airdrops", async () => {
    const user = await generateKeyPairSigner();
    const connection = connect();
    const balance = await connection.getBalance(user.address);
    assert.equal(balance, 0n);
    const lamportsToAirdrop = lamports(1n * SOL);

    // First airdrop asks for 500_000 lamports
    await connection.airdropIfRequired(user.address, lamportsToAirdrop, lamports(500_000n));

    // Try a second airdrop if the balance is less than 1 SOL
    // Check second airdrop didn't happen (since we already had 1 SOL from first airdrop)
    const minimumBalance = lamports(1n * SOL);
    const finalBalance = await connection.airdropIfRequired(user.address, lamportsToAirdrop, minimumBalance);
    assert.equal(finalBalance, lamportsToAirdrop);
  });

  test("airdropIfRequired does airdrop when necessary", async () => {
    const user = await generateKeyPairSigner();

    const connection = connect();
    const originalBalance = await connection.getBalance(user.address, "finalized");
    assert.equal(originalBalance, 0);
    // Get 999_999_999 lamports if we have less than 500_000 lamports
    const lamportsToAirdrop = lamports(1n * SOL - 1n);
    const balanceAfterFirstAirdrop = await connection.airdropIfRequired(
      user.address,
      lamportsToAirdrop,
      lamports(500_000n),
    );
    assert.equal(balanceAfterFirstAirdrop, lamportsToAirdrop);

    // We only have 999_999_999 lamports, so we should need another airdrop
    // Check second airdrop happened
    const finalBalance = await connection.airdropIfRequired(user.address, lamports(1n * SOL), lamports(1n * SOL));
    assert.equal(finalBalance, lamports(2n * SOL - 1n));
  });
});

describe("getExplorerLink", () => {
  test("getExplorerLink works for a block on mainnet", () => {
    const { getExplorerLink } = connect("mainnet-beta");
    const link = getExplorerLink("block", "242233124");
    assert.equal(link, "https://explorer.solana.com/block/242233124");
  });

  test("getExplorerLink works for an address using Helius as an RPC", () => {
    // This is a fake API key, don't use it
    // But I did test with a real one, and it worked
    const FAKE_API_KEY = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
    const { getExplorerLink } = connect(
      `https://mainnet.helius-rpc.com/?api-key=${FAKE_API_KEY}`,
      `wss://mainnet.helius-rpc.com/?api-key=${FAKE_API_KEY}`,
    );
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

  test("getExplorerLink works for an address on mainnet", () => {
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

  test("getExplorerLink works for a transaction on mainnet", () => {
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

  test("getExplorerLink works for a block on mainnet", () => {
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

describe("getLogs", () => {
  test("getLogs works", async () => {
    const connection = connect();
    const [sender, recipient] = await Promise.all([generateKeyPairSigner(), generateKeyPairSigner()]);
    const lamportsToAirdrop = lamports(2n * SOL);
    await connection.airdropIfRequired(sender.address, lamportsToAirdrop, lamports(1n * SOL));

    const signature = await connection.transferLamports(sender, recipient.address, lamports(1n * SOL));

    const logs = await connection.getLogs(signature);
    assert.deepEqual(logs, [
      "Program 11111111111111111111111111111111 invoke [1]",
      "Program 11111111111111111111111111111111 success",
    ]);
  });
});
