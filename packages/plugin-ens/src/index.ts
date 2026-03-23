import type { Plugin } from "@elizaos/core";
import { resolveEnsNameAction } from "./actions/resolveEnsName";
import { resolveEnsAddressAction } from "./actions/resolveEnsAddress";
import { namehashAction } from "./actions/namehash";
import { convertEvmChainIdToCoinTypeAction } from "./actions/convertEvmChainIdToCoinType";
import { checkNameAvailabilityAction } from "./actions/checkNameAvailability";

export const ensPlugin: Plugin = {
    name: "ens",
    description: "ENS integration plugin for resolving names, addresses, computing namehash, converting chain IDs, and checking name availability",
    actions: [
        resolveEnsNameAction,
        resolveEnsAddressAction,
        namehashAction,
        convertEvmChainIdToCoinTypeAction,
        checkNameAvailabilityAction,
    ],
    evaluators: [],
    providers: [],
};

export default ensPlugin;
