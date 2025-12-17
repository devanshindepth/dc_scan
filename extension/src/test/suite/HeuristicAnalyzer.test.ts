import * as assert from 'assert';
import * as fc from 'fast-check';
import { HeuristicAnalyzer } from '../../services/HeuristicAnalyzer';
import { DeveloperEvent, EventMetadata } from '../../types/events';

/**
 * **Feature: ai-dev-insights, Property 4: Skill Inference Consistency**
 * For any set of interaction patterns, the skill inference algorithms should consistently 
 * classify AI assistance levels, calculate prompt efficiency scores, and generate human 
 * refinement ratios based solely on behavioral metadata
 * **Validates: Requirements 1.4, 1.5, 8.1, 8.2**
 */

suite('HeuristicAnalyzer Property Tests', () => {
    let analyzer: HeuristicAnalyzer;

    setup(() => {
        analyzer = new HeuristicAnalyzer();
    });

    test('Property 4: Skill Inference Consistency - AI Assistance Level Classification', () => {
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 50 }),
            (events) => {
                // Test that AI assistance level classification is consistent
                const result1 = analyzer.analyzeAIAssistanceLevel(events);
                const result2 = analyzer.analyzeAIAssistanceLevel(events);
                
                // Same input should produce same output
                assert.strictEqual(result1.level, result2.level);
                assert.strictEqual(result1.confidence, result2.confidence);
                assert.strictEqual(result1.reasoning, result2.reasoning);
                
                // Level should be one of the valid values
                assert.ok(['low', 'medium', 'high'].includes(result1.level));
                
                // Confidence should be between 0 and 1
                assert.ok(result1.confidence >= 0 && result1.confidence <= 1);
                
                // Reasoning should be a non-empty string
                assert.ok(typeof result1.reasoning === 'string' && result1.reasoning.length > 0);
            }
        ), { numRuns: 100 });
    });

    test('Property 4: Skill Inference Consistency - Prompt Efficiency Scoring', () => {
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 50 }),
            (events) => {
                // Test that prompt efficiency scoring is consistent
                const result1 = analyzer.calculatePromptEfficiency(events);
                const result2 = analyzer.calculatePromptEfficiency(events);
                
                // Same input should produce same output
                assert.strictEqual(result1.score, result2.score);
                assert.deepStrictEqual(result1.factors, result2.factors);
                
                // Score should be between 0 and 100
                assert.ok(result1.score >= 0 && result1.score <= 100);
                
                // Factors should be non-negative numbers
                assert.ok(result1.factors.retryCount >= 0);
                assert.ok(result1.factors.timeToAccept >= 0);
                assert.ok(result1.factors.editDistance >= 0);
            }
        ), { numRuns: 100 });
    });

    test('Property 4: Skill Inference Consistency - Human Refinement Ratio', () => {
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 50 }),
            (events) => {
                // Test that human refinement ratio calculation is consistent
                const result1 = analyzer.calculateHumanRefinementRatio(events);
                const result2 = analyzer.calculateHumanRefinementRatio(events);
                
                // Same input should produce same output
                assert.strictEqual(result1, result2);
                
                // Ratio should be between 0 and 1
                assert.ok(result1 >= 0 && result1 <= 1);
            }
        ), { numRuns: 100 });
    });

    test('Property 4: Skill Inference Consistency - Debugging Style Analysis', () => {
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 50 }),
            (events) => {
                // Test that debugging style analysis is consistent
                const result1 = analyzer.analyzeDebuggingStyle(events);
                const result2 = analyzer.analyzeDebuggingStyle(events);
                
                // Same input should produce same output
                assert.strictEqual(result1.style, result2.style);
                assert.strictEqual(result1.confidence, result2.confidence);
                assert.deepStrictEqual(result1.indicators, result2.indicators);
                
                // Style should be one of the valid values
                assert.ok(['hypothesis-driven', 'trial-and-error', 'mixed'].includes(result1.style));
                
                // Confidence should be between 0 and 1
                assert.ok(result1.confidence >= 0 && result1.confidence <= 1);
                
                // Indicators should be an array of strings
                assert.ok(Array.isArray(result1.indicators));
                result1.indicators.forEach(indicator => {
                    assert.ok(typeof indicator === 'string' && indicator.length > 0);
                });
            }
        ), { numRuns: 100 });
    });
});

// Generator for DeveloperEvent
function generateDeveloperEvent(): fc.Arbitrary<DeveloperEvent> {
    return fc.record({
        id: fc.uuid(),
        developerId: fc.uuid(),
        timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() }), // Last 24 hours
        eventType: fc.constantFrom('keystroke_burst', 'paste', 'ai_invocation', 'debug_action', 'file_switch', 'error_marker'),
        metadata: generateEventMetadata(),
        sessionId: fc.uuid()
    });
}

// Generator for EventMetadata
function generateEventMetadata(): fc.Arbitrary<EventMetadata> {
    return fc.record({
        // Keystroke burst metadata
        burstDuration: fc.option(fc.integer({ min: 100, max: 10000 })),
        characterCount: fc.option(fc.integer({ min: 1, max: 1000 })),
        
        // Paste event metadata
        pasteLength: fc.option(fc.integer({ min: 1, max: 5000 })),
        timeSinceAiInvocation: fc.option(fc.integer({ min: 0, max: 60000 })),
        aiContributionLevel: fc.option(fc.constantFrom('low', 'medium', 'high')),
        
        // AI invocation metadata
        toolType: fc.option(fc.constantFrom('copilot', 'chat', 'other')),
        invocationContext: fc.option(fc.constantFrom('coding', 'debugging', 'documentation')),
        
        // Debug action metadata
        actionType: fc.option(fc.constantFrom('run', 'debug', 'test')),
        errorCount: fc.option(fc.integer({ min: 0, max: 20 })),
        
        // File switch metadata
        fileExtension: fc.option(fc.constantFrom('.ts', '.js', '.py', '.java', '.cpp', '.html', '.css')),
        switchFrequency: fc.option(fc.integer({ min: 1, max: 100 })),
        
        // Error marker metadata
        errorAppeared: fc.option(fc.boolean()),
        errorResolved: fc.option(fc.boolean()),
        timeToResolve: fc.option(fc.integer({ min: 1000, max: 1800000 })) // 1 second to 30 minutes
    });
}