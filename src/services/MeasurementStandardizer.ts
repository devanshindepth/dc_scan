import { DailyMetrics, DeveloperEvent, SkillAssessment } from '../types/events.js';
import { HeuristicValidator, ValidationResult, ConsistencyReport } from './HeuristicValidator.js';

export interface StandardizedMeasurement {
    originalValue: number;
    standardizedValue: number;
    approximateRange: string;
    confidenceLevel: 'high' | 'medium' | 'low';
}

export interface MeasurementReport {
    developerId: string;
    reportDate: string;
    consistencyScore: number;
    validationResults: Record<string, ValidationResult>;
    standardizedMetrics: Record<string, StandardizedMeasurement>;
    recommendations: string[];
    complianceStatus: 'compliant' | 'warning' | 'non-compliant';
}

/**
 * Standardizes measurements across all tracking scenarios to ensure consistency
 * Implements Requirements 3.4, 6.1 - approximate and heuristic measurements
 */
export class MeasurementStandardizer {
    
    private validator: HeuristicValidator;
    
    // Standardization parameters for different measurement types
    private readonly STANDARDIZATION_PARAMS = {
        promptEfficiency: {
            buckets: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
            labels: ['Needs Work', 'Developing', 'Moderate', 'Good', 'Excellent']
        },
        errorResolution: {
            buckets: [0, 5, 15, 30, 60, Infinity],
            labels: ['Very Quick', 'Quick', 'Moderate', 'Slow', 'Very Slow']
        },
        aiDependency: {
            buckets: [0, 0.3, 0.7, 1.0],
            labels: ['Low', 'Balanced', 'High']
        },
        refinementRatio: {
            buckets: [0, 0.2, 0.5, 0.8, 1.0],
            labels: ['Minimal', 'Light', 'Moderate', 'Heavy']
        },
        sessionActivity: {
            buckets: [0, 2, 5, 10, 20, Infinity],
            labels: ['Very Low', 'Low', 'Moderate', 'High', 'Very High']
        }
    };
    
    constructor() {
        this.validator = new HeuristicValidator();
    }
    
    /**
     * Standardize daily metrics to ensure consistency across all measurements
     */
    public standardizeDailyMetrics(metrics: DailyMetrics[]): DailyMetrics[] {
        if (metrics.length === 0) {
            return metrics;
        }
        
        // Validate consistency first
        const consistencyReport = this.validator.validateDailyMetrics(metrics);
        
        return metrics.map(metric => ({
            ...metric,
            promptEfficiencyScore: this.standardizeValue(
                metric.promptEfficiencyScore,
                'promptEfficiency'
            ),
            humanRefinementRatio: this.standardizeValue(
                metric.humanRefinementRatio,
                'refinementRatio'
            ),
            errorResolutionTime: this.standardizeValue(
                metric.errorResolutionTime,
                'errorResolution'
            ),
            aiDependencyRatio: this.standardizeValue(
                metric.aiDependencyRatio,
                'aiDependency'
            ),
            sessionCount: Math.round(this.standardizeValue(
                metric.sessionCount,
                'sessionActivity'
            )),
            activeTime: Math.round(this.standardizeValue(
                metric.activeTime,
                'sessionActivity'
            ))
        }));
    }
    
    /**
     * Standardize skill assessment scores for consistency
     */
    public standardizeSkillAssessment(assessment: SkillAssessment): SkillAssessment {
        // Validate the assessment first
        const validationResult = this.validator.validateSkillAssessment(assessment);
        
        return {
            ...assessment,
            promptMaturity: {
                ...assessment.promptMaturity,
                score: Math.round(this.standardizeScore(assessment.promptMaturity.score))
            },
            debuggingSkill: {
                ...assessment.debuggingSkill,
                score: Math.round(this.standardizeScore(assessment.debuggingSkill.score))
            },
            aiCollaboration: {
                ...assessment.aiCollaboration,
                score: Math.round(this.standardizeScore(assessment.aiCollaboration.score)),
                refinementSkill: Math.round(this.standardizeScore(assessment.aiCollaboration.refinementSkill))
            }
        };
    }
    
