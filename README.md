# A modern Solana framework for web3.js version 2 🪁

> [!NOTE]  
> Kite is new, and should be considered experimental. Please [report any issues](https://github.com/helius-dev/kite/issues) you find.

## A modern Solana TypeScript framework for the browser and node.js

Kite leverages the speed and elegance of [Solana web3.js version 2](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk) but allows you to **do most Solana tasks in a single step**. Since Kite uses web3.js version 2 for the heavy lifting, the full features of web3.js version 2 are available, and if you decide you don't need Kite anymore, you can easily remove it and use plain web3.js version 2 if you wish.

Kite is a web3.js v2 update of `@solana-developers/helpers`, the [most popular high level library for web3.js version 1](https://www.npmjs.com/package/@solana-developers/helpers), by the original author. The `kite` package includes updated versions of most of the original helpers, including contributions from [Helius](https://helius.xyz), [the Solana Foundation](https://youtu.be/zvQIa68ObK8?t=319), [Anza](https://anza.xyz), [Turbin3](https://turbin3.com/), [Unboxed Software](https://beunboxed.com/), and [StarAtlas](https://staratlas.com/). The ones we don't have should be added soon.

Kite works both in the browser and node.js and has [minimal dependencies](https://github.com/helius-dev/kite/blob/main/package.json).

## What can I do with this library?

Kite includes functions to:

### Wallets

- [Create a new wallet](#createwallet---create-a-new-wallet)
- [Load a wallet from a file](#loadwalletfromfile---load-a-wallet-from-file)
- [Load a wallet from an environment variable](#loadwalletfromenvironment---load-a-wallet-from-environment)

### SOL

- [Airdrop SOL if balance is low](#airdropifrequired---airdrop-sol-if-balance-is-low)
- [Get an account balance](#getbalance---get-account-balance)
- [Transfer SOL between wallets](#transferlamports---transfer-sol-between-wallets)

### Tokens

- [Create a new token](#maketokenmint---create-a-new-token)
- [Get token account address](#gettokenaccountaddress---get-token-account-address)
- [Mint tokens to an account](#minttokens---mint-tokens-to-an-account)
- [Transfer tokens between accounts](#transfertokens---transfer-tokens-between-accounts)

### Transactions

- [Send and confirm a transaction](#sendandconfirmtransaction---send-and-confirm-a-transaction)
- [Sign, send and confirm a transaction](#signsendandconfirmtransaction---sign-send-and-confirm-a-transaction)
- [Check if a transaction is confirmed](#getrecentsignatureconfirmation---get-transaction-confirmation-status)
- [Get transaction logs](#getlogs---get-transaction-logs)

### Explorer

- [Get a Solana Explorer link](#getexplorerlink---get-solana-explorer-link)

We'll be adding more functions over time. You're welcome to [suggest a new function](https://github.com/helius-dev/kite/issues) or read the [CONTRIBUTING guidelines](CONTRIBUTING.md) and [send a PR](https://github.com/helius-dev/kite/pulls).

## Why the name 'Kite'?

Solana itself is named after [a beach](https://en.wikipedia.org/wiki/Solana_Beach,_California). Kite is a high-level framework, so what is high above a beach? Kites! 🪁😃

## Installation

```bash
npm i @helius/kite
```

## Starting Kite

To use the local cluster (ie, `solana-test-validator` running on your machine):

```typescript
import { connect } from "@helius/kite";

const connection = connect();
```

You can also specify a cluster name. The connection object defaults to `localnet` but any of the following cluster names are supported: `mainnet-beta` (or `mainnet`), `testnet`, `devnet`, `helius-mainnet`, `helius-testnet`, `helius-devnet`.

```typescript
const connection = connect("helius-devnet");
```

The Helius names require the environment variable `HELIUS_API_KEY` to be set in your environment.

You can also specify an arbitrary RPC URL and RPC subscription URL:

```typescript
const connection = connect("https://mainnet.example.com/", "wss://mainnet.example.com/");
```

After you've made a connection Kite is ready to use. **You don't need to set up any factories, they're already configured.** A `connection` has the following functions ready out of the box:

## createWallet - Create a new wallet

Creates a new Solana wallet (more specifically a `KeyPairSigner`).

If you like, the wallet will have a prefix/suffix of your choice, the wallet will have a SOL balance ready to spend, and the keypair will be saved to a file for you to use later.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.createWallet({
  prefix, // optional: prefix for wallet address
  suffix, // optional: suffix for wallet address
  envFileName, // optional: path to .env file to save keypair
  envVariableName, // optional: name of environment variable to store keypair
  airdropAmount, // optional: amount of SOL to airdrop
});
```

### Options

All options are optional:

- `prefix`: `string | null` - Prefix for wallet address
- `suffix`: `string | null` - Suffix for wallet address
- `envFileName`: `string | null` - Path to .env file to save keypair
- `envVariableName`: `string` - Name of environment variable to store keypair (default: "PRIVATE_KEY")
- `airdropAmount`: `Lamports | null` - Amount of SOL to airdrop (default: 1 SOL)

### Examples

Create a basic wallet:

```typescript
const wallet = await connection.createWallet();
```

Create a wallet with a specific prefix and suffix:

```typescript
const wallet = await connection.createWallet({
  prefix: "COOL",
  suffix: "WALLET",
});
```

Create a wallet and save it to an environment file:

```typescript
const wallet = await connection.createWallet({
  envFileName: ".env",
  envVariableName: "MY_WALLET_KEY",
});
```

Create a wallet with a custom airdrop amount:

```typescript
const wallet = await connection.createWallet({
  airdropAmount: lamports(2n * SOL),
});
```

## loadWalletFromFile - Load a wallet from file

Loads a wallet (more specifically a `KeyPairSigner`) from a file. The file should be in the same format as files created by the `solana-keygen` command.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.loadWalletFromFile(keyPairPath);
```

### Options

- `keyPairPath`: `string` - Path to load keypair from file

## loadWalletFromEnvironment - Load a wallet from environment

Loads a wallet (more specifically a `KeyPairSigner`) from an environment variable. The keypair should be in the same 'array of numbers' format as used by `solana-keygen`.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.loadWalletFromEnvironment(envVariableName);
```

### Options

- `envVariableName`: `string` - Name of environment variable containing the keypair (default: "PRIVATE_KEY")

## sendAndConfirmTransaction - Send and confirm a transaction

Sends a transaction and waits for confirmation.

Returns: `Promise<void>`

```typescript
await connection.sendAndConfirmTransaction(transaction, options);
```

### Options

- `transaction`: `VersionedTransaction` - Transaction to send
- `options`: `Object` (optional)
  - `commitment`: `Commitment` - Desired confirmation level
  - `skipPreflight`: `boolean` - Whether to skip preflight transaction checks

## signSendAndConfirmTransaction - Sign, send and confirm a transaction

Signs a transaction with the provided signer, sends it, and waits for confirmation.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.signSendAndConfirmTransaction(transactionMessage, commitment, skipPreflight);
```

### Options

- `transactionMessage`: `CompilableTransactionMessage & TransactionMessageWithBlockhashLifetime` - Transaction message to sign and send
- `commitment`: `Commitment` (optional) - Desired confirmation level (default: "processed")
- `skipPreflight`: `boolean` (optional) - Whether to skip preflight transaction checks (default: true)

## getBalance - Get account balance

Gets the SOL balance of an account.

Returns: `Promise<Lamports>`

```typescript
const balance = await connection.getBalance(address, commitment);
```

### Options

- `address`: `string` - Address to check balance for
- `commitment`: `Commitment` (optional) - Desired confirmation level (default: "finalized")

## getExplorerLink - Get Solana Explorer link

Generates a link to view an address, transaction, or token on Solana Explorer. The link will automatically use your RPC.

Returns: `string` - Explorer URL

Get a link to view an address:

```typescript
const addressLink = connection.getExplorerLink("address", "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn");
```

Get a link to view a transaction:

```typescript
const transactionLink = connection.getExplorerLink(
  "transaction",
  "5rUQ2tX8bRzB2qJWnrBhHYgHsafpqVZwGwxVrtyYFZXJZs6yBVwerZHGbwsrDHKbRtKpxnWoHKmBgqYXVbU5TrHe",
);
```

Or if you like abbrieviations:

```typescript
const transactionLink = connection.getExplorerLink(
  "tx",
  "5rUQ2tX8bRzB2qJWnrBhHYgHsafpqVZwGwxVrtyYFZXJZs6yBVwerZHGbwsrDHKbRtKpxnWoHKmBgqYXVbU5TrHe",
);
```

Get a link to view a block:

```typescript
const blockLink = connection.getExplorerLink("block", "180392470");
```

### Options

- `linkType`: `"transaction" | "tx" | "address" | "block"` - Type of entity to link to
- `id`: `string` - The address, signature, or block to link to

## getRecentSignatureConfirmation - Get transaction confirmation status

Checks the confirmation status of a recent transaction.

Returns: `Promise<boolean>`

```typescript
const confirmed = await connection.getRecentSignatureConfirmation(signature);
```

### Options

- `signature`: `string` - The signature of the transaction to check

## airdropIfRequired - Airdrop SOL if balance is low

Airdrops SOL to an address if its balance is below the specified threshold.

Returns: `Promise<string | null>` - Transaction signature if airdrop occurred, null if no airdrop was needed

```typescript
const signature = await connection.airdropIfRequired(address, airdropAmount, minimumBalance);
```

### Options

- `address`: `Address` - Address to check balance and potentially airdrop to
- `airdropAmount`: `Lamports` - Amount of lamports to airdrop if needed
- `minimumBalance`: `Lamports` - Minimum balance threshold that triggers airdrop

## getLogs - Get transaction logs

Retrieves logs for a transaction.

Returns: `Promise<Array<string>>`

```typescript
const logs = await connection.getLogs(signature);
```

### Options

- `signature`: `string` - Transaction signature to get logs for

## transferLamports - Transfer SOL between wallets

Transfers SOL from one wallet to another.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.transferLamports(source, destination, amount);
```

### Options

- `source`: `KeyPairSigner` - The wallet to send SOL from
- `destination`: `Address` - The wallet to send SOL to
- `amount`: `Lamports` - Amount of lamports to send

## makeTokenMint - Create a new token with metadata

Creates a new SPL token with specified parameters.

Returns: `Promise<Address>`

### Options

- `mintAuthority`: `KeyPairSigner` - Authority that can mint new tokens
- `decimals`: `number` - Number of decimal places for the token
- `name`: `string` - Name of the token
- `symbol`: `string` - Symbol of the token
- `uri`: `string` - URI pointing to the token's metadata (eg: "https://arweave.net/abc123")
- `additionalMetadata`: `Record<string, string> | Map<string, string>` (optional) - Additional metadata fields

### Examples

Create a token with additional metadata:

```typescript
const mintAddress = await connection.makeTokenMint(
  mintAuthority,
  6,
  "My token",
  "MTKN",
  "https://example.com/metadata.json",
  {
    description: "A stablecoin pegged to the US dollar",
    website: "https://example.com",
  },
);
```

## getTokenAccountAddress - Get token account address

Gets the associated token account address for a given wallet and token mint.

Returns: `Promise<Address>`

```typescript
const tokenAccountAddress = await connection.getTokenAccountAddress(wallet, mint, useTokenExtensions);
```

### Options

- `wallet`: `Address` - The wallet address to get the token account for
- `mint`: `Address` - The token mint address
- `useTokenExtensions`: `boolean` (optional) - Whether to use Token Extensions program (default: false)

### Example

Get a token account address for a token made with the classic token program:

```typescript
const tokenAccountAddress = await connection.getTokenAccountAddress(
  "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
```

Get a token account address for a Token Extensions token:

```typescript
const tokenAccountAddress = await connection.getTokenAccountAddress(
  "GkFTrgp8FcCgkCZeKreKKVHLyzGV6eqBpDHxRzg1brRn",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  true,
);
```

## mintTokens - Mint tokens to an account

Mints tokens from a token mint to a destination account. The mint authority must sign the transaction.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.mintTokens(
  mintAddress, // address of the token mint
  mintAuthority, // signer with authority to mint tokens
  amount, // amount of tokens to mint
  destination, // address to receive the tokens
);
```

### Options

- `mintAddress`: `Address` - Address of the token mint
- `mintAuthority`: `KeyPairSigner` - Signer with authority to mint tokens
- `amount`: `bigint` - Amount of tokens to mint (in base units)
- `destination`: `Address` - Address to receive the minted tokens

### Example

```typescript
// Create a new token mint
const mintAuthority = await connection.createWallet({
  airdropAmount: lamports(1n * SOL),
});

const mintAddress = await connection.makeTokenMint(
  mintAuthority,
  9, // decimals
  "My Token",
  "TKN",
  "https://example.com/token.json",
);

// Mint 100 tokens to the mint authority's account
const signature = await connection.mintTokens(mintAddress, mintAuthority, 100n, mintAuthority.address);
```

## transferTokens - Transfer tokens between accounts

Transfers tokens from one account to another. The sender must sign the transaction.

Returns: `Promise<Signature>`

```typescript
const signature = await connection.transferTokens(
  sender, // signer that owns the tokens
  destination, // address to receive the tokens
  mintAddress, // address of the token mint
  amount, // amount of tokens to transfer
);
```

### Options

- `sender`: `KeyPairSigner` - Signer that owns the tokens and will sign the transaction
- `destination`: `Address` - Address to receive the tokens
- `mintAddress`: `Address` - Address of the token mint
- `amount`: `bigint` - Amount of tokens to transfer (in base units)

### Example

```typescript
// Create wallets for sender and recipient
const [sender, recipient] = await Promise.all([
  connection.createWallet({
    airdropAmount: lamports(1n * SOL),
  }),
  connection.createWallet({
    airdropAmount: lamports(1n * SOL),
  }),
]);

// Create a new token mint
const mintAddress = await connection.makeTokenMint(
  sender, // sender will be the mint authority
  9, // decimals
  "My Token",
  "TKN",
  "https://example.com/token.json",
);

// Mint some tokens to the sender's account
await connection.mintTokens(mintAddress, sender, 100n, sender.address);

// Transfer 50 tokens from sender to recipient
const signature = await connection.transferTokens(sender, recipient.address, mintAddress, 50n);
```

## Development and testing

To run tests, open a terminal tab, and run:

```bash
solana-test-validator
```

Then in a different tab, run:

```bash
npm run test
```

The tests use the [node native test runner](https://blog.logrocket.com/exploring-node-js-native-test-runner/).

If you'd like to run a single test, use:

```bash
esrun --node-no-warnings tests/src/keypair.test.ts
```

We use `--node-no-warnings` to avoid `ExperimentalWarning: The Ed25519 Web Crypto API algorithm is an experimental feature` which is pretty boring once you've read it for the 50th time.

```bash
esrun --node-no-warnings --node-test-name-pattern='connect' src/tests/connect.test.ts
```

To just run tests matching the name `getCustomErrorMessage`.
