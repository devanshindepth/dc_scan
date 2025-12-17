import { DailyMetrics, SkillAssessment, DeveloperEvent } from '../types/events.js';

export interface ValidationResult {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    normalizedValue?: number;
}

export interface ConsistencyReport {
    overallConsistency: number; // 0-1 score
    validationResults: Record<string, ValidationResult>;
    recommendations: string[];
}

/**
 * Ensures heuristic measurements are consistent and approximate across all tracking scenarios
 * Validates Requirements 3.4, 6.1 - approximate and heuristic measurements
 */
export class HeuristicValidator {
    
    // Consistency thresholds for different metrics
    private readonly CONSISTENCY_THRESHOLDS = {
        promptEfficiency: { min: 0, max: 1, variance: 0.3 },
        humanRefinement: { min: 0, max: 1, variance: 0.4 },
        errorResolution: { min: 0, max: 300, variance: 0.5 }, // minutes
        aiDependency: { min: 0, max: 1, variance: 0.3 },
        sessionCount: { min: 0, max: 50, variance: 0.6 },
        activeTime: { min: 0, max: 1440, variance: 0.5 } // minutes per day
    };
    
    // Approximation ranges for privacy-safe measurements
    private readonly APPROXIMATION_RANGES = {
        score: [
            { min: 0, max: 20, label: 'Needs Attention' },
            { min: 20, max: 40, label: 'Developing' },
            { min: 40, max: 60, label: 'Moderate' },
            { min: 60, max: 80, label: 'Good' },
            { min: 80, max: 100, label: 'High' }
        ],
        time: [
            { min: 0, max: 5, label: 'Very Quick' },
            { min: 5, max: 15, label: 'Quick' },
            { min: 15, max: 30, label: 'Moderate' },
            { min: 30, max: 60, label: 'Slow' },
            { min: 60, max: Infinity, label: 'Very Slow' }
        ],
        dependency: [
            { min: 0, max: 0.3, label: 'Low' },
            { min: 0.3, max: 0.7, label: 'Balanced' },
            { min: 0.7, max: 1, label: 'High' }
        ]
    };
    
    /**
     * Validate daily metrics for consistency and heuristic compliance
     */
    public validateDailyMetrics(metrics: DailyMetrics[]): ConsistencyReport {
        const validationResults: Record<string, ValidationResult> = {};
        const recommendations: string[] = [];
        
        if (metrics.length === 0) {
            return {
                overallConsistency: 0,
                validationResults: {},
                recommendations: ['No metrics available for validation']
            };
        }
        
        // Validate prompt efficiency consistency
        validationResults.promptEfficiency = this.validateMetricConsistency(
            metrics.map(m => m.promptEfficiencyScore),
            'promptEfficiency',
            'Prompt Efficiency'
        );
        
        // Validate human refinement ratio consistency
        validationResults.humanRefinement = this.validateMetricConsistency(
            metrics.map(m => m.humanRefinementRatio),
            'humanRefinement',
            'Human Refinement Ratio'
        );
        
        // Validate error resolution time consistency
        validationResults.errorResolution = this.validateMetricConsistency(
            metrics.map(m => m.errorResolutionTime),
            'errorResolution',
            'Error Resolution Time'
        );
        
        // Validate AI dependency consistency
        validationResults.aiDependency = this.validateMetricConsistency(
            metrics.map(m => m.aiDependencyRatio),
            'aiDependency',
            'AI Dependency Ratio'
        );
        
        // Validate session count consistency
        validationResults.sessionCount = this.validateMetricConsistency(
            metrics.map(m => m.sessionCount),
            'sessionCount',
            'Session Count'
        );
        
        // Validate active time consistency
        validationResults.activeTime = this.validateMetricConsistency(
            metrics.map(m => m.activeTime),
            'activeTime',
            'Active Time'
        );
        
        // Validate cross-metric relationships
        validationResults.crossMetric = this.validateCrossMetricConsistency(metrics);
        
        // Calculate overall consistency score
        const validResults = Object.values(validationResults).filter(r => r.isValid);
        const overallConsistency = validResults.length / Object.keys(validationResults).length;
        
        // Generate recommendations
        Object.entries(validationResults).forEach(([metric, result]) => {
            if (!result.isValid) {
                recommendations.push(`${metric}: ${result.issues.join(', ')}`);
            }
            if (result.warnings.length > 0) {
                recommendations.push(`${metric} warnings: ${result.warnings.join(', ')}`);
            }
        });
        
        return {
            overallConsistency,
            validationResults,
            recommendations
        };
    }
    
