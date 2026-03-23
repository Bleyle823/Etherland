import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import { generateObject, ModelClass } from '../utils/generation';
import { z } from 'zod';
import { isAddress } from 'viem';

const checkApprovalSchema = z.object({
  walletAddress: z.string().describe('The wallet address of the user'),
  token: z.string().describe('The ERC20 token address to check approval for'),
  amount: z.string().describe('The amount of tokens to check approval for (in wei/base units)'),
  chainId: z.number().describe('The chain ID where the token exists'),
});

const extractionTemplate = `
Extract the following information from the user's message about checking token approval:
- walletAddress: The Ethereum wallet address (0x...)
- token: The ERC20 token address (0x...)
- amount: The amount needed (integer string)
- chainId: The numerical chain ID (e.g., 1 for Ethereum, 8453 for Base)

Message: {{message.content.text}}
`;

export const checkApprovalAction: Action = {
  name: 'CHECK_APPROVAL',
  similes: ['CHECK_TOKEN_APPROVAL', 'VERIFY_ALLOWANCE'],
  description: 'Checks if a token is approved for swapping via the Uniswap Trading API.',
  validate: async () => true,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options: any,
    callback?: HandlerCallback
  ) => {
    try {
      if (!state) state = (await runtime.composeState(message)) as State;

      const result = await generateObject({
        runtime,
        context: extractionTemplate.replace('{{message.content.text}}', message.content.text),
        modelClass: ModelClass.SMALL,
        schema: checkApprovalSchema,
      });

      const params = result.object as any;

      if (!params.walletAddress || !isAddress(params.walletAddress)) {
        params.walletAddress = runtime.getSetting('EVM_WALLET_ADDRESS');

        if (!params.walletAddress || !isAddress(params.walletAddress)) {
          const privateKey = runtime.getSetting('EVM_PRIVATE_KEY') as `0x${string}`;
          if (privateKey) {
            const { privateKeyToAddress } = await import("viem/accounts");
            params.walletAddress = privateKeyToAddress(privateKey);
            logger.info({ src: 'plugin-uniswap', walletAddress: params.walletAddress }, 'Using agent default wallet address derived from private key');
          } else {
            throw new Error('No valid wallet address found in message and no valid agent EVM_WALLET_ADDRESS or EVM_PRIVATE_KEY configured');
          }
        } else {
          logger.info({ src: 'plugin-uniswap', walletAddress: params.walletAddress }, 'Using agent EVM_WALLET_ADDRESS from env');
        }
      }

      const apiKey = runtime.getSetting('UNISWAP_API_KEY') || process.env.UNISWAP_API_KEY;

      if (!apiKey) {
        throw new Error('UNISWAP_API_KEY is not configured');
      }

      const response = await fetch('https://trade-api.gateway.uniswap.org/v1/check_approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey as string,
          'x-universal-router-version': '2.0',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      const needsApproval = data.approval !== null;

      const replyText = needsApproval
        ? `Token approval is required. Spender: ${data.approval.to}. Please sign an approval transaction.`
        : `Token is already approved for swapping.`;

      if (callback) {
        callback({ text: replyText, data: data.approval });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error checking approval', error);
      if (callback) callback({ text: `Failed to check approval: ${error}` });
      return { success: false };
    }
  },
  examples: [
    [
      {
        name: 'user1',
        content: { text: 'Check approval for 100 USDC on Base (chain 8453) for my wallet 0x123...' },
      },
      {
        name: 'assistant',
        content: { text: 'Checking token approval...', action: 'CHECK_APPROVAL' },
      },
    ],
  ],
};
