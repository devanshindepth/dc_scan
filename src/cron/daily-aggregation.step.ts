import type { CronConfig } from 'motia';
import * as sqlite3 from 'sqlite3';
import { DeveloperEvent, DailyMetrics } from '../types/events.js';
// import { MeasurementStandardizer } from '../services/MeasurementStandardizer.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';

export const config: CronConfig = {
    name: 'DailyAggregation',
    type: 'cron',
    description: 'Generates daily per-developer metrics and time-series data',
    cron: '0 2 * * *', // Run at 2 AM daily
    emits: ['infer-skills']
};

export const handler = async ({ emit, logger }: any) => {
    const startTime = Date.now();
    
    try {
        logger.info('Starting daily aggregation job');
        
        // Initialize database and measurement standardizer
        const db = await initializeDatabase();
        // const standardizer = new MeasurementStandardizer();
        
        // Get yesterday's date for processing
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        // Get all unprocessed events from yesterday
        const events = await getUnprocessedEvents(db, 10000);
        
        // Filter events for yesterday
        const yesterdayStart = new Date(dateStr + 'T00:00:00.000Z').getTime();
        const yesterdayEnd = new Date(dateStr + 'T23:59:59.999Z').getTime();
        
        const yesterdayEvents = events.filter(event => 
            event.timestamp >= yesterdayStart && event.timestamp <= yesterdayEnd
        );
        
        if (yesterdayEvents.length === 0) {
            logger.info(`No events found for ${dateStr}, skipping aggregation`);
            return;
        }
        
        logger.info(`Processing ${yesterdayEvents.length} events for ${dateStr}`);
        
        // Group events by developer
        const eventsByDeveloper = groupEventsByDeveloper(yesterdayEvents);
        
        // Process each developer's events
        const processedDevelopers: string[] = [];
        
        for (const [developerId, developerEvents] of eventsByDeveloper.entries()) {
            try {
                // Calculate daily metrics for this developer
                const dailyMetrics = await calculateDailyMetrics(developerId, dateStr, developerEvents);
                
                // Standardize metrics for consistency and privacy compliance
                const standardizedMetrics = dailyMetrics; // standardizer.standardizeDailyMetrics([dailyMetrics])[0];
                
                // Store the standardized metrics
                await storeDailyMetrics(db, standardizedMetrics);
                
                // Emit skill inference event
                await emit({
                    topic: 'infer-skills',
                    data: {
                        developerId,
                        date: dateStr
                    }
                });
                
                processedDevelopers.push(developerId);
                
                logger.info(`Processed daily metrics for developer ${developerId}: ${developerEvents.length} events`);
                
            } catch (error) {
                logger.error(`Error processing metrics for developer ${developerId}:`, error);
                // Continue processing other developers
            }
        }
        
        // Mark processed events as processed
        const processedEventIds = yesterdayEvents.map(event => event.id);
        await markEventsProcessed(db, processedEventIds);
        
        // Clean up old data (retention policy)
        await cleanupOldData(db, 90); // Keep 90 days of data
        
        const processingTime = Date.now() - startTime;
        logger.info(`Daily aggregation completed: processed ${processedDevelopers.length} developers in ${processingTime}ms`);
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error(`Daily aggregation failed after ${processingTime}ms:`, error);
        throw error;
    }
};

/**
 * Groups events by developer ID
 */
function groupEventsByDeveloper(events: DeveloperEvent[]): Map<string, DeveloperEvent[]> {
    const grouped = new Map<string, DeveloperEvent[]>();
    
    for (const event of events) {
        const existing = grouped.get(event.developerId) || [];
        existing.push(event);
        grouped.set(event.developerId, existing);
    }
    
    return grouped;
}

/**
 * Calculates daily metrics for a developer based on their events
 */
async function calculateDailyMetrics(
    developerId: string, 
    date: string, 
    events: DeveloperEvent[]
): Promise<DailyMetrics> {
    
    // Sort events by timestamp for sequential analysis
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate session count (unique session IDs)
    const uniqueSessions = new Set(events.map(e => e.sessionId));
    const sessionCount = uniqueSessions.size;
    
    // Calculate active time (time between first and last event + buffer)
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    const activeTime = Math.max(1, (lastEvent.timestamp - firstEvent.timestamp) / (1000 * 60)); // in minutes
    
    // Analyze AI assistance patterns
    const aiEvents = events.filter(e => e.eventType === 'ai_invocation');
    const pasteEvents = events.filter(e => e.eventType === 'paste');
    const keystrokeEvents = events.filter(e => e.eventType === 'keystroke_burst');
    
    // Calculate AI assistance level
    const aiAssistanceLevel = calculateAiAssistanceLevel(aiEvents, pasteEvents, keystrokeEvents);
    
    // Calculate human refinement ratio
    const humanRefinementRatio = calculateHumanRefinementRatio(aiEvents, pasteEvents, keystrokeEvents);
    
    // Calculate prompt efficiency score
    const promptEfficiencyScore = calculatePromptEfficiencyScore(aiEvents, pasteEvents);
    
    // Analyze debugging patterns
    const debugEvents = events.filter(e => e.eventType === 'debug_action');
    const errorEvents = events.filter(e => e.eventType === 'error_marker');
    
    const debuggingStyle = analyzeDebuggingStyle(debugEvents, errorEvents, aiEvents);
    const errorResolutionTime = calculateErrorResolutionTime(errorEvents);
    
    // Calculate AI dependency ratio
    const aiDependencyRatio = calculateAiDependencyRatio(aiEvents, keystrokeEvents, pasteEvents);
    
    return {
        developerId,
        date,
        aiAssistanceLevel,
        humanRefinementRatio,
        promptEfficiencyScore,
        debuggingStyle,
        errorResolutionTime,
        aiDependencyRatio,
        sessionCount,
        activeTime
    };
}

