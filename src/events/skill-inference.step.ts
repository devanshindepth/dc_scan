import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import sqlite3 from 'sqlite3';
import { DailyMetrics, SkillAssessment } from '../types/events.js';
import { MeasurementStandardizer } from '../services/MeasurementStandardizer.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';

// Zod schema for skill inference input data
const skillInferenceDataSchema = z.object({
    developerId: z.string(),
    date: z.string()
});

export const config: EventConfig = {
    name: 'SkillInference',
    type: 'event',
    description: 'Analyzes patterns to generate skill assessments and insights',
    subscribes: ['infer-skills'],
    emits: [],
    input: skillInferenceDataSchema
};

export const handler: Handlers['SkillInference'] = async (data, { emit, logger }) => {
    const startTime = Date.now();
    const { developerId, date } = data;
    
    try {
        logger.info(`Starting skill inference for developer ${developerId} on ${date}`);
        
        // Initialize database and measurement standardizer
        const db = await initializeDatabase();
        const standardizer = new MeasurementStandardizer();
        
        // Get daily metrics for this developer and date
        const dailyMetrics = await getDailyMetrics(db, developerId, date);
        if (!dailyMetrics) {
            logger.warn(`No daily metrics found for developer ${developerId} on ${date}`);
            return;
        }
        
        // Get historical metrics for trend analysis (last 30 days)
        const historicalMetrics = await getHistoricalMetrics(db, developerId, 30);
        
        // Standardize metrics for consistency
        const standardizedHistoricalMetrics = standardizer.standardizeDailyMetrics(historicalMetrics);
        
        // Generate skill assessment
        const skillAssessment = await generateSkillAssessment(
            developerId, 
            date, 
            dailyMetrics, 
            standardizedHistoricalMetrics
        );
        
        // Standardize the skill assessment for heuristic compliance
        const standardizedAssessment = standardizer.standardizeSkillAssessment(skillAssessment);
        
        // Store the standardized skill assessment
        await storeSkillAssessment(db, standardizedAssessment);
        
        const processingTime = Date.now() - startTime;
        logger.info(`Skill inference completed for developer ${developerId}: ${processingTime}ms`);
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error(`Skill inference failed for developer ${developerId} after ${processingTime}ms:`, error);
        throw error;
    }
};

/**
 * Generate comprehensive skill assessment based on current and historical metrics
 */
async function generateSkillAssessment(
    developerId: string,
    date: string,
    currentMetrics: DailyMetrics,
    historicalMetrics: DailyMetrics[]
): Promise<SkillAssessment> {
    
    // Detect improvement patterns for enhanced trend analysis
    const improvementPatterns = detectImprovementPatterns(historicalMetrics);
    
    // Calculate prompt maturity assessment with advanced trend analysis
    const promptMaturity = calculatePromptMaturity(currentMetrics, historicalMetrics, improvementPatterns);
    
    // Calculate debugging skill assessment with advanced trend analysis
    const debuggingSkill = calculateDebuggingSkill(currentMetrics, historicalMetrics, improvementPatterns);
    
    // Calculate AI collaboration assessment with advanced trend analysis
    const aiCollaboration = calculateAiCollaboration(currentMetrics, historicalMetrics, improvementPatterns);
    
    return {
        developerId,
        assessmentDate: date,
        promptMaturity,
        debuggingSkill,
        aiCollaboration
    };
}

/**
 * Calculate prompt maturity score and trend
 */
function calculatePromptMaturity(
    current: DailyMetrics, 
    historical: DailyMetrics[],
    improvementPatterns?: ReturnType<typeof detectImprovementPatterns>
): SkillAssessment['promptMaturity'] {
    
    // Base score calculation from current metrics
    let score = 0;
    
    // Prompt efficiency contributes 40% to the score
    score += current.promptEfficiencyScore * 40;
    
    // Human refinement ratio contributes 30% (higher refinement = lower maturity initially)
    // But we want to reward developers who refine AI output thoughtfully
    const refinementScore = current.humanRefinementRatio > 0.8 ? 
        current.humanRefinementRatio * 30 : // High refinement = good practice
        (1 - current.humanRefinementRatio) * 30; // Low refinement might indicate good prompts
    score += refinementScore;
    
    // AI assistance level contributes 30% (balanced usage indicates maturity)
    const assistanceScore = current.aiAssistanceLevel === 'medium' ? 30 :
                           current.aiAssistanceLevel === 'high' ? 15 :
                           current.aiAssistanceLevel === 'low' ? 20 : 0;
    score += assistanceScore;
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));
    
    // Calculate trend from historical data with enhanced analysis
    const trend = calculateTrend(
        historical.map(m => m.promptEfficiencyScore),
        current.promptEfficiencyScore
    );
    
    // Generate explanation with improvement patterns
    const explanation = generatePromptMaturityExplanation(current, trend, score, improvementPatterns);
    
    return {
        score: Math.round(score),
        trend,
        explanation
    };
}

