import { DeveloperEvent, EventMetadata } from '../types/events';

// Import validation types for consistency checking
interface ValidationConstraints {
    minValue: number;
    maxValue: number;
    expectedVariance: number;
}

export interface AIAssistanceLevel {
    level: 'low' | 'medium' | 'high';
    confidence: number;
    reasoning: string;
}

export interface PromptEfficiencyScore {
    score: number; // 0-100
    factors: {
        retryCount: number;
        timeToAccept: number;
        editDistance: number;
    };
}

export interface DebuggingStyle {
    style: 'hypothesis-driven' | 'trial-and-error' | 'mixed';
    confidence: number;
    indicators: string[];
}

export class HeuristicAnalyzer {
    
    // Consistency constraints for heuristic measurements
    private readonly MEASUREMENT_CONSTRAINTS = {
        aiContributionRatio: { minValue: 0, maxValue: 1, expectedVariance: 0.3 },
        promptEfficiency: { minValue: 0, maxValue: 100, expectedVariance: 20 },
        timeToAccept: { minValue: 0, maxValue: 300, expectedVariance: 60 }, // seconds
        retryCount: { minValue: 0, maxValue: 10, expectedVariance: 3 },
        humanRefinement: { minValue: 0, maxValue: 1, expectedVariance: 0.4 },
        errorResolutionTime: { minValue: 0, maxValue: 300, expectedVariance: 120 } // minutes
    };
    
    public analyzeAIAssistanceLevel(events: DeveloperEvent[]): AIAssistanceLevel {
        const aiEvents = events.filter(e => e.eventType === 'ai_invocation');
        const pasteEvents = events.filter(e => e.eventType === 'paste');
        const keystrokeEvents = events.filter(e => e.eventType === 'keystroke_burst');

        if (aiEvents.length === 0) {
            return {
                level: 'low',
                confidence: 0.9,
                reasoning: 'No AI tool invocations detected'
            };
        }

        // Calculate AI contribution ratio with validation
        const totalPasteLength = pasteEvents.reduce((sum, e) => sum + (e.metadata.pasteLength || 0), 0);
        const totalKeystrokeChars = keystrokeEvents.reduce((sum, e) => sum + (e.metadata.characterCount || 0), 0);
        
        let aiContributionRatio = totalPasteLength / (totalPasteLength + totalKeystrokeChars);
        
        // Apply heuristic consistency validation
        aiContributionRatio = this.validateAndNormalizeMeasurement(
            aiContributionRatio, 
            'aiContributionRatio'
        );

        // Use approximate ranges for privacy-safe classification
        if (aiContributionRatio > 0.7) {
            return {
                level: 'high',
                confidence: 0.8,
                reasoning: `High AI contribution ratio: ${this.formatApproximatePercentage(aiContributionRatio)}`
            };
        } else if (aiContributionRatio > 0.3) {
            return {
                level: 'medium',
                confidence: 0.7,
                reasoning: `Moderate AI contribution ratio: ${this.formatApproximatePercentage(aiContributionRatio)}`
            };
        } else {
            return {
                level: 'low',
                confidence: 0.8,
                reasoning: `Low AI contribution ratio: ${this.formatApproximatePercentage(aiContributionRatio)}`
            };
        }
    }

