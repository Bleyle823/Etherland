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
If the user specifies a network (e.g. "on Base"), use that chain ID (Base=8453, Celo=42220, Ethereum=1).
If no chain is specified, default to Base (8453).

Return only a JSON object with the following properties:
- swapper (0x...)
- tokenIn (0x... or symbol like "ETH", "USDC", "cUSD")
- tokenOut (0x... or symbol like "ETH", "USDC", "cUSD")
- tokenInChainId (number)
- tokenOutChainId (number)
- amount (string, use the human-readable amount like "0.001")
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

      // Symbol to Address Map (for common tokens)
      const tokenMap: Record<number, Record<string, string>> = {
        8453: { // Base
          "ETH": "0x4200000000000000000000000000000000000006", // WETH
          "WETH": "0x4200000000000000000000000000000000000006",
          "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
        1: { // Ethereum
          "ETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
          "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        },
        42220: { // Celo
          "CELO": "0x471EcE3750Da237f93B8E2997353916a4b1703d2",
          "cUSD": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
          "USDC": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
        }
      };

      const decimalMap: Record<string, number> = {
        "0x4200000000000000000000000000000000000006": 18, // Base WETH
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": 6,  // Base USDC
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": 18, // Mainnet WETH
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 6,  // Mainnet USDC
        "0x471EcE3750Da237f93B8E2997353916a4b1703d2": 18, // Celo CELO
        "0x765DE816845861e75A25fCA122bb6898B8B1282a": 18, // Celo cUSD
        "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": 6,  // Celo USDC
      };

      // Resolve tokenIn
      if (!isAddress(params.tokenIn as string)) {
        const symbol = (params.tokenIn as string).toUpperCase();
        const address = tokenMap[params.tokenInChainId]?.[symbol];
        if (address) {
          params.tokenIn = address;
        } else {
          throw new Error(`Could not resolve tokenIn symbol: ${params.tokenIn} on chain ${params.tokenInChainId}`);
        }
      }

      // Resolve tokenOut
      if (!isAddress(params.tokenOut as string)) {
        const symbol = (params.tokenOut as string).toUpperCase();
        const address = tokenMap[params.tokenOutChainId]?.[symbol];
        if (address) {
          params.tokenOut = address;
        } else {
          throw new Error(`Could not resolve tokenOut symbol: ${params.tokenOut} on chain ${params.tokenOutChainId}`);
        }
      }

      // Convert amount to base units
      if (params.amount && (params.amount.includes('.') || parseFloat(params.amount) < 100)) {
        const decimals = decimalMap[params.tokenIn.toLowerCase()] || 18; // Default to 18
        const floatAmount = parseFloat(params.amount);
        const { parseUnits } = await import("viem");
        params.amount = parseUnits(floatAmount.toString(), decimals).toString();
        logger.info({ src: 'plugin-uniswap', amount: params.amount }, 'Converted human amount to base units');
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
      
      if (!response.ok || data.detail) {
        throw new Error(`API Error: ${JSON.stringify(data)}`);
      }
      
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
