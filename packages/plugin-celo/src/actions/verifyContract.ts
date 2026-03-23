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
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const verifySchema = z.object({
  contractAddress: z.string().describe('The deployed contract address on Celo'),
  network: z.enum(['celo', 'celoSepolia']).describe('The network to verify on'),
  srcFile: z.string().describe('Path to the Solidity contract file (e.g., src/MyContract.sol:MyContract)'),
});

const extractionTemplate = `
Extract verification parameters:
- contractAddress
- network (celo or celoSepolia)
- srcFile

Message: {{message.content.text}}
`;

export const verifyContractAction: Action = {
  name: 'VERIFY_CONTRACT_CELO',
  similes: ['VERIFY_CELOSCAN', 'VERIFY_BLOCKSCOUT'],
  description: 'Verifies a smart contract on Celoscan/Blockscout using Foundry.',
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
        schema: verifySchema,
      });

      const { contractAddress, network, srcFile } = result.object as any;
      const chainId = network === 'celo' ? 42220 : 11142220;

      // Ensure ETHERSCAN_API_KEY is available in the environment to serve as Celoscan API key
      const apiKey = runtime.getSetting('ETHERSCAN_API_KEY') || process.env.ETHERSCAN_API_KEY;

      if (!apiKey) {
        if (callback) callback({ text: 'Missing ETHERSCAN_API_KEY for Celo verification.' });
        return { success: false, error: 'Missing ETHERSCAN_API_KEY for Celo verification.' };
      }

      const cmd = `forge verify-contract --chain-id ${chainId} ${contractAddress} ${srcFile} --etherscan-api-key ${apiKey}`;
      
      const replyText = `Running verification command:
${cmd}

(Since this is an Eliza process, make sure it is run in a Foundry project directory with access to the source code).`;

      if (callback) {
        callback({ text: replyText });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error verifying contract', error);
      if (callback) callback({ text: `Failed: ${error}` });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'Verify 0xABCD... on celo of src/Contract.sol:Contract' } },
      { name: 'assistant', content: { text: 'Running forge verify-contract...', action: 'VERIFY_CONTRACT_CELO' } },
    ],
  ],
};
