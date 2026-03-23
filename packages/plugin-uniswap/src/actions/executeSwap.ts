import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import { isAddress, isHex } from 'viem';

export const executeSwapAction: Action = {
  name: 'EXECUTE_SWAP',
  similes: ['RUN_SWAP', 'SUBMIT_SWAP', 'CONFIRM_SWAP'],
  description: 'Takes a quote from the GET_QUOTE action and generates a broadcastable swap transaction from the Uniswap Trading API.',
  validate: async () => true,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options: any,
    callback?: HandlerCallback
  ) => {
    try {
      const apiKey = runtime.getSetting('UNISWAP_API_KEY') || process.env.UNISWAP_API_KEY;
      if (!apiKey) throw new Error('UNISWAP_API_KEY is not configured');

      // In a real Eliza scenario, we retrieve the last quote from state/memory.
      // For the sake of this implementation, we attempt to find it in the message data 
      // or state.data if the previous action (GET_QUOTE) stored it there.
      let quoteResponse = (message.content as any).quote || (state as any)?.data?.quote;

      if (!quoteResponse) {
        // Automatically fetch quote if not found in state
        try {
          const { getQuoteAction } = await import('./getQuote.ts');
          const quoteResult = await getQuoteAction.handler(runtime, message, state, _options, undefined);
          
          if (!quoteResult || !quoteResult.success) {
            const errorMsg = "Failed to automatically generate quote for swap.";
            if (callback) callback({ text: errorMsg });
            return { success: false, error: errorMsg };
          }
          
          // Re-check state if getQuoteAction populated it
          quoteResponse = (message.content as any).quote || (state as any)?.data?.quote;
          
          if (!quoteResponse && quoteResult.data) {
             // Fallback: use data returned directly from getQuoteAction
             quoteResponse = quoteResult.data;
          }

          if (!quoteResponse) {
             logger.warn("getQuoteAction succeeded but didn't return quote data as expected.");
             const errorMsg = "Automatically generated quote not found in state.";
             if (callback) callback({ text: errorMsg });
             return { success: false, error: errorMsg };
          }
        } catch (e: any) {
          const errorMsg = `No quote found, and automatic quote generation failed: ${e.message}`;
          if (callback) callback({ text: errorMsg });
          return { success: false, error: errorMsg };
        }
      }

      // 1. Prepare the swap request body
      // We must spread the quote response and handle permitData correctly by routing type
      const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
      const swapRequest: Record<string, any> = { ...cleanQuote };

      const isUniswapX =
        quoteResponse.routing === 'DUTCH_V2' ||
        quoteResponse.routing === 'DUTCH_V3' ||
        quoteResponse.routing === 'PRIORITY';

      // Note: signature would normally come from a wallet provider or user signing step.
      // If available in the message/state, we attach it.
      const signature = (message.content as any).signature || (state as any)?.data?.signature;

      if (isUniswapX) {
        // UniswapX: signature only — permitData must NOT go to /swap
        if (signature) swapRequest.signature = signature;
      } else {
        // CLASSIC: both signature and permitData must be present if using Permit2
        if (signature && permitData && typeof permitData === 'object') {
          swapRequest.signature = signature;
          swapRequest.permitData = permitData;
        }
      }

      // 2. Call the /swap endpoint
      const response = await fetch('https://trade-api.gateway.uniswap.org/v1/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey as string,
          'x-universal-router-version': '2.0',
        },
        body: JSON.stringify(swapRequest),
      });

      const swapData = await response.json();

      if (!swapData.swap) {
        throw new Error('Failed to generate swap transaction. Quote might have expired.');
      }

      // 3. Validate the transaction
      const tx = swapData.swap;
      if (!tx.data || tx.data === '0x' || !isHex(tx.data)) {
        throw new Error('Invalid swap data returned from API');
      }
      if (!isAddress(tx.to) || !isAddress(tx.from)) {
        throw new Error('Invalid addresses in swap transaction');
      }

      const replyText = `Swap transaction generated successfully!
To: ${tx.to}
Value: ${tx.value}
ChainId: ${tx.chainId}
Data: ${tx.data.substring(0, 20)}...
Please sign and broadcast this transaction to complete the swap.`;

      if (callback) {
        callback({ 
          text: replyText, 
          data: { 
            transaction: tx,
            quote: quoteResponse 
          } 
        });
      }

      return { success: true };
    } catch (error: any) {
      logger.error('Error executing swap', error);
      if (callback) callback({ text: `Failed to execute swap: ${error.message}` });
      return { success: false };
    }
  },
  examples: [
    [
      { name: 'user1', content: { text: 'Execute the swap' } },
      { name: 'assistant', content: { text: 'Generating transaction...', action: 'EXECUTE_SWAP' } },
    ],
  ],
};
