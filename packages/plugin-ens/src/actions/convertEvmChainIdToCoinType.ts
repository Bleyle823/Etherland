import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    type Action,
} from "@elizaos/core";
import { z } from "zod";
import { generateObject, ModelClass } from "../utils/generation";

const schema = z.object({
    chainId: z.number().describe("The EVM chainId (e.g. 1 for Ethereum Mainnet, 137 for Polygon)"),
});

export const convertEvmChainIdToCoinTypeAction: Action = {
    name: "CONVERT_CHAIN_ID_TO_COINTYPE",
    similes: ["GET_COIN_TYPE", "CHAIN_ID_TO_COINTYPE"],
    description: "Converts an EVM Chain ID into its SLIP-0044 coin type representation used for ENS resolution.",
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        _options: any,
        callback?: HandlerCallback
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        }

        const convertContext = `You are an expert at extracting EVM chain IDs from user messages.
Extract the numeric chainId from the following message. 
Return only a JSON object with a "chainId" property as a number.

Message: ${message.content.text}

Response:`;

        const result = await generateObject({
            runtime,
            context: convertContext,
            modelClass: ModelClass.SMALL,
            schema,
        });

        const chainId = (result.object as any)?.chainId;

        if (chainId === undefined || chainId === null || isNaN(Number(chainId))) {
            const fallbackMsg = "I couldn't identify the numeric chain ID to convert.";
            if (callback) {
                callback({ text: fallbackMsg });
            }
            return { 
                success: false, 
                text: fallbackMsg,
                data: { error: "Missing chain ID" } 
            };
        }

        try {
            const numChainId = parseInt(chainId.toString(), 10);
            const cointype = numChainId === 1 ? 60 : (0x80000000 | numChainId) >>> 0;

            const replyText = `The coin type for EVM chain ID ${numChainId} is ${cointype}.`;
            if (callback) {
                callback({
                    text: replyText,
                });
            }

            return { 
                success: true, 
                text: replyText,
                data: { chainId: numChainId, coinType: cointype } 
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorReply = `Error converting chain ID: ${errorMessage}`;
            if (callback) {
                callback({ text: errorReply });
            }
            return { 
                success: false, 
                text: errorReply,
                data: { error: errorMessage } 
            };
        }
    },
    examples: [
        [
            {
                name: "{{name1}}",
                content: { text: "Convert chain ID 137 to a coin type." },
            },
            {
                name: "{{name2}}",
                content: { text: "The coin type for EVM chain ID 137 is 2147483785.", action: "CONVERT_CHAIN_ID_TO_COINTYPE" },
            },
        ],
    ] as ActionExample[][],
};