/**
 * Calculate debugging skill score and trend
 */
function calculateDebuggingSkill(
    current: DailyMetrics, 
    historical: DailyMetrics[],
    improvementPatterns?: ReturnType<typeof detectImprovementPatterns>
): SkillAssessment['debuggingSkill'] {
    
    let score = 0;
    
    // Debugging style contributes 40% to the score
    const styleScore = current.debuggingStyle === 'hypothesis-driven' ? 40 :
                      current.debuggingStyle === 'mixed' ? 25 :
                      current.debuggingStyle === 'trial-and-error' ? 10 : 0;
    score += styleScore;
    
    // Error resolution time contributes 35% (faster resolution = higher score)
    // Normalize resolution time (assume 60 minutes is baseline, 10 minutes is excellent)
    const maxResolutionTime = 60; // minutes
    const excellentResolutionTime = 10; // minutes
    const normalizedResolutionTime = Math.max(0, Math.min(1, 
        (maxResolutionTime - current.errorResolutionTime) / 
        (maxResolutionTime - excellentResolutionTime)
    ));
    score += normalizedResolutionTime * 35;
    
    // AI dependency during debugging contributes 25% (lower dependency = higher skill)
    const debuggingAiScore = (1 - current.aiDependencyRatio) * 25;
    score += debuggingAiScore;
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));
    
    // Calculate trend from historical error resolution times
    const trend = calculateTrend(
        historical.map(m => 1 / (m.errorResolutionTime + 1)), // Invert for trend calculation
        1 / (current.errorResolutionTime + 1)
    );
    
    // Generate explanation with improvement patterns
    const explanation = generateDebuggingSkillExplanation(current, trend, score, improvementPatterns);
    
    return {
        score: Math.round(score),
        style: current.debuggingStyle,
        trend,
        explanation
    };
}

/**
 * Calculate AI collaboration score and assessment
 */
function calculateAiCollaboration(
    current: DailyMetrics, 
    historical: DailyMetrics[],
    improvementPatterns?: ReturnType<typeof detectImprovementPatterns>
): SkillAssessment['aiCollaboration'] {
    
    let score = 0;
    
    // Human refinement ratio contributes 40% (good refinement = good collaboration)
    score += current.humanRefinementRatio * 40;
    
    // Prompt efficiency contributes 35%
    score += current.promptEfficiencyScore * 35;
    
    // Balanced AI usage contributes 25% (not too dependent, not avoiding)
    const balanceScore = current.aiDependencyRatio > 0.8 ? 10 : // Too dependent
                        current.aiDependencyRatio < 0.2 ? 15 : // Avoiding AI
                        25; // Balanced usage
    score += balanceScore;
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));
    
    // Determine dependency level
    const dependencyLevel: 'low' | 'medium' | 'high' = 
        current.aiDependencyRatio > 0.7 ? 'high' :
        current.aiDependencyRatio > 0.3 ? 'medium' : 'low';
    
    // Refinement skill is directly the human refinement ratio scaled to 0-100
    const refinementSkill = Math.round(current.humanRefinementRatio * 100);
    
    // Generate explanation with improvement patterns
    const explanation = generateAiCollaborationExplanation(current, dependencyLevel, score, improvementPatterns);
    
    return {
        score: Math.round(score),
        dependencyLevel,
        refinementSkill,
        explanation
    };
}

/**
 * Calculate trend from historical data using multiple analysis methods
 */
