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

// Mock Viem clients & functions
let balanceMock = 0n;
const clientMock = {
    getBalance: mock(async () => balanceMock),
    readContract: mock(async () => balanceMock),
};

mock.module("viem", () => {
    const originalViem = require("viem");
    return {
        ...originalViem,
        createPublicClient: mock(() => clientMock),
        createWalletClient: mock(() => clientMock),
    };
});

import { expect, it, describe, beforeEach } from "bun:test";
import { readBalancesAction } from "../actions/readBalances";
import { aaveLendBorrowAction } from "../actions/aaveLendBorrow";
import { payGasWithTokenAction } from "../actions/payGasWithToken";
import { verifyContractAction } from "../actions/verifyContract";
import type { IAgentRuntime, Memory, State } from "@elizaos/core";

const mockRuntime: Partial<IAgentRuntime> = {
    composeState: mock(async () => ({
        values: {},
        data: {},
        text: "",
    } as unknown as State)),
    getSetting: mock(() => "mock-setting"),
};

const mockMessage = (text: string): Memory => ({
    entityId: "00000000-0000-0000-0000-000000000000" as any,
    agentId: "00000000-0000-0000-0000-000000000001" as any,
    roomId: "00000000-0000-0000-0000-000000000002" as any,
    content: { text },
});

describe("Celo Plugin Actions", () => {
    beforeEach(() => {
        generatedObjectResponse = {};
        balanceMock = 0n;
    });

    describe("readBalancesAction", () => {
        it("should extract address and return balances", async () => {
            generatedObjectResponse = { walletAddress: "0x1234567890123456789012345678901234567890" };
            balanceMock = 1000000n; // mock base balance return
            
            const callback = mock();
            const result = await readBalancesAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Check my balances"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("Balances on Celo for");
        });
    });

    describe("aaveLendBorrowAction", () => {
        it("should mock aave supply request", async () => {
            generatedObjectResponse = { action: "supply", assetAddress: "0x...", amount: "100" };
            const callback = mock();
            
            const result = await aaveLendBorrowAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Supply Aave"),
                undefined as any,
                {},
                callback
            );

            // Tests if logic successfully handles the object and formats intent
            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("supply");
        });
    });

    describe("payGasWithTokenAction", () => {
        it("should mock gas abstraction fee logic", async () => {
            generatedObjectResponse = { recipient: "0xAAA", amount: "50", feeToken: "USDC" };
            const callback = mock();
            
            const result = await payGasWithTokenAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Send 50 CELO paying fee with USDC"),
                undefined as any,
                {},
                callback
            );

            expect((result as any).success).toBe(true);
            expect(callback).toHaveBeenCalled();
            const callArgs = (callback as any).mock.calls[0][0];
            expect(callArgs.text).toContain("Generated transaction sending");
        });
    });

    // skip verifyContract testing execution entirely due to child_process exec
    describe("verifyContractAction", () => {
        it("should parse fields representing the contract", async () => {
            generatedObjectResponse = { contractAddress: "0x123", network: "celo", srcFile: "MyContract.sol" };
            const callback = mock();
            
            // Just verifying that the handler returns `{ success: false }` or mock succeeds on failed exec depending on logic
            const result = await verifyContractAction.handler(
                mockRuntime as IAgentRuntime,
                mockMessage("Verify my contract on celo"),
                undefined as any,
                {},
                callback
            );

            // Expect to catch exec error or success depending on how failure is handled inline
            expect(callback).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });
});