    /**
     * Generate comprehensive measurement report for a developer
     */
    public generateMeasurementReport(
        developerId: string,
        metrics: DailyMetrics[],
        events: DeveloperEvent[]
    ): MeasurementReport {
        
        // Generate standardization report
        const standardizationReport = this.validator.generateMeasurementStandardizationReport(
            metrics,
            events
        );
        
        // Create standardized measurements
        const standardizedMetrics: Record<string, StandardizedMeasurement> = {};
        
        if (metrics.length > 0) {
            // Calculate averages for standardization
            const avgPromptEfficiency = metrics.reduce((sum, m) => sum + m.promptEfficiencyScore, 0) / metrics.length;
            const avgErrorResolution = metrics.reduce((sum, m) => sum + m.errorResolutionTime, 0) / metrics.length;
            const avgAiDependency = metrics.reduce((sum, m) => sum + m.aiDependencyRatio, 0) / metrics.length;
            const avgRefinement = metrics.reduce((sum, m) => sum + m.humanRefinementRatio, 0) / metrics.length;
            const avgSessions = metrics.reduce((sum, m) => sum + m.sessionCount, 0) / metrics.length;
            
            standardizedMetrics.promptEfficiency = this.createStandardizedMeasurement(
                avgPromptEfficiency,
                'promptEfficiency'
            );
            
            standardizedMetrics.errorResolution = this.createStandardizedMeasurement(
                avgErrorResolution,
                'errorResolution'
            );
            
            standardizedMetrics.aiDependency = this.createStandardizedMeasurement(
                avgAiDependency,
                'aiDependency'
            );
            
            standardizedMetrics.refinementRatio = this.createStandardizedMeasurement(
                avgRefinement,
                'refinementRatio'
            );
            
            standardizedMetrics.sessionActivity = this.createStandardizedMeasurement(
                avgSessions,
                'sessionActivity'
            );
        }
        
        // Determine compliance status
        const complianceStatus = this.determineComplianceStatus(
            standardizationReport.overallCompliance
        );
        
        return {
            developerId,
            reportDate: new Date().toISOString(),
            consistencyScore: standardizationReport.overallCompliance,
            validationResults: standardizationReport.metricsReport.validationResults,
            standardizedMetrics,
            recommendations: standardizationReport.recommendations,
            complianceStatus
        };
    }
    
    /**
     * Standardize a value according to its measurement type
     */
    private standardizeValue(
        value: number,
        measurementType: keyof typeof this.STANDARDIZATION_PARAMS
    ): number {
        const params = this.STANDARDIZATION_PARAMS[measurementType];
        
        // Apply slight randomization for privacy (heuristic requirement)
        const jitterRange = 0.02; // 2% jitter
        const jitter = (Math.random() - 0.5) * 2 * jitterRange * value;
        let standardizedValue = value + jitter;
        
        // Ensure value stays within reasonable bounds
        if (measurementType === 'promptEfficiency' || measurementType === 'aiDependency' || measurementType === 'refinementRatio') {
            standardizedValue = Math.max(0, Math.min(1, standardizedValue));
        } else if (measurementType === 'errorResolution') {
            standardizedValue = Math.max(0, Math.min(300, standardizedValue)); // Max 5 hours
        } else if (measurementType === 'sessionActivity') {
            standardizedValue = Math.max(0, standardizedValue);
        }
        
        return standardizedValue;
    }
    
    /**
     * Standardize skill assessment scores (0-100 range)
     */
    private standardizeScore(score: number): number {
        // Apply slight randomization for privacy
        const jitterRange = 2; // ±2 points
        const jitter = (Math.random() - 0.5) * 2 * jitterRange;
        let standardizedScore = score + jitter;
        
        // Ensure score stays within 0-100 range
        standardizedScore = Math.max(0, Math.min(100, standardizedScore));
        
        return standardizedScore;
    }
    
    /**
     * Create a standardized measurement with approximate range
     */
    private createStandardizedMeasurement(
        originalValue: number,
        measurementType: keyof typeof this.STANDARDIZATION_PARAMS
    ): StandardizedMeasurement {
        
        const standardizedValue = this.standardizeValue(originalValue, measurementType);
        const approximateRange = this.getApproximateRange(standardizedValue, measurementType);
        const confidenceLevel = this.calculateConfidenceLevel(originalValue, standardizedValue);
        
        return {
            originalValue,
            standardizedValue,
            approximateRange,
            confidenceLevel
        };
    }
    