function calculateTrend(
    historicalValues: number[], 
    currentValue: number
): 'improving' | 'stable' | 'declining' {
    
    if (historicalValues.length < 3) {
        return 'stable'; // Not enough data for trend analysis
    }
    
    // Method 1: Rolling average comparison
    const rollingTrend = calculateRollingAverageTrend(historicalValues);
    
    // Method 2: Linear regression trend
    const regressionTrend = calculateLinearRegressionTrend(historicalValues);
    
    // Method 3: Recent vs historical comparison
    const comparisonTrend = calculateComparisonTrend(historicalValues, currentValue);
    
    // Combine trends with weighted voting
    const trends = [rollingTrend, regressionTrend, comparisonTrend];
    const trendCounts = {
        improving: trends.filter(t => t === 'improving').length,
        stable: trends.filter(t => t === 'stable').length,
        declining: trends.filter(t => t === 'declining').length
    };
    
    // Return the trend with the most votes, preferring stable in ties
    if (trendCounts.improving > trendCounts.declining && trendCounts.improving > trendCounts.stable) {
        return 'improving';
    } else if (trendCounts.declining > trendCounts.improving && trendCounts.declining > trendCounts.stable) {
        return 'declining';
    } else {
        return 'stable';
    }
}

/**
 * Calculate trend using rolling averages
 */
function calculateRollingAverageTrend(historicalValues: number[]): 'improving' | 'stable' | 'declining' {
    if (historicalValues.length < 7) {
        return 'stable';
    }
    
    // Calculate 7-day rolling averages
    const rollingAverages = calculateRollingAverages(historicalValues, 7);
    
    if (rollingAverages.length < 2) {
        return 'stable';
    }
    
    // Compare recent rolling average with older rolling average
    const recentAverage = rollingAverages[rollingAverages.length - 1];
    const olderAverage = rollingAverages[Math.floor(rollingAverages.length / 2)];
    
    const trendThreshold = 0.05;
    const changeRatio = (recentAverage - olderAverage) / Math.max(olderAverage, 0.01);
    
    if (changeRatio > trendThreshold) {
        return 'improving';
    } else if (changeRatio < -trendThreshold) {
        return 'declining';
    } else {
        return 'stable';
    }
}

/**
 * Calculate trend using linear regression
 */
function calculateLinearRegressionTrend(historicalValues: number[]): 'improving' | 'stable' | 'declining' {
    if (historicalValues.length < 5) {
        return 'stable';
    }
    
    const n = historicalValues.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = historicalValues;
    
    // Calculate linear regression slope
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Normalize slope by the average value to get relative change
    const avgY = sumY / n;
    const normalizedSlope = slope / Math.max(avgY, 0.01);
    
    const slopeThreshold = 0.01; // 1% change per day
    
    if (normalizedSlope > slopeThreshold) {
        return 'improving';
    } else if (normalizedSlope < -slopeThreshold) {
        return 'declining';
    } else {
        return 'stable';
    }
}

/**
 * Calculate trend using recent vs historical comparison
 */
function calculateComparisonTrend(
    historicalValues: number[], 
    currentValue: number
): 'improving' | 'stable' | 'declining' {
    
    if (historicalValues.length < 7) {
        return 'stable';
    }
    
    // Compare current value with historical average
    const historicalAverage = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    
    // Also compare with recent average (last 7 days)
    const recentValues = historicalValues.slice(-7);
    const recentAverage = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    const trendThreshold = 0.1; // 10% change
    
    const currentVsHistorical = (currentValue - historicalAverage) / Math.max(historicalAverage, 0.01);
    const currentVsRecent = (currentValue - recentAverage) / Math.max(recentAverage, 0.01);
    
    // Weight recent comparison more heavily
    const weightedChange = currentVsRecent * 0.7 + currentVsHistorical * 0.3;
    
    if (weightedChange > trendThreshold) {
        return 'improving';
    } else if (weightedChange < -trendThreshold) {
        return 'declining';
    } else {
        return 'stable';
    }
}

/**
 * Calculate rolling averages for a given window size
 */
function calculateRollingAverages(values: number[], windowSize: number): number[] {
    if (values.length < windowSize) {
        return [];
    }
    
    const rollingAverages: number[] = [];
    
    for (let i = windowSize - 1; i < values.length; i++) {
        const window = values.slice(i - windowSize + 1, i + 1);
        const average = window.reduce((sum, val) => sum + val, 0) / window.length;
        rollingAverages.push(average);
    }
    
    return rollingAverages;
}

/**
 * Calculate exponential moving average for trend smoothing
 */
function calculateExponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
    if (values.length === 0) {
        return [];
    }
    
    const ema: number[] = [values[0]];
    
    for (let i = 1; i < values.length; i++) {
        const newEma = alpha * values[i] + (1 - alpha) * ema[i - 1];
        ema.push(newEma);
    }
    
    return ema;
}

/**
 * Detect improvement patterns in skill progression
 */
