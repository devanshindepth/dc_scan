import { DailyMetrics, SkillAssessment } from '../types/events.js';

export interface TrendBasedInsight {
    metric: string;
    currentValue: string;
    trend: 'improving' | 'stable' | 'declining';
    trendDescription: string;
    explanation: string;
    confidenceLevel: 'high' | 'medium' | 'low';
}

export interface FormattedInsightResponse {
    developerId: string;
    generatedAt: string;
    insights: TrendBasedInsight[];
    summary: {
        overallTrend: 'improving' | 'stable' | 'declining';
        keyStrengths: string[];
        areasForImprovement: string[];
        trendExplanation: string;
    };
    privacyNote: string;
}

export class InsightFormatter {
    
    /**
     * Format skill assessment into trend-based insights
     */
    public formatSkillAssessment(
        assessment: SkillAssessment,
        historicalMetrics: DailyMetrics[]
    ): FormattedInsightResponse {
        
        const insights: TrendBasedInsight[] = [];
        
        // Format prompt maturity insight
        insights.push(this.formatPromptMaturityInsight(assessment, historicalMetrics));
        
        // Format debugging skill insight
        insights.push(this.formatDebuggingSkillInsight(assessment, historicalMetrics));
        
        // Format AI collaboration insight
        insights.push(this.formatAiCollaborationInsight(assessment, historicalMetrics));
        
        // Generate overall summary
        const summary = this.generateOverallSummary(assessment, insights);
        
        return {
            developerId: assessment.developerId,
            generatedAt: new Date().toISOString(),
            insights,
            summary,
            privacyNote: "These insights are based on heuristic analysis of interaction patterns. No source code, prompts, or responses are stored or analyzed."
        };
    }
    
    /**
     * Format daily metrics into trend-focused output
     */
    public formatDailyMetricsTrends(
        metrics: DailyMetrics[],
        developerId: string
    ): FormattedInsightResponse {
        
        if (metrics.length === 0) {
            return this.createEmptyResponse(developerId);
        }
        
        const insights: TrendBasedInsight[] = [];
        
        // Analyze prompt efficiency trends
        insights.push(this.formatPromptEfficiencyTrend(metrics));
        
        // Analyze debugging performance trends
        insights.push(this.formatDebuggingPerformanceTrend(metrics));
        
        // Analyze AI dependency trends
        insights.push(this.formatAiDependencyTrend(metrics));
        
        // Analyze activity patterns
        insights.push(this.formatActivityPatternTrend(metrics));
        
        // Generate summary from trends
        const summary = this.generateTrendSummary(insights, metrics);
        
        return {
            developerId,
            generatedAt: new Date().toISOString(),
            insights,
            summary,
            privacyNote: "These insights are based on heuristic analysis of interaction patterns. No source code, prompts, or responses are stored or analyzed."
        };
    }
    
    /**
     * Format prompt maturity insight with trend focus
     */
    private formatPromptMaturityInsight(
        assessment: SkillAssessment,
        historicalMetrics: DailyMetrics[]
    ): TrendBasedInsight {
        
        const { score, trend, explanation } = assessment.promptMaturity;
        
        // Calculate trend strength from historical data
        const efficiencyValues = historicalMetrics.map(m => m.promptEfficiencyScore);
        const trendStrength = this.calculateTrendStrength(efficiencyValues);
        
        return {
            metric: 'Prompt Maturity',
            currentValue: this.formatScoreRange(score),
            trend,
            trendDescription: this.formatTrendDescription(trend, trendStrength),
            explanation: this.enhanceExplanationWithTrendContext(explanation, trend, trendStrength),
            confidenceLevel: this.calculateConfidenceLevel(historicalMetrics.length, trendStrength)
        };
    }
    
    /**
     * Format debugging skill insight with trend focus
     */
    private formatDebuggingSkillInsight(
        assessment: SkillAssessment,
        historicalMetrics: DailyMetrics[]
    ): TrendBasedInsight {
        
        const { score, trend, explanation, style } = assessment.debuggingSkill;
        
        // Calculate trend strength from error resolution times
        const resolutionTimes = historicalMetrics.map(m => 1 / (m.errorResolutionTime + 1));
        const trendStrength = this.calculateTrendStrength(resolutionTimes);
        
        return {
            metric: 'Debugging Effectiveness',
            currentValue: `${this.formatScoreRange(score)} (${this.formatDebuggingStyle(style)})`,
            trend,
            trendDescription: this.formatTrendDescription(trend, trendStrength),
            explanation: this.enhanceExplanationWithTrendContext(explanation, trend, trendStrength),
            confidenceLevel: this.calculateConfidenceLevel(historicalMetrics.length, trendStrength)
        };
    }
    
