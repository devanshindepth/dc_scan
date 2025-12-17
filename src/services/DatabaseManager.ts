import * as sqlite3 from 'sqlite3';
import { DeveloperEvent, DailyMetrics, SkillAssessment } from '../types/events.js';
import * as path from 'path';
import * as fs from 'fs';

export class DatabaseManager {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor(dbPath: string = './data/ai-dev-insights.db') {
        this.dbPath = dbPath;
        this.initializeDatabase();
    }

    private async initializeDatabase(): Promise<void> {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.createTables().then(resolve).catch(reject);
            });
        });
    }

    private async createTables(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                -- Events table for raw event storage
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

                -- Daily metrics table for aggregated data
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

                -- Skill assessments table
                CREATE TABLE IF NOT EXISTS skill_assessments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    developer_id TEXT NOT NULL,
                    assessment_date TEXT NOT NULL,
                    prompt_maturity_score REAL NOT NULL,
                    prompt_maturity_trend TEXT NOT NULL,
                    prompt_maturity_explanation TEXT NOT NULL,
                    debugging_skill_score REAL NOT NULL,
                    debugging_skill_style TEXT NOT NULL,
                    debugging_skill_trend TEXT NOT NULL,
                    debugging_skill_explanation TEXT NOT NULL,
                    ai_collaboration_score REAL NOT NULL,
                    ai_collaboration_dependency TEXT NOT NULL,
                    ai_collaboration_refinement REAL NOT NULL,
                    ai_collaboration_explanation TEXT NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    UNIQUE(developer_id, assessment_date)
                );

                -- Indexes for performance
                CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
                CREATE INDEX IF NOT EXISTS idx_events_developer_id ON events(developer_id);
                CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed);
                CREATE INDEX IF NOT EXISTS idx_daily_metrics_developer_date ON daily_metrics(developer_id, date);
                CREATE INDEX IF NOT EXISTS idx_skill_assessments_developer_date ON skill_assessments(developer_id, assessment_date);
            `;

            this.db!.exec(createTablesSQL, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async storeEvents(events: DeveloperEvent[]): Promise<void> {
        if (!this.db || events.length === 0) {
            return;
        }

        return new Promise((resolve, reject) => {
            const stmt = this.db!.prepare(`
                INSERT OR IGNORE INTO events (id, developer_id, timestamp, event_type, metadata, session_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            this.db!.serialize(() => {
                this.db!.run('BEGIN TRANSACTION');

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

                this.db!.run('COMMIT', (err) => {
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

    public async getUnprocessedEvents(limit: number = 1000): Promise<DeveloperEvent[]> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.all(`
                SELECT * FROM events 
                WHERE processed = FALSE 
                ORDER BY timestamp ASC 
                LIMIT ?
            `, [limit], (err, rows: any[]) => {
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

    public async markEventsProcessed(eventIds: string[]): Promise<void> {
        if (!this.db || eventIds.length === 0) {
            return;
        }

        return new Promise((resolve, reject) => {
            const placeholders = eventIds.map(() => '?').join(',');
            this.db!.run(`
                UPDATE events 
                SET processed = TRUE 
                WHERE id IN (${placeholders})
            `, eventIds, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async storeDailyMetrics(metrics: DailyMetrics): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const stmt = this.db!.prepare(`
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
            ], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });

            stmt.finalize();
        });
    }

    public async storeSkillAssessment(assessment: SkillAssessment): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const stmt = this.db!.prepare(`
                INSERT OR REPLACE INTO skill_assessments (
                    developer_id, assessment_date, prompt_maturity_score, prompt_maturity_trend,
                    prompt_maturity_explanation, debugging_skill_score, debugging_skill_style,
                    debugging_skill_trend, debugging_skill_explanation, ai_collaboration_score,
                    ai_collaboration_dependency, ai_collaboration_refinement, ai_collaboration_explanation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run([
                assessment.developerId,
                assessment.assessmentDate,
                assessment.promptMaturity.score,
                assessment.promptMaturity.trend,
                assessment.promptMaturity.explanation,
                assessment.debuggingSkill.score,
                assessment.debuggingSkill.style,
                assessment.debuggingSkill.trend,
                assessment.debuggingSkill.explanation,
                assessment.aiCollaboration.score,
                assessment.aiCollaboration.dependencyLevel,
                assessment.aiCollaboration.refinementSkill,
                assessment.aiCollaboration.explanation
            ], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });

            stmt.finalize();
        });
    }

    public async getDeveloperMetrics(developerId: string, days: number = 30): Promise<DailyMetrics[]> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

            this.db!.all(`
                SELECT * FROM daily_metrics 
                WHERE developer_id = ? AND date >= ?
                ORDER BY date DESC
            `, [developerId, cutoffDateStr], (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const metrics = rows.map(row => ({
                    developerId: row.developer_id,
                    date: row.date,
                    aiAssistanceLevel: row.ai_assistance_level,
                    humanRefinementRatio: row.human_refinement_ratio,
                    promptEfficiencyScore: row.prompt_efficiency_score,
                    debuggingStyle: row.debugging_style,
                    errorResolutionTime: row.error_resolution_time,
                    aiDependencyRatio: row.ai_dependency_ratio,
                    sessionCount: row.session_count,
                    activeTime: row.active_time
                }));

                resolve(metrics);
            });
        });
    }

    public async getLatestSkillAssessment(developerId: string): Promise<SkillAssessment | null> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.get(`
                SELECT * FROM skill_assessments 
                WHERE developer_id = ?
                ORDER BY assessment_date DESC
                LIMIT 1
            `, [developerId], (err, row: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                const assessment: SkillAssessment = {
                    developerId: row.developer_id,
                    assessmentDate: row.assessment_date,
                    promptMaturity: {
                        score: row.prompt_maturity_score,
                        trend: row.prompt_maturity_trend,
                        explanation: row.prompt_maturity_explanation
                    },
                    debuggingSkill: {
                        score: row.debugging_skill_score,
                        style: row.debugging_skill_style,
                        trend: row.debugging_skill_trend,
                        explanation: row.debugging_skill_explanation
                    },
                    aiCollaboration: {
                        score: row.ai_collaboration_score,
                        dependencyLevel: row.ai_collaboration_dependency,
                        refinementSkill: row.ai_collaboration_refinement,
                        explanation: row.ai_collaboration_explanation
                    }
                };

                resolve(assessment);
            });
        });
    }

    public async cleanupOldData(retentionDays: number = 90): Promise<void> {
        if (!this.db) {
            return;
        }

        const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        const cutoffDate = new Date(cutoffTimestamp).toISOString().split('T')[0];

        return new Promise((resolve, reject) => {
            this.db!.serialize(() => {
                this.db!.run('BEGIN TRANSACTION');
                
                // Clean up old events
                this.db!.run(`
                    DELETE FROM events 
                    WHERE timestamp < ? AND processed = TRUE
                `, [cutoffTimestamp]);

                // Clean up old daily metrics
                this.db!.run(`
                    DELETE FROM daily_metrics 
                    WHERE date < ?
                `, [cutoffDate]);

                // Clean up old skill assessments (keep more recent ones)
                this.db!.run(`
                    DELETE FROM skill_assessments 
                    WHERE assessment_date < ?
                `, [cutoffDate]);

                this.db!.run('COMMIT', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    public async getStorageStats(): Promise<{
        totalEvents: number;
        processedEvents: number;
        unprocessedEvents: number;
        dailyMetrics: number;
        skillAssessments: number;
        oldestEventDate: string | null;
        newestEventDate: string | null;
    }> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const stats = {
                totalEvents: 0,
                processedEvents: 0,
                unprocessedEvents: 0,
                dailyMetrics: 0,
                skillAssessments: 0,
                oldestEventDate: null as string | null,
                newestEventDate: null as string | null
            };

            this.db!.serialize(() => {
                // Count total events
                this.db!.get('SELECT COUNT(*) as count FROM events', (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    stats.totalEvents = row.count;
                });

                // Count processed events
                this.db!.get('SELECT COUNT(*) as count FROM events WHERE processed = TRUE', (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    stats.processedEvents = row.count;
                });

                // Count unprocessed events
                this.db!.get('SELECT COUNT(*) as count FROM events WHERE processed = FALSE', (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    stats.unprocessedEvents = row.count;
                });

                // Count daily metrics
                this.db!.get('SELECT COUNT(*) as count FROM daily_metrics', (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    stats.dailyMetrics = row.count;
                });

                // Count skill assessments
                this.db!.get('SELECT COUNT(*) as count FROM skill_assessments', (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    stats.skillAssessments = row.count;
                });

                // Get oldest and newest event dates
                this.db!.get(`
                    SELECT 
                        MIN(timestamp) as oldest,
                        MAX(timestamp) as newest
                    FROM events
                `, (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (row.oldest) {
                        stats.oldestEventDate = new Date(row.oldest).toISOString();
                    }
                    if (row.newest) {
                        stats.newestEventDate = new Date(row.newest).toISOString();
                    }
                    
                    resolve(stats);
                });
            });
        });
    }

    public async cleanupByRetentionPolicy(policies: {
        eventsRetentionDays: number;
        metricsRetentionDays: number;
        assessmentsRetentionDays: number;
    }): Promise<{
        eventsDeleted: number;
        metricsDeleted: number;
        assessmentsDeleted: number;
    }> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const eventsTimestamp = Date.now() - (policies.eventsRetentionDays * 24 * 60 * 60 * 1000);
        const metricsDate = new Date(Date.now() - (policies.metricsRetentionDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        const assessmentsDate = new Date(Date.now() - (policies.assessmentsRetentionDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        return new Promise((resolve, reject) => {
            const results = {
                eventsDeleted: 0,
                metricsDeleted: 0,
                assessmentsDeleted: 0
            };

            this.db!.serialize(() => {
                this.db!.run('BEGIN TRANSACTION');

                // Clean up old processed events
                this.db!.run(`
                    DELETE FROM events 
                    WHERE timestamp < ? AND processed = TRUE
                `, [eventsTimestamp], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    results.eventsDeleted = this.changes;
                });

                // Clean up old daily metrics
                this.db!.run(`
                    DELETE FROM daily_metrics 
                    WHERE date < ?
                `, [metricsDate], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    results.metricsDeleted = this.changes;
                });

                // Clean up old skill assessments
                this.db!.run(`
                    DELETE FROM skill_assessments 
                    WHERE assessment_date < ?
                `, [assessmentsDate], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    results.assessmentsDeleted = this.changes;
                });

                this.db!.run('COMMIT', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });
        });
    }

    public async cleanupCorruptedData(): Promise<{
        corruptedEventsDeleted: number;
        orphanedMetricsDeleted: number;
    }> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const results = {
                corruptedEventsDeleted: 0,
                orphanedMetricsDeleted: 0
            };

            this.db!.serialize(() => {
                this.db!.run('BEGIN TRANSACTION');

                // Clean up events with invalid JSON metadata
                this.db!.run(`
                    DELETE FROM events 
                    WHERE metadata IS NULL 
                    OR metadata = '' 
                    OR (metadata NOT LIKE '{%' AND metadata NOT LIKE '[%')
                `, function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    results.corruptedEventsDeleted = this.changes;
                });

                // Clean up daily metrics without valid developer IDs
                this.db!.run(`
                    DELETE FROM daily_metrics 
                    WHERE developer_id IS NULL 
                    OR developer_id = ''
                    OR date IS NULL
                    OR date = ''
                `, function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    results.orphanedMetricsDeleted = this.changes;
                });

                this.db!.run('COMMIT', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });
        });
    }
}