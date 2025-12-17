import * as assert from 'assert';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { HeuristicAnalyzer } from '../services/HeuristicAnalyzer';
import { LocalStorageManager } from '../services/LocalStorageManager';
import { DeveloperEvent, EventMetadata } from '../types/events';

// Simple test runner for property-based tests
class TestRunner {
    private passed = 0;
    private failed = 0;

    async runTest(name: string, testFn: () => Promise<void> | void): Promise<void> {
        try {
            console.log(`Running: ${name}`);
            await testFn();
            this.passed++;
            console.log(`✓ ${name}`);
        } catch (error) {
            this.failed++;
            console.error(`✗ ${name}`);
            console.error(error);
        }
    }

    summary(): void {
        console.log(`\nTest Results: ${this.passed} passed, ${this.failed} failed`);
        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

// Generator functions
function generateDeveloperEvent(): fc.Arbitrary<DeveloperEvent> {
    return fc.record({
        id: fc.uuid(),
        developerId: fc.uuid(),
        timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
        eventType: fc.constantFrom('keystroke_burst', 'paste', 'ai_invocation', 'debug_action', 'file_switch', 'error_marker'),
        metadata: generateEventMetadata(),
        sessionId: fc.uuid()
    });
}

function generateEventMetadata(): fc.Arbitrary<EventMetadata> {
    return fc.record({
        burstDuration: fc.option(fc.integer({ min: 100, max: 10000 })),
        characterCount: fc.option(fc.integer({ min: 1, max: 1000 })),
        pasteLength: fc.option(fc.integer({ min: 1, max: 5000 })),
        timeSinceAiInvocation: fc.option(fc.integer({ min: 0, max: 60000 })),
        aiContributionLevel: fc.option(fc.constantFrom('low', 'medium', 'high')),
        toolType: fc.option(fc.constantFrom('copilot', 'chat', 'other')),
        invocationContext: fc.option(fc.constantFrom('coding', 'debugging', 'documentation')),
        actionType: fc.option(fc.constantFrom('run', 'debug', 'test')),
        errorCount: fc.option(fc.integer({ min: 0, max: 20 })),
        fileExtension: fc.option(fc.constantFrom('.ts', '.js', '.py', '.java', '.cpp', '.html', '.css')),
        switchFrequency: fc.option(fc.integer({ min: 1, max: 100 })),
        errorAppeared: fc.option(fc.boolean()),
        errorResolved: fc.option(fc.boolean()),
        timeToResolve: fc.option(fc.integer({ min: 1000, max: 1800000 }))
    });
}

async function main() {
    const runner = new TestRunner();

    // Property 4: Skill Inference Consistency Tests
    await runner.runTest('Property 4: AI Assistance Level Classification', () => {
        const analyzer = new HeuristicAnalyzer();
        
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 20 }),
            (events) => {
                const result1 = analyzer.analyzeAIAssistanceLevel(events);
                const result2 = analyzer.analyzeAIAssistanceLevel(events);
                
                assert.strictEqual(result1.level, result2.level);
                assert.strictEqual(result1.confidence, result2.confidence);
                assert.ok(['low', 'medium', 'high'].includes(result1.level));
                assert.ok(result1.confidence >= 0 && result1.confidence <= 1);
                assert.ok(typeof result1.reasoning === 'string' && result1.reasoning.length > 0);
            }
        ), { numRuns: 50 });
    });

    await runner.runTest('Property 4: Prompt Efficiency Scoring', () => {
        const analyzer = new HeuristicAnalyzer();
        
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 20 }),
            (events) => {
                const result1 = analyzer.calculatePromptEfficiency(events);
                const result2 = analyzer.calculatePromptEfficiency(events);
                
                assert.strictEqual(result1.score, result2.score);
                assert.deepStrictEqual(result1.factors, result2.factors);
                assert.ok(result1.score >= 0 && result1.score <= 100);
                assert.ok(result1.factors.retryCount >= 0);
                assert.ok(result1.factors.timeToAccept >= 0);
                assert.ok(result1.factors.editDistance >= 0);
            }
        ), { numRuns: 50 });
    });

    await runner.runTest('Property 4: Human Refinement Ratio', () => {
        const analyzer = new HeuristicAnalyzer();
        
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 20 }),
            (events) => {
                const result1 = analyzer.calculateHumanRefinementRatio(events);
                const result2 = analyzer.calculateHumanRefinementRatio(events);
                
                assert.strictEqual(result1, result2);
                assert.ok(result1 >= 0 && result1 <= 1);
            }
        ), { numRuns: 50 });
    });

    await runner.runTest('Property 4: Debugging Style Analysis', () => {
        const analyzer = new HeuristicAnalyzer();
        
        fc.assert(fc.property(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 20 }),
            (events) => {
                const result1 = analyzer.analyzeDebuggingStyle(events);
                const result2 = analyzer.analyzeDebuggingStyle(events);
                
                assert.strictEqual(result1.style, result2.style);
                assert.strictEqual(result1.confidence, result2.confidence);
                assert.ok(['hypothesis-driven', 'trial-and-error', 'mixed'].includes(result1.style));
                assert.ok(result1.confidence >= 0 && result1.confidence <= 1);
                assert.ok(Array.isArray(result1.indicators));
            }
        ), { numRuns: 50 });
    });

    // Property 6: Offline-First Data Integrity Tests
    await runner.runTest('Property 6: Event Storage and Retrieval', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-insights-test-'));
        const storageManager = new LocalStorageManager(tempDir);
        
        try {
            // Wait for database initialization
            await new Promise(resolve => setTimeout(resolve, 200));

            await fc.assert(fc.asyncProperty(
                fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 10 }),
                async (events) => {
                    // Store events
                    for (const event of events) {
                        await storageManager.storeEvent(event);
                    }

                    // Retrieve events
                    const retrievedEvents = await storageManager.getUnsyncedEvents(events.length);
                    assert.strictEqual(retrievedEvents.length, events.length);

                    // Verify ordering
                    for (let i = 1; i < retrievedEvents.length; i++) {
                        assert.ok(retrievedEvents[i].timestamp >= retrievedEvents[i - 1].timestamp);
                    }
                }
            ), { numRuns: 10 });
        } finally {
            // Cleanup
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    });

    await runner.runTest('Property 6: Storage Statistics Consistency', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-insights-test-'));
        const storageManager = new LocalStorageManager(tempDir);
        
        try {
            // Wait for database initialization
            await new Promise(resolve => setTimeout(resolve, 200));

            await fc.assert(fc.asyncProperty(
                fc.array(generateDeveloperEvent(), { minLength: 0, maxLength: 5 }),
                async (events) => {
                    // Store events
                    for (const event of events) {
                        await storageManager.storeEvent(event);
                    }

                    // Get statistics
                    const stats = await storageManager.getStorageStats();
                    
                    assert.ok(typeof stats.eventCount === 'number' && stats.eventCount >= 0);
                    assert.ok(typeof stats.unsyncedCount === 'number' && stats.unsyncedCount >= 0);
                    assert.strictEqual(stats.eventCount, events.length);
                    assert.strictEqual(stats.unsyncedCount, events.length);
                }
            ), { numRuns: 10 });
        } finally {
            // Cleanup
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    });

    runner.summary();
}

main().catch(console.error);