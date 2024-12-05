import {
  Address,
  generateKeyPair,
  getAddressFromPublicKey,
  lamports,
  Lamports,
  Rpc,
  // Yes this does both DevNet and TestNet but not Mainnet
  // See web3.js code
  SolanaRpcApi,
} from "@solana/web3.js";
import type { InitializeCryptoKeyPairOptions } from "../types";
import {
  addCryptoKeyPairToEnvFile,
  generateExtractableKeyPair,
  getCryptoKeyPairFromEnvironment,
  getCryptoKeyPairFromFile,
} from "./keypair";
import { SOL } from "./constants";
import { Connection } from "./connect";

const DEFAULT_AIRDROP_AMOUNT = lamports(1n * SOL);
const DEFAULT_MINIMUM_BALANCE = lamports(500_000_000n);
const DEFAULT_ENV_KEYPAIR_VARIABLE_NAME = "PRIVATE_KEY";

// TODO: honestly initializeCryptoKeyPair is a bit vague
// we can probably give this a better name,
// just not sure what yet
export const initializeCryptoKeyPair = async (
  connection: Connection,
  options?: InitializeCryptoKeyPairOptions,
): Promise<CryptoKeyPair> => {
  const {
    keyPairPath,
    envFileName,
    envVariableName = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
    airdropAmount = DEFAULT_AIRDROP_AMOUNT,
    minimumBalance = DEFAULT_MINIMUM_BALANCE,
  } = options || {};

  let keyPair: CryptoKeyPair;

  if (keyPairPath) {
    keyPair = await getCryptoKeyPairFromFile(keyPairPath);
  } else if (process.env[envVariableName]) {
    keyPair = await getCryptoKeyPairFromEnvironment(envVariableName);
  } else {
    // TODO: we should make a temporary keyPair and write it to the environment
    // then reload the one from the environment as non-extractable
    keyPair = await generateExtractableKeyPair();
    await addCryptoKeyPairToEnvFile(keyPair, envVariableName, envFileName);
  }

  const address = await getAddressFromPublicKey(keyPair.publicKey);

  if (airdropAmount) {
    await airdropIfRequired(connection, address, airdropAmount, minimumBalance);
  }

  return keyPair;
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
  console.log("Requesting airdrop for address", address);

  // Note rpc.requestAirdrop is broken, the finalized paramater doesn't do anything.
  // https://github.com/solana-labs/solana-web3.js/issues/3683
  const airdropTransactionSignature = await connection.airdrop({
    commitment: "finalized",
    recipientAddress: address,
    lamports: amount,
  });

  console.log("Airdrop transaction signature", airdropTransactionSignature);

  console.log("Getting balance for address", address);

  const getBalanceResponse = await connection.rpc
    .getBalance(address, { commitment: "finalized" })
    .send();

  console.log("Updated balance for address", address, getBalanceResponse.value);

  return getBalanceResponse.value;
};

export const airdropIfRequired = async (
  connection: Connection,
  address: Address,
  airdropAmount: Lamports,
  minimumBalance: Lamports,
): Promise<Lamports> => {
  const balanceResponse = await connection.rpc
    .getBalance(address, {
      commitment: "finalized",
    })
    .send();
  if (balanceResponse.value < minimumBalance) {
    console.log("Will request airdrop for address", address);
    return requestAndConfirmAirdrop(connection, address, airdropAmount);
  }
  return balanceResponse.value;
};
