import { Lamports } from "@solana/web3.js";

export interface createKeyPairSignerOptions {
  envFileName?: string;
  envVariableName?: string;
  airdropAmount?: Lamports | null;
  minimumBalance?: Lamports;
  keyPairPath?: string;
}
