import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

// Zod schema for event metadata validation
const eventMetadataSchema = z.object({
    // Keystroke burst metadata
    burstDuration: z.number().optional(),
    characterCount: z.number().optional(),
    
    // Paste event metadata
    pasteLength: z.number().optional(),
    timeSinceAiInvocation: z.number().optional(),
    
    // AI invocation metadata
    toolType: z.enum(['copilot', 'chat', 'other']).optional(),
    invocationContext: z.enum(['coding', 'debugging', 'documentation']).optional(),
    
    // Debug action metadata
    actionType: z.enum(['run', 'debug', 'test']).optional(),
    errorCount: z.number().optional(),
    
    // File switch metadata
    fileExtension: z.string().optional(),
    switchFrequency: z.number().optional(),
    
    // Error marker metadata
    errorAppeared: z.boolean().optional(),
    errorResolved: z.boolean().optional(),
    timeToResolve: z.number().optional()
});

// Zod schema for individual developer events
const developerEventSchema = z.object({
    id: z.string(),
    developerId: z.string(),
    timestamp: z.number(),
    eventType: z.enum(['keystroke_burst', 'paste', 'ai_invocation', 'debug_action', 'file_switch', 'error_marker']),
    metadata: eventMetadataSchema,
    sessionId: z.string()
});

// Zod schema for the complete request body
const requestSchema = z.object({
    events: z.array(developerEventSchema).min(1).max(1000), // Limit batch size for performance
    batchId: z.string().uuid(),
    timestamp: z.number()
});

// Response schemas for different status codes
const successResponseSchema = z.object({
    success: z.literal(true),
    message: z.string(),
    batchId: z.string(),
    processedCount: z.number()
});

const errorResponseSchema = z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.string().optional()
});

export const config: ApiRouteConfig = {
    name: 'EventsIngestion',
    type: 'api',
    method: 'POST',
    path: '/api/events/batch',
    description: 'Receives batched events from VS Code extension for processing',
    emits: ['process-events'],
    bodySchema: requestSchema,
    responseSchema: {
        200: successResponseSchema,
        400: errorResponseSchema,
        429: errorResponseSchema,
        500: errorResponseSchema
    }
};

export const handler: Handlers['EventsIngestion'] = async (req, { emit, logger }) => {
    const startTime = Date.now();
    const { batchId, events, timestamp } = req.body;
    
    try {
        logger.info(`Processing event batch ${batchId} with ${events.length} events`);
        
        // Basic rate limiting check - reject if too many events
        if (events.length > 1000) {
            logger.warn(`Batch ${batchId} rejected: too many events (${events.length})`);
            return {
                status: 429,
                body: {
                    success: false,
                    message: 'Batch size exceeds maximum allowed limit',
                    error: 'BATCH_TOO_LARGE'
                }
            };
        }
        
        // Validate timestamp is not too far in the future or past
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        const maxFuture = 5 * 60 * 1000; // 5 minutes
        
        if (timestamp < now - maxAge) {
            logger.warn(`Batch ${batchId} rejected: timestamp too old`);
            return {
                status: 400,
                body: {
                    success: false,
                    message: 'Batch timestamp is too old',
                    error: 'TIMESTAMP_TOO_OLD'
                }
            };
        }
        
        if (timestamp > now + maxFuture) {
            logger.warn(`Batch ${batchId} rejected: timestamp too far in future`);
            return {
                status: 400,
                body: {
                    success: false,
                    message: 'Batch timestamp is too far in the future',
                    error: 'TIMESTAMP_INVALID'
                }
            };
        }
        
        // Validate individual events
        const validEvents = [];
        const invalidEvents = [];
        
        for (const event of events) {
            // Additional validation for event timestamps
            if (event.timestamp < now - maxAge || event.timestamp > now + maxFuture) {
                invalidEvents.push({ eventId: event.id, reason: 'Invalid timestamp' });
                continue;
            }
            
            // Validate developer ID format (basic check)
            if (!event.developerId || event.developerId.length < 1) {
                invalidEvents.push({ eventId: event.id, reason: 'Invalid developer ID' });
                continue;
            }
            
            validEvents.push(event);
        }
        
        if (invalidEvents.length > 0) {
            logger.warn(`Batch ${batchId} contains ${invalidEvents.length} invalid events`, { invalidEvents });
        }
        
        if (validEvents.length === 0) {
            return {
                status: 400,
                body: {
                    success: false,
                    message: 'No valid events in batch',
                    error: 'NO_VALID_EVENTS'
                }
            };
        }
        
        // Emit events for processing
        await emit({
            topic: 'process-events',
            data: {
                batchId,
                events: validEvents,
                timestamp
            }
        });
        
        const processingTime = Date.now() - startTime;
        logger.info(`Successfully processed batch ${batchId}: ${validEvents.length}/${events.length} events in ${processingTime}ms`);
        
        return {
            status: 200,
            body: {
                success: true,
                message: `Successfully queued ${validEvents.length} events for processing`,
                batchId,
                processedCount: validEvents.length
            }
        };
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error(`Error processing batch ${batchId} after ${processingTime}ms:`, error);
        
        return {
            status: 500,
            body: {
                success: false,
                message: 'Internal server error while processing events',
                error: 'PROCESSING_ERROR'
            }
        };
    }
};