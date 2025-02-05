import { Lamports } from "@solana/web3.js";

export interface createWalletOptions {
  envFileName?: string;
  envVariableName?: string;
  airdropAmount?: Lamports | null;
  minimumBalance?: Lamports;
  keyPairPath?: string;
  prefix?: string | null;
  suffix?: string | null;
}
