import * as vscode from 'vscode';
import { LocalStorageManager } from './LocalStorageManager';
import { SyncBatch } from '../types/events';

// Use global fetch if available, otherwise use node-fetch
const fetch = globalThis.fetch || (async (input: string | URL | RequestInfo, init?: RequestInit) => {
    const { default: nodeFetch } = await import('node-fetch');
    return nodeFetch(input as any, init as import('node-fetch').RequestInit);
});

export class SyncManager implements vscode.Disposable {
    private syncInterval: NodeJS.Timeout | null = null;
    private isOnline: boolean = true;
    private retryCount: number = 0;
    private maxRetries: number = 3;

    constructor(private localStorageManager: LocalStorageManager) {}

    public startPeriodicSync(): void {
        const config = vscode.workspace.getConfiguration('aiDevInsights');
        const syncIntervalMs = config.get<number>('syncInterval', 300000); // Default 5 minutes

        this.syncInterval = setInterval(() => {
            this.performSync();
        }, syncIntervalMs);

        // Perform initial sync
        this.performSync();
    }

    public async performSync(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('aiDevInsights');
            const backendUrl = config.get<string>('backendUrl', 'http://localhost:3000');
            
            if (!this.isOnline) {
                console.log('Offline - skipping sync');
                return;
            }

            const unsyncedEvents = await this.localStorageManager.getUnsyncedEvents(100);
            
            if (unsyncedEvents.length === 0) {
                console.log('No events to sync');
                return;
            }

            const syncBatch = await this.localStorageManager.createSyncBatch(unsyncedEvents);
            
            const success = await this.uploadBatch(backendUrl, syncBatch);
            
            if (success) {
                const eventIds = unsyncedEvents.map(event => event.id);
                await this.localStorageManager.markEventsSynced(eventIds);
                this.retryCount = 0;
                console.log(`Successfully synced ${unsyncedEvents.length} events`);
            } else {
                this.handleSyncFailure();
            }

        } catch (error) {
            console.error('Sync error:', error);
            this.handleSyncFailure();
        }
    }

    private async uploadBatch(backendUrl: string, batch: SyncBatch): Promise<boolean> {
        try {
            const response = await fetch(`${backendUrl}/api/events/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batch)
            });

            if (response.ok) {
                return true;
            } else if (response.status === 409) {
                // Batch already processed (idempotent handling)
                console.log('Batch already processed - marking as synced');
                return true;
            } else {
                console.error('Upload failed with status:', response.status);
                return false;
            }

        } catch (error) {
            console.error('Network error during upload:', error);
            this.isOnline = false;
            
            // Try to detect when we're back online
            setTimeout(() => {
                this.checkConnectivity();
            }, 30000); // Check again in 30 seconds
            
            return false;
        }
    }

    private async checkConnectivity(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('aiDevInsights');
            const backendUrl = config.get<string>('backendUrl', 'http://localhost:3000');
            
            const response = await fetch(`${backendUrl}/health`, {
                method: 'GET',
                timeout: 5000
            } as any);

            if (response.ok) {
                this.isOnline = true;
                console.log('Connectivity restored');
                this.performSync(); // Attempt sync now that we're online
            }
        } catch (error) {
            // Still offline, will check again later
            setTimeout(() => {
                this.checkConnectivity();
            }, 60000); // Check again in 1 minute
        }
    }

    private handleSyncFailure(): void {
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
            console.log('Max retries reached - will try again on next sync cycle');
            this.retryCount = 0;
        } else {
            // Exponential backoff retry
            const retryDelay = Math.pow(2, this.retryCount) * 1000;
            setTimeout(() => {
                this.performSync();
            }, retryDelay);
        }
    }

    public async forcSync(): Promise<void> {
        await this.performSync();
    }

    public getConnectionStatus(): { isOnline: boolean; retryCount: number } {
        return {
            isOnline: this.isOnline,
            retryCount: this.retryCount
        };
    }

    public dispose(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
}