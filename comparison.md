Using Kite:

```typescript
import { connect } from "@helius/kite";
const connection = connect();
const mintAuthority = await createWallet();
const mintAddress = await connection.makeTokenMint(
  mintAuthority,
  6,
  "My Token",
  "MTKN",
  "https://example.com/metadata.json",
  {
    description: "A sample token",
    website: "https://example.com",
  },
);
console.log(connection.getExplorerLink(mintAddress));
```

Using web3.js version 2 on it's own:

```typescript
import {
  airdropFactory,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  some,
} from "@solana/web3.js";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  extension,
  getInitializeMetadataPointerInstruction,
  getInitializeTokenMetadataInstruction,
  tokenMetadataField,
  getUpdateTokenMetadataFieldInstruction,
} from "@solana-program/token-2022";

const rpc = createSolanaRpc("http://127.0.0.1:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions("ws://127.0.0.1:8900");

const feePayer = await generateKeyPairSigner();
console.log(feePayer.address);
const mint = await generateKeyPairSigner();

await airdropFactory({ rpc, rpcSubscriptions })({
  recipientAddress: feePayer.address,
  lamports: lamports(1_000_000_000n),
  commitment: "confirmed",
});

const balance = await rpc.getBalance(feePayer.address).send();
console.log("balance:", balance.value);

const metadataPointerExtension = extension("MetadataPointer", {
  authority: some(feePayer.address),
  metadataAddress: some(mint.address),
});

const tokenMetadataExtension = extension("TokenMetadata", {
  updateAuthority: some(feePayer.address),
  mint: mint.address,
  name: "OPOS",
  symbol: "OPOS",
  uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
  additionalMetadata: new Map<string, string>([["description", "Only Possible On Solana"]]),
});

const spaceWithoutMetadata = BigInt(getMintSize([metadataPointerExtension]));

const spaceWithMetadata = BigInt(getMintSize([metadataPointerExtension, tokenMetadataExtension]));

const rent = await rpc.getMinimumBalanceForRentExemption(spaceWithMetadata).send();

const createAccountInstruction = getCreateAccountInstruction({
  payer: feePayer,
  newAccount: mint,
  lamports: rent,
  space: spaceWithoutMetadata,
  programAddress: TOKEN_2022_PROGRAM_ADDRESS,
});

const initializeMetadataPointerInstruction = getInitializeMetadataPointerInstruction({
  mint: mint.address,
  authority: feePayer.address,
  metadataAddress: mint.address,
});

const initializeMintInstruction = getInitializeMintInstruction({
  mint: mint.address,
  decimals: 2,
  mintAuthority: feePayer.address,
});

const initializeTokenMetadataInstruction = getInitializeTokenMetadataInstruction({
  metadata: mint.address,
  updateAuthority: feePayer.address,
  mint: mint.address,
  mintAuthority: feePayer,
  name: tokenMetadataExtension.name,
  symbol: tokenMetadataExtension.symbol,
  uri: tokenMetadataExtension.uri,
});

const updateTokenMetadataInstruction = getUpdateTokenMetadataFieldInstruction({
  metadata: mint.address,
  updateAuthority: feePayer,
  field: tokenMetadataField("Key", ["description"]),
  value: "Only Possible On Solana",
});

const createAtaInstruction = await getCreateAssociatedTokenInstructionAsync({
  payer: feePayer,
  mint: mint.address,
  owner: feePayer.address,
});

const [associatedTokenAddress] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: feePayer.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
});

const mintToInstruction = getMintToInstruction({
  mint: mint.address,
  token: associatedTokenAddress,
  mintAuthority: feePayer.address,
  amount: 100n,
});

const instructions = [
  createAccountInstruction,
  initializeMetadataPointerInstruction,
  initializeMintInstruction,
  initializeTokenMetadataInstruction,
  updateTokenMetadataInstruction,
  createAtaInstruction,
  mintToInstruction,
];

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const transactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions(instructions, tx),
);

const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

const transactionSignature = getSignatureFromTransaction(signedTransaction);

console.log("Transaction Signature:", `https://explorer.solana.com/tx/${transactionSignature}?cluster=custom`);

await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signedTransaction, {
  commitment: "confirmed",
  skipPreflight: true,
});
```
