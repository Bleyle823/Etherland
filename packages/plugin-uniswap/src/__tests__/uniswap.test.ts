import { mock } from "bun:test";

let generatedObjectResponse: any = {};

mock.module("../utils/generation", () => {
    return {
        generateObject: mock(async () => {
            return {
                object: generatedObjectResponse,
            };
        }),
        ModelClass: {
            SMALL: "small",
        },
    };
});

mock.module("@elizaos/core", () => {
    return {
        logger: {
            error: mock(() => {}),
        },
    };
});

import { expect, it, describe, beforeEach, afterEach } from "bun:test";
import { checkApprovalAction } from "../actions/checkApproval";
import { getQuoteAction } from "../actions/getQuote";
import { executeSwapAction } from "../actions/executeSwap";
import type { IAgentRuntime, Memory, State } from "@elizaos/core";

const mockRuntime: Partial<IAgentRuntime> = {
    composeState: mock(async () => ({
        values: {},
        data: {},
        text: "",
    } as unknown as State)),
    getSetting: mock(() => "mock-api-key"),
};

const mockMessage = (text: string, data?: any): Memory => ({
    entityId: "00000000-0000-0000-0000-000000000000" as any,
    agentId: "00000000-0000-0000-0000-000000000001" as any,
    roomId: "00000000-0000-0000-0000-000000000002" as any,
    content: { text, ...data },
});

// Since the Uniswap API requires a real API key to actually return 200 responses,
// we will intercept `fetch` and mock the response so tests can complete without an API key.
const originalFetch = globalThis.fetch;

describe("Uniswap Plugin Actions", () => {
    beforeEach(() => {
        generatedObjectResponse = {};
        
        // Setup default fetch mock
        globalThis.fetch = mock(async (url: any) => {
            if (url.toString().includes("/check_approval")) {
                return new Response(JSON.stringify({ approval: null }), { status: 200 });
            }
            if (url.toString().includes("/quote")) {
                return new Response(JSON.stringify({ routing: "CLASSIC", quote: { gasFeeUSD: "2", output: { amount: "100" } } }), { status: 200 });
            }
            if (url.toString().includes("/swap")) {
                return new Response(JSON.stringify({ swap: { data: "0x123", to: "0x1111111111111111111111111111111111111111", from: "0x1111111111111111111111111111111111111111", value: "0", chainId: 1 } }), { status: 200 });
            }
            return new Response("Not Found", { status: 404 });
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe("checkApprovalAction", () => {
        it("should successfully check approval and see it is already approved", async () => {
            generatedObjectResponse = { walletAddress: "0x123", token: "0x456", amount: "100", chainId: 1 };
            const callback = mock();

            const result = await checkApprovalAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Check approval"),
                undefined,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("Token is already approved");
        });
    });

    describe("getQuoteAction", () => {
        it("should successfully get a quote", async () => {
            generatedObjectResponse = { swapper: "0x123", tokenIn: "0x456", tokenOut: "0x789", tokenInChainId: 1, tokenOutChainId: 1, amount: "100", type: "EXACT_INPUT" };
            const callback = mock();

            const result = await getQuoteAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Get quote"),
                undefined,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("Retrieved quote using CLASSIC");
        });
    });

    describe("executeSwapAction", () => {
        it("should successfully execute a swap", async () => {
            generatedObjectResponse = {};
            const callback = mock();

            const result = await executeSwapAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Execute swap", { quote: { routing: "PRIORITY" } }),
                undefined,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("Swap transaction generated successfully!");
        });
        
        it("should fail gracefully if no quote is found", async () => {
            generatedObjectResponse = {};
            const callback = mock();

            const result = await executeSwapAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Execute swap"), // no quote provided
                undefined,
                {},
                callback
            );

            expect((result as any).success).toBe(false);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("No quote found");
        });
    });
});
