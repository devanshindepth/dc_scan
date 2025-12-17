import * as assert from 'assert';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LocalStorageManager } from '../../extension/out/services/LocalStorageManager.js';
import { SyncManager } from '../../extension/out/services/SyncManager.js';
import { HeuristicAnalyzer } from '../../extension/out/services/HeuristicAnalyzer.js';
import { EventTracker } from '../../extension/out/services/EventTracker.js';
import { PrivacyController } from '../../extension/out/services/PrivacyController.js';
import { DeveloperEvent, SyncBatch } from '../../src/types/events.js';
import { 
    generateRealisticCodingSession, 
    generateMultiDayActivity, 
    generateEdgeCaseScenarios,
    generatePerformanceTestDataset,
    RealisticScenarioConfig 
} from './test-helpers.js';

/**
 * End-to-End Integration Tests for AI Development Insights System
 * 
 * These tests validate the complete workflow from VS Code extension
 * event collection through backend processing to insight generation.
 * 
 * Requirements: All (comprehensive system validation)
 */

interface E2ETestContext {
    tempDir: string;
    storageManager: LocalStorageManager;
    syncManager: SyncManager;
    heuristicAnalyzer: HeuristicAnalyzer;
    privacyController: PrivacyController;
    developerId: string;
    mockBackendUrl: string;
}