    public calculatePromptEfficiency(events: DeveloperEvent[]): PromptEfficiencyScore {
        const aiEvents = events.filter(e => e.eventType === 'ai_invocation');
        const pasteEvents = events.filter(e => e.eventType === 'paste');

        if (aiEvents.length === 0) {
            return {
                score: 0,
                factors: {
                    retryCount: 0,
                    timeToAccept: 0,
                    editDistance: 0
                }
            };
        }

        // Calculate average time from AI invocation to paste acceptance
        let totalTimeToAccept = 0;
        let acceptedPastes = 0;
        let totalRetries = 0;

        for (const aiEvent of aiEvents) {
            const subsequentPastes = pasteEvents.filter(p => 
                p.timestamp > aiEvent.timestamp && 
                p.timestamp < aiEvent.timestamp + 30000 // Within 30 seconds
            );

            if (subsequentPastes.length > 0) {
                const firstPaste = subsequentPastes[0];
                totalTimeToAccept += firstPaste.timestamp - aiEvent.timestamp;
                acceptedPastes++;
                
                // Count retries (multiple AI invocations in short succession)
                const nearbyAiEvents = aiEvents.filter(e => 
                    e.timestamp > aiEvent.timestamp - 10000 && 
                    e.timestamp < aiEvent.timestamp + 10000
                );
                totalRetries += Math.max(0, nearbyAiEvents.length - 1);
            }
        }

        let avgTimeToAccept = acceptedPastes > 0 ? totalTimeToAccept / acceptedPastes : 0;
        let avgRetries = aiEvents.length > 0 ? totalRetries / aiEvents.length : 0;

        // Apply heuristic consistency validation
        avgTimeToAccept = this.validateAndNormalizeMeasurement(
            avgTimeToAccept / 1000, // Convert to seconds
            'timeToAccept'
        ) * 1000; // Convert back to milliseconds
        
        avgRetries = this.validateAndNormalizeMeasurement(avgRetries, 'retryCount');

        // Calculate efficiency score (lower time and retries = higher score)
        let score = 100;
        
        // Penalize long acceptance times (over 10 seconds)
        if (avgTimeToAccept > 10000) {
            score -= Math.min(40, (avgTimeToAccept - 10000) / 1000 * 2);
        }
        
        // Penalize high retry rates
        score -= Math.min(30, avgRetries * 15);

        // Validate final score
        score = this.validateAndNormalizeMeasurement(score, 'promptEfficiency');

        return {
            score: Math.max(0, Math.round(score)),
            factors: {
                retryCount: Math.round(avgRetries * 10) / 10,
                timeToAccept: Math.round(avgTimeToAccept / 100) / 10, // Convert to seconds with approximation
                editDistance: 0 // Will be calculated when we have edit distance data
            }
        };
    }