/**
 * Determines AI assistance level based on event patterns
 */
function calculateAiAssistanceLevel(
    aiEvents: DeveloperEvent[], 
    pasteEvents: DeveloperEvent[], 
    keystrokeEvents: DeveloperEvent[]
): 'low' | 'medium' | 'high' {
    
    const totalEvents = aiEvents.length + pasteEvents.length + keystrokeEvents.length;
    if (totalEvents === 0) return 'low';
    
    const aiRatio = aiEvents.length / totalEvents;
    const pasteRatio = pasteEvents.length / totalEvents;
    
    // High AI assistance: frequent AI invocations and pastes
    if (aiRatio > 0.3 && pasteRatio > 0.2) return 'high';
    
    // Medium AI assistance: moderate AI usage
    if (aiRatio > 0.1 || pasteRatio > 0.1) return 'medium';
    
    // Low AI assistance: minimal AI usage
    return 'low';
}

/**
 * Calculates how much developers refine AI-generated content
 */
function calculateHumanRefinementRatio(
    aiEvents: DeveloperEvent[], 
    pasteEvents: DeveloperEvent[], 
    keystrokeEvents: DeveloperEvent[]
): number {
    
    if (pasteEvents.length === 0) return 1.0; // No AI content to refine
    
    // Find keystroke events that occur shortly after paste events (refinement)
    let refinementEvents = 0;
    
    for (const pasteEvent of pasteEvents) {
        const refinementWindow = 5 * 60 * 1000; // 5 minutes after paste
        const refinements = keystrokeEvents.filter(ke => 
            ke.timestamp > pasteEvent.timestamp && 
            ke.timestamp <= pasteEvent.timestamp + refinementWindow &&
            ke.sessionId === pasteEvent.sessionId
        );
        
        if (refinements.length > 0) {
            refinementEvents++;
        }
    }
    
    return Math.min(1.0, refinementEvents / pasteEvents.length);
}

/**
 * Calculates prompt efficiency based on retry patterns and acceptance time
 */
function calculatePromptEfficiencyScore(
    aiEvents: DeveloperEvent[], 
    pasteEvents: DeveloperEvent[]
): number {
    
    if (aiEvents.length === 0) return 0.5; // Neutral score when no AI usage
    
    let totalEfficiency = 0;
    let scoredInteractions = 0;
    
    for (const aiEvent of aiEvents) {
        // Find paste events within 2 minutes of AI invocation
        const acceptanceWindow = 2 * 60 * 1000; // 2 minutes
        const relatedPastes = pasteEvents.filter(pe => 
            pe.timestamp > aiEvent.timestamp && 
            pe.timestamp <= aiEvent.timestamp + acceptanceWindow &&
            pe.sessionId === aiEvent.sessionId
        );
        
        if (relatedPastes.length > 0) {
            // Quick acceptance indicates good prompt
            const timeToAccept = relatedPastes[0].timestamp - aiEvent.timestamp;
            const efficiency = Math.max(0, 1 - (timeToAccept / acceptanceWindow));
            totalEfficiency += efficiency;
            scoredInteractions++;
        }
    }
    
    return scoredInteractions > 0 ? totalEfficiency / scoredInteractions : 0.5;
}

/**
 * Analyzes debugging style based on patterns
 */
function analyzeDebuggingStyle(
    debugEvents: DeveloperEvent[], 
    errorEvents: DeveloperEvent[], 
    aiEvents: DeveloperEvent[]
): 'hypothesis-driven' | 'trial-and-error' | 'mixed' {
    
    if (debugEvents.length === 0) return 'mixed';
    
    const runEvents = debugEvents.filter(e => e.metadata.actionType === 'run');
    const debugActionEvents = debugEvents.filter(e => e.metadata.actionType === 'debug');
    const testEvents = debugEvents.filter(e => e.metadata.actionType === 'test');
    
    // Hypothesis-driven: more debugging and testing, less running
    const hypothesisScore = (debugActionEvents.length + testEvents.length) / debugEvents.length;
    
    // Trial-and-error: frequent runs, less systematic debugging
    const trialErrorScore = runEvents.length / debugEvents.length;
    
    if (hypothesisScore > 0.6) return 'hypothesis-driven';
    if (trialErrorScore > 0.7) return 'trial-and-error';
    return 'mixed';
}

