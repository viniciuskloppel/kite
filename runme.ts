import {
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  generateKeyPair,
  getAddressFromPublicKey,
  lamports,
} from "@solana/web3.js";

const user = await generateKeyPair();

const SOL = 1_000_000_000n;

const transport = createDefaultRpcTransport({
  url: "http://localhost:8899",
});

// Create an RPC client using that transport.
const rpc = createSolanaRpcFromTransport(transport);

const address = await getAddressFromPublicKey(user.publicKey);

const amount = lamports(1n * SOL);

const airdropTransactionSignature = await rpc
  .requestAirdrop(address, amount, { commitment: "finalized" })
  .send();
console.log("Airdrop transaction signature", airdropTransactionSignature);

console.log("Getting balance for address", address);

const getBalanceResponse = await rpc
  .getBalance(address, { commitment: "finalized" })
  .send();

console.log("Updated balance for address", address, getBalanceResponse.value);
