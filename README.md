

# Introducing Kite, a modern Solana framework for the browser and node.js 🪁

## A modern Solana framework for the browser and node.js

Kite leverages the speed and elegance of [Solana web3.js version 2](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk) but provides a simpler environment to get more done quickly.

More specifically, Kite allows you to **do the most common Solana tasks - make a funded wallet, make a token, send SOL, send tokens, etc - in a single function**. Since Kite uses web3.js version 2 for the heavy lifting, the full features of web3.js version 2 are available, and if you decide you don't need Kite anymore, you can easily remove it and use plain web3.js version 2 if you wish.

Kite is a web3.js v2 version of  `@solana-developers/helpers`, the [most popular high level library for web3.js version 1](), by the original author. The `kite` package includes updated versions of all the original helpers, including contributions from [Helius](https://helius.xyz), [the Solana Foundation Developer Ecosystem team](https://youtu.be/zvQIa68ObK8?t=319), [Anza](https://anza.xyz), [Turbin3](https://turbin3.com/), [Unboxed Software](https://beunboxed.com/), and [StarAtlas](https://staratlas.com/).

## Why the name 'Kite'?

Many Solana things - Solana itself, Sealevel, Anchor, Poseidon, etc. - are sea-themed. Kite is a high-level framework, so what is high above a beach? Kites! 🪁😃

## Installation

```bash
npm i @helius/kite
```

## Starting Kite

web3.js v2 with Kite

```typescript
import { connect } from "@helius/kite";

const connection = connect();
```

The connection object defaults to "localnet" but any of the following cluster names are supported: "mainnet-beta", "testnet", "devnet", "helius-mainnet-beta", "helius-testnet," "helius-devnet". 

```typescript
const connection = connect("helius-devnet");
```

The Helius names require the environment variable `HELIUS_API_KEY` to be set in your environment.

You can also specify an arbitrary RPC URL and RPC subscription URL:

```typescript
const connection = connect("https://mainnet.example.com/", "wss://mainnet.example.com/");
```

After you've made a connection Kite is ready to use. **You don't need to set up any factories, they're already configured.** Connection has the following functions ready out of the box:

```
createWallet
sendAndConfirmTransaction
signSendAndConfirmTransaction
getBalance
getExplorerLink
getRecentSignatureConfirmation
airdropIfRequired
getLogs
transferLamports
makeTokenMint
```

REGENERATE DOCS HERE


## Contributing

PRs are very much welcome! Read the [CONTRIBUTING guidelines](CONTRIBUTING.md) then send a PR!

## Connect to your RPC provider

Using the local cluster (ie, `solana-test-validator` running on your machine):

```typescript
const connection = connect();
```

Using Helius:

```typescript
const connection = connect(
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
);
```

Using mainnet-beta:

```typescript
const connection = connect("mainnet-beta");
```

## Loading keypairs from a file

```typescript
const keyPairSigner = await getKeyPairSignerFromFile('key-pair.json');
```

## Make multiple keypairs at once

```typescript
const keyPairs = await makeKeyPairSigners(3);
```

## Create a wallet with some SOL in it

```typescript
const keyPairSigner = await connection.createWallet('key-pair.json', 1 * SOL);
```

## Transfer SOL

```typescript
const signature = await connection.transferLamports(keyPairSigner, recipient, amount);
```

## Transfer tokens


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

We use `--node-no-warnings` to avoid ...

```
(node:27923) ExperimentalWarning: The Ed25519 Web Crypto API algorithm is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

...which is pretty boring once you've read it for the 50th time.

```bash
esrun --node-no-warnings --node-test-name-pattern="getCustomErrorMessage" tests/src/keypair.test.ts
```

To just run tests matching the name `getCustomErrorMessage`.
## See also 

SEE
https://github.com/mcintyre94/helius-smart-transactions-web3js2

 https://solana.com/developers/cookbook/transactions/send-sol
https://blog.triton.one/ping-thing-solanaweb3js-2x-walkthrough
Also quicknode helpers