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
  network: z.enum(['celo', 'base']).default('celo').describe('The network to check balances on (celo or base)'),
});

const extractionTemplate = `
Extract the wallet address and network from the message to check balances.
If the user mentions "Base", use network "base". 
If the user mentions "Celo", use network "celo".
Default to "celo" if no network is mentioned.
If the user is asking about their own balance or 'my' balance without providing an address, RETURN AN EMPTY STRING OR UNDEFINED for walletAddress.
Return only a JSON object with properties "walletAddress" and "network".
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
  description: 'Reads CELO native balance and stablecoin balances (USDC, USDT, cUSD) on Celo network.',
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

      let network = (result.object as any).network || 'celo';
      let walletAddress = (result.object as any).walletAddress;

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

      const isBase = network.toLowerCase() === 'base';
      const rpcUrl = isBase ? "https://mainnet.base.org" : "https://forno.celo.org";
      const chain = isBase ? { id: 8453, name: 'Base' } : celo;

      const publicClient = createPublicClient({
        chain: chain as any,
        transport: http(rpcUrl),
      });

      const usdcAddress = isBase ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" : "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
      const stableSymbol = isBase ? "USDC" : "cUSD";
      const stableAddress = isBase ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" : "0x765de816845861e75a25fca122bb6898b8b1282a";
      const nativeSymbol = isBase ? "ETH" : "CELO";

      const [nativeBalance, usdcBalance, stableBalance] = await Promise.all([
        publicClient.getBalance({ address: walletAddress as `0x${string}` }),
        publicClient.readContract({
          address: usdcAddress as `0x${string}`, // USDC
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        } as any).catch(() => 0n),
        publicClient.readContract({
          address: stableAddress as `0x${string}`, // cUSD or another USDC copy if we wanted, but let's just use the main one
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        } as any).catch(() => 0n)
      ]);
      
      const networkName = isBase ? "Base" : "Celo";
      const replyText = `Balances on ${networkName} for ${walletAddress}:
- ${nativeSymbol}: ${formatEther(nativeBalance)}
- USDC: ${formatUnits(usdcBalance as bigint, 6)}
- ${stableSymbol}: ${formatUnits(stableBalance as bigint, isBase ? 6 : 18)}`;

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
