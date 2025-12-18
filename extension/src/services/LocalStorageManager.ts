import * as path from 'path';
import * as fs from 'fs';
import { DeveloperEvent, SyncBatch } from '../types/events';
import { v4 as uuidv4 } from 'uuid';

interface StoredEvent extends DeveloperEvent {
    synced: boolean;
    createdAt: number;
}

export class LocalStorageManager {
    private eventsFilePath: string;
    private initPromise: Promise<void>;

    constructor(private storagePath: string) {
        this.eventsFilePath = path.join(storagePath, 'ai-dev-insights-events.json');
        this.initPromise = this.initializeStorage();
    }

    private async initializeStorage(): Promise<void> {
        // Ensure storage directory exists
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }

        // Initialize events file if it doesn't exist
        if (!fs.existsSync(this.eventsFilePath)) {
            await this.saveEvents([]);
        }
    }

    private async loadEvents(): Promise<StoredEvent[]> {
        try {
            if (!fs.existsSync(this.eventsFilePath)) {
                return [];
            }
            const data = fs.readFileSync(this.eventsFilePath, 'utf8');
            return JSON.parse(data) || [];
        } catch (error) {
            console.error('Failed to load events:', error);
            return [];
        }
    }

    private async saveEvents(events: StoredEvent[]): Promise<void> {
        try {
            fs.writeFileSync(this.eventsFilePath, JSON.stringify(events, null, 2));
        } catch (error) {
            console.error('Failed to save events:', error);
            throw error;
        }
    }

    public async storeEvent(event: DeveloperEvent): Promise<void> {
        await this.initPromise;
        
        const events = await this.loadEvents();
        const storedEvent: StoredEvent = {
            ...event,
            synced: false,
            createdAt: Date.now()
        };
        
        events.push(storedEvent);
        await this.saveEvents(events);
    }

    public async getUnsyncedEvents(limit: number = 100): Promise<DeveloperEvent[]> {
        await this.initPromise;
        
        const events = await this.loadEvents();
        const unsyncedEvents = events
            .filter(event => !event.synced)
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, limit);

        return unsyncedEvents.map(event => ({
            id: event.id,
            developerId: event.developerId,
            timestamp: event.timestamp,
            eventType: event.eventType,
            metadata: event.metadata,
            sessionId: event.sessionId
        }));
    }

    public async markEventsSynced(eventIds: string[]): Promise<void> {
        await this.initPromise;
        if (eventIds.length === 0) {
            return;
        }

        const events = await this.loadEvents();
        const eventIdSet = new Set(eventIds);
        
        for (const event of events) {
            if (eventIdSet.has(event.id)) {
                event.synced = true;
            }
        }
        
        await this.saveEvents(events);
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
        
        const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        const events = await this.loadEvents();
        
        const filteredEvents = events.filter(event => 
            event.timestamp >= cutoffTimestamp || !event.synced
        );
        
        await this.saveEvents(filteredEvents);
    }

    public async exportData(): Promise<any> {
        await this.initPromise;
        
        const events = await this.loadEvents();
        const sortedEvents = events.sort((a, b) => b.timestamp - a.timestamp);

        return {
            exportTimestamp: Date.now(),
            eventCount: events.length,
            events: sortedEvents
        };
    }

    public async getStorageStats(): Promise<{ eventCount: number; unsyncedCount: number; oldestEvent: number | null }> {
        await this.initPromise;
        
        const events = await this.loadEvents();
        const unsyncedCount = events.filter(event => !event.synced).length;
        const oldestEvent = events.length > 0 ? Math.min(...events.map(e => e.timestamp)) : null;

        return {
            eventCount: events.length,
            unsyncedCount,
            oldestEvent
        };
    }

    public async clearAllData(): Promise<void> {
        await this.initPromise;
        await this.saveEvents([]);
    }

    public async waitForInitialization(): Promise<void> {
        await this.initPromise;
    }

    public dispose(): void {
        // No cleanup needed for JSON file storage
    }
}