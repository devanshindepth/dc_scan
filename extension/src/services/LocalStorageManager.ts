import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { DeveloperEvent, SyncBatch } from '../types/events';
import { v4 as uuidv4 } from 'uuid';

export class LocalStorageManager {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor(private storagePath: string) {
        this.dbPath = path.join(storagePath, 'ai-dev-insights.db');
        this.initializeDatabase();
    }

    private async initializeDatabase(): Promise<void> {
        // Ensure storage directory exists
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
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
            const createEventsTable = `
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    developer_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    synced BOOLEAN DEFAULT FALSE,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `;

            const createIndexes = `
                CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
                CREATE INDEX IF NOT EXISTS idx_events_synced ON events(synced);
                CREATE INDEX IF NOT EXISTS idx_events_developer_id ON events(developer_id);
            `;

            this.db!.exec(createEventsTable + '; ' + createIndexes, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async storeEvent(event: DeveloperEvent): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const stmt = this.db!.prepare(`
                INSERT INTO events (id, developer_id, timestamp, event_type, metadata, session_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            stmt.run([
                event.id,
                event.developerId,
                event.timestamp,
                event.eventType,
                JSON.stringify(event.metadata),
                event.sessionId
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

    public async getUnsyncedEvents(limit: number = 100): Promise<DeveloperEvent[]> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.all(`
                SELECT * FROM events 
                WHERE synced = FALSE 
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

    public async markEventsSynced(eventIds: string[]): Promise<void> {
        if (!this.db || eventIds.length === 0) {
            return;
        }

        return new Promise((resolve, reject) => {
            const placeholders = eventIds.map(() => '?').join(',');
            this.db!.run(`
                UPDATE events 
                SET synced = TRUE 
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

    public async createSyncBatch(events: DeveloperEvent[]): Promise<SyncBatch> {
        return {
            events,
            batchId: uuidv4(),
            timestamp: Date.now()
        };
    }

    public async cleanupOldEvents(retentionDays: number = 30): Promise<void> {
        if (!this.db) {
            return;
        }

        const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            this.db!.run(`
                DELETE FROM events 
                WHERE timestamp < ? AND synced = TRUE
            `, [cutoffTimestamp], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async exportData(): Promise<any> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.all('SELECT * FROM events ORDER BY timestamp DESC', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        exportTimestamp: Date.now(),
                        eventCount: rows.length,
                        events: rows
                    });
                }
            });
        });
    }

    public async getStorageStats(): Promise<{ eventCount: number; unsyncedCount: number; oldestEvent: number | null }> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.get(`
                SELECT 
                    COUNT(*) as eventCount,
                    SUM(CASE WHEN synced = FALSE THEN 1 ELSE 0 END) as unsyncedCount,
                    MIN(timestamp) as oldestEvent
                FROM events
            `, (err, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        eventCount: row.eventCount || 0,
                        unsyncedCount: row.unsyncedCount || 0,
                        oldestEvent: row.oldestEvent || null
                    });
                }
            });
        });
    }

    public async clearAllData(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            this.db!.run('DELETE FROM events', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public dispose(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}