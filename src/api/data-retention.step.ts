import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
import { DatabaseManager } from '../services/DatabaseManager.js';
import { DataRetentionManager } from '../services/services/DataRetentionManager.js';

const db = new DatabaseManager();
const retentionManager = new DataRetentionManager(db);

// Response schemas
const storageReportSchema = z.object({
    success: z.boolean(),
    data: z.object({
        currentStats: z.object({
            totalEvents: z.number(),
            processedEvents: z.number(),
            unprocessedEvents: z.number(),
            dailyMetrics: z.number(),
            skillAssessments: z.number(),
            oldestEventDate: z.string().nullable(),
            newestEventDate: z.string().nullable()
        }),
        retentionPolicy: z.object({
            name: z.string(),
            description: z.string(),
            eventsRetentionDays: z.number(),
            metricsRetentionDays: z.number(),
            assessmentsRetentionDays: z.number(),
            maxStorageSizeMB: z.number(),
            cleanupBatchSize: z.number()
        }),
        recommendations: z.array(z.string())
    }),
    message: z.string()
});

// Data retention management endpoint
export const config: ApiRouteConfig = {
    name: 'DataRetentionReport',
    type: 'api',
    method: 'GET',
    path: '/api/admin/data-retention/report',
    description: 'Returns storage statistics and retention policy information',
    emits: [],
    responseSchema: {
        200: storageReportSchema
    }
};

export const handler = async (req: any, { logger }: any) => {
    try {
        logger.info('Generating data retention report');

        const storageReport = await retentionManager.getStorageReport();

        return {
            status: 200,
            body: {
                success: true,
                data: storageReport,
                message: 'Data retention report generated successfully'
            }
        };

    } catch (error) {
        logger.error('Error generating data retention report:', error);
        return {
            status: 500,
            body: {
                success: false,
                message: 'Internal server error while generating data retention report'
            }
        };
    }
};