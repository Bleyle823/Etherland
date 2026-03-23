import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    type Action,
} from "@elizaos/core";
import { namehash as namehashViem } from "viem/ens";
import { z } from "zod";
import { generateObject, ModelClass } from "../utils/generation";

const schema = z.object({
    name: z.string().describe("The ENS name to hash"),
});

export const namehashAction: Action = {
    name: "COMPUTE_NAMEHASH",
    similes: ["GET_NAMEHASH", "ENS_NAMEHASH"],
    description: "Computes the namehash for a given ENS name.",
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

        const namehashContext = `Extract the ENS name from the user's message to compute its namehash.
Message: ${message.content.text}
Given the above context, extract the ENS name.
`;

        const result = await generateObject({
            runtime,
            context: namehashContext,
            modelClass: ModelClass.SMALL,
            schema,
        });

        const { name } = result.object as any;

        if (!name) {
            if (callback) {
                callback({ text: "I couldn't identify the ENS name to compute the namehash for." });
            }
            return { success: false, error: "Missing ENS name" };
        }

        try {
            const hash = namehashViem(name);

            if (callback) {
                callback({
                    text: `The namehash for ${name} is ${hash}.`,
                });
            }

            return { success: true, data: { name, hash } };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (callback) {
                callback({ text: `Error computing namehash: ${errorMessage}` });
            }
            return { success: false, error: errorMessage };
        }
    },
    examples: [
        [
            {
                name: "{{name1}}",
                content: { text: "What's the namehash for vitalik.eth?" },
            },
            {
                name: "{{name2}}",
                content: { text: "The namehash for vitalik.eth is 0xee6c4522...", action: "COMPUTE_NAMEHASH" },
            },
        ],
    ] as ActionExample[][],
};
