import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import sqlite3 from 'sqlite3';
import { DeveloperEvent } from '../types/events.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';

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

// Zod schema for the event data payload
const eventDataSchema = z.object({
    batchId: z.string(),
    events: z.array(developerEventSchema),
    timestamp: z.number()
});

export const config: EventConfig = {
    name: 'ProcessEvents',
    type: 'event',
    description: 'Processes and stores developer events from the ingestion API',
    subscribes: ['process-events'],
    emits: [],
    input: eventDataSchema
};

export const handler: Handlers['ProcessEvents'] = async (data, { emit, logger }) => {
    const startTime = Date.now();
    const { batchId, events, timestamp } = data;
    
    try {
        logger.info(`Processing event batch ${batchId} with ${events.length} events`);
        
        // Initialize database
        const db = await initializeDatabase();
        
        // Validate and filter events
        const validEvents: DeveloperEvent[] = [];
        const invalidEvents: Array<{ eventId: string; reason: string }> = [];
        
        for (const event of events) {
            try {
                // Additional business logic validation
                if (!event.id || !event.developerId || !event.sessionId) {
                    invalidEvents.push({ 
                        eventId: event.id || 'unknown', 
                        reason: 'Missing required fields' 
                    });
                    continue;
                }
                
                // Validate timestamp is reasonable
                const now = Date.now();
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                const maxFuture = 5 * 60 * 1000; // 5 minutes
                
                if (event.timestamp < now - maxAge || event.timestamp > now + maxFuture) {
                    invalidEvents.push({ 
                        eventId: event.id, 
                        reason: 'Invalid timestamp' 
                    });
                    continue;
                }
                
                // Validate event type specific metadata
                if (!validateEventMetadata(event)) {
                    invalidEvents.push({ 
                        eventId: event.id, 
                        reason: 'Invalid metadata for event type' 
                    });
                    continue;
                }
                
                validEvents.push(event);
                
            } catch (error) {
                logger.warn(`Error validating event ${event.id}:`, error);
                invalidEvents.push({ 
                    eventId: event.id || 'unknown', 
                    reason: 'Validation error' 
                });
            }
        }
        
        if (invalidEvents.length > 0) {
            logger.warn(`Batch ${batchId} contains ${invalidEvents.length} invalid events`, { 
                invalidEvents: invalidEvents.slice(0, 10) // Log first 10 for debugging
            });
        }
        
        if (validEvents.length === 0) {
            logger.warn(`Batch ${batchId} contains no valid events, skipping storage`);
            return;
        }
        
        // Store events in time-series database
        await storeEvents(db, validEvents);
        
        // Events are now stored and will be processed by the daily aggregation cron job
        
        const processingTime = Date.now() - startTime;
        logger.info(`Successfully processed batch ${batchId}: stored ${validEvents.length}/${events.length} events in ${processingTime}ms`);
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error(`Error processing event batch ${batchId} after ${processingTime}ms:`, error);
        throw error; // Re-throw to trigger retry mechanism
    }
};

/**
 * Validates event metadata based on event type
 */
function validateEventMetadata(event: DeveloperEvent): boolean {
    const { eventType, metadata } = event;
    
    switch (eventType) {
        case 'keystroke_burst':
            return typeof metadata.burstDuration === 'number' && 
                   typeof metadata.characterCount === 'number' &&
                   metadata.burstDuration > 0 && 
                   metadata.characterCount > 0;
                   
        case 'paste':
            return typeof metadata.pasteLength === 'number' && 
                   metadata.pasteLength > 0;
                   
        case 'ai_invocation':
            return metadata.toolType !== undefined && 
                   ['copilot', 'chat', 'other'].includes(metadata.toolType);
                   
        case 'debug_action':
            return metadata.actionType !== undefined && 
                   ['run', 'debug', 'test'].includes(metadata.actionType);
                   
        case 'file_switch':
            return typeof metadata.fileExtension === 'string';
            
        case 'error_marker':
            return typeof metadata.errorAppeared === 'boolean' || 
                   typeof metadata.errorResolved === 'boolean';
                   
        default:
            return false;
    }
}

/**
 * Initialize database connection and create tables
 */
async function initializeDatabase(): Promise<sqlite3.Database> {
    const dbPath = './data/ai-dev-insights.db';
    
    // Ensure data directory exists
    const dataDir = dirname(dbPath);
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
        // Directory might already exist
    }

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err: any) => {
            if (err) {
                reject(err);
                return;
            }

            // Create tables
            const createTablesSQL = `
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    developer_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    processed BOOLEAN DEFAULT FALSE,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                );

                CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
                CREATE INDEX IF NOT EXISTS idx_events_developer_id ON events(developer_id);
                CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed);
            `;

            db.exec(createTablesSQL, (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(db);
                }
            });
        });
    });
}

/**
 * Store events in database
 */
async function storeEvents(db: sqlite3.Database, events: DeveloperEvent[]): Promise<void> {
    if (events.length === 0) {
        return;
    }

    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO events (id, developer_id, timestamp, event_type, metadata, session_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            for (const event of events) {
                stmt.run([
                    event.id,
                    event.developerId,
                    event.timestamp,
                    event.eventType,
                    JSON.stringify(event.metadata),
                    event.sessionId
                ]);
            }

            db.run('COMMIT', (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        stmt.finalize();
    });
}

