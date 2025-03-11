# Kite Changelog

## Kite version 1.1.0

### Additions

- Main package is now `solana-kite`.
- Add `getPDAAndBump()` - calculates a Program Derived Address (PDA) and its bump seed from a program address and seeds, automatically encoding different seed types (strings, addresses, and bigints).
- `getTokenAccountBalance()` - can now take either a wallet and token mint (it will find the token account and then get the balance), or a token account address.
- Add `checkTokenAccountIsClosed()` - checks if a token account is closed or doesn't exist, supporting both direct token account address and wallet+mint lookup.
- Add TSDoc comments for all functions, so VSCode and other editors can display parameters nicely.
- Solana `@solana/kit` has been renamed to `@solana/kit`, and dependencies have been updated accordingly.

### Bug fixes

- Fix bug where types were generated but not shown to consuming apps.
- Fix bug where `mintTokens()` was minting to the mint authority rather than the destination.

## Kite version 1.0.1

- Add `getTokenAccountBalance()`
- Minor docs updates

## Kite version 1.0

- New name: `@helius-dev/kite`
- Use @solana/web3.js version 2
- A new `connect()` method is provided, which returns an object with `rpc`, `rpcSubscriptions`, `sendAndConfirmTransaction()`, `getExplorerLink()` and the other functions in this library.
- Most functions are now a property of `connection`. For example, `connection.getLamportBalance()` instead of `getBalance()`.
- Added support for Helius RPCs - just specify the name and as long as the Helius API key is set in the environment, it will be used.
- We've tried to match the coding style of web3.js v2
  - `xToY()` becomes `createXFromY`. `create` is now the preferred nomenclature, so `initializeKeypair` is now `createWallet`,
  - Functions that return a `doThing()` function are called `doThingFactory()`
  - We do not use web3.js Hungarian notation - this library uses `getFoo()` rather than `getFooPromise()` since TS rarely uses Hungarian.
- `initializeKeypair` is now `createKeyPairSigner`
- Since web3.js uses Promises in more places, nearly every helper function returns a `Promise<>` now, so you'll use `await` more often.
- localhost links on `getExplorerLink()` no longer add an unnecessary customUrl parameter
- `confirmTransaction` is now `getRecentSignatureConfirmation`
- We no longer support base58 encoded private keys - instead we use the 'Array of numbers' format exclusively. If you have base58 encoded private keys you can convert them with the previous version of this library.
- Use `tsx` over `esrun`. While `tsx` needs a `tsconfig.json` file, `tsx` has many more users and is more actively maintained.
- Remove CommonJS support.

# Previous changelog as @solana/helpers

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
