import {
  Address,
  createSolanaRpcSubscriptions,
  Lamports,
  Commitment,
  createSolanaRpcFromTransport,
  airdropFactory,
} from "@solana/web3.js";

export const getBalanceFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  const getBalance = async (address: string, commitment: Commitment = "finalized"): Promise<Lamports> => {
    const getBalanceResponse = await rpc.getBalance(address, { commitment }).send();
    return getBalanceResponse.value;
  };
  return getBalance;
};

export const airdropIfRequiredFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>,
) => {
  const getBalance = getBalanceFactory(rpc);
  // Plain 'airdrop' is not exported as we don't want to encourage people to
  // request airdrops when they don't need them, ie - don't bother
  // the faucet unless you really need to!
  //
  // Note rpc.requestAirdrop is broken, the commitment paramater doesn't do anything
  // despite the docs repeatedly referring to rpc.requestAirdrop
  // See https://github.com/solana-labs/solana-web3.js/issues/3683
  //
  // @ts-expect-error TODO need to work out devnet/mainnet typing issue re: airdrops
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  const airdropIfRequired = async (
    address: Address,
    airdropAmount: Lamports,
    minimumBalance: Lamports,
  ): Promise<string | null> => {
    if (airdropAmount < 0n) {
      throw new Error(`Airdrop amount must be a positive number, not ${airdropAmount}`);
    }
    if (minimumBalance === 0n) {
      const signature = await airdrop({
        commitment: "finalized",
        recipientAddress: address,
        lamports: airdropAmount,
      });
      return signature;
    }
    const balance = await getBalance(address, "finalized");

    if (balance >= minimumBalance) {
      return null;
    }
    const signature = await airdrop({
      commitment: "finalized",
      recipientAddress: address,
      lamports: airdropAmount,
    });

    return signature;
  };
  return airdropIfRequired;
};
