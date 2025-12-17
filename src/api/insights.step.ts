import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';
// import { DatabaseManager } from '../services/DatabaseManager.js';
// import { InsightFormatter } from '../services/InsightFormatter.js';

// const db = new DatabaseManager();
// const formatter = new InsightFormatter();

// Schema definitions for responses
const skillAssessmentSchema = z.object({
    developerId: z.string(),
    assessmentDate: z.string(),
    promptMaturity: z.object({
        score: z.number(),
        trend: z.enum(['improving', 'stable', 'declining']),
        explanation: z.string()
    }),
    debuggingSkill: z.object({
        score: z.number(),
        style: z.enum(['hypothesis-driven', 'trial-and-error', 'mixed']),
        trend: z.enum(['improving', 'stable', 'declining']),
        explanation: z.string()
    }),
    aiCollaboration: z.object({
        score: z.number(),
        dependencyLevel: z.enum(['low', 'medium', 'high']),
        refinementSkill: z.number(),
        explanation: z.string()
    })
});

const dailyMetricsSchema = z.object({
    developerId: z.string(),
    date: z.string(),
    aiAssistanceLevel: z.enum(['low', 'medium', 'high']),
    humanRefinementRatio: z.number(),
    promptEfficiencyScore: z.number(),
    debuggingStyle: z.enum(['hypothesis-driven', 'trial-and-error', 'mixed']),
    errorResolutionTime: z.number(),
    aiDependencyRatio: z.number(),
    sessionCount: z.number(),
    activeTime: z.number()
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

const developerInsightsResponseSchema = z.object({
    success: z.boolean(),
    data: formattedInsightResponseSchema.nullable(),
    message: z.string()
});

const trendsResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        developerId: z.string(),
        timeRange: z.object({
            startDate: z.string(),
            endDate: z.string(),
            days: z.number()
        }),
        trends: z.object({
            promptEfficiency: z.object({
                values: z.array(z.number()),
                trend: z.enum(['improving', 'stable', 'declining']),
                changePercent: z.number()
            }),
            debuggingSkill: z.object({
                values: z.array(z.number()),
                trend: z.enum(['improving', 'stable', 'declining']),
                changePercent: z.number()
            }),
            aiDependency: z.object({
                values: z.array(z.number()),
                trend: z.enum(['improving', 'stable', 'declining']),
                changePercent: z.number()
            })
        }),
        dailyMetrics: z.array(dailyMetricsSchema)
    }).nullable(),
    message: z.string()
});

const pauseResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    pausedAt: z.string()
});

// Developer insights endpoint
export const config: ApiRouteConfig = {
    name: 'DeveloperInsights',
    type: 'api',
    method: 'GET',
    path: '/api/insights/developer/:developerId',
    description: 'Returns comprehensive insights for a specific developer',
    emits: [],
    responseSchema: {
        200: developerInsightsResponseSchema
    }
};

export const handler = async (req: any, { logger }: any) => {
    try {
        // Try different ways to access the parameter
        const developerId = req.params?.developerId || req.pathParams?.developerId || req.route?.params?.developerId;
        
        if (!developerId) {
            return {
                status: 400,
                body: {
                    success: false,
                    message: 'Developer ID is required'
                }
            };
        }

        logger.info(`Fetching insights for developer: ${developerId}`);

        // Mock insights data
        const formattedInsights = {
            developerId,
            summary: {
                overallScore: 75,
                trend: 'improving' as const,
                lastUpdated: new Date().toISOString()
            },
            skills: {
                promptMaturity: { score: 80, trend: 'improving' as const },
                debuggingSkill: { score: 70, trend: 'stable' as const },
                aiCollaboration: { score: 75, trend: 'improving' as const }
            },
            insights: [
                {
                    metric: 'Prompt Efficiency',
                    currentValue: '80%',
                    trend: 'improving' as const,
                    trendDescription: 'Your prompting skills are getting better',
                    recommendation: 'Keep practicing with more complex scenarios'
                }
            ]
        };

        return {
            status: 200,
            body: {
                success: true,
                data: formattedInsights,
                message: 'Developer insights retrieved successfully'
            }
        };

    } catch (error) {
        logger.error('Error fetching developer insights:', error);
        return {
            status: 500,
            body: {
                success: false,
                data: null,
                message: 'Internal server error while fetching insights'
            }
        };
    }
};

// Helper function to calculate trend direction
function calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 5) return 'improving';
    if (changePercent < -5) return 'declining';
    return 'stable';
}