suite('End-to-End Integration Tests', () => {
    let context: E2ETestContext;

    setup(async () => {
        // Create temporary directory for each test
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-insights-e2e-'));
        const developerId = `test-dev-${Date.now()}`;
        
        context = {
            tempDir,
            storageManager: new LocalStorageManager(tempDir),
            syncManager: new SyncManager('http://localhost:3001'),
            heuristicAnalyzer: new HeuristicAnalyzer(),
            privacyController: new PrivacyController(),
            developerId,
            mockBackendUrl: 'http://localhost:3001'
        };

        // Wait for services to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    teardown(async () => {
        // Cleanup temporary directory
        if (fs.existsSync(context.tempDir)) {
            fs.rmSync(context.tempDir, { recursive: true, force: true });
        }
    });

    test('Complete Developer Workflow: Coding Session with AI Assistance', async function() {
        this.timeout(10000);

        // Generate realistic coding session
        const sessionConfig: RealisticScenarioConfig = {
            developerId: context.developerId,
            sessionDuration: 2 * 60 * 60 * 1000, // 2 hours
            aiUsageFrequency: 'medium',
            debuggingStyle: 'hypothesis-driven',
            errorFrequency: 2 // 2 errors per hour
        };

        const { events, expectedMetrics } = generateRealisticCodingSession(sessionConfig);

        // Step 1: Process events through heuristic analyzer
        const analyzedEvents = await Promise.all(
            events.map(async event => {
                const analysis = await context.heuristicAnalyzer.processEvent(event);
                return { ...event, analysis };
            })
        );

        // Step 2: Store events locally
        for (const event of analyzedEvents) {
            await context.storageManager.storeEvent(event);
        }

        // Step 3: Verify local storage integrity
        const storedEvents = await context.storageManager.getUnsyncedEvents(events.length);
        assert.strictEqual(storedEvents.length, events.length, 'All events should be stored locally');

        // Step 4: Create sync batch
        const syncBatch = await context.storageManager.createSyncBatch(storedEvents);
        assert.ok(syncBatch.batchId, 'Sync batch should have an ID');
        assert.strictEqual(syncBatch.events.length, events.length, 'Sync batch should contain all events');

        // Step 5: Verify privacy protection throughout the pipeline
        for (const event of syncBatch.events) {
            assert.ok(!event.metadata.hasOwnProperty('sourceCode'), 'No source code should be stored');
            assert.ok(!event.metadata.hasOwnProperty('prompt'), 'No prompts should be stored');
            assert.ok(!event.metadata.hasOwnProperty('response'), 'No responses should be stored');
        }

        // Step 6: Analyze AI assistance patterns
        const aiAssistanceAnalysis = context.heuristicAnalyzer.analyzeAIAssistanceLevel(storedEvents);
        assert.ok(['low', 'medium', 'high'].includes(aiAssistanceAnalysis.level));
        assert.ok(aiAssistanceAnalysis.confidence >= 0 && aiAssistanceAnalysis.confidence <= 1);

        // Step 7: Calculate skill metrics
        const promptEfficiency = context.heuristicAnalyzer.calculatePromptEfficiency(storedEvents);
        assert.ok(promptEfficiency.score >= 0 && promptEfficiency.score <= 100);

        const humanRefinementRatio = context.heuristicAnalyzer.calculateHumanRefinementRatio(storedEvents);
        assert.ok(humanRefinementRatio >= 0 && humanRefinementRatio <= 1);

        // Step 8: Analyze debugging patterns
        const debuggingAnalysis = context.heuristicAnalyzer.analyzeDebuggingStyle(storedEvents);
        assert.ok(['hypothesis-driven', 'trial-and-error', 'mixed'].includes(debuggingAnalysis.style));

        // Step 9: Verify expected metrics alignment
        assert.strictEqual(aiAssistanceAnalysis.level, expectedMetrics.aiAssistanceLevel);
        assert.ok(
            promptEfficiency.score >= expectedMetrics.promptEfficiencyRange[0] &&
            promptEfficiency.score <= expectedMetrics.promptEfficiencyRange[1]
        );

        console.log('✓ Complete developer workflow validated successfully');
    });

    test('Multi-Day Activity Analysis: Skill Progression Tracking', async function() {
        this.timeout(15000);

        // Generate 7 days of developer activity
        const multiDayEvents = generateMultiDayActivity(context.developerId, 7);
        
        // Process events day by day to simulate real-world usage
        const dailyMetrics: any[] = [];
        
        for (let day = 0; day < 7; day++) {
            const dayStart = Date.now() - ((7 - day) * 24 * 60 * 60 * 1000);
            const dayEnd = dayStart + (24 * 60 * 60 * 1000);
            
            const dayEvents = multiDayEvents.filter(
                event => event.timestamp >= dayStart && event.timestamp < dayEnd
            );

            if (dayEvents.length === 0) continue;

            // Store events for the day
            for (const event of dayEvents) {
                await context.storageManager.storeEvent(event);
            }

            // Analyze daily patterns
            const aiAssistance = context.heuristicAnalyzer.analyzeAIAssistanceLevel(dayEvents);
            const promptEfficiency = context.heuristicAnalyzer.calculatePromptEfficiency(dayEvents);
            const debuggingStyle = context.heuristicAnalyzer.analyzeDebuggingStyle(dayEvents);

            dailyMetrics.push({
                day,
                eventCount: dayEvents.length,
                aiAssistanceLevel: aiAssistance.level,
                promptEfficiencyScore: promptEfficiency.score,
                debuggingStyle: debuggingStyle.style,
                debuggingConfidence: debuggingStyle.confidence
            });
        }

        // Verify progression tracking
        assert.ok(dailyMetrics.length >= 5, 'Should have metrics for at least 5 days');
        
        // Check for consistency in measurements
        const aiLevels = dailyMetrics.map(m => m.aiAssistanceLevel);
        const uniqueAiLevels = [...new Set(aiLevels)];
        assert.ok(uniqueAiLevels.every(level => ['low', 'medium', 'high'].includes(level)));

        // Verify prompt efficiency scores are reasonable
        const efficiencyScores = dailyMetrics.map(m => m.promptEfficiencyScore);
        assert.ok(efficiencyScores.every(score => score >= 0 && score <= 100));

        // Check for trend analysis capability
        const avgEarlyEfficiency = efficiencyScores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const avgLateEfficiency = efficiencyScores.slice(-3).reduce((a, b) => a + b, 0) / 3;
        
        // Should be able to detect trends (improvement, decline, or stability)
        const trendDirection = avgLateEfficiency > avgEarlyEfficiency ? 'improving' : 
                              avgLateEfficiency < avgEarlyEfficiency ? 'declining' : 'stable';
        assert.ok(['improving', 'declining', 'stable'].includes(trendDirection));

        console.log('✓ Multi-day activity analysis completed successfully');
        console.log(`  - Analyzed ${multiDayEvents.length} events over 7 days`);
        console.log(`  - Trend direction: ${trendDirection}`);
    });

    test('Privacy Protection Validation: Comprehensive Data Safety', async function() {
        this.timeout(8000);

        // Generate events that could potentially contain sensitive data
        const sensitiveScenarios = [
            // Scenario 1: Large paste events (could be sensitive code)
            {
                id: 'sensitive-1',
                developerId: context.developerId,
                timestamp: Date.now(),
                eventType: 'paste' as const,
                metadata: {
                    pasteLength: 5000, // Large paste - only length stored
                    timeSinceAiInvocation: 2000,
                    aiContributionLevel: 'high' as const
                },
                sessionId: 'privacy-test'
            },
            // Scenario 2: AI invocation (could contain sensitive prompts)
            {
                id: 'sensitive-2',
                developerId: context.developerId,
                timestamp: Date.now() + 1000,
                eventType: 'ai_invocation' as const,
                metadata: {
                    toolType: 'chat' as const,
                    invocationContext: 'debugging' as const
                    // No prompt content stored
                },
                sessionId: 'privacy-test'
            },
            // Scenario 3: Error markers (could contain sensitive error messages)
            {
                id: 'sensitive-3',
                developerId: context.developerId,
                timestamp: Date.now() + 2000,
                eventType: 'error_marker' as const,
                metadata: {
                    errorAppeared: true
                    // No error content stored
                },
                sessionId: 'privacy-test'
            }
        ];

        // Process through privacy controller
        for (const event of sensitiveScenarios) {
            const isAllowed = context.privacyController.validateEventPrivacy(event);
            assert.ok(isAllowed, 'Privacy controller should allow metadata-only events');
            
            await context.storageManager.storeEvent(event);
        }

        // Verify stored data contains no sensitive information
        const storedEvents = await context.storageManager.getUnsyncedEvents(10);
        
        for (const event of storedEvents) {
            // Check that no forbidden fields are present
            const forbiddenFields = ['sourceCode', 'content', 'prompt', 'response', 'errorMessage', 'stackTrace'];
            
            for (const field of forbiddenFields) {
                assert.ok(!event.metadata.hasOwnProperty(field), 
                    `Event should not contain ${field}`);
            }

            // Verify only allowed metadata is present
            const allowedFields = [
                'burstDuration', 'characterCount', 'pasteLength', 'timeSinceAiInvocation',
                'aiContributionLevel', 'toolType', 'invocationContext', 'actionType',
                'errorCount', 'fileExtension', 'switchFrequency', 'errorAppeared',
                'errorResolved', 'timeToResolve'
            ];

            for (const field in event.metadata) {
                assert.ok(allowedFields.includes(field), 
                    `Only allowed metadata fields should be present, found: ${field}`);
            }
        }

        // Test privacy control pause/resume functionality
        context.privacyController.pauseTracking();
        assert.ok(context.privacyController.isTrackingPaused(), 'Tracking should be paused');

        // Attempt to store event while paused
        const pausedEvent = {
            id: 'paused-event',
            developerId: context.developerId,
            timestamp: Date.now(),
            eventType: 'keystroke_burst' as const,
            metadata: { burstDuration: 1000, characterCount: 50 },
            sessionId: 'privacy-test'
        };

        const shouldBeBlocked = context.privacyController.validateEventPrivacy(pausedEvent);
        assert.ok(!shouldBeBlocked, 'Events should be blocked when tracking is paused');

        // Resume tracking
        context.privacyController.resumeTracking();
        assert.ok(!context.privacyController.isTrackingPaused(), 'Tracking should be resumed');

        const shouldBeAllowed = context.privacyController.validateEventPrivacy(pausedEvent);
        assert.ok(shouldBeAllowed, 'Events should be allowed when tracking is resumed');

        console.log('✓ Privacy protection validation completed successfully');
    });

    test('Edge Case Handling: System Resilience', async function() {
        this.timeout(12000);

        const edgeCaseEvents = generateEdgeCaseScenarios(context.developerId);

        // Test handling of edge cases
        let processedCount = 0;
        let errorCount = 0;

        for (const event of edgeCaseEvents) {
            try {
                // Validate event structure
                assert.ok(event.id, 'Event should have an ID');
                assert.ok(event.developerId, 'Event should have a developer ID');
                assert.ok(event.timestamp, 'Event should have a timestamp');
                assert.ok(event.eventType, 'Event should have an event type');
                assert.ok(event.sessionId, 'Event should have a session ID');

                // Process through heuristic analyzer
                const analysis = await context.heuristicAnalyzer.processEvent(event);
                assert.ok(analysis, 'Analysis should be generated for all events');

                // Store event
                await context.storageManager.storeEvent(event);
                processedCount++;

            } catch (error) {
                errorCount++;
                console.warn(`Edge case event processing error: ${error}`);
            }
        }

        // Verify system resilience
        const successRate = processedCount / edgeCaseEvents.length;
        assert.ok(successRate >= 0.9, 'System should handle at least 90% of edge cases successfully');

        // Test storage statistics with edge case data
        const stats = await context.storageManager.getStorageStats();
        assert.ok(stats.eventCount >= processedCount, 'Storage stats should reflect processed events');
        assert.ok(stats.unsyncedCount >= processedCount, 'All events should be unsynced initially');

        // Test data export with edge case data
        const exportData = await context.storageManager.exportData();
        assert.ok(exportData.events.length >= processedCount, 'Export should include all processed events');
        assert.ok(exportData.eventCount >= processedCount, 'Export count should match processed events');

        console.log('✓ Edge case handling validation completed successfully');
        console.log(`  - Processed ${processedCount}/${edgeCaseEvents.length} edge case events`);
        console.log(`  - Success rate: ${(successRate * 100).toFixed(1)}%`);
    });

    test('Performance Validation: High Volume Processing', async function() {
        this.timeout(20000);

        const eventCount = 1000;
        const performanceEvents = generatePerformanceTestDataset(context.developerId, eventCount);

        const startTime = Date.now();

        // Process high volume of events
        let processedCount = 0;
        const batchSize = 50;

        for (let i = 0; i < performanceEvents.length; i += batchSize) {
            const batch = performanceEvents.slice(i, i + batchSize);
            
            // Process batch through heuristic analyzer
            const analyzedBatch = await Promise.all(
                batch.map(event => context.heuristicAnalyzer.processEvent(event))
            );

            // Store batch
            for (let j = 0; j < batch.length; j++) {
                await context.storageManager.storeEvent(batch[j]);
                processedCount++;
            }

            // Check memory usage periodically (simplified check)
            if (i % 200 === 0) {
                const memUsage = process.memoryUsage();
                assert.ok(memUsage.heapUsed < 500 * 1024 * 1024, 'Memory usage should stay reasonable'); // 500MB limit
            }
        }

        const processingTime = Date.now() - startTime;
        const eventsPerSecond = (processedCount / processingTime) * 1000;

        // Performance assertions
        assert.strictEqual(processedCount, eventCount, 'All events should be processed');
        assert.ok(processingTime < 15000, 'Processing should complete within 15 seconds');
        assert.ok(eventsPerSecond > 50, 'Should process at least 50 events per second');

        // Verify data integrity after high volume processing
        const storedEvents = await context.storageManager.getUnsyncedEvents(eventCount);
        assert.strictEqual(storedEvents.length, eventCount, 'All events should be stored');

        // Verify events are properly ordered
        for (let i = 1; i < storedEvents.length; i++) {
            assert.ok(storedEvents[i].timestamp >= storedEvents[i-1].timestamp, 
                'Events should be stored in timestamp order');
        }

        console.log('✓ Performance validation completed successfully');
        console.log(`  - Processed ${processedCount} events in ${processingTime}ms`);
        console.log(`  - Performance: ${eventsPerSecond.toFixed(1)} events/second`);
    });

    test('Data Retention and Cleanup: Storage Management', async function() {
        this.timeout(8000);

        // Generate events with different ages
        const now = Date.now();
        const retentionDays = 30;
        const cutoffTime = now - (retentionDays * 24 * 60 * 60 * 1000);

        const recentEvents = Array.from({ length: 10 }, (_, i) => ({
            id: `recent-${i}`,
            developerId: context.developerId,
            timestamp: now - (i * 60000), // Recent events (last 10 minutes)
            eventType: 'keystroke_burst' as const,
            metadata: { burstDuration: 1000, characterCount: 50 },
            sessionId: 'retention-test'
        }));

        const oldEvents = Array.from({ length: 5 }, (_, i) => ({
            id: `old-${i}`,
            developerId: context.developerId,
            timestamp: cutoffTime - (i * 60000), // Old events (beyond retention)
            eventType: 'keystroke_burst' as const,
            metadata: { burstDuration: 1000, characterCount: 50 },
            sessionId: 'retention-test'
        }));

        // Store all events
        for (const event of [...recentEvents, ...oldEvents]) {
            await context.storageManager.storeEvent(event);
        }

        // Mark old events as synced (so they can be cleaned up)
        const oldEventIds = oldEvents.map(e => e.id);
        await context.storageManager.markEventsSynced(oldEventIds);

        // Verify initial state
        const initialStats = await context.storageManager.getStorageStats();
        assert.strictEqual(initialStats.eventCount, 15, 'Should have 15 total events');
        assert.strictEqual(initialStats.unsyncedCount, 10, 'Should have 10 unsynced events');

        // Perform cleanup
        await context.storageManager.cleanupOldEvents(retentionDays);

        // Verify cleanup results
        const finalStats = await context.storageManager.getStorageStats();
        assert.ok(finalStats.eventCount <= 10, 'Old events should be cleaned up');
        assert.strictEqual(finalStats.unsyncedCount, 10, 'Recent events should be preserved');

        // Verify recent events are still accessible
        const remainingEvents = await context.storageManager.getUnsyncedEvents(20);
        const remainingIds = remainingEvents.map(e => e.id);

        for (const recentEvent of recentEvents) {
            assert.ok(remainingIds.includes(recentEvent.id), 
                `Recent event ${recentEvent.id} should be preserved`);
        }

        console.log('✓ Data retention and cleanup validation completed successfully');
    });
});

