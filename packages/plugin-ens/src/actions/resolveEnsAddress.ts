import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    type Action,
} from "@elizaos/core";
import { createPublicClient, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { z } from "zod";
import { generateObject, ModelClass } from "../utils/generation";

const schema = z.object({
    address: z.string().describe("The Ethereum address to resolve an ENS name for (e.g. 0xd8dA6BF...E53415D37aA96045)"),
});

export const resolveEnsAddressAction: Action = {
    name: "RESOLVE_ENS_ADDRESS",
    similes: ["GET_ENS_FROM_ADDRESS", "LOOKUP_ETHEREUM_ADDRESS_NAME"],
    description: "Resolve an Ethereum address back to its primary ENS name.",
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

        const resolveEnsAddressContext = `You are an expert at extracting Ethereum addresses from user messages.
Extract the Ethereum address from the following message. 
Return only a JSON object with an "address" property. Ensure the address starts with 0x and is exactly 42 characters long.

Message: ${message.content.text}

Response:`;

        const result = await generateObject({
            runtime,
            context: resolveEnsAddressContext,
            modelClass: ModelClass.SMALL,
            schema,
        });

        const address = (result.object as any)?.address;

        if (!address || !isAddress(address)) {
            const fallbackMsg = "I couldn't identify a valid Ethereum address to resolve. Please provide one.";
            if (callback) {
                callback({
                    text: fallbackMsg,
                });
            }
            return { 
                success: false, 
                text: fallbackMsg,
                data: { error: "Invalid or missing Ethereum address" } 
            };
        }

        try {
            const client = createPublicClient({
                transport: http(),
                chain: mainnet,
            });

            const name = await client.getEnsName({ address: address as `0x${string}` });

            const replyText = name ? `The ENS name for the address ${address} is ${name}.` : `No ENS name was found for the address ${address}.`;
            if (callback) {
                callback({
                    text: replyText,
                });
            }

            return { 
                success: true, 
                text: replyText,
                data: { address, name } 
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorReply = `Error resolving ENS address: ${errorMessage}`;
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
                content: { text: "Can you resolve the ENS name for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?" },
            },
            {
                name: "{{name2}}",
                content: { text: "The ENS name for the address 0xd8dA... is vitalik.eth.", action: "RESOLVE_ENS_ADDRESS" },
            },
        ],
    ] as ActionExample[][],
};
