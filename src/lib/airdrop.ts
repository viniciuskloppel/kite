import {
  Address,
  createSignerFromKeyPair,
  generateKeyPair,
  getAddressFromPublicKey,
  KeyPairSigner,
  lamports,
  Lamports,
  Rpc,
  // Yes this does both DevNet and TestNet but not Mainnet
  // See web3.js code
  SolanaRpcApi,
} from "@solana/web3.js";
import type { createKeyPairSignerOptions } from "../types";
import {
  addKeyPairSignerToEnvFile,
  generateExtractableKeyPair,
  getKeyPairSignerFromEnvironment,
  getKeyPairSignerFromFile,
} from "./keypair";
import { SOL } from "./constants";
import { Connection } from "./connect";
import { log, stringify } from "./utils";

export const DEFAULT_AIRDROP_AMOUNT = lamports(1n * SOL);
export const DEFAULT_MINIMUM_BALANCE = lamports(500_000_000n);
export const DEFAULT_ENV_KEYPAIR_VARIABLE_NAME = "PRIVATE_KEY";

// Formerly called initializeKeypair()
// TODO: Should really be part of connection along with other functions
export const createKeyPairSigner = async (
  connection: Connection,
  options?: createKeyPairSignerOptions,
): Promise<KeyPairSigner> => {
  const {
    keyPairPath,
    envFileName,
    envVariableName = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
    airdropAmount = DEFAULT_AIRDROP_AMOUNT,
    minimumBalance = DEFAULT_MINIMUM_BALANCE,
  } = options || {};

  let keyPairSigner: KeyPairSigner;

  if (keyPairPath) {
    keyPairSigner = await getKeyPairSignerFromFile(keyPairPath);
  } else if (process.env[envVariableName]) {
    keyPairSigner = await getKeyPairSignerFromEnvironment(envVariableName);
  } else {
    // TODO: we should make a temporary keyPair and write it to the environment
    // then reload the one from the environment as non-extractable
    const keyPair = await generateExtractableKeyPair();
    keyPairSigner = await createSignerFromKeyPair(keyPair);
    await addKeyPairSignerToEnvFile(keyPairSigner, envVariableName, envFileName);
  }

  if (airdropAmount) {
    await airdropIfRequired(connection, keyPairSigner.address, airdropAmount, minimumBalance);
  }

  return keyPairSigner;
};

// Not exported as we don't want to encourage people to
// request airdrops when they don't need them, ie - don't bother
// the faucet unless you really need to!
const requestAndConfirmAirdrop = async (
  connection: Connection,
  address: Address,
  amount: Lamports,
): Promise<Lamports> => {
  // Wait for airdrop confirmation
  // "finalized" is slow but we must be absolutely sure
  // the airdrop has gone through

  // Note rpc.requestAirdrop is broken, the finalized paramater doesn't do anything.
  // https://github.com/solana-labs/solana-web3.js/issues/3683
  const airdropTransactionSignature = await connection.airdrop({
    commitment: "finalized",
    recipientAddress: address,
    lamports: amount,
  });

  const balance = await connection.getBalance(address, "finalized");

  return balance;
};

export const airdropIfRequired = async (
  connection: Connection,
  address: Address,
  airdropAmount: Lamports,
  minimumBalance: Lamports,
): Promise<Lamports> => {
  const balance = await connection.getBalance(address, "finalized");
  if (balance < minimumBalance) {
    return requestAndConfirmAirdrop(connection, address, airdropAmount);
  }
  return balance;
};
