# Introducing Kite, a modern Solana framework for the browser and node.js 🪁

## A modern Solana framework for the browser and node.js

Kite leverages the speed and elegance of [Solana web3.js version 2](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk) but provides a simpler environment to get more done quickly.

More specifically, Kite allows you to **do the most common Solana tasks - make a funded wallet, make a token, send SOL, send tokens, etc - in a single function**. Since Kite uses web3.js version 2 for the heavy lifting, the full features of web3.js version 2 are available, and if you decide you don't need Kite anymore, you can easily remove it and use plain web3.js version 2 if you wish.

Kite is a web3.js v2 version of `@solana-developers/helpers`, the [most popular high level library for web3.js version 1](), by the original author. The `kite` package includes updated versions of all the original helpers, including contributions from [Helius](https://helius.xyz), [the Solana Foundation Developer Ecosystem team](https://youtu.be/zvQIa68ObK8?t=319), [Anza](https://anza.xyz), [Turbin3](https://turbin3.com/), [Unboxed Software](https://beunboxed.com/), and [StarAtlas](https://staratlas.com/).

## Why the name 'Kite'?

Many Solana things - Solana itself, Sealevel, Anchor, Poseidon, etc. - are sea-themed. Kite is a high-level framework, so what is high above a beach? Kites! 🪁😃

## Installation

```bash
npm i @helius/kite
```

## Starting Kite

Using the local cluster (ie, `solana-test-validator` running on your machine):

```typescript
import { connect } from "@helius/kite";

const connection = connect();
```

The connection object defaults to "localnet" but any of the following cluster names are supported: "mainnet-beta" (or "mainnet"), "testnet", "devnet", "helius-mainnet", "helius-testnet," "helius-devnet".

```typescript
const connection = connect("helius-devnet");
```

The Helius names require the environment variable `HELIUS_API_KEY` to be set in your environment.

You can also specify an arbitrary RPC URL and RPC subscription URL:

```typescript
const connection = connect("https://mainnet.example.com/", "wss://mainnet.example.com/");
```

After you've made a connection Kite is ready to use. **You don't need to set up any factories, they're already configured.** Connection has the following functions ready out of the box:

## createWallet - Create a new Solana wallet

Creates a new Solana wallet (more specifically a `KeyPairSigner`).

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.createWallet(prefix, suffix, envFileName, envVariableName, airdropAmount);
```

### Options

- `prefix`: `string | null` (optional) - Prefix for generated keypair name
- `suffix`: `string | null` (optional) - Suffix for generated keypair name
- `envFileName`: `string | null` (optional) - Path to .env file to save/load keypair
- `envVariableName`: `string` (optional) - Name of environment variable to store keypair (default: "PRIVATE_KEY")
- `airdropAmount`: `Lamports | null` (optional) - Amount of SOL to airdrop (default: 1 SOL)

## getKeyPairSignerFromFile - Load a keypair from file

Loads a keypair from a file.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.getKeyPairSignerFromFile(keyPairPath);
```

### Options

- `keyPairPath`: `string` - Path to load keypair from file

## getKeyPairSignerFromEnvironment - Load a keypair from environment

Loads a keypair from an environment variable.

Returns: `Promise<KeyPairSigner>`

```typescript
const wallet = await connection.getKeyPairSignerFromEnvironment(envVariableName);
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

## getBalance - Get wallet balance

Gets the SOL balance of a wallet.

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

```typescript
const link = connection.getExplorerLink(linkType, id);
```

### Options

- `linkType`: `"transaction" | "tx" | "address" | "block"` - Type of entity to link to
- `id`: `string` - The address, signature, or block to link to

## getRecentSignatureConfirmation - Get transaction confirmation status

Checks if a recent transaction signature has been confirmed.

Returns: `Promise<boolean>`

```typescript
const isConfirmed = await connection.getRecentSignatureConfirmation(signature, options);
```

### Options

- `signature`: `string` - Transaction signature to check
- `options`: `Object` (optional)
  - `commitment`: `Commitment` - Desired confirmation level
  - `timeout`: `number` - How long to wait for confirmation in milliseconds

## airdropIfRequired - Airdrop SOL if balance is low

Airdrops SOL to a wallet if its balance is below the specified threshold.

Returns: `Promise<Lamports>` - New balance in lamports

```typescript
const newBalance = await connection.airdropIfRequired(address, airdropAmount, minimumBalance);
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

## makeTokenMint - Create a new token

Creates a new SPL token with specified parameters.

Returns: `Promise<Address>`

```typescript
const mintAddress = await connection.makeTokenMint(mintAuthority, decimals, name, symbol, uri, additionalMetadata);
```

### Options

- `mintAuthority`: `KeyPairSigner` - Authority that can mint new tokens
- `decimals`: `number` - Number of decimal places for the token
- `name`: `string` - Name of the token
- `symbol`: `string` - Symbol of the token
- `uri`: `string` - URI for token metadata
- `additionalMetadata`: `Record<string, string> | Map<string, string>` (optional) - Additional metadata fields

## Contributing

PRs are very much welcome! Read the [CONTRIBUTING guidelines](CONTRIBUTING.md) then send a PR!

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
