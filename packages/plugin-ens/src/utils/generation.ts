import {
    type IAgentRuntime,
    ModelType,
    logger,
} from "@elizaos/core";

export const ModelClass = {
    SMALL: ModelType.TEXT_SMALL,
    MEDIUM: ModelType.TEXT_LARGE,
    LARGE: ModelType.TEXT_LARGE,
};

export async function generateObject({
    runtime,
    context,
    modelClass,
    schema,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
    schema: any;
}) {
    try {
        const result = await runtime.useModel(ModelType.OBJECT_SMALL as any, {
            prompt: context,
            schema: schema && typeof schema.parse === 'function' ? schema : schema,
        });

        return { object: result };
    } catch (error) {
        logger.error("Error generating object", error instanceof Error ? error.message : String(error));
        throw error;
    }
}
