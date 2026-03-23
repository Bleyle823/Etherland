import type { Plugin } from '@elizaos/core';
import { bridgeAssetsAction } from './actions/bridgeAssets.ts';
import { readBalancesAction } from './actions/readBalances.ts';
import { aaveLendBorrowAction } from './actions/aaveLendBorrow.ts';
import { payGasWithTokenAction } from './actions/payGasWithToken.ts';
import { verifyContractAction } from './actions/verifyContract.ts';

export const celoPlugin: Plugin = {
  name: 'plugin-celo',
  description: 'Celo network integration: Bridge, DeFi (Aave), Stablecoins, Fee Abstraction, and Contract Verification',
  actions: [
    bridgeAssetsAction,
    readBalancesAction,
    aaveLendBorrowAction,
    payGasWithTokenAction,
    verifyContractAction,
  ],
  providers: [],
  evaluators: [],
  services: [],
};
