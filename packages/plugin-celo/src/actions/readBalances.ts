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
import { createPublicClient, http, formatUnits, formatEther, isAddress } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import { celo } from "viem/chains";

const balanceSchema = z.object({
  walletAddress: z.string().optional().describe('The wallet address to check balances for (optional)'),
});

const extractionTemplate = `
Extract the wallet address from the message to check Celo balances.
If the user is asking about their own balance or 'my' balance without providing an address, RETURN AN EMPTY STRING OR UNDEFINED.
Return only a JSON object with a "walletAddress" property.
Message: {{message.content.text}}
`;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  }
] as const;

export const readBalancesAction: Action = {
  name: 'READ_BALANCES',
  similes: ['CHECK_CELO_BALANCE', 'GET_BALANCES'],
  description: 'Reads CELO native balance and stablecoin balances (USDC, USDT, USDm) on Celo network.',
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
        schema: balanceSchema,
      });

      let { walletAddress } = result.object as any;

      if (!walletAddress || !isAddress(walletAddress)) {
        // Fallback to agent's own address if none found in message or invalid address extracted
        walletAddress = runtime.getSetting('EVM_WALLET_ADDRESS');
        
        if (!walletAddress || !isAddress(walletAddress)) {
          const privateKey = runtime.getSetting('EVM_PRIVATE_KEY') as `0x${string}`;
          if (privateKey) {
            walletAddress = privateKeyToAddress(privateKey);
            logger.info({ src: 'plugin-celo', walletAddress }, 'Using agent default wallet address derived from private key');
          } else {
            throw new Error('No valid wallet address found in message and no valid agent EVM_WALLET_ADDRESS or EVM_PRIVATE_KEY configured');
          }
        } else {
          logger.info({ src: 'plugin-celo', walletAddress }, 'Using agent EVM_WALLET_ADDRESS from env');
        }
      }

      const publicClient = createPublicClient({
        chain: celo,
        transport: http("https://forno.celo.org"),
      });

      const [celoBalance, usdcBalance, usdmBalance] = await Promise.all([
        publicClient.getBalance({ address: walletAddress as `0x${string}` }),
        publicClient.readContract({
          address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        } as any).catch(() => 0n),
        publicClient.readContract({
          address: "0x765de816845861e75a25fca122bb6898b8b1282a", // USDm
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        } as any).catch(() => 0n)
      ]);
      
      const replyText = `Balances on Celo for ${walletAddress}:
- Native CELO: ${formatEther(celoBalance)}
- USDC: ${formatUnits(usdcBalance as bigint, 6)}
- USDm: ${formatUnits(usdmBalance as bigint, 18)}`;

      if (callback) {
        callback({ text: replyText });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error reading balances', error);
      if (callback) callback({ text: `Failed to read balances: ${error}` });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'What is my balance on Celo for 0xABC...?' } },
      { name: 'assistant', content: { text: 'Checking balances...', action: 'READ_BALANCES' } },
    ],
  ],
};