    /**
     * Format AI collaboration insight with trend focus
     */
    private formatAiCollaborationInsight(
        assessment: SkillAssessment,
        historicalMetrics: DailyMetrics[]
    ): TrendBasedInsight {
        
        const { score, dependencyLevel, explanation } = assessment.aiCollaboration;
        
        // Calculate trend from refinement ratios
        const refinementValues = historicalMetrics.map(m => m.humanRefinementRatio);
        const trendStrength = this.calculateTrendStrength(refinementValues);
        const trend = this.determineTrendFromValues(refinementValues);
        
        return {
            metric: 'AI Collaboration',
            currentValue: `${this.formatScoreRange(score)} (${dependencyLevel} dependency)`,
            trend,
            trendDescription: this.formatTrendDescription(trend, trendStrength),
            explanation: this.enhanceExplanationWithTrendContext(explanation, trend, trendStrength),
            confidenceLevel: this.calculateConfidenceLevel(historicalMetrics.length, trendStrength)
        };
    }
    
    /**
     * Format prompt efficiency trend from daily metrics
     */
    private formatPromptEfficiencyTrend(metrics: DailyMetrics[]): TrendBasedInsight {
        const values = metrics.map(m => m.promptEfficiencyScore);
        const trend = this.determineTrendFromValues(values);
        const trendStrength = this.calculateTrendStrength(values);
        const currentValue = values.length > 0 ? values[values.length - 1] : 0;
        
        return {
            metric: 'Prompt Efficiency',
            currentValue: this.formatScoreRange(currentValue * 100),
            trend,
            trendDescription: this.formatTrendDescription(trend, trendStrength),
            explanation: this.generatePromptEfficiencyExplanation(values, trend),
            confidenceLevel: this.calculateConfidenceLevel(metrics.length, trendStrength)
        };
    }
    
    /**
     * Format debugging performance trend from daily metrics
     */
    private formatDebuggingPerformanceTrend(metrics: DailyMetrics[]): TrendBasedInsight {
        const resolutionTimes = metrics.map(m => m.errorResolutionTime);
        const invertedTimes = resolutionTimes.map(t => 1 / (t + 1)); // Invert for trend calculation
        const trend = this.determineTrendFromValues(invertedTimes);
        const trendStrength = this.calculateTrendStrength(invertedTimes);
        const currentTime = resolutionTimes.length > 0 ? resolutionTimes[resolutionTimes.length - 1] : 0;
        
        return {
            metric: 'Debugging Performance',
            currentValue: this.formatTimeRange(currentTime),
            trend,
            trendDescription: this.formatTrendDescription(trend, trendStrength),
            explanation: this.generateDebuggingPerformanceExplanation(resolutionTimes, trend),
            confidenceLevel: this.calculateConfidenceLevel(metrics.length, trendStrength)
        };
    }
    
    /**
     * Format AI dependency trend from daily metrics
     */
    private formatAiDependencyTrend(metrics: DailyMetrics[]): TrendBasedInsight {
        const dependencyValues = metrics.map(m => m.aiDependencyRatio);
        const trend = this.determineTrendFromValues(dependencyValues);
        const trendStrength = this.calculateTrendStrength(dependencyValues);
        const currentValue = dependencyValues.length > 0 ? dependencyValues[dependencyValues.length - 1] : 0;
        
        return {
            metric: 'AI Dependency',
            currentValue: this.formatDependencyLevel(currentValue),
            trend,
            trendDescription: this.formatTrendDescription(trend, trendStrength),
            explanation: this.generateAiDependencyExplanation(dependencyValues, trend),
            confidenceLevel: this.calculateConfidenceLevel(metrics.length, trendStrength)
        };
    }
    
    /**
     * Format activity pattern trend from daily metrics
     */
    private formatActivityPatternTrend(metrics: DailyMetrics[]): TrendBasedInsight {
        const sessionCounts = metrics.map(m => m.sessionCount);
        const activeTimes = metrics.map(m => m.activeTime);
        
        const sessionTrend = this.determineTrendFromValues(sessionCounts);
        const timeTrend = this.determineTrendFromValues(activeTimes);
        
        // Combine trends for overall activity pattern
        const overallTrend = this.combineTrends(sessionTrend, timeTrend);
        const trendStrength = (this.calculateTrendStrength(sessionCounts) + this.calculateTrendStrength(activeTimes)) / 2;
        
        const avgSessions = sessionCounts.length > 0 ? sessionCounts.reduce((a, b) => a + b, 0) / sessionCounts.length : 0;
        const avgTime = activeTimes.length > 0 ? activeTimes.reduce((a, b) => a + b, 0) / activeTimes.length : 0;
        
        return {
            metric: 'Activity Patterns',
            currentValue: `${Math.round(avgSessions)} sessions/day, ${Math.round(avgTime)}min active`,
            trend: overallTrend,
            trendDescription: this.formatTrendDescription(overallTrend, trendStrength),
            explanation: this.generateActivityPatternExplanation(sessionCounts, activeTimes, overallTrend),
            confidenceLevel: this.calculateConfidenceLevel(metrics.length, trendStrength)
        };
    }
    