// Property-based test for comprehensive system validation
suite('System-Wide Property Tests', () => {
    let tempDir: string;
    let storageManager: LocalStorageManager;
    let heuristicAnalyzer: HeuristicAnalyzer;

    setup(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-insights-prop-'));
        storageManager = new LocalStorageManager(tempDir);
        heuristicAnalyzer = new HeuristicAnalyzer();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    teardown(async () => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Property: System Maintains Data Integrity Throughout Pipeline', () => {
        fc.assert(fc.asyncProperty(
            fc.array(generateDeveloperEventArbitrary(), { minLength: 1, maxLength: 20 }),
            async (events) => {
                // Process events through the complete pipeline
                const processedEvents = [];

                for (const event of events) {
                    // Validate event structure
                    assert.ok(event.id && typeof event.id === 'string');
                    assert.ok(event.developerId && typeof event.developerId === 'string');
                    assert.ok(typeof event.timestamp === 'number' && event.timestamp > 0);
                    assert.ok(event.eventType && typeof event.eventType === 'string');
                    assert.ok(event.sessionId && typeof event.sessionId === 'string');

                    // Process through heuristic analyzer
                    const analysis = await heuristicAnalyzer.processEvent(event);
                    assert.ok(analysis, 'Analysis should be generated');

                    // Store event
                    await storageManager.storeEvent(event);
                    processedEvents.push(event);
                }

                // Verify all events are stored
                const storedEvents = await storageManager.getUnsyncedEvents(events.length);
                assert.strictEqual(storedEvents.length, events.length);

                // Verify data integrity
                for (let i = 0; i < events.length; i++) {
                    const original = events[i];
                    const stored = storedEvents.find(e => e.id === original.id);
                    
                    assert.ok(stored, `Event ${original.id} should be stored`);
                    assert.strictEqual(stored.developerId, original.developerId);
                    assert.strictEqual(stored.timestamp, original.timestamp);
                    assert.strictEqual(stored.eventType, original.eventType);
                    assert.strictEqual(stored.sessionId, original.sessionId);
                }
            }
        ), { numRuns: 50 });
    });
});

