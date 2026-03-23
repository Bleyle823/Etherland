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

const getQuoteSchema = z.object({
  swapper: z.string().describe('The wallet address of the swapper'),
  tokenIn: z.string().describe('The token address being sold (or WETH)'),
  tokenOut: z.string().describe('The token address being bought (or WETH)'),
  tokenInChainId: z.number().describe('The chain ID of tokenIn'),
  tokenOutChainId: z.number().describe('The chain ID of tokenOut'),
  amount: z.string().describe('The amount in base units'),
  type: z.enum(['EXACT_INPUT', 'EXACT_OUTPUT']).describe('Trade type'),
  slippageTolerance: z.number().default(0.5).describe('Slippage tolerance percentage'),
  routingPreference: z.enum(['BEST_PRICE', 'FASTEST', 'CLASSIC']).default('BEST_PRICE'),
});

const extractionTemplate = `
Extract swap parameters from the message.
Return only a JSON object with the following properties:
- swapper (0x...)
- tokenIn (0x...)
- tokenOut (0x...)
- tokenInChainId (number)
- tokenOutChainId (number)
- amount (integer string)
- type (EXACT_INPUT or EXACT_OUTPUT)

Message: {{message.content.text}}
`;

export const getQuoteAction: Action = {
  name: 'GET_QUOTE',
  similes: ['SWAP_QUOTE', 'GET_PRICE'],
  description: 'Gets a swap quote from the Uniswap Trading API.',
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
        schema: getQuoteSchema,
      });

      const params = result.object as any;

      if (!params.swapper || !isAddress(params.swapper)) {
        params.swapper = runtime.getSetting('EVM_WALLET_ADDRESS');

        if (!params.swapper || !isAddress(params.swapper)) {
          const privateKey = runtime.getSetting('EVM_PRIVATE_KEY') as `0x${string}`;
          if (privateKey) {
            const { privateKeyToAddress } = await import("viem/accounts");
            params.swapper = privateKeyToAddress(privateKey);
            logger.info({ src: 'plugin-uniswap', swapper: params.swapper }, 'Using agent default swapper address derived from private key');
          } else {
            throw new Error('No valid swapper address found in message and no valid agent EVM_WALLET_ADDRESS or EVM_PRIVATE_KEY configured');
          }
        } else {
          logger.info({ src: 'plugin-uniswap', swapper: params.swapper }, 'Using agent EVM_WALLET_ADDRESS from env');
        }
      }
      const apiKey = runtime.getSetting('UNISWAP_API_KEY') || process.env.UNISWAP_API_KEY;

      if (!apiKey) throw new Error('UNISWAP_API_KEY is not configured');

      const response = await fetch('https://trade-api.gateway.uniswap.org/v1/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey as string,
          'x-universal-router-version': '2.0',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      
      const routing = data.routing;
      let replyText = `Retrieved quote using ${routing} routing.`;
      
      if (routing === 'CLASSIC' && data.quote) {
         replyText += ` Gas: $\${data.quote.gasFeeUSD}. Output: \${data.quote.output.amount}`;
      } else if (data.quote && data.quote.orderInfo) {
         replyText += ` Output: \${data.quote.orderInfo.outputs[0].startAmount}`;
      }

      if (callback) {
        callback({ text: replyText, data: data });
      }

      return { success: true, data: data };
    } catch (error) {
      logger.error('Error getting quote', error);
      if (callback) callback({ text: `Failed to get quote: ${error}` });
      return { success: false };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'Get a quote to swap 100 USDC to ETH on Base' } },
      { name: 'assistant', content: { text: 'Fetching quote...', action: 'GET_QUOTE' } },
    ],
  ],
};