/**
 * Calculates average error resolution time
 */
function calculateErrorResolutionTime(errorEvents: DeveloperEvent[]): number {
    const errorPairs: Array<{ appeared: number; resolved: number }> = [];
    const pendingErrors = new Map<string, number>();
    
    // Sort error events by timestamp
    const sortedErrors = errorEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const event of sortedErrors) {
        const sessionKey = event.sessionId;
        
        if (event.metadata.errorAppeared) {
            pendingErrors.set(sessionKey, event.timestamp);
        } else if (event.metadata.errorResolved && pendingErrors.has(sessionKey)) {
            const appearedTime = pendingErrors.get(sessionKey)!;
            errorPairs.push({
                appeared: appearedTime,
                resolved: event.timestamp
            });
            pendingErrors.delete(sessionKey);
        }
    }
    
    if (errorPairs.length === 0) return 0;
    
    const totalResolutionTime = errorPairs.reduce((sum, pair) => 
        sum + (pair.resolved - pair.appeared), 0
    );
    
    return totalResolutionTime / errorPairs.length / (1000 * 60); // Convert to minutes
}

/**
 * Calculates AI dependency ratio
 */
function calculateAiDependencyRatio(
    aiEvents: DeveloperEvent[], 
    keystrokeEvents: DeveloperEvent[], 
    pasteEvents: DeveloperEvent[]
): number {
    
    const totalProductiveEvents = aiEvents.length + keystrokeEvents.length + pasteEvents.length;
    if (totalProductiveEvents === 0) return 0;
    
    const aiRelatedEvents = aiEvents.length + pasteEvents.length;
    return aiRelatedEvents / totalProductiveEvents;
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

                CREATE TABLE IF NOT EXISTS daily_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    developer_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    ai_assistance_level TEXT NOT NULL,
                    human_refinement_ratio REAL NOT NULL,
                    prompt_efficiency_score REAL NOT NULL,
                    debugging_style TEXT NOT NULL,
                    error_resolution_time REAL NOT NULL,
                    ai_dependency_ratio REAL NOT NULL,
                    session_count INTEGER NOT NULL,
                    active_time REAL NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    UNIQUE(developer_id, date)
                );

                CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
                CREATE INDEX IF NOT EXISTS idx_events_developer_id ON events(developer_id);
                CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed);
                CREATE INDEX IF NOT EXISTS idx_daily_metrics_developer_date ON daily_metrics(developer_id, date);
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
 * Get unprocessed events from database
 */
async function getUnprocessedEvents(db: sqlite3.Database, limit: number = 1000): Promise<DeveloperEvent[]> {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM events 
            WHERE processed = FALSE 
            ORDER BY timestamp ASC 
            LIMIT ?
        `, [limit], (err: any, rows: any[]) => {
            if (err) {
                reject(err);
                return;
            }

            const events = rows.map(row => ({
                id: row.id,
                developerId: row.developer_id,
                timestamp: row.timestamp,
                eventType: row.event_type,
                metadata: JSON.parse(row.metadata),
                sessionId: row.session_id
            }));

            resolve(events);
        });
    });
}

/**
 * Store daily metrics in database
 */
async function storeDailyMetrics(db: sqlite3.Database, metrics: DailyMetrics): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO daily_metrics (
                developer_id, date, ai_assistance_level, human_refinement_ratio,
                prompt_efficiency_score, debugging_style, error_resolution_time,
                ai_dependency_ratio, session_count, active_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
            metrics.developerId,
            metrics.date,
            metrics.aiAssistanceLevel,
            metrics.humanRefinementRatio,
            metrics.promptEfficiencyScore,
            metrics.debuggingStyle,
            metrics.errorResolutionTime,
            metrics.aiDependencyRatio,
            metrics.sessionCount,
            metrics.activeTime
        ], (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });

        stmt.finalize();
    });
}

/**
 * Mark events as processed
 */
async function markEventsProcessed(db: sqlite3.Database, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) {
        return;
    }

    return new Promise((resolve, reject) => {
        const placeholders = eventIds.map(() => '?').join(',');
        db.run(`
            UPDATE events 
            SET processed = TRUE 
            WHERE id IN (${placeholders})
        `, eventIds, (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Clean up old data based on retention policy
 */
async function cleanupOldData(db: sqlite3.Database, retentionDays: number = 90): Promise<void> {
    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const cutoffDate = new Date(cutoffTimestamp).toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Clean up old events
            db.run(`
                DELETE FROM events 
                WHERE timestamp < ? AND processed = TRUE
            `, [cutoffTimestamp]);

            // Clean up old daily metrics
            db.run(`
                DELETE FROM daily_metrics 
                WHERE date < ?
            `, [cutoffDate]);

            db.run('COMMIT', (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
}