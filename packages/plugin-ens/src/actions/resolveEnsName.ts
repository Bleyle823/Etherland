import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    type Action,
} from "@elizaos/core";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { z } from "zod";
import { generateObject, ModelClass } from "../utils/generation";

const schema = z.object({
    name: z.string().describe("The ENS name to resolve, usually ending in .eth (e.g. vitalik.eth)"),
});

export const resolveEnsNameAction: Action = {
    name: "RESOLVE_ENS_NAME",
    similes: ["GET_ADDRESS_FROM_ENS", "ENS_NAME_TO_ADDRESS", "LOOKUP_ENS_NAME"],
    description: "Resolve an ENS name (like vitalik.eth) to its corresponding Ethereum address.",
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

        const resolveEnsNameContext = `You are an expert at extracting ENS names from user messages.
Extract the ENS name from the following message. 
Return only a JSON object with a "name" property containing the full ENS name (e.g., "vitalik.eth").

Message: ${message.content.text}

Response:`;

        const result = await generateObject({
            runtime,
            context: resolveEnsNameContext,
            modelClass: ModelClass.SMALL,
            schema,
        });

        const name = (result.object as any)?.name;

        if (!name) {
            const fallbackMsg = "I couldn't identify the ENS name to resolve. Please provide a valid ENS name like vitalik.eth.";
            if (callback) {
                callback({
                    text: fallbackMsg,
                });
            }
            return { 
                success: false, 
                text: fallbackMsg,
                data: { error: "Missing ENS name" } 
            };
        }

        try {
            const client = createPublicClient({
                transport: http(),
                chain: mainnet,
            });

            const address = await client.getEnsAddress({ name });

            const replyText = address ? `The Ethereum address for ${name} is ${address}.` : `No address was found for the ENS name ${name}.`;
            if (callback) {
                callback({
                    text: replyText,
                });
            }

            return { 
                success: true, 
                text: replyText,
                data: { name, address } 
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorReply = `Error resolving ENS name: ${errorMessage}`;
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
                content: { text: "What is the address for vitalik.eth?" },
            },
            {
                name: "{{name2}}",
                content: { text: "The Ethereum address for vitalik.eth is 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045.", action: "RESOLVE_ENS_NAME" },
            },
        ],
        [
            {
                name: "{{name1}}",
                content: { text: "Can you resolve the ENS name brantly.eth?" },
            },
            {
                name: "{{name2}}",
                content: { text: "The Ethereum address for brantly.eth is 0x983110309620D911731Ac0932219af06091b6744.", action: "RESOLVE_ENS_NAME" },
            },
        ],
    ] as ActionExample[][],
};
