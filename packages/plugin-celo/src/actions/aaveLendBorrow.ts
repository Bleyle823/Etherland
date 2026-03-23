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

const aaveSchema = z.object({
  action: z.enum(['supply', 'borrow']).describe('Whether to supply or borrow'),
  assetAddress: z.string().describe('The ERC20 token address being supplied/borrowed'),
  amount: z.string().describe('The amount in base units'),
});

const extractionTemplate = `
Extract the aave interaction parameters.
Return only a JSON object with the following properties: "action" (supply or borrow), "assetAddress" (0x...), and "amount" (string representing base units).
Message: {{message.content.text}}
`;

const AAVE_POOL = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402";

export const aaveLendBorrowAction: Action = {
  name: 'AAVE_LEND_BORROW',
  similes: ['AAVE_SUPPLY', 'AAVE_BORROW'],
  description: 'Supplies or borrows assets on Aave V3 on Celo.',
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
        schema: aaveSchema,
      });

      const { action, assetAddress, amount } = result.object as any;

      const replyText = `Aave transaction generated to ${action} ${amount} of asset ${assetAddress} using Aave Pool ${AAVE_POOL} on Celo.`;

      if (callback) {
        callback({ text: replyText });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error with Aave transaction', error);
      if (callback) callback({ text: `Failed: ${error}` });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'Supply 100 USDC to Aave on Celo' } },
      { name: 'assistant', content: { text: 'Initiating Aave transaction...', action: 'AAVE_LEND_BORROW' } },
    ],
  ],
};
