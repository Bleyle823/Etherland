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

import { expect, it, describe, beforeEach } from "bun:test";
import { resolveEnsNameAction } from "../actions/resolveEnsName";
import { resolveEnsAddressAction } from "../actions/resolveEnsAddress";
import { namehashAction } from "../actions/namehash";
import { convertEvmChainIdToCoinTypeAction } from "../actions/convertEvmChainIdToCoinType";
import { checkNameAvailabilityAction } from "../actions/checkNameAvailability";
import type { IAgentRuntime, Memory, State } from "@elizaos/core";

const mockRuntime: Partial<IAgentRuntime> = {
    composeState: mock(async () => ({
        values: {},
        data: {},
        text: "",
    } as unknown as State)),
};

const mockMessage = (text: string): Memory => ({
    entityId: "00000000-0000-0000-0000-000000000000" as any,
    agentId: "00000000-0000-0000-0000-000000000001" as any,
    roomId: "00000000-0000-0000-0000-000000000002" as any,
    content: { text },
});

describe("ENS Plugin Actions", () => {
    beforeEach(() => {
        generatedObjectResponse = {};
    });

    describe("resolveEnsNameAction", () => {
        it("should resolve a valid ENS name", async () => {
            generatedObjectResponse = { name: "vitalik.eth" };
            const callback = mock();

            const result = await resolveEnsNameAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("What is the address for vitalik.eth?"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
        });
    });

    describe("resolveEnsAddressAction", () => {
        it("should resolve a valid Ethereum address", async () => {
            generatedObjectResponse = { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" };
            const callback = mock();

            const result = await resolveEnsAddressAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("What is the ENS name for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("vitalik.eth"); // It might resolve to a different primary, but it should succeed
        });
    });

    describe("namehashAction", () => {
        it("should compute the namehash correctly", async () => {
            generatedObjectResponse = { name: "vitalik.eth" };
            const callback = mock();

            const result = await namehashAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Compute namehash for vitalik.eth"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("0xee6c4522aab0003e8d14cd40a6af439055fd2577951148c14b6cea9a53475835");
        });
    });

    describe("convertEvmChainIdToCoinTypeAction", () => {
        it("should convert chain ID 137 to coin type 2147483785", async () => {
            generatedObjectResponse = { chainId: 137 };
            const callback = mock();

            const result = await convertEvmChainIdToCoinTypeAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Coin type for chain 137?"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("2147483785");
        });
    });

    describe("checkNameAvailabilityAction", () => {
        it("should return not available for vitalik.eth", async () => {
            generatedObjectResponse = { name: "vitalik.eth" };
            const callback = mock();

            const result = await checkNameAvailabilityAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Is vitalik.eth available?"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("NOT available");
        });
        
        it("should return available for a random name", async () => {
            generatedObjectResponse = { name: "random-test-name-that-is-super-long-12345.eth" };
            const callback = mock();

            const result = await checkNameAvailabilityAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Is random-test-name-that-is-super-long-12345.eth available?"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("Good news!");
        });
    });
});