// Generator for property-based testing
function generateDeveloperEventArbitrary(): fc.Arbitrary<DeveloperEvent> {
    return fc.record({
        id: fc.uuid(),
        developerId: fc.uuid(),
        timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
        eventType: fc.constantFrom('keystroke_burst', 'paste', 'ai_invocation', 'debug_action', 'file_switch', 'error_marker'),
        metadata: fc.record({
            burstDuration: fc.option(fc.integer({ min: 100, max: 10000 })),
            characterCount: fc.option(fc.integer({ min: 1, max: 1000 })),
            pasteLength: fc.option(fc.integer({ min: 1, max: 5000 })),
            timeSinceAiInvocation: fc.option(fc.integer({ min: 0, max: 60000 })),
            aiContributionLevel: fc.option(fc.constantFrom('low', 'medium', 'high')),
            toolType: fc.option(fc.constantFrom('copilot', 'chat', 'other')),
            invocationContext: fc.option(fc.constantFrom('coding', 'debugging', 'documentation')),
            actionType: fc.option(fc.constantFrom('run', 'debug', 'test')),
            errorCount: fc.option(fc.integer({ min: 0, max: 20 })),
            fileExtension: fc.option(fc.constantFrom('.ts', '.js', '.py', '.java', '.cpp')),
            switchFrequency: fc.option(fc.integer({ min: 1, max: 100 })),
            errorAppeared: fc.option(fc.boolean()),
            errorResolved: fc.option(fc.boolean()),
            timeToResolve: fc.option(fc.integer({ min: 1000, max: 1800000 }))
        }),
        sessionId: fc.uuid()
    });
}