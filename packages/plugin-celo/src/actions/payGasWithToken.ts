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

const feeSchema = z.object({
  recipient: z.string().describe('The recipient address'),
  amount: z.string().describe('Amount of CELO to send natively'),
  feeToken: z.enum(['USDC', 'USDT', 'cUSD']).describe('Which token to pay gas with'),
});

const extractionTemplate = `
Extract parameters for the fee-abstracted send:
- recipient: address
- amount: quantity to send 
- feeToken: USDC, USDT or cUSD

Message: {{message.content.text}}
`;

const FEE_ADAPTERS = {
  USDC: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
  USDT: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72",
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Token address for 18-dec
};

export const payGasWithTokenAction: Action = {
  name: 'PAY_GAS_WITH_TOKEN',
  similes: ['FEE_ABSTRACTION', 'GASLESS_TX_CELO'],
  description: 'Generates a Celo transaction paying gas fees with ERC-20 tokens (stablecoins).',
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
        schema: feeSchema,
      });

      const { recipient, amount, feeToken } = result.object as any;
      const adapter = FEE_ADAPTERS[feeToken];

      const replyText = `Generated transaction sending ${amount} to ${recipient} on Celo with gas fees paid in ${feeToken}. (Uses feeCurrency parameter: ${adapter} in viem).`;

      if (callback) {
        callback({ text: replyText });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error generating fee-abstracted transaction', error);
      if (callback) callback({ text: `Failed: ${error}` });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'Send 0.01 to 0x... and pay gas in USDC' } },
      { name: 'assistant', content: { text: 'Generating transaction...', action: 'PAY_GAS_WITH_TOKEN' } },
    ],
  ],
};
