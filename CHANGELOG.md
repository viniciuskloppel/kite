# Version 3

## Kite version 1.0

- New name: `@helius/kite`
- Use @solana/web3.js version 2
- A new `connect()` method is provided, which returns an object with `rpc`, `rpcSubscriptions`, `sendAndConfirmTransaction()` (to confirm transactions using your RPC) and `getExplorerLink()` (to get Explorer links using your RPC).
- Most functions are now a property of `connection`. For example, `connection.getBalance()` instead of `getBalance()`.
- Added support for Helius RPCs - just specify the name and as long as the Helius API key is set in the environment, it will be used.
- A new value `SOL` is exported, to match the previous convenience value `LAMPORTS_PER_SOL`. For example, use `10n * SOL` for 10 SOL.
- We've tried to match the coding style of web3.js v2
  - `xToY()` becomes `createXFromY`. `create` is now the preferred nomenclature, so `initializeKeypair` is now `createWallet`,
  - Functions that return a `doThing()` function are called `doThingFactory()`
  - We do not use web3.js Hungarian notation - this library uses `getFoo()` rather than `getFooPromise()` since TS rarely uses Hungarian.
- `initializeKeypair` is now `createKeyPairSigner`
- Since web3.js uses Promises in more places, nearly every helper function returns a `Promise<>` now, so you'll use `await` more often.
- localhost links on `getExplorerLink()` no longer add an unnecessary customUrl parameter
- `confirmTransaction` is now `getRecentSignatureConfirmation`
- We no longer support base58 encoded private keys - instead we use the 'Array of numbers' format exclusively. If you have base58 encoded private keys you can convert them with the previous version of this library.
- Remove CommonJS support.

## 2.5

- Add `makeTokenMint()`
- 2.5.4 includes a few fixes to build system and TS types that were missing in earlier 2.5.x releases
- 2.5.6 includes a fix for esm module post-build script

## 2.4

- Add `createAccountsMintsAndTokenAccounts()`

## 2.3

Improved browser support by only loading node-specific modules when they are needed. Thanks @piotr-layerzero!

## 2.2

- Add `getSimulationComputeUnits()`

## 2.1

- Add `initializeKeypair()`
- Change documentation to be task based.

## 2.0

- **Breaking**: Replace both `requestAndConfirmAirdropIfRequired()` and `requestAndConfirmAirdrop()` with a single function, `airdropIfRequired()`. See [README.md]!
- Fix error handling in `confirmTransaction()` to throw errors correctly.
- Added `getLogs()` function

## 1.5

- Added `getExplorerLink()`

## 1.4

- Added `requestAndConfirmAirdropIfRequired()`

## 1.3

- Now just `helpers`. The old `node-helpers` package is marked as deprecated.
- Added `requestAndConfirmAirdrop()`
- Added `getCustomErrorMessage()`

## 1.2

- Added `addKeypairToEnvFile()`

## 1.0

Original release.
