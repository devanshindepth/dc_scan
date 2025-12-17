import * as assert from 'assert';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LocalStorageManager } from '../../services/LocalStorageManager';
import { SyncManager } from '../../services/SyncManager';
import { DeveloperEvent, EventMetadata } from '../../types/events';

/**
 * **Feature: ai-dev-insights, Property 6: Offline-First Data Integrity**
 * For any network connectivity scenario, the system should store events locally when offline, 
 * batch sync when online, ensure idempotent uploads, and preserve event ordering and timestamps 
 * throughout the process
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.5**
 */

suite('Offline-First Data Integrity Property Tests', () => {
    let tempDir: string;
    let storageManager: LocalStorageManager;

    setup(async () => {
        // Create temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dev-insights-test-'));
        storageManager = new LocalStorageManager(tempDir);
        // Wait for database initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    teardown(async () => {
        // Cleanup temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Property 6: Offline-First Data Integrity - Event Storage and Retrieval', () => {
        fc.assert(fc.asyncProperty(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 20 }),
            async (events) => {
                // Store events locally
                for (const event of events) {
                    await storageManager.storeEvent(event);
                }

                // Retrieve unsynced events
                const retrievedEvents = await storageManager.getUnsyncedEvents(events.length);

                // Verify all events were stored and retrieved
                assert.strictEqual(retrievedEvents.length, events.length);

                // Verify event ordering is preserved (by timestamp)
                for (let i = 1; i < retrievedEvents.length; i++) {
                    assert.ok(retrievedEvents[i].timestamp >= retrievedEvents[i - 1].timestamp);
                }

                // Verify event data integrity
                const sortedOriginal = [...events].sort((a, b) => a.timestamp - b.timestamp);
                const sortedRetrieved = [...retrievedEvents].sort((a, b) => a.timestamp - b.timestamp);

                for (let i = 0; i < sortedOriginal.length; i++) {
                    const original = sortedOriginal[i];
                    const retrieved = sortedRetrieved[i];

                    assert.strictEqual(retrieved.id, original.id);
                    assert.strictEqual(retrieved.developerId, original.developerId);
                    assert.strictEqual(retrieved.timestamp, original.timestamp);
                    assert.strictEqual(retrieved.eventType, original.eventType);
                    assert.strictEqual(retrieved.sessionId, original.sessionId);
                    assert.deepStrictEqual(retrieved.metadata, original.metadata);
                }
            }
        ), { numRuns: 50 });
    });

    test('Property 6: Offline-First Data Integrity - Batch Creation and Sync Marking', () => {
        fc.assert(fc.asyncProperty(
            fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 15 }),
            async (events) => {
                // Store events
                for (const event of events) {
                    await storageManager.storeEvent(event);
                }

                // Create sync batch
                const batch = await storageManager.createSyncBatch(events);

                // Verify batch properties
                assert.ok(typeof batch.batchId === 'string' && batch.batchId.length > 0);
                assert.ok(typeof batch.timestamp === 'number' && batch.timestamp > 0);
                assert.strictEqual(batch.events.length, events.length);

                // Mark events as synced
                const eventIds = events.map(e => e.id);
                await storageManager.markEventsSynced(eventIds);

                // Verify events are no longer unsynced
                const unsyncedEvents = await storageManager.getUnsyncedEvents(100);
                const unsyncedIds = unsyncedEvents.map(e => e.id);
                
                for (const eventId of eventIds) {
                    assert.ok(!unsyncedIds.includes(eventId));
                }
            }
        ), { numRuns: 50 });
    });

    test('Property 6: Offline-First Data Integrity - Storage Statistics Consistency', () => {
        fc.assert(fc.asyncProperty(
            fc.array(generateDeveloperEvent(), { minLength: 0, maxLength: 10 }),
            async (events) => {
                // Store events
                for (const event of events) {
                    await storageManager.storeEvent(event);
                }

                // Get storage statistics
                const stats = await storageManager.getStorageStats();

                // Verify statistics consistency
                assert.ok(typeof stats.eventCount === 'number' && stats.eventCount >= 0);
                assert.ok(typeof stats.unsyncedCount === 'number' && stats.unsyncedCount >= 0);
                assert.ok(stats.oldestEvent === null || (typeof stats.oldestEvent === 'number' && stats.oldestEvent > 0));

                // Event count should match stored events
                assert.strictEqual(stats.eventCount, events.length);
                
                // All events should be unsynced initially
                assert.strictEqual(stats.unsyncedCount, events.length);

                // If there are events, oldest event should be set
                if (events.length > 0) {
                    assert.ok(stats.oldestEvent !== null);
                    const minTimestamp = Math.min(...events.map(e => e.timestamp));
                    assert.strictEqual(stats.oldestEvent, minTimestamp);
                }
            }
        ), { numRuns: 50 });
    });

    test('Property 6: Offline-First Data Integrity - Data Export Completeness', () => {
        fc.assert(fc.asyncProperty(
            fc.array(generateDeveloperEvent(), { minLength: 0, maxLength: 10 }),
            async (events) => {
                // Store events
                for (const event of events) {
                    await storageManager.storeEvent(event);
                }

                // Export data
                const exportData = await storageManager.exportData();

                // Verify export structure
                assert.ok(typeof exportData.exportTimestamp === 'number');
                assert.ok(typeof exportData.eventCount === 'number');
                assert.ok(Array.isArray(exportData.events));

                // Verify export completeness
                assert.strictEqual(exportData.eventCount, events.length);
                assert.strictEqual(exportData.events.length, events.length);

                // Verify export timestamp is recent
                const now = Date.now();
                assert.ok(exportData.exportTimestamp <= now);
                assert.ok(exportData.exportTimestamp > now - 10000); // Within last 10 seconds
            }
        ), { numRuns: 50 });
    });

    test('Property 6: Offline-First Data Integrity - Cleanup Preserves Recent Events', () => {
        fc.assert(fc.asyncProperty(
            fc.tuple(
                fc.array(generateDeveloperEvent(), { minLength: 1, maxLength: 10 }),
                fc.integer({ min: 1, max: 30 }) // retention days
            ),
            async ([events, retentionDays]) => {
                // Modify events to have different ages
                const now = Date.now();
                const cutoffTime = now - (retentionDays * 24 * 60 * 60 * 1000);
                
                const recentEvents = events.slice(0, Math.ceil(events.length / 2)).map(e => ({
                    ...e,
                    timestamp: now - Math.random() * (retentionDays - 1) * 24 * 60 * 60 * 1000 // Recent
                }));
                
                const oldEvents = events.slice(Math.ceil(events.length / 2)).map(e => ({
                    ...e,
                    timestamp: cutoffTime - Math.random() * 30 * 24 * 60 * 60 * 1000 // Old
                }));

                // Store all events
                for (const event of [...recentEvents, ...oldEvents]) {
                    await storageManager.storeEvent(event);
                }

                // Mark old events as synced so they can be cleaned up
                const oldEventIds = oldEvents.map(e => e.id);
                await storageManager.markEventsSynced(oldEventIds);

                // Perform cleanup
                await storageManager.cleanupOldEvents(retentionDays);

                // Verify recent events are preserved
                const remainingEvents = await storageManager.getUnsyncedEvents(100);
                const remainingIds = remainingEvents.map(e => e.id);
                
                for (const recentEvent of recentEvents) {
                    assert.ok(remainingIds.includes(recentEvent.id), 
                        `Recent event ${recentEvent.id} should be preserved`);
                }
            }
        ), { numRuns: 30 });
    });
});

// Generator for DeveloperEvent with realistic timestamps
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