    public analyzeDebuggingStyle(events: DeveloperEvent[]): DebuggingStyle {
        const debugEvents = events.filter(e => e.eventType === 'debug_action');
        const errorEvents = events.filter(e => e.eventType === 'error_marker');
        const aiEvents = events.filter(e => e.eventType === 'ai_invocation' && 
            e.metadata.invocationContext === 'debugging');

        if (debugEvents.length === 0 && errorEvents.length === 0) {
            return {
                style: 'mixed',
                confidence: 0.1,
                indicators: ['Insufficient debugging activity to analyze']
            };
        }

        const indicators: string[] = [];
        let hypothesisDrivenScore = 0;
        let trialAndErrorScore = 0;

        // Analyze debug action patterns
        const runActions = debugEvents.filter(e => e.metadata.actionType === 'run').length;
        const debugActions = debugEvents.filter(e => e.metadata.actionType === 'debug').length;
        const testActions = debugEvents.filter(e => e.metadata.actionType === 'test').length;

        // Test-driven debugging indicates hypothesis-driven approach
        if (testActions > runActions) {
            hypothesisDrivenScore += 3;
            indicators.push('High test-to-run ratio suggests systematic approach');
        } else if (testActions > 0 && testActions / (runActions + debugActions + testActions) > 0.2) {
            hypothesisDrivenScore += 1;
            indicators.push('Regular testing indicates methodical debugging');
        }

        // Debugger usage patterns
        if (debugActions > runActions * 0.5) {
            hypothesisDrivenScore += 2;
            indicators.push('Frequent debugger usage indicates methodical debugging');
        } else if (runActions > debugActions * 4) {
            trialAndErrorScore += 3;
            indicators.push('High run-to-debug ratio suggests trial-and-error approach');
        }

        // Analyze AI usage patterns during debugging
        const aiToDebugRatio = aiEvents.length / Math.max(1, debugEvents.length);
        if (aiToDebugRatio > 0.5) {
            trialAndErrorScore += 2;
            indicators.push('Heavy AI reliance during debugging suggests less systematic approach');
        } else if (aiToDebugRatio > 0.2) {
            trialAndErrorScore += 1;
            indicators.push('Moderate AI usage during debugging');
        }

        // Analyze error resolution patterns and timing
        const errorResolutionTimes = errorEvents
            .filter(e => e.metadata.timeToResolve !== undefined)
            .map(e => e.metadata.timeToResolve!);

        if (errorResolutionTimes.length > 0) {
            const avgResolutionTime = errorResolutionTimes.reduce((a, b) => a + b, 0) / errorResolutionTimes.length;
            const resolutionVariance = this.calculateVariance(errorResolutionTimes);
            
            // Quick, consistent resolution suggests systematic approach
            if (avgResolutionTime < 300000 && resolutionVariance < 60000) { // Less than 5 minutes, low variance
                hypothesisDrivenScore += 2;
                indicators.push('Quick and consistent error resolution suggests good debugging skills');
            } else if (avgResolutionTime < 600000) { // Less than 10 minutes
                hypothesisDrivenScore += 1;
                indicators.push('Reasonable error resolution time');
            } else if (avgResolutionTime > 1800000) { // More than 30 minutes
                trialAndErrorScore += 2;
                indicators.push('Long error resolution times suggest less systematic approach');
            }

            // High variance in resolution times suggests inconsistent approach
            if (resolutionVariance > 300000) { // High variance (5+ minutes)
                trialAndErrorScore += 1;
                indicators.push('Inconsistent error resolution times suggest trial-and-error patterns');
            }
        }

        // Analyze error type diversity (more types might indicate systematic exploration)
        const errorTypeEvents = errorEvents.filter(e => e.metadata.errorTypeCount !== undefined);
        if (errorTypeEvents.length > 0) {
            const avgErrorTypes = errorTypeEvents.reduce((sum, e) => sum + (e.metadata.errorTypeCount || 0), 0) / errorTypeEvents.length;
            
            if (avgErrorTypes > 2) {
                hypothesisDrivenScore += 1;
                indicators.push('Handling diverse error types suggests systematic debugging');
            }
        }

        // Analyze debugging session patterns
        const debugSessionEvents = debugEvents.filter(e => e.metadata.debuggingAnalysis);
        if (debugSessionEvents.length > 0) {
            const avgEfficiency = debugSessionEvents.reduce((sum, e) => sum + (e.metadata.debuggingEfficiency || 0), 0) / debugSessionEvents.length;
            const avgAiDependency = debugSessionEvents.reduce((sum, e) => sum + (e.metadata.aiDependencyRatio || 0), 0) / debugSessionEvents.length;
            
            if (avgEfficiency > 0.7) {
                hypothesisDrivenScore += 2;
                indicators.push('High debugging efficiency indicates systematic approach');
            } else if (avgEfficiency < 0.3) {
                trialAndErrorScore += 1;
                indicators.push('Low debugging efficiency suggests room for improvement');
            }

            if (avgAiDependency > 0.6) {
                trialAndErrorScore += 2;
                indicators.push('High AI dependency during debugging');
            }
        }

        // Determine style and confidence
        const totalScore = hypothesisDrivenScore + trialAndErrorScore;
        const confidence = Math.min(0.9, Math.max(0.1, totalScore * 0.1));

        if (hypothesisDrivenScore > trialAndErrorScore * 1.3) {
            return {
                style: 'hypothesis-driven',
                confidence,
                indicators
            };
        } else if (trialAndErrorScore > hypothesisDrivenScore * 1.3) {
            return {
                style: 'trial-and-error',
                confidence,
                indicators
            };
        } else {
            return {
                style: 'mixed',
                confidence: confidence * 0.8,
                indicators: [...indicators, 'Mixed debugging patterns observed']
            };
        }
    }