    /**
     * Get approximate range label for a standardized value
     */
    private getApproximateRange(
        value: number,
        measurementType: keyof typeof this.STANDARDIZATION_PARAMS
    ): string {
        
        const params = this.STANDARDIZATION_PARAMS[measurementType];
        
        for (let i = 0; i < params.buckets.length - 1; i++) {
            if (value >= params.buckets[i] && value < params.buckets[i + 1]) {
                return params.labels[i];
            }
        }
        
        // Return last label if value is at or above the last bucket
        return params.labels[params.labels.length - 1];
    }
    
    /**
     * Calculate confidence level based on standardization impact
     */
    private calculateConfidenceLevel(
        originalValue: number,
        standardizedValue: number
    ): 'high' | 'medium' | 'low' {
        
        const changePercent = Math.abs(standardizedValue - originalValue) / Math.max(originalValue, 0.01);
        
        if (changePercent < 0.05) return 'high';    // Less than 5% change
        if (changePercent < 0.15) return 'medium';  // Less than 15% change
        return 'low';                               // More than 15% change
    }
    
    /**
     * Determine compliance status based on overall compliance score
     */
    private determineComplianceStatus(
        complianceScore: number
    ): 'compliant' | 'warning' | 'non-compliant' {
        
        if (complianceScore >= 0.8) return 'compliant';
        if (complianceScore >= 0.6) return 'warning';
        return 'non-compliant';
    }
    
    /**
     * Validate measurement consistency across tracking scenarios
     */
    public validateTrackingConsistency(
        extensionEvents: DeveloperEvent[],
        backendMetrics: DailyMetrics[]
    ): {
        isConsistent: boolean;
        issues: string[];
        recommendations: string[];
    } {
        
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        // Validate event measurement consistency
        const eventValidation = this.validator.validateEventMeasurements(extensionEvents);
        if (!eventValidation.isValid) {
            issues.push(...eventValidation.issues);
        }
        
        // Validate metrics consistency
        const metricsValidation = this.validator.validateDailyMetrics(backendMetrics);
        if (metricsValidation.overallConsistency < 0.7) {
            issues.push('Backend metrics show consistency issues');
        }
        
        // Cross-validate extension events with backend metrics
        if (extensionEvents.length > 0 && backendMetrics.length > 0) {
            const eventDates = new Set(
                extensionEvents.map(e => new Date(e.timestamp).toISOString().split('T')[0])
            );
            const metricDates = new Set(backendMetrics.map(m => m.date));
            
            const missingDates = [...eventDates].filter(date => !metricDates.has(date));
            if (missingDates.length > 0) {
                issues.push(`Missing backend metrics for ${missingDates.length} days with extension events`);
            }
        }
        
        // Generate recommendations
        if (issues.length > 0) {
            recommendations.push('Review data collection and processing pipelines for consistency');
        }
        
        if (eventValidation.warnings.length > 0) {
            recommendations.push('Monitor extension event collection for potential issues');
        }
        
        if (metricsValidation.overallConsistency < 0.8) {
            recommendations.push('Implement additional validation in backend metric calculation');
        }
        
        return {
            isConsistent: issues.length === 0,
            issues,
            recommendations
        };
    }
    
    /**
     * Apply measurement standardization to ensure approximate values
     */
    public applyApproximationStandards<T extends Record<string, any>>(
        data: T,
        approximationRules: Record<keyof T, 'round' | 'range' | 'category'>
    ): T {
        
        const approximatedData = { ...data } as any;
        
        Object.entries(approximationRules).forEach(([key, rule]) => {
            const value = data[key];
            
            if (typeof value === 'number') {
                switch (rule) {
                    case 'round':
                        // Round to nearest 5 for privacy
                        approximatedData[key] = Math.round(value / 5) * 5;
                        break;
                    case 'range':
                        // Convert to range string
                        approximatedData[key] = this.convertToRange(value);
                        break;
                    case 'category':
                        // Convert to categorical value
                        approximatedData[key] = this.convertToCategory(value);
                        break;
                }
            }
        });
        
        return approximatedData;
    }
    
    /**
     * Convert numeric value to range string
     */
    private convertToRange(value: number): string {
        if (value < 10) return '0-10';
        if (value < 25) return '10-25';
        if (value < 50) return '25-50';
        if (value < 75) return '50-75';
        return '75+';
    }
    
    /**
     * Convert numeric value to categorical description
     */
    private convertToCategory(value: number): string {
        if (value < 0.2) return 'Very Low';
        if (value < 0.4) return 'Low';
        if (value < 0.6) return 'Moderate';
        if (value < 0.8) return 'High';
        return 'Very High';
    }
}