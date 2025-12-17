import { DatabaseManager } from '../DatabaseManager.js';

export interface RetentionPolicy {
    name: string;
    description: string;
    eventsRetentionDays: number;
    metricsRetentionDays: number;
    assessmentsRetentionDays: number;
    maxStorageSizeMB: number;
    cleanupBatchSize: number;
}

export interface CleanupResult {
    success: boolean;
    startTime: string;
    endTime: string;
    duration: number;
    totalRecordsCleaned: number;
    eventsDeleted: number;
    metricsDeleted: number;
    assessmentsDeleted: number;
    corruptedDataCleaned: number;
    storageFreedMB: number;
    error?: string;
}

export class DataRetentionManager {
    private db: DatabaseManager;
    private defaultPolicy: RetentionPolicy;

    constructor(db: DatabaseManager) {
        this.db = db;
        this.defaultPolicy = {
            name: 'default',
            description: 'Default retention policy for AI Dev Insights',
            eventsRetentionDays: 30,
            metricsRetentionDays: 365,
            assessmentsRetentionDays: 730, // 2 years
            maxStorageSizeMB: 500,
            cleanupBatchSize: 1000
        };
    }

    public async executeCleanup(policy?: Partial<RetentionPolicy>): Promise<CleanupResult> {
        const startTime = Date.now();
        const effectivePolicy = { ...this.defaultPolicy, ...policy };

        try {
            // Get initial storage stats
            const initialStats = await this.db.getStorageStats();

            // Execute retention-based cleanup
            const retentionResult = await this.db.cleanupByRetentionPolicy({
                eventsRetentionDays: effectivePolicy.eventsRetentionDays,
                metricsRetentionDays: effectivePolicy.metricsRetentionDays,
                assessmentsRetentionDays: effectivePolicy.assessmentsRetentionDays
            });

            // Execute integrity cleanup
            const integrityResult = await this.db.cleanupCorruptedData();

            // Get final storage stats
            const finalStats = await this.db.getStorageStats();

            const endTime = Date.now();
            const totalCleaned = retentionResult.eventsDeleted + 
                               retentionResult.metricsDeleted + 
                               retentionResult.assessmentsDeleted +
                               integrityResult.corruptedEventsDeleted +
                               integrityResult.orphanedMetricsDeleted;

            return {
                success: true,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                duration: endTime - startTime,
                totalRecordsCleaned: totalCleaned,
                eventsDeleted: retentionResult.eventsDeleted,
                metricsDeleted: retentionResult.metricsDeleted,
                assessmentsDeleted: retentionResult.assessmentsDeleted,
                corruptedDataCleaned: integrityResult.corruptedEventsDeleted + integrityResult.orphanedMetricsDeleted,
                storageFreedMB: this.estimateStorageFreed(initialStats, finalStats)
            };

        } catch (error) {
            const endTime = Date.now();
            return {
                success: false,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                duration: endTime - startTime,
                totalRecordsCleaned: 0,
                eventsDeleted: 0,
                metricsDeleted: 0,
                assessmentsDeleted: 0,
                corruptedDataCleaned: 0,
                storageFreedMB: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    public async getStorageReport(): Promise<{
        currentStats: any;
        retentionPolicy: RetentionPolicy;
        recommendations: string[];
    }> {
        const currentStats = await this.db.getStorageStats();
        const recommendations: string[] = [];

        // Analyze storage and provide recommendations
        if (currentStats.unprocessedEvents > 1000) {
            recommendations.push('High number of unprocessed events detected. Consider checking event processing pipeline.');
        }

        if (currentStats.totalEvents > 100000) {
            recommendations.push('Large number of events stored. Consider reducing retention period for events.');
        }

        const daysSinceOldest = currentStats.oldestEventDate 
            ? Math.floor((Date.now() - new Date(currentStats.oldestEventDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        if (daysSinceOldest > this.defaultPolicy.eventsRetentionDays * 2) {
            recommendations.push('Very old events detected. Manual cleanup may be needed.');
        }

        return {
            currentStats,
            retentionPolicy: this.defaultPolicy,
            recommendations
        };
    }

    public async scheduleCleanup(policy?: Partial<RetentionPolicy>): Promise<void> {
        // This would integrate with a job scheduler in a real implementation
        // For now, we'll just log the scheduling request
        console.log('Cleanup scheduled with policy:', { ...this.defaultPolicy, ...policy });
    }

    public getDefaultPolicy(): RetentionPolicy {
        return { ...this.defaultPolicy };
    }

    public updateDefaultPolicy(updates: Partial<RetentionPolicy>): void {
        this.defaultPolicy = { ...this.defaultPolicy, ...updates };
    }

    private estimateStorageFreed(initialStats: any, finalStats: any): number {
        // Rough estimation of storage freed
        // In a real implementation, you would measure actual file sizes
        const recordsFreed = (initialStats.totalEvents - finalStats.totalEvents) +
                           (initialStats.dailyMetrics - finalStats.dailyMetrics) +
                           (initialStats.skillAssessments - finalStats.skillAssessments);
        
        // Estimate ~1KB per record on average
        return Math.round((recordsFreed * 1024) / (1024 * 1024) * 100) / 100;
    }
}