    private calculateVariance(values: number[]): number {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    public calculateHumanRefinementRatio(events: DeveloperEvent[]): number {
        const pasteEvents = events.filter(e => e.eventType === 'paste');
        const keystrokeEvents = events.filter(e => e.eventType === 'keystroke_burst');

        if (pasteEvents.length === 0) {
            return 1.0; // All human if no AI pastes
        }

        // Look for keystroke bursts that occur shortly after paste events
        let refinementActivity = 0;
        let totalPastes = 0;

        for (const pasteEvent of pasteEvents) {
            const subsequentKeystrokes = keystrokeEvents.filter(k => 
                k.timestamp > pasteEvent.timestamp && 
                k.timestamp < pasteEvent.timestamp + 60000 // Within 1 minute
            );

            if (subsequentKeystrokes.length > 0) {
                const totalRefinementChars = subsequentKeystrokes.reduce(
                    (sum, k) => sum + (k.metadata.characterCount || 0), 0
                );
                refinementActivity += totalRefinementChars;
            }
            totalPastes++;
        }

        const totalPasteChars = pasteEvents.reduce((sum, p) => sum + (p.metadata.pasteLength || 0), 0);
        
        if (totalPasteChars === 0) {
            return 1.0;
        }

        let refinementRatio = Math.min(1.0, refinementActivity / totalPasteChars);
        
        // Apply heuristic consistency validation
        refinementRatio = this.validateAndNormalizeMeasurement(refinementRatio, 'humanRefinement');

        return refinementRatio;
    }
    
    /**
     * Validate and normalize measurements for consistency
     */
    private validateAndNormalizeMeasurement(
        value: number, 
        measurementType: keyof typeof this.MEASUREMENT_CONSTRAINTS
    ): number {
        const constraints = this.MEASUREMENT_CONSTRAINTS[measurementType];
        
        // Clamp to valid range
        let normalizedValue = Math.max(constraints.minValue, Math.min(constraints.maxValue, value));
        
        // Apply slight randomization to prevent exact measurements (privacy requirement)
        const jitterRange = constraints.expectedVariance * 0.05; // 5% of expected variance
        const jitter = (Math.random() - 0.5) * 2 * jitterRange;
        normalizedValue += jitter;
        
        // Ensure still within bounds after jitter
        normalizedValue = Math.max(constraints.minValue, Math.min(constraints.maxValue, normalizedValue));
        
        return normalizedValue;
    }
    
    /**
     * Format percentage as approximate range for privacy
     */
    private formatApproximatePercentage(ratio: number): string {
        const percentage = ratio * 100;
        
        if (percentage < 10) return 'Very Low (~5-10%)';
        if (percentage < 25) return 'Low (~10-25%)';
        if (percentage < 50) return 'Moderate (~25-50%)';
        if (percentage < 75) return 'High (~50-75%)';
        return 'Very High (~75%+)';
    }
    
    /**
     * Validate measurement consistency across multiple values
     */
    public validateMeasurementConsistency(
        values: number[], 
        measurementType: keyof typeof this.MEASUREMENT_CONSTRAINTS
    ): { isConsistent: boolean; issues: string[] } {
        const constraints = this.MEASUREMENT_CONSTRAINTS[measurementType];
        const issues: string[] = [];
        
        if (values.length === 0) {
            return { isConsistent: false, issues: ['No values to validate'] };
        }
        
        // Check for values outside expected range
        const outOfRange = values.filter(v => v < constraints.minValue || v > constraints.maxValue);
        if (outOfRange.length > 0) {
            issues.push(`${outOfRange.length} values outside expected range (${constraints.minValue}-${constraints.maxValue})`);
        }
        
        // Check variance
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);
        
        if (standardDeviation > constraints.expectedVariance) {
            issues.push(`High variance detected (σ=${standardDeviation.toFixed(2)} > ${constraints.expectedVariance})`);
        }
        
        // Check for suspicious patterns (all identical values)
        const uniqueValues = new Set(values);
        if (uniqueValues.size === 1 && values.length > 3) {
            issues.push('All values are identical - may indicate measurement error');
        }
        
        return {
            isConsistent: issues.length === 0,
            issues
        };
    }
}