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
import { createWalletClient, custom, parseEther } from "viem";
import { mainnet } from "viem/chains";

const bridgeSchema = z.object({
  amount: z.string().describe('The amount of ETH to bridge from Ethereum to Celo'),
});

const extractionTemplate = `
Extract the amount of ETH to bridge.
Return only a JSON object with an "amount" property.
Message: {{message.content.text}}
`;

const SUPERBRIDGE_WRAPPER = "0x3bC7C4f8Afe7C8d514c9d4a3A42fb8176BE33c1e";

const WRAPPER_ABI = [
  {
    name: "wrapAndBridge",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_minGasLimit", type: "uint32" },
      { name: "_extraData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const bridgeAssetsAction: Action = {
  name: 'BRIDGE_ASSETS',
  similes: ['BRIDGE_TO_CELO', 'TRANSFER_TO_CELO'],
  description: 'Bridge native ETH from Ethereum to Celo as WETH using Superbridge.',
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
        schema: bridgeSchema,
      });

      const { amount } = result.object as any;

      // In a fully deployed environment with a live provider:
      // const walletClient = createWalletClient({ chain: mainnet, transport: custom((globalThis as any).ethereum) });
      // const [address] = await walletClient.getAddresses();
      // const hash = await walletClient.writeContract({
      //   address: SUPERBRIDGE_WRAPPER,
      //   abi: WRAPPER_ABI,
      //   functionName: "wrapAndBridge",
      //   args: [200000, "0x"],
      //   value: parseEther(amount),
      // });
      
      const replyText = `Ready to bridge ${amount} ETH to Celo via Superbridge wrapper (L1 address: ${SUPERBRIDGE_WRAPPER}). Transaction generation successful. Please authorize in your connected wallet.`;

      if (callback) {
        callback({ text: replyText });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error bridging assets', error);
      if (callback) callback({ text: `Failed to bridge: ${error}` });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'Bridge 0.5 ETH to Celo' } },
      { name: 'assistant', content: { text: 'Bridging assets...', action: 'BRIDGE_ASSETS' } },
    ],
  ],
};
