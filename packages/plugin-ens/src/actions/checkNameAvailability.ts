import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    type Action,
} from "@elizaos/core";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { z } from "zod";
import { generateObject, ModelClass } from "../utils/generation";

const schema = z.object({
    name: z.string().describe("The ENS name to check availability for (e.g. vitalik.eth)"),
});

export const checkNameAvailabilityAction: Action = {
    name: "CHECK_ENS_AVAILABILITY",
    similes: ["IS_ENS_AVAILABLE", "CHECK_DOMAIN"],
    description: "Check if a .eth domain name is available for registration.",
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

        const checkContext = `You are an expert at extracting ENS names from user messages.
Extract the ENS name from the following message to check its availability. 
Return only a JSON object with a "name" property.

Message: ${message.content.text}

Response:`;

        const result = await generateObject({
            runtime,
            context: checkContext,
            modelClass: ModelClass.SMALL,
            schema,
        });

        const name = (result.object as any)?.name;

        if (!name) {
            const fallbackMsg = "I couldn't identify the ENS name to check.";
            if (callback) {
                callback({ text: fallbackMsg });
            }
            return { 
                success: false, 
                text: fallbackMsg,
                data: { error: "Missing ENS name" } 
            };
        }

        if (!name.endsWith('.eth') || name.split('.').length > 2) {
            const errorMsg = 'Invalid name - this tool only supports .eth 2LDs, not subdomains or other TLDs. Example: greg.eth';
            if (callback) {
                callback({
                    text: errorMsg,
                });
            }
            return { 
                success: false, 
                text: errorMsg,
                data: { error: 'Invalid ENS name format' } 
            };
        }

        try {
            const client = createPublicClient({
                transport: http(),
                chain: mainnet,
            });

            const isAvailable = await client.readContract({
                address: '0x253553366Da8546fC250F225fe3d25d0C782303b', // controller.ens.eth
                abi: parseAbi(['function available(string name) view returns (bool)']),
                functionName: 'available',
                args: [normalize(name.slice(0, -4))],
            });

            const replyText = isAvailable ? `Good news! The ENS name ${name} is available for registration.` : `Unfortunately, the ENS name ${name} is NOT available.`;
            if (callback) {
                callback({
                    text: replyText,
                });
            }

            return { 
                success: true, 
                text: replyText,
                data: { name, available: isAvailable } 
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorReply = `Error checking availability: ${errorMessage}`;
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
                content: { text: "Is vitalik.eth available?" },
            },
            {
                name: "{{name2}}",
                content: { text: "Unfortunately, the ENS name vitalik.eth is NOT available.", action: "CHECK_ENS_AVAILABILITY" },
            },
        ],
        [
            {
                name: "{{name1}}",
                content: { text: "Check if somecompletelyrandomname.eth is available" },
            },
            {
                name: "{{name2}}",
                content: { text: "Good news! The ENS name somecompletelyrandomname.eth is available for registration.", action: "CHECK_ENS_AVAILABILITY" },
            },
        ],
    ] as ActionExample[][],
};
