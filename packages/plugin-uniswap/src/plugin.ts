import type { Plugin } from '@elizaos/core';
import { checkApprovalAction } from './actions/checkApproval.ts';
import { getQuoteAction } from './actions/getQuote.ts';
import { executeSwapAction } from './actions/executeSwap.ts';
import { payWithAnyTokenAction } from './actions/payWithAnyToken.ts';

export const uniswapPlugin: Plugin = {
  name: 'plugin-uniswap',
  description: 'Uniswap Trading API and Tempo integration for Eliza',
  actions: [
    checkApprovalAction,
    getQuoteAction,
    executeSwapAction,
    payWithAnyTokenAction,
  ],
  providers: [],
  evaluators: [],
  services: [],
};
