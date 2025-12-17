import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
// import { DatabaseManager } from '../services/DatabaseManager.js';
// import { InsightFormatter } from '../services/InsightFormatter.js';

// const db = new DatabaseManager();
// const formatter = new InsightFormatter();

// Query parameters schema
const querySchema = z.object({
    days: z.string().optional().transform(val => val ? parseInt(val, 10) : 30)
});

// Updated response schema for trend-based insights
const trendBasedInsightSchema = z.object({
    metric: z.string(),
    currentValue: z.string(),
    trend: z.enum(['improving', 'stable', 'declining']),
    trendDescription: z.string(),
    explanation: z.string(),
    confidenceLevel: z.enum(['high', 'medium', 'low'])
});

const formattedInsightResponseSchema = z.object({
    developerId: z.string(),
    generatedAt: z.string(),
    insights: z.array(trendBasedInsightSchema),
    summary: z.object({
        overallTrend: z.enum(['improving', 'stable', 'declining']),
        keyStrengths: z.array(z.string()),
        areasForImprovement: z.array(z.string()),
        trendExplanation: z.string()
    }),
    privacyNote: z.string()
});

const trendsResponseSchema = z.object({
    success: z.boolean(),
    data: formattedInsightResponseSchema.nullable(),
    message: z.string()
});

// Trends endpoint configuration
export const config: ApiRouteConfig = {
    name: 'DeveloperTrends',
    type: 'api',
    method: 'GET',
    path: '/api/insights/trends/:developerId',
    description: 'Returns historical trend data for a specific developer',
    emits: [],
    responseSchema: {
        200: trendsResponseSchema
    }
};

export const handler = async (req: any, { logger }: any) => {
    try {
        const developerId = (req as any).params?.developerId as string;
        
        if (!developerId) {
            return {
                status: 400,
                body: {
                    success: false,
                    message: 'Developer ID is required'
                }
            };
        }

        // Parse query parameters
        const { days } = querySchema.parse((req as any).query || {});
        
        logger.info(`Fetching trends for developer: ${developerId}, days: ${days}`);

        // Get historical metrics
        const dailyMetrics = await db.getDeveloperMetrics(developerId, days);

        if (dailyMetrics.length === 0) {
            return {
                status: 404,
                body: {
                    success: false,
                    data: null,
                    message: 'No trend data found for this developer'
                }
            };
        }

        // Format trends using trend-based formatter
        const formattedTrends = formatter.formatDailyMetricsTrends(dailyMetrics, developerId);

        return {
            status: 200,
            body: {
                success: true,
                data: formattedTrends,
                message: 'Developer trends retrieved successfully'
            }
        };

    } catch (error) {
        logger.error('Error fetching developer trends:', error);
        return {
            status: 500,
            body: {
                success: false,
                data: null,
                message: 'Internal server error while fetching trends'
            }
        };
    }
};

// Helper function to calculate comprehensive trend analysis
function calculateTrendAnalysis(values: number[], lowerIsBetter: boolean = false) {
    if (values.length < 2) {
        return {
            values,
            trend: 'stable' as const,
            changePercent: 0
        };
    }
    
    // Calculate change percentage between first and last values
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    
    // Determine trend direction
    let trend: 'improving' | 'stable' | 'declining';
    const absChangePercent = Math.abs(changePercent);
    
    if (absChangePercent < 5) {
        trend = 'stable';
    } else if (lowerIsBetter) {
        // For metrics where lower values are better (like error resolution time)
        trend = changePercent < 0 ? 'improving' : 'declining';
    } else {
        // For metrics where higher values are better
        trend = changePercent > 0 ? 'improving' : 'declining';
    }
    
    return {
        values,
        trend,
        changePercent: Math.round(changePercent * 100) / 100
    };
}