    /**
     * Generate overall summary from skill assessment
     */
    private generateOverallSummary(
        assessment: SkillAssessment,
        insights: TrendBasedInsight[]
    ): FormattedInsightResponse['summary'] {
        
        const trends = insights.map(i => i.trend);
        const improvingCount = trends.filter(t => t === 'improving').length;
        const decliningCount = trends.filter(t => t === 'declining').length;
        
        const overallTrend: 'improving' | 'stable' | 'declining' = 
            improvingCount > decliningCount ? 'improving' :
            decliningCount > improvingCount ? 'declining' : 'stable';
        
        const keyStrengths: string[] = [];
        const areasForImprovement: string[] = [];
        
        // Identify strengths and areas for improvement
        if (assessment.promptMaturity.score >= 70) {
            keyStrengths.push('Strong prompt crafting skills');
        } else if (assessment.promptMaturity.score < 50) {
            areasForImprovement.push('Prompt effectiveness could be improved');
        }
        
        if (assessment.debuggingSkill.score >= 70) {
            keyStrengths.push('Effective debugging approach');
        } else if (assessment.debuggingSkill.score < 50) {
            areasForImprovement.push('Debugging efficiency needs attention');
        }
        
        if (assessment.aiCollaboration.score >= 70) {
            keyStrengths.push('Balanced AI collaboration');
        } else if (assessment.aiCollaboration.score < 50) {
            areasForImprovement.push('AI collaboration skills could be enhanced');
        }
        
        // Add trend-based strengths
        insights.forEach(insight => {
            if (insight.trend === 'improving' && insight.confidenceLevel === 'high') {
                keyStrengths.push(`${insight.metric} is showing consistent improvement`);
            }
        });
        
        const trendExplanation = this.generateTrendExplanation(overallTrend, insights);
        
        return {
            overallTrend,
            keyStrengths,
            areasForImprovement,
            trendExplanation
        };
    }
    
    /**
     * Generate summary from trend analysis
     */
    private generateTrendSummary(
        insights: TrendBasedInsight[],
        metrics: DailyMetrics[]
    ): FormattedInsightResponse['summary'] {
        
        const trends = insights.map(i => i.trend);
        const improvingCount = trends.filter(t => t === 'improving').length;
        const decliningCount = trends.filter(t => t === 'declining').length;
        
        const overallTrend: 'improving' | 'stable' | 'declining' = 
            improvingCount > decliningCount ? 'improving' :
            decliningCount > improvingCount ? 'declining' : 'stable';
        
        const keyStrengths: string[] = [];
        const areasForImprovement: string[] = [];
        
        // Analyze recent performance
        if (metrics.length > 0) {
            const recentMetrics = metrics.slice(-7); // Last 7 days
            const avgEfficiency = recentMetrics.reduce((sum, m) => sum + m.promptEfficiencyScore, 0) / recentMetrics.length;
            const avgResolutionTime = recentMetrics.reduce((sum, m) => sum + m.errorResolutionTime, 0) / recentMetrics.length;
            const avgDependency = recentMetrics.reduce((sum, m) => sum + m.aiDependencyRatio, 0) / recentMetrics.length;
            
            if (avgEfficiency > 0.7) {
                keyStrengths.push('High prompt efficiency in recent sessions');
            } else if (avgEfficiency < 0.4) {
                areasForImprovement.push('Prompt efficiency could be improved');
            }
            
            if (avgResolutionTime < 15) {
                keyStrengths.push('Quick error resolution');
            } else if (avgResolutionTime > 45) {
                areasForImprovement.push('Error resolution time could be reduced');
            }
            
            if (avgDependency > 0.3 && avgDependency < 0.7) {
                keyStrengths.push('Balanced AI usage');
            } else if (avgDependency > 0.8) {
                areasForImprovement.push('Consider developing more independent coding skills');
            }
        }
        
        // Add trend-based insights
        insights.forEach(insight => {
            if (insight.trend === 'improving' && insight.confidenceLevel !== 'low') {
                keyStrengths.push(`${insight.metric} trend is positive`);
            } else if (insight.trend === 'declining' && insight.confidenceLevel !== 'low') {
                areasForImprovement.push(`${insight.metric} trend needs attention`);
            }
        });
        
        const trendExplanation = this.generateTrendExplanation(overallTrend, insights);
        
        return {
            overallTrend,
            keyStrengths,
            areasForImprovement,
            trendExplanation
        };
    }
    
