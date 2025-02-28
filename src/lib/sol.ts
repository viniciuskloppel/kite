import {
  Address,
  createSolanaRpcSubscriptions,
  Lamports,
  Commitment,
  createSolanaRpcFromTransport,
  airdropFactory,
} from "@solana/web3.js";

export const getLamportBalanceFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Gets the SOL balance of an account in lamports.
   * @param {string} address - The address to check the balance for
   * @param {Commitment} commitment - The commitment level to use for the query (default: "finalized")
   * @returns {Promise<Lamports>} The balance in lamports
   */
  const getLamportBalance = async (address: string, commitment: Commitment = "finalized"): Promise<Lamports> => {
    const getLamportBalanceResponse = await rpc.getBalance(address, { commitment }).send();
    return getLamportBalanceResponse.value;
  };
  return getLamportBalance;
};

export const airdropIfRequiredFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>,
) => {
  const getLamportBalance = getLamportBalanceFactory(rpc);
  // Plain 'airdrop' is not exported as we don't want to encourage people to
  // request airdrops when they don't need them, ie - don't bother
  // the faucet unless you really need to!
  //
  // Note rpc.requestAirdrop is broken, the commitment parameter doesn't do anything
  // despite the docs repeatedly referring to rpc.requestAirdrop
  // See https://github.com/solana-labs/solana-web3.js/issues/3683
  //
  // @ts-expect-error TODO need to work out devnet/mainnet typing issue re: airdrops
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  /**
   * Airdrops SOL to an address if its balance is below the specified threshold.
   * @param {Address} address - The address to check balance and potentially airdrop to
   * @param {Lamports} airdropAmount - Amount of lamports to airdrop if needed
   * @param {Lamports} minimumBalance - Minimum balance threshold that triggers airdrop
   * @param {Commitment} commitment - The commitment level to use (default: "finalized")
   * @returns {Promise<string | null>} Transaction signature if airdrop occurred, null if no airdrop was needed
   */
  const airdropIfRequired = async (
    address: Address,
    airdropAmount: Lamports,
    minimumBalance: Lamports,
    // We're being conservative here, using the 'finalized' commitment
    // level because we want to ensure the SOL is always available
    // when the function return and users try and spend it.
    commitment: Commitment = "finalized",
  ): Promise<string | null> => {
    if (airdropAmount < 0n) {
      throw new Error(`Airdrop amount must be a positive number, not ${airdropAmount}`);
    }
    if (minimumBalance === 0n) {
      const signature = await airdrop({
        commitment,
        recipientAddress: address,
        lamports: airdropAmount,
      });
      return signature;
    }
    const balance = await getLamportBalance(address, commitment);

    if (balance >= minimumBalance) {
      return null;
    }
    const signature = await airdrop({
      commitment,
      recipientAddress: address,
      lamports: airdropAmount,
    });

    return signature;
  };
  return airdropIfRequired;
};
