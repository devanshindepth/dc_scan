import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

export const config: ApiRouteConfig = {
    name: 'Health',
    type: 'api',
    method: 'GET',
    path: '/health',
    description: 'Health check endpoint',
    emits: [],
    responseSchema: {
        200: z.object({
            status: z.string(),
            timestamp: z.string(),
            service: z.string()
        })
    }
};

export const handler: Handlers['Health'] = async (_, { logger }) => {
    logger.info('Health check requested');
    
    return {
        status: 200,
        body: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'ai-dev-insights-backend'
        }
    };
};