function detectImprovementPatterns(historicalMetrics: DailyMetrics[]): {
    hasConsistentImprovement: boolean;
    improvementRate: number;
    skillProgression: {
        promptMaturity: 'accelerating' | 'steady' | 'plateauing';
        debugging: 'accelerating' | 'steady' | 'plateauing';
        aiCollaboration: 'accelerating' | 'steady' | 'plateauing';
    };
} {
    
    if (historicalMetrics.length < 10) {
        return {
            hasConsistentImprovement: false,
            improvementRate: 0,
            skillProgression: {
                promptMaturity: 'steady',
                debugging: 'steady',
                aiCollaboration: 'steady'
            }
        };
    }
    
    // Sort by date to ensure chronological order
    const sortedMetrics = historicalMetrics.sort((a, b) => a.date.localeCompare(b.date));
    
    // Extract skill-related metrics
    const promptEfficiencyValues = sortedMetrics.map(m => m.promptEfficiencyScore);
    const refinementValues = sortedMetrics.map(m => m.humanRefinementRatio);
    const errorResolutionValues = sortedMetrics.map(m => 1 / (m.errorResolutionTime + 1)); // Invert for improvement
    
    // Calculate improvement patterns for each skill area
    const promptMaturityPattern = analyzeSkillProgression(promptEfficiencyValues);
    const debuggingPattern = analyzeSkillProgression(errorResolutionValues);
    const aiCollaborationPattern = analyzeSkillProgression(refinementValues);
    
    // Calculate overall improvement rate
    const allValues = [...promptEfficiencyValues, ...refinementValues, ...errorResolutionValues];
    const overallSlope = calculateLinearRegressionSlope(allValues);
    const improvementRate = Math.max(0, overallSlope * 100); // Convert to percentage
    
    // Determine if there's consistent improvement
    const improvingPatterns = [promptMaturityPattern, debuggingPattern, aiCollaborationPattern]
        .filter(pattern => pattern === 'accelerating' || pattern === 'steady').length;
    
    const hasConsistentImprovement = improvingPatterns >= 2;
    
    return {
        hasConsistentImprovement,
        improvementRate,
        skillProgression: {
            promptMaturity: promptMaturityPattern,
            debugging: debuggingPattern,
            aiCollaboration: aiCollaborationPattern
        }
    };
}

/**
 * Analyze skill progression pattern
 */
function analyzeSkillProgression(values: number[]): 'accelerating' | 'steady' | 'plateauing' {
    if (values.length < 5) {
        return 'steady';
    }
    
    // Calculate first and second derivatives to detect acceleration
    const firstDerivative = calculateDerivative(values);
    const secondDerivative = calculateDerivative(firstDerivative);
    
    // Analyze recent trend in second derivative
    const recentSecondDerivative = secondDerivative.slice(-3);
    const avgSecondDerivative = recentSecondDerivative.reduce((sum, val) => sum + val, 0) / recentSecondDerivative.length;
    
    // Analyze recent trend in first derivative
    const recentFirstDerivative = firstDerivative.slice(-5);
    const avgFirstDerivative = recentFirstDerivative.reduce((sum, val) => sum + val, 0) / recentFirstDerivative.length;
    
    const accelerationThreshold = 0.01;
    const plateauThreshold = 0.005;
    
    if (avgSecondDerivative > accelerationThreshold && avgFirstDerivative > 0) {
        return 'accelerating';
    } else if (Math.abs(avgFirstDerivative) < plateauThreshold) {
        return 'plateauing';
    } else {
        return 'steady';
    }
}

/**
 * Calculate derivative (rate of change) for a series of values
 */
function calculateDerivative(values: number[]): number[] {
    if (values.length < 2) {
        return [];
    }
    
    const derivative: number[] = [];
    for (let i = 1; i < values.length; i++) {
        derivative.push(values[i] - values[i - 1]);
    }
    
    return derivative;
}

/**
 * Calculate linear regression slope
 */
function calculateLinearRegressionSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) {
        return 0;
    }
    
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

/**
 * Generate explanation for prompt maturity assessment
 */
