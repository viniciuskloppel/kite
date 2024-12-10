import {
  airdropFactory,
  createDefaultRpcTransport,
  createSolanaRpc,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  generateKeyPair,
  generateKeyPairSigner,
  getAddressFromPublicKey,
  lamports,
} from "@solana/web3.js";

const user = await generateKeyPairSigner();

const SOL = 1_000_000_000n;

const rpc = createSolanaRpc("http://localhost:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions("ws://localhost:8900");
const airdrop = airdropFactory({ rpc, rpcSubscriptions });

const amount = lamports(1n * SOL);

const airdropTransactionSignature = await airdrop({
  commitment: "finalized",
  recipientAddress: user.address,
  lamports: amount,
});

console.log("Airdrop transaction signature", airdropTransactionSignature);

console.log("Getting balance for address", user.address);

const getBalanceResponse = await rpc
  .getBalance(user.address, { commitment: "finalized" })
  .send();

console.log(
  "Updated balance for address",
  user.address,
  getBalanceResponse.value,
);