    /**
     * Validate skill assessment for heuristic compliance
     */
    public validateSkillAssessment(assessment: SkillAssessment): ValidationResult {
        const issues: string[] = [];
        const warnings: string[] = [];
        
        // Validate score ranges (should be 0-100)
        if (assessment.promptMaturity.score < 0 || assessment.promptMaturity.score > 100) {
            issues.push('Prompt maturity score out of valid range (0-100)');
        }
        
        if (assessment.debuggingSkill.score < 0 || assessment.debuggingSkill.score > 100) {
            issues.push('Debugging skill score out of valid range (0-100)');
        }
        
        if (assessment.aiCollaboration.score < 0 || assessment.aiCollaboration.score > 100) {
            issues.push('AI collaboration score out of valid range (0-100)');
        }
        
        if (assessment.aiCollaboration.refinementSkill < 0 || assessment.aiCollaboration.refinementSkill > 100) {
            issues.push('Refinement skill score out of valid range (0-100)');
        }
        
        // Validate trend values
        const validTrends = ['improving', 'stable', 'declining'];
        if (!validTrends.includes(assessment.promptMaturity.trend)) {
            issues.push('Invalid prompt maturity trend value');
        }
        
        if (!validTrends.includes(assessment.debuggingSkill.trend)) {
            issues.push('Invalid debugging skill trend value');
        }
        
        // Validate dependency levels
        const validDependencyLevels = ['low', 'medium', 'high'];
        if (!validDependencyLevels.includes(assessment.aiCollaboration.dependencyLevel)) {
            issues.push('Invalid AI collaboration dependency level');
        }
        
        // Validate debugging styles
        const validDebuggingStyles = ['hypothesis-driven', 'trial-and-error', 'mixed'];
        if (!validDebuggingStyles.includes(assessment.debuggingSkill.style)) {
            issues.push('Invalid debugging skill style');
        }
        
        // Check for explanation completeness
        if (!assessment.promptMaturity.explanation || assessment.promptMaturity.explanation.length < 20) {
            warnings.push('Prompt maturity explanation is too brief');
        }
        
        if (!assessment.debuggingSkill.explanation || assessment.debuggingSkill.explanation.length < 20) {
            warnings.push('Debugging skill explanation is too brief');
        }
        
        if (!assessment.aiCollaboration.explanation || assessment.aiCollaboration.explanation.length < 20) {
            warnings.push('AI collaboration explanation is too brief');
        }
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings
        };
    }
    
    /**
     * Normalize values to ensure approximate measurements
     */
    public normalizeToApproximateRange(value: number, type: 'score' | 'time' | 'dependency'): string {
        const ranges = this.APPROXIMATION_RANGES[type];
        
        for (const range of ranges) {
            if (value >= range.min && value < range.max) {
                return range.label;
            }
        }
        
        // Fallback for edge cases
        return ranges[ranges.length - 1].label;
    }
    
    /**
     * Validate measurement standardization across events
     */
    public validateEventMeasurements(events: DeveloperEvent[]): ValidationResult {
        const issues: string[] = [];
        const warnings: string[] = [];
        
        // Group events by type for consistency checking
        const eventsByType = events.reduce((acc, event) => {
            if (!acc[event.eventType]) {
                acc[event.eventType] = [];
            }
            acc[event.eventType].push(event);
            return acc;
        }, {} as Record<string, DeveloperEvent[]>);
        
        // Validate keystroke burst measurements
        const keystrokeEvents = eventsByType.keystroke_burst || [];
        if (keystrokeEvents.length > 0) {
            const durations = keystrokeEvents
                .map(e => e.metadata.burstDuration)
                .filter(d => d !== undefined) as number[];
            
            const charCounts = keystrokeEvents
                .map(e => e.metadata.characterCount)
                .filter(c => c !== undefined) as number[];
            
            if (durations.some(d => d < 0 || d > 300000)) { // 5 minutes max
                issues.push('Keystroke burst durations contain unrealistic values');
            }
            
            if (charCounts.some(c => c < 0 || c > 10000)) { // 10k chars max per burst
                issues.push('Character counts contain unrealistic values');
            }
        }
        
        // Validate paste event measurements
        const pasteEvents = eventsByType.paste || [];
        if (pasteEvents.length > 0) {
            const pasteLengths = pasteEvents
                .map(e => e.metadata.pasteLength)
                .filter(l => l !== undefined) as number[];
            
            const timeSinceAi = pasteEvents
                .map(e => e.metadata.timeSinceAiInvocation)
                .filter(t => t !== undefined) as number[];
            
            if (pasteLengths.some(l => l < 0 || l > 100000)) { // 100k chars max
                issues.push('Paste lengths contain unrealistic values');
            }
            
            if (timeSinceAi.some(t => t < 0 || t > 3600000)) { // 1 hour max
                warnings.push('Some AI invocation timings seem unusually long');
            }
        }
        
        // Validate error marker measurements
        const errorEvents = eventsByType.error_marker || [];
        if (errorEvents.length > 0) {
            const resolutionTimes = errorEvents
                .map(e => e.metadata.timeToResolve)
                .filter(t => t !== undefined) as number[];
            
            if (resolutionTimes.some(t => t < 0 || t > 7200000)) { // 2 hours max
                warnings.push('Some error resolution times seem unusually long');
            }
        }
        
        // Check for consistent timestamp formatting
        const timestamps = events.map(e => e.timestamp);
        if (timestamps.some(t => t < 1000000000000 || t > 9999999999999)) { // Valid Unix timestamp range
            issues.push('Event timestamps are not in valid Unix millisecond format');
        }
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings
        };
    }
    
    /**
     * Validate consistency of a specific metric across measurements
     */
    private validateMetricConsistency(
        values: number[],
        metricKey: keyof typeof this.CONSISTENCY_THRESHOLDS,
        metricName: string
    ): ValidationResult {
        const issues: string[] = [];
        const warnings: string[] = [];
        
        if (values.length === 0) {
            return {
                isValid: false,
                issues: [`No ${metricName} values to validate`],
                warnings: []
            };
        }
        
        const threshold = this.CONSISTENCY_THRESHOLDS[metricKey];
        
        // Check value ranges
        const outOfRange = values.filter(v => v < threshold.min || v > threshold.max);
        if (outOfRange.length > 0) {
            issues.push(`${outOfRange.length} ${metricName} values out of expected range (${threshold.min}-${threshold.max})`);
        }
        
        // Check variance for consistency
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const coefficientOfVariation = Math.sqrt(variance) / Math.max(mean, 0.01);
        
        if (coefficientOfVariation > threshold.variance) {
            warnings.push(`${metricName} shows high variance (${coefficientOfVariation.toFixed(2)} > ${threshold.variance})`);
        }
        
        // Check for suspicious patterns (all identical values)
        const uniqueValues = new Set(values);
        if (uniqueValues.size === 1 && values.length > 5) {
            warnings.push(`${metricName} has identical values across all measurements`);
        }
        
        // Normalize value for approximate measurement
        const normalizedValue = this.normalizeValue(mean, metricKey);
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            normalizedValue
        };
    }
    
    /**
     * Validate cross-metric relationships for logical consistency
     */
    private validateCrossMetricConsistency(metrics: DailyMetrics[]): ValidationResult {
        const issues: string[] = [];
        const warnings: string[] = [];
        
        for (const metric of metrics) {
            // AI dependency should correlate with assistance level
            const dependencyLevel = metric.aiDependencyRatio;
            const assistanceLevel = metric.aiAssistanceLevel;
            
            if (dependencyLevel > 0.7 && assistanceLevel === 'low') {
                warnings.push(`High AI dependency (${dependencyLevel.toFixed(2)}) but low assistance level on ${metric.date}`);
            }
            
            if (dependencyLevel < 0.3 && assistanceLevel === 'high') {
                warnings.push(`Low AI dependency (${dependencyLevel.toFixed(2)}) but high assistance level on ${metric.date}`);
            }
            
            // Human refinement should be reasonable relative to AI usage
            if (metric.humanRefinementRatio > 0.9 && dependencyLevel > 0.8) {
                warnings.push(`Very high refinement ratio with high AI dependency on ${metric.date}`);
            }
            
            // Session count and active time should be correlated
            const avgTimePerSession = metric.activeTime / Math.max(metric.sessionCount, 1);
            if (avgTimePerSession > 480) { // 8 hours per session
                warnings.push(`Unusually long average session time (${avgTimePerSession.toFixed(0)} min) on ${metric.date}`);
            }
            
            if (avgTimePerSession < 5 && metric.sessionCount > 10) {
                warnings.push(`Very short sessions with high session count on ${metric.date}`);
            }
            
            // Error resolution time should be reasonable
            if (metric.errorResolutionTime > 120 && metric.debuggingStyle === 'hypothesis-driven') {
                warnings.push(`Long error resolution time with systematic debugging style on ${metric.date}`);
            }
        }
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings
        };
    }
    
    /**
     * Normalize a value based on its metric type
     */
    private normalizeValue(value: number, metricKey: keyof typeof this.CONSISTENCY_THRESHOLDS): number {
        const threshold = this.CONSISTENCY_THRESHOLDS[metricKey];
        
        // Clamp to valid range
        const clampedValue = Math.max(threshold.min, Math.min(threshold.max, value));
        
        // Normalize to 0-1 range
        return (clampedValue - threshold.min) / (threshold.max - threshold.min);
    }
    
    /**
     * Generate standardized measurement report
     */
    public generateMeasurementStandardizationReport(
        metrics: DailyMetrics[],
        events: DeveloperEvent[]
    ): {
        metricsReport: ConsistencyReport;
        eventsReport: ValidationResult;
        overallCompliance: number;
        recommendations: string[];
    } {
        const metricsReport = this.validateDailyMetrics(metrics);
        const eventsReport = this.validateEventMeasurements(events);
        
        // Calculate overall compliance score
        const metricsCompliance = metricsReport.overallConsistency;
        const eventsCompliance = eventsReport.isValid ? 1 : 0.5; // Partial credit for warnings only
        const overallCompliance = (metricsCompliance + eventsCompliance) / 2;
        
        // Combine recommendations
        const recommendations = [
            ...metricsReport.recommendations,
            ...eventsReport.issues.map(issue => `Event validation: ${issue}`),
            ...eventsReport.warnings.map(warning => `Event warning: ${warning}`)
        ];
        
        // Add general recommendations based on compliance score
        if (overallCompliance < 0.7) {
            recommendations.push('Consider reviewing data collection processes for consistency');
        }
        
        if (overallCompliance < 0.5) {
            recommendations.push('Significant measurement inconsistencies detected - review heuristic algorithms');
        }
        
        return {
            metricsReport,
            eventsReport,
            overallCompliance,
            recommendations
        };
    }
}