function generatePromptMaturityExplanation(
    metrics: DailyMetrics, 
    trend: 'improving' | 'stable' | 'declining',
    score: number,
    improvementPatterns?: ReturnType<typeof detectImprovementPatterns>
): string {
    
    const efficiency = metrics.promptEfficiencyScore;
    const refinement = metrics.humanRefinementRatio;
    const assistance = metrics.aiAssistanceLevel;
    
    let explanation = `Your prompt maturity score is ${Math.round(score)}/100. `;
    
    // Efficiency feedback
    if (efficiency > 0.7) {
        explanation += "You're efficiently accepting AI suggestions, indicating well-crafted prompts. ";
    } else if (efficiency > 0.4) {
        explanation += "Your prompt efficiency is moderate - consider refining your prompts for better results. ";
    } else {
        explanation += "Your prompts may need improvement - try being more specific and contextual. ";
    }
    
    // Refinement feedback
    if (refinement > 0.7) {
        explanation += "You actively refine AI output, showing good judgment. ";
    } else if (refinement > 0.3) {
        explanation += "You sometimes refine AI suggestions - this is healthy practice. ";
    } else {
        explanation += "Consider reviewing and refining AI output more often. ";
    }
    
    // Enhanced trend feedback with improvement patterns
    if (trend === 'improving') {
        explanation += "Your prompting skills are improving over time! ";
        if (improvementPatterns?.skillProgression.promptMaturity === 'accelerating') {
            explanation += "The improvement is accelerating - excellent progress!";
        } else if (improvementPatterns?.skillProgression.promptMaturity === 'steady') {
            explanation += "You're showing steady, consistent improvement.";
        }
    } else if (trend === 'declining') {
        explanation += "Your prompting efficiency has declined recently - consider reviewing your approach. ";
        if (improvementPatterns?.skillProgression.promptMaturity === 'plateauing') {
            explanation += "You may be hitting a plateau - try experimenting with new prompting techniques.";
        }
    } else {
        explanation += "Your prompting skills are stable. ";
        if (improvementPatterns?.skillProgression.promptMaturity === 'plateauing') {
            explanation += "Consider challenging yourself with more complex prompting scenarios to continue growing.";
        }
    }
    
    return explanation;
}

/**
 * Generate explanation for debugging skill assessment
 */
function generateDebuggingSkillExplanation(
    metrics: DailyMetrics, 
    trend: 'improving' | 'stable' | 'declining',
    score: number,
    improvementPatterns?: ReturnType<typeof detectImprovementPatterns>
): string {
    
    const style = metrics.debuggingStyle;
    const resolutionTime = metrics.errorResolutionTime;
    const aiDependency = metrics.aiDependencyRatio;
    
    let explanation = `Your debugging skill score is ${Math.round(score)}/100. `;
    
    // Style feedback
    if (style === 'hypothesis-driven') {
        explanation += "You use a systematic, hypothesis-driven approach to debugging. ";
    } else if (style === 'mixed') {
        explanation += "You use a mixed debugging approach, combining systematic and exploratory methods. ";
    } else {
        explanation += "You tend to use trial-and-error debugging - consider a more systematic approach. ";
    }
    
    // Resolution time feedback
    if (resolutionTime < 15) {
        explanation += "You resolve errors quickly, showing strong debugging skills. ";
    } else if (resolutionTime < 45) {
        explanation += "Your error resolution time is reasonable. ";
    } else {
        explanation += "Consider improving your debugging efficiency - errors take longer to resolve. ";
    }
    
    // AI dependency feedback
    if (aiDependency < 0.3) {
        explanation += "You debug independently with minimal AI assistance. ";
    } else if (aiDependency < 0.7) {
        explanation += "You balance AI assistance with independent debugging. ";
    } else {
        explanation += "You rely heavily on AI for debugging - developing independent skills could be beneficial. ";
    }
    
    // Enhanced trend feedback with improvement patterns
    if (trend === 'improving') {
        explanation += "Your debugging skills are improving! ";
        if (improvementPatterns?.skillProgression.debugging === 'accelerating') {
            explanation += "Your debugging efficiency is accelerating - great work!";
        } else if (improvementPatterns?.skillProgression.debugging === 'steady') {
            explanation += "You're showing consistent improvement in debugging.";
        }
    } else if (trend === 'declining') {
        explanation += "Your debugging efficiency has declined recently. ";
        if (improvementPatterns?.skillProgression.debugging === 'plateauing') {
            explanation += "Consider learning new debugging techniques or tools to break through this plateau.";
        }
    } else {
        explanation += "Your debugging skills are stable. ";
        if (improvementPatterns?.skillProgression.debugging === 'plateauing') {
            explanation += "Try challenging yourself with more complex debugging scenarios.";
        }
    }
    
    return explanation;
}

/**
 * Generate explanation for AI collaboration assessment
 */
