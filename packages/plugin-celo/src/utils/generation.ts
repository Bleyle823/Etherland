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
    // Convert Zod schema to plain prompt if needed, or just let useModel handle it
    // In many Eliza versions, you can just pass the context
    try {
        const result = await runtime.useModel(ModelType.OBJECT_SMALL as any, {
            prompt: context,
            schema: schema && typeof schema.parse === 'function' ? schema._def : schema,
        });

        return { object: result };
    } catch (error) {
        logger.error("Error generating object", error);
        throw error;
    }
}
