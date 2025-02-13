// Based on smart-transaction.ts from https://github.com/mcintyre94/helius-smart-transactions-web3js2/blob/main/index.ts

import {
  IInstruction,
  getComputeUnitEstimateForTransactionMessageFactory,
  appendTransactionMessageInstruction,
  TransactionMessage,
  isWritableRole,
  isInstructionWithData,
  CompilableTransactionMessage,
  createSolanaRpcFromTransport,
} from "@solana/web3.js";
import {
  getSetComputeUnitPriceInstruction,
  identifyComputeBudgetInstruction,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
  ComputeBudgetInstruction,
} from "@solana-program/compute-budget";

export const getPriorityFeeEstimate = async (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  supportsGetPriorityFeeEstimate: boolean,
  transactionMessage: TransactionMessage,
  abortSignal: AbortSignal | null = null,
): Promise<number> => {
  const accountKeys = [
    ...new Set([
      ...transactionMessage.instructions.flatMap((instruction: IInstruction) =>
        (instruction.accounts ?? [])
          .filter((account) => isWritableRole(account.role))
          .map((account) => account.address),
      ),
    ]),
  ];

  // If the RPC doesn't support getPriorityFeeEstimate, use the median of the recent fees
  if (!supportsGetPriorityFeeEstimate) {
    const recentFeesResponse = await rpc.getRecentPrioritizationFees([...accountKeys]).send({ abortSignal });
    // @ts-expect-error TODO: typing error from original helius-smart-transactions-web3js2. Fix this.
    const recentFeesValues = recentFeesResponse.reduce((accumulator, current) => {
      if (current.prioritizationFee > 0n) {
        return [...accumulator, current.prioritizationFee];
      } else {
        return accumulator;
      }
    }, []);

    // Return the median fee
    // @ts-expect-error TODO: typing error from original helius-smart-transactions-web3js2. Fix this.
    recentFeesValues.sort((a, b) => Number(a - b));
    return Number(recentFeesValues[Math.floor(recentFeesValues.length / 2)]);
  }
  // Get a priority fee estimate, using Helius' `getPriorityFeeEstimate` method on Helius mainnet
  const { priorityFeeEstimate } = await rpc
    .getPriorityFeeEstimate({
      accountKeys,
      options: {
        recommended: true,
      },
    })
    .send({ abortSignal });

  return priorityFeeEstimate;
};

export const getComputeUnitEstimate = async (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  transactionMessage: CompilableTransactionMessage,
  abortSignal: AbortSignal | null = null,
) => {
  // add placeholder instruction for CU price if not already present
  // web3js estimate will add CU limit but not price
  // both take CUs, so we need both in the simulation
  const hasExistingComputeBudgetPriceInstruction = transactionMessage.instructions.some(
    (instruction) =>
      instruction.programAddress === COMPUTE_BUDGET_PROGRAM_ADDRESS &&
      isInstructionWithData(instruction) &&
      identifyComputeBudgetInstruction(instruction) === ComputeBudgetInstruction.SetComputeUnitPrice,
  );

  const transactionMessageToSimulate = hasExistingComputeBudgetPriceInstruction
    ? transactionMessage
    : appendTransactionMessageInstruction(getSetComputeUnitPriceInstruction({ microLamports: 0n }), transactionMessage);

  const computeUnitEstimateFn = getComputeUnitEstimateForTransactionMessageFactory({ rpc });
  // TODO: computeUnitEstimateFn expects an explicit 'undefined' for abortSignal,
  // fix upstream
  return computeUnitEstimateFn(transactionMessageToSimulate, {
    abortSignal: abortSignal ?? undefined,
  });
};
