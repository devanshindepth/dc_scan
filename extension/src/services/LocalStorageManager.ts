import initSqlJs, { Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { DeveloperEvent, SyncBatch } from '../types/events';
import { v4 as uuidv4 } from 'uuid';

export class LocalStorageManager {
    private db: Database | null = null;
    private dbPath: string;
    private SQL: any = null;
    private initPromise: Promise<void>;

    constructor(private storagePath: string) {
        this.dbPath = path.join(storagePath, 'ai-dev-insights.db');
        this.initPromise = this.initializeDatabase();
    }

    private async initializeDatabase(): Promise<void> {
        // Ensure storage directory exists
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }

        // Initialize sql.js
        this.SQL = await initSqlJs();

        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new this.SQL.Database(buffer);
        } else {
            this.db = new this.SQL.Database();
        }

        await this.createTables();
    }

    private async createTables(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

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

        this.db.run(createEventsTable);
        this.db.run(createIndexes);
        this.saveDatabase();
    }

    private saveDatabase(): void {
        if (!this.db) {
            return;
        }
        const data = this.db.export();
        fs.writeFileSync(this.dbPath, data);
    }

    public async storeEvent(event: DeveloperEvent): Promise<void> {
        await this.initPromise;
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        this.db.run(
            `INSERT INTO events (id, developer_id, timestamp, event_type, metadata, session_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                event.id,
                event.developerId,
                event.timestamp,
                event.eventType,
                JSON.stringify(event.metadata),
                event.sessionId
            ]
        );

        this.saveDatabase();
    }

    public async getUnsyncedEvents(limit: number = 100): Promise<DeveloperEvent[]> {
        await this.initPromise;
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const results = this.db.exec(`
            SELECT * FROM events 
            WHERE synced = 0
            ORDER BY timestamp ASC 
            LIMIT ?
        `, [limit]);

        if (results.length === 0) {
            return [];
        }

        const columns = results[0].columns;
        const values = results[0].values;

        const events = values.map((row: any[]) => {
            const rowObj: any = {};
            columns.forEach((col: string, idx: number) => {
                rowObj[col] = row[idx];
            });

            return {
                id: rowObj.id,
                developerId: rowObj.developer_id,
                timestamp: rowObj.timestamp,
                eventType: rowObj.event_type,
                metadata: JSON.parse(rowObj.metadata),
                sessionId: rowObj.session_id
            };
        });

        return events;
    }

    public async markEventsSynced(eventIds: string[]): Promise<void> {
        await this.initPromise;
        if (!this.db || eventIds.length === 0) {
            return;
        }

        const placeholders = eventIds.map(() => '?').join(',');
        this.db.run(
            `UPDATE events 
             SET synced = 1
             WHERE id IN (${placeholders})`,
            eventIds
        );

        this.saveDatabase();
    }

    public async createSyncBatch(events: DeveloperEvent[]): Promise<SyncBatch> {
        return {
            events,
            batchId: uuidv4(),
            timestamp: Date.now()
        };
    }

    public async cleanupOldEvents(retentionDays: number = 30): Promise<void> {
        await this.initPromise;
        if (!this.db) {
            return;
        }

        const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

        this.db.run(
            `DELETE FROM events 
             WHERE timestamp < ? AND synced = 1`,
            [cutoffTimestamp]
        );

        this.saveDatabase();
    }

    public async exportData(): Promise<any> {
        await this.initPromise;
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const results = this.db.exec('SELECT * FROM events ORDER BY timestamp DESC');

        if (results.length === 0) {
            return {
                exportTimestamp: Date.now(),
                eventCount: 0,
                events: []
            };
        }

        const columns = results[0].columns;
        const values = results[0].values;

        const rows = values.map((row: any[]) => {
            const rowObj: any = {};
            columns.forEach((col: string, idx: number) => {
                rowObj[col] = row[idx];
            });
            return rowObj;
        });

        return {
            exportTimestamp: Date.now(),
            eventCount: rows.length,
            events: rows
        };
    }

    public async getStorageStats(): Promise<{ eventCount: number; unsyncedCount: number; oldestEvent: number | null }> {
        await this.initPromise
            throw new Error('Database not initialized');
        }

        const results = this.db.exec(`
            SELECT 
                COUNT(*) as eventCount,
                SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as unsyncedCount,
                MIN(timestamp) as oldestEvent
            FROM events
        `);

        if (results.length === 0 || results[0].values.length === 0) {
            return {
                eventCount: 0,
                unsyncedCount: 0,
                oldestEvent: null
            };
        }

        const row = results[0].values[0];

        return {
            eventCount: (row[0] as number) || 0,
            unsyncedCount: (row[1] as number) || 0,
            oldestEvent: (row[2] as number) || null
        };
    }

    public async clearAllData(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        this.db.run('DELETE FROM events');
        this.saveDatabase();
    }

    public dispose(): void {
        if (this.db) {
            this.saveDatabase();
            this.db.close();
            this.db = null;
        }
    }
}