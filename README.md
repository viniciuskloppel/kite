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

The connection object defaults to "localnet" but any of the following cluster names are supported: "mainnet-beta", "testnet", "devnet", "helius-mainnet", "helius-testnet," "helius-devnet".

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
const wallet = await connection.createWallet();
```

### Options

- `keyPairPath`: `string` (optional) - Path to load keypair from file
- `envFileName`: `string` (optional) - Path to .env file to save/load keypair
- `prefix`: `string` (optional) - Prefix for generated keypair name
- `suffix`: `string` (optional) - Suffix for generated keypair name
- `envVariableName`: `string` (optional) - Name of environment variable to store keypair (default: "PRIVATE_KEY")
- `airdropAmount`: `Lamports` (optional) - Amount of SOL to airdrop (default: 1 SOL)
- `minimumBalance`: `Lamports` (optional) - Minimum balance threshold (default: 0.5 SOL)

## sendAndConfirmTransaction - Send and confirm a transaction

Sends a transaction and waits for confirmation

Returns: `Promise<void>`

```typescript
const signature = await connection.sendAndConfirmTransaction(transaction, options);
```

### Options

- `commitment`: `Commitment` (optional) - Desired confirmation level
- `skipPreflight`: `boolean` (optional) - Whether to skip preflight transaction checks

## signSendAndConfirmTransaction - Sign, send and confirm a transaction

Signs a transaction with the provided signer, sends it, and waits for confirmation

Returns: `Promise<Signature>`

```typescript
const signature = await connection.signSendAndConfirmTransaction(transaction, signer, options);
```

### Options

- `commitment`: `Commitment` (optional) - Desired confirmation level
- `skipPreflight`: `boolean` (optional) - Whether to skip preflight transaction checks

## getBalance - Get wallet balance

Gets the SOL balance of a wallet

Returns: `Promise<Lamports>`

```typescript
const balance = await connection.getBalance(publicKey, commitment);
```

### Options

- `commitment`: `Commitment` (optional) - Desired confirmation level (default: "finalized")

## getExplorerLink - Get Solana Explorer link

Generates a link to view an address, transaction, or token on Solana Explorer. The link will automatically use your RPC.

Returns: `string` - Explorer URL

```typescript
const link = connection.getExplorerLink(addressOrSignature, type);
```

### Options

- `addressOrSignature`: `string` - The address, signature, or token to link to
- `type`: `"address" | "tx" | "token" | "block"` - Type of entity to link to
- `searchParams`: `Record<string, string>` (optional) - Additional URL search parameters

## getRecentSignatureConfirmation - Get transaction confirmation status

Checks if a recent transaction signature has been confirmed

Returns: `Promise<boolean>`

```typescript
const isConfirmed = await connection.getRecentSignatureConfirmation(signature, options);
```

### Options

- `commitment`: `Commitment` (optional) - Desired confirmation level
- `timeout`: `number` (optional) - How long to wait for confirmation in milliseconds

## airdropIfRequired - Airdrop SOL if balance is low

Airdrops SOL to a wallet if its balance is below the specified threshold

Returns: `Promise<Lamports>` - New balance in lamports

```typescript
await connection.airdropIfRequired(address, airdropAmount, minimumBalance);
```

### Options

- `address`: `Address` - Address to check balance and potentially airdrop to
- `airdropAmount`: `Lamports` - Amount of lamports to airdrop if needed
- `minimumBalance`: `Lamports` - Minimum balance threshold that triggers airdrop

## getLogs - Get transaction logs

Retrieves logs for a transaction

Returns: `Promise<Array<string>>`

```typescript
const logs = await connection.getLogs(signature);
```

### Options

- `maxSupportedTransactionVersion`: `number` (optional) - Maximum supported transaction version (default: 0)
- `commitment`: `Commitment` (optional) - Desired confirmation level (default: "confirmed")

## transferLamports - Transfer SOL between wallets

Transfers SOL from one wallet to another

Returns: `Promise<Signature>`

```typescript
const signature = await connection.transferLamports(source, destination, amount);
```

### Options

- `source`: `KeyPairSigner` - The wallet to send SOL from
- `destination`: `Address` - The wallet to send SOL to
- `amount`: `Lamports` - Amount of lamports to send

## makeTokenMint - Create a new token

Creates a new SPL token with specified parameters

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
