import {
  airdropFactory,
  createDefaultRpcTransport,
  createSolanaRpc,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  generateKeyPair,
  getAddressFromPublicKey,
  lamports,
} from "@solana/web3.js";

const user = await generateKeyPairSigner();

const SOL = 1_000_000_000n;

const rpc = createSolanaRpc("http://localhost:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions("ws://localhost:8900");
const airdrop = airdropFactory({ rpc, rpcSubscriptions });

const address = await getAddressFromPublicKey(user.publicKey);

const amount = lamports(1n * SOL);

const airdropTransactionSignature = await airdrop({
  commitment: "finalized",
  recipientAddress: address,
  lamports: amount,
});

console.log("Airdrop transaction signature", airdropTransactionSignature);

console.log("Getting balance for address", address);

const getBalanceResponse = await rpc
  .getBalance(address, { commitment: "finalized" })
  .send();

console.log("Updated balance for address", address, getBalanceResponse.value);
