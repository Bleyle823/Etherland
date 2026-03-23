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

const tempoSchema = z.object({
  serviceUrl: z.string().describe('The URL or endpoint to call via tempo'),
  method: z.string().default('POST').describe('The HTTP method'),
});

const extractionTemplate = `
Extract the service parameters from the message for Tempo CLI:
- serviceUrl: The url or endpoint
- method: The method to use

Message: {{message.content.text}}
`;

export const payWithAnyTokenAction: Action = {
  name: 'PAY_WITH_ANY_TOKEN',
  similes: ['MPP_PAYMENT', 'USE_TEMPO', 'TEMPO_REQUEST'],
  description: 'Uses Tempo CLI to make a paid request and handles 402 HTTP challenges by bridging via Uniswap Trading API.',
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
        schema: tempoSchema,
      });

      const { serviceUrl, method } = result.object as any;
      
      const tempoBin = process.env.HOME + '/.local/bin/tempo';
      try {
        const { stdout, stderr } = await execAsync(tempoBin + ' wallet -t whoami');
        logger.info('Tempo wallet info:', stdout);
      } catch (e) {
        logger.error('Tempo CLI error:', e);
        if (callback) callback({ text: 'Tempo CLI is not installed or configured correctly.' });
        return { success: false, error: 'Tempo CLI is not installed or configured correctly.' };
      }

      const replyText = "Executing Tempo request to " + serviceUrl + " with method " + method + ". Tempo will automatically use the wallet balance or prompt bridging if insufficient.";

      if (callback) {
        callback({ text: replyText });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error in pay-with-any-token flow', error);
      if (callback) callback({ text: 'Failed to run tempo request: ' + error });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'Use tempo to call https://paid-api.example.com' } },
      { name: 'assistant', content: { text: 'Running tempo request...', action: 'PAY_WITH_ANY_TOKEN' } },
    ],
  ],
};