    /**
     * Calculate trend strength from historical values
     */
    private calculateTrendStrength(values: number[]): number {
        if (values.length < 3) return 0;
        
        // Calculate linear regression slope
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = values;
        
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const avgY = sumY / n;
        
        // Normalize slope by average value
        return Math.abs(slope / Math.max(avgY, 0.01));
    }
    
    /**
     * Determine trend direction from values
     */
    private determineTrendFromValues(values: number[]): 'improving' | 'stable' | 'declining' {
        if (values.length < 2) return 'stable';
        
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        
        const changePercent = ((secondAvg - firstAvg) / Math.max(firstAvg, 0.01)) * 100;
        
        if (changePercent > 5) return 'improving';
        if (changePercent < -5) return 'declining';
        return 'stable';
    }
    
    /**
     * Format score as a range to maintain privacy
     */
    private formatScoreRange(score: number): string {
        if (score >= 80) return 'High (80-100)';
        if (score >= 60) return 'Good (60-79)';
        if (score >= 40) return 'Moderate (40-59)';
        if (score >= 20) return 'Developing (20-39)';
        return 'Needs Attention (0-19)';
    }
    
    /**
     * Format time as a range to maintain privacy
     */
    private formatTimeRange(minutes: number): string {
        if (minutes < 5) return 'Very Quick (< 5 min)';
        if (minutes < 15) return 'Quick (5-15 min)';
        if (minutes < 30) return 'Moderate (15-30 min)';
        if (minutes < 60) return 'Slow (30-60 min)';
        return 'Very Slow (> 60 min)';
    }
    
    /**
     * Format dependency level as descriptive text
     */
    private formatDependencyLevel(ratio: number): string {
        if (ratio < 0.3) return 'Low dependency';
        if (ratio < 0.7) return 'Balanced usage';
        return 'High dependency';
    }
    
    /**
     * Format debugging style for display
     */
    private formatDebuggingStyle(style: string): string {
        switch (style) {
            case 'hypothesis-driven': return 'Systematic';
            case 'trial-and-error': return 'Exploratory';
            case 'mixed': return 'Adaptive';
            default: return 'Unknown';
        }
    }
    
    /**
     * Format trend description with strength indication
     */
    private formatTrendDescription(trend: 'improving' | 'stable' | 'declining', strength: number): string {
        const strengthDesc = strength > 0.1 ? 'strong' : strength > 0.05 ? 'moderate' : 'slight';
        
        switch (trend) {
            case 'improving': return `Showing ${strengthDesc} improvement`;
            case 'declining': return `Showing ${strengthDesc} decline`;
            case 'stable': return 'Remaining stable';
        }
    }
    
    /**
     * Calculate confidence level based on data availability and trend strength
     */
    private calculateConfidenceLevel(dataPoints: number, trendStrength: number): 'high' | 'medium' | 'low' {
        if (dataPoints >= 14 && trendStrength > 0.1) return 'high';
        if (dataPoints >= 7 && trendStrength > 0.05) return 'medium';
        return 'low';
    }
    
    /**
     * Enhance explanation with trend context
     */
    private enhanceExplanationWithTrendContext(
        baseExplanation: string,
        trend: 'improving' | 'stable' | 'declining',
        strength: number
    ): string {
        let enhancement = '';
        
        if (trend === 'improving' && strength > 0.1) {
            enhancement = ' This positive trend suggests your skills are developing well.';
        } else if (trend === 'declining' && strength > 0.1) {
            enhancement = ' This declining trend suggests focusing on this area could be beneficial.';
        } else if (trend === 'stable') {
            enhancement = ' This stable pattern indicates consistent performance.';
        }
        
        return baseExplanation + enhancement;
    }
    
    /**
     * Combine two trends into an overall trend
     */
    private combineTrends(
        trend1: 'improving' | 'stable' | 'declining',
        trend2: 'improving' | 'stable' | 'declining'
    ): 'improving' | 'stable' | 'declining' {
        if (trend1 === trend2) return trend1;
        if (trend1 === 'stable') return trend2;
        if (trend2 === 'stable') return trend1;
        return 'stable'; // If one improving and one declining
    }
    
