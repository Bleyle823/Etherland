import { mock } from "bun:test";

// Mock the local generation shim
mock.module("../utils/generation", () => {
    return {
        generateObject: mock(async () => {
            return {
                object: {
                    amount: "0.5",
                },
            };
        }),
        ModelClass: {
            SMALL: "small",
        },
    };
});

// Mock @elizaos/core for logger and other exports
mock.module("@elizaos/core", () => {
    return {
        logger: {
            error: mock(() => {}),
        },
    };
});

import { expect, it, describe } from "bun:test";
import { bridgeAssetsAction } from "../actions/bridgeAssets";
import type { IAgentRuntime, Memory, State } from "@elizaos/core";

describe("bridgeAssetsAction", () => {
    it("should extract amount and return success text", async () => {
        const runtime: Partial<IAgentRuntime> = {
            composeState: mock(async () => ({
                values: {},
                data: {},
                text: "",
            } as unknown as State)),
        };

        const message: Memory = {
            entityId: "00000000-0000-0000-0000-000000000000" as any,
            agentId: "00000000-0000-0000-0000-000000000001" as any,
            roomId: "00000000-0000-0000-0000-000000000002" as any,
            content: { text: "Bridge 0.5 ETH to Celo" },
        };

        const callback = mock();

        const result = await bridgeAssetsAction.handler(
            runtime as IAgentRuntime,
            message,
            {
                values: {},
                data: {},
                text: "",
            } as State,
            {},
            callback
        );

        expect((result as any).success).toBe(true);
        expect(callback).toHaveBeenCalled();
        const callArgs = (callback as any).mock.calls[0][0];
        expect(callArgs.text).toContain("Ready to bridge 0.5 ETH to Celo");
    });
});
