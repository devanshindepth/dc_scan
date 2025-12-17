import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

// Request body schema
const pauseRequestSchema = z.object({
    developerId: z.string(),
    action: z.enum(['pause', 'resume']),
    reason: z.string().optional()
});

// Response schema
const pauseResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    developerId: z.string(),
    action: z.enum(['pause', 'resume']),
    timestamp: z.string()
});

// Privacy control endpoint configuration
export const config: ApiRouteConfig = {
    name: 'InsightsPause',
    type: 'api',
    method: 'POST',
    path: '/api/insights/pause',
    description: 'Pause or resume tracking for privacy control',
    emits: ['privacy-control-changed'],

    responseSchema: {
        200: pauseResponseSchema
    }
};

export const handler = async (req: any, { logger, emit }: any) => {
    try {
        const { developerId, action, reason } = pauseRequestSchema.parse((req as any).body);
        
        logger.info(`Privacy control request: ${action} tracking for developer ${developerId}`, {
            developerId,
            action,
            reason
        });

        const timestamp = new Date().toISOString();

        // Emit event to notify other components about privacy control change
        await emit('privacy-control-changed', {
            developerId,
            action,
            reason,
            timestamp
        });

        const actionMessage = action === 'pause' 
            ? 'Tracking has been paused. No new data will be collected until resumed.'
            : 'Tracking has been resumed. Data collection will continue normally.';

        return {
            status: 200,
            body: {
                success: true,
                message: actionMessage,
                developerId,
                action,
                timestamp
            }
        };

    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.warn('Invalid privacy control request:', (error as any).errors);
            return {
                status: 400,
                body: {
                    success: false,
                    message: 'Invalid request: ' + (error as any).errors.map((e: any) => e.message).join(', ')
                }
            };
        }

        logger.error('Error processing privacy control request:', error);
        return {
            status: 500,
            body: {
                success: false,
                message: 'Internal server error while processing privacy control request'
            }
        };
    }
};