    /**
     * Generate explanations for specific metrics
     */
    private generatePromptEfficiencyExplanation(values: number[], trend: 'improving' | 'stable' | 'declining'): string {
        const avgEfficiency = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        let explanation = `Your prompt efficiency averages ${(avgEfficiency * 100).toFixed(0)}%. `;
        
        if (trend === 'improving') {
            explanation += 'Your prompting skills are getting better over time, with more effective AI interactions.';
        } else if (trend === 'declining') {
            explanation += 'Consider reviewing your prompting approach - more specific and contextual prompts often yield better results.';
        } else {
            explanation += 'Your prompting efficiency is consistent. Consider experimenting with different approaches to improve further.';
        }
        
        return explanation;
    }
    
    private generateDebuggingPerformanceExplanation(times: number[], trend: 'improving' | 'stable' | 'declining'): string {
        const avgTime = times.reduce((sum, val) => sum + val, 0) / times.length;
        
        let explanation = `Your average error resolution time is ${this.formatTimeRange(avgTime)}. `;
        
        if (trend === 'improving') {
            explanation += 'Your debugging efficiency is improving, suggesting better problem-solving skills.';
        } else if (trend === 'declining') {
            explanation += 'Consider adopting more systematic debugging approaches to improve resolution times.';
        } else {
            explanation += 'Your debugging performance is consistent. Focus on systematic approaches for further improvement.';
        }
        
        return explanation;
    }
    
    private generateAiDependencyExplanation(values: number[], trend: 'improving' | 'stable' | 'declining'): string {
        const avgDependency = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        let explanation = `Your AI dependency level is ${this.formatDependencyLevel(avgDependency)}. `;
        
        if (avgDependency < 0.3) {
            explanation += 'You maintain strong independent coding skills while using AI as a tool.';
        } else if (avgDependency > 0.7) {
            explanation += 'Consider balancing AI assistance with independent problem-solving to maintain coding skills.';
        } else {
            explanation += 'You have a healthy balance of AI assistance and independent coding.';
        }
        
        if (trend === 'improving') {
            explanation += ' Your AI collaboration is becoming more effective.';
        } else if (trend === 'declining') {
            explanation += ' Consider reviewing your AI collaboration approach.';
        }
        
        return explanation;
    }
    
    private generateActivityPatternExplanation(
        sessions: number[],
        times: number[],
        trend: 'improving' | 'stable' | 'declining'
    ): string {
        const avgSessions = sessions.reduce((sum, val) => sum + val, 0) / sessions.length;
        const avgTime = times.reduce((sum, val) => sum + val, 0) / times.length;
        
        let explanation = `You average ${avgSessions.toFixed(1)} coding sessions per day with ${avgTime.toFixed(0)} minutes of active time. `;
        
        if (trend === 'improving') {
            explanation += 'Your coding activity is increasing, showing good engagement.';
        } else if (trend === 'declining') {
            explanation += 'Your coding activity has decreased recently.';
        } else {
            explanation += 'Your coding activity patterns are consistent.';
        }
        
        return explanation;
    }
    
    /**
     * Generate overall trend explanation
     */
    private generateTrendExplanation(
        overallTrend: 'improving' | 'stable' | 'declining',
        insights: TrendBasedInsight[]
    ): string {
        const improvingInsights = insights.filter(i => i.trend === 'improving').length;
        const decliningInsights = insights.filter(i => i.trend === 'declining').length;
        
        switch (overallTrend) {
            case 'improving':
                return `Overall, your development skills are trending positively with ${improvingInsights} areas showing improvement. Keep up the good work!`;
            case 'declining':
                return `Some areas need attention with ${decliningInsights} metrics showing decline. Focus on the suggested improvements to get back on track.`;
            case 'stable':
                return `Your skills are stable with consistent performance. Consider challenging yourself with new approaches to continue growing.`;
        }
    }
    
    /**
     * Create empty response for cases with no data
     */
    private createEmptyResponse(developerId: string): FormattedInsightResponse {
        return {
            developerId,
            generatedAt: new Date().toISOString(),
            insights: [],
            summary: {
                overallTrend: 'stable',
                keyStrengths: [],
                areasForImprovement: ['Insufficient data for analysis'],
                trendExplanation: 'Not enough data available to generate meaningful trends. Continue using the system to build up your insight history.'
            },
            privacyNote: "These insights are based on heuristic analysis of interaction patterns. No source code, prompts, or responses are stored or analyzed."
        };
    }
}