function generateAiCollaborationExplanation(
    metrics: DailyMetrics, 
    dependencyLevel: 'low' | 'medium' | 'high',
    score: number,
    improvementPatterns?: ReturnType<typeof detectImprovementPatterns>
): string {
    
    const refinement = metrics.humanRefinementRatio;
    const efficiency = metrics.promptEfficiencyScore;
    
    let explanation = `Your AI collaboration score is ${Math.round(score)}/100. `;
    
    // Dependency level feedback
    if (dependencyLevel === 'low') {
        explanation += "You have low AI dependency, maintaining strong independent coding skills. ";
    } else if (dependencyLevel === 'medium') {
        explanation += "You have balanced AI usage, effectively collaborating with AI tools. ";
    } else {
        explanation += "You have high AI dependency - consider developing more independent coding skills. ";
    }
    
    // Refinement feedback
    if (refinement > 0.7) {
        explanation += "You excel at refining AI output, showing strong collaboration skills. ";
    } else if (refinement > 0.3) {
        explanation += "You sometimes refine AI suggestions, which is good practice. ";
    } else {
        explanation += "Consider reviewing and improving AI-generated code more actively. ";
    }
    
    // Efficiency feedback with improvement patterns
    if (efficiency > 0.7) {
        explanation += "Your prompts are efficient and effective. ";
    } else if (efficiency > 0.4) {
        explanation += "Your prompt efficiency is moderate. ";
    } else {
        explanation += "Your prompts could be more effective. ";
    }
    
    // Add improvement pattern insights
    if (improvementPatterns?.hasConsistentImprovement) {
        explanation += `You're showing consistent improvement across multiple skill areas (${improvementPatterns.improvementRate.toFixed(1)}% improvement rate).`;
    } else if (improvementPatterns?.skillProgression.aiCollaboration === 'accelerating') {
        explanation += "Your AI collaboration skills are accelerating - excellent progress!";
    } else if (improvementPatterns?.skillProgression.aiCollaboration === 'plateauing') {
        explanation += "Consider experimenting with different AI collaboration approaches to continue growing.";
    }
    
    return explanation;
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

            // Create skill assessments table
            const createTablesSQL = `
                CREATE TABLE IF NOT EXISTS skill_assessments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    developer_id TEXT NOT NULL,
                    assessment_date TEXT NOT NULL,
                    prompt_maturity_score INTEGER NOT NULL,
                    prompt_maturity_trend TEXT NOT NULL,
                    prompt_maturity_explanation TEXT NOT NULL,
                    debugging_skill_score INTEGER NOT NULL,
                    debugging_skill_style TEXT NOT NULL,
                    debugging_skill_trend TEXT NOT NULL,
                    debugging_skill_explanation TEXT NOT NULL,
                    ai_collaboration_score INTEGER NOT NULL,
                    ai_collaboration_dependency_level TEXT NOT NULL,
                    ai_collaboration_refinement_skill INTEGER NOT NULL,
                    ai_collaboration_explanation TEXT NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    UNIQUE(developer_id, assessment_date)
                );

                CREATE INDEX IF NOT EXISTS idx_skill_assessments_developer_date ON skill_assessments(developer_id, assessment_date);
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
 * Get daily metrics for a specific developer and date
 */
async function getDailyMetrics(
    db: sqlite3.Database, 
    developerId: string, 
    date: string
): Promise<DailyMetrics | null> {
    
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM daily_metrics 
            WHERE developer_id = ? AND date = ?
        `, [developerId, date], (err: any, row: any) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                resolve(null);
                return;
            }

            const metrics: DailyMetrics = {
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
            };

            resolve(metrics);
        });
    });
}

/**
 * Get historical metrics for trend analysis
 */
async function getHistoricalMetrics(
    db: sqlite3.Database, 
    developerId: string, 
    days: number
): Promise<DailyMetrics[]> {
    
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM daily_metrics 
            WHERE developer_id = ? 
            ORDER BY date DESC 
            LIMIT ?
        `, [developerId, days], (err: any, rows: any[]) => {
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

/**
 * Store skill assessment in database
 */
async function storeSkillAssessment(db: sqlite3.Database, assessment: SkillAssessment): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO skill_assessments (
                developer_id, assessment_date,
                prompt_maturity_score, prompt_maturity_trend, prompt_maturity_explanation,
                debugging_skill_score, debugging_skill_style, debugging_skill_trend, debugging_skill_explanation,
                ai_collaboration_score, ai_collaboration_dependency_level, 
                ai_collaboration_refinement_skill, ai_collaboration_explanation
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