import { DeveloperEvent, EventMetadata } from '../../src/types/events';

/**
 * Test Helper Functions for Integration Testing
 * 
 * Provides utilities for generating realistic test data and scenarios
 * for comprehensive integration testing of the AI Development Insights system.
 */

export interface RealisticScenarioConfig {
    developerId: string;
    sessionDuration: number; // in milliseconds
    aiUsageFrequency: 'low' | 'medium' | 'high';
    debuggingStyle: 'hypothesis-driven' | 'trial-and-error' | 'mixed';
    errorFrequency: number; // errors per hour
}

export interface TestScenarioResult {
    events: DeveloperEvent[];
    expectedMetrics: {
        aiAssistanceLevel: 'low' | 'medium' | 'high';
        promptEfficiencyRange: [number, number];
        debuggingStyleConfidence: number;
        humanRefinementRatio: number;
    };
}

/**
 * Generates a realistic developer coding session with configurable parameters
 */
export function generateRealisticCodingSession(config: RealisticScenarioConfig): TestScenarioResult {
    const events: DeveloperEvent[] = [];
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now() - config.sessionDuration;
    let currentTime = startTime;

    // Calculate event frequencies based on configuration
    const keystrokeBurstInterval = getKeystrokeBurstInterval(config.aiUsageFrequency);
    const aiInvocationInterval = getAiInvocationInterval(config.aiUsageFrequency);
    const errorInterval = 3600000 / config.errorFrequency; // Convert errors per hour to interval

    let eventId = 0;
    let lastAiInvocation = 0;
    let activeErrors = 0;

    while (currentTime < Date.now()) {
        const timeToNextEvent = Math.random() * keystrokeBurstInterval;
        currentTime += timeToNextEvent;

        if (currentTime >= Date.now()) break;

        // Decide what type of event to generate
        const eventType = selectEventType(currentTime, lastAiInvocation, activeErrors, config);

        switch (eventType) {
            case 'keystroke_burst':
                events.push(createKeystrokeBurstEvent(eventId++, config.developerId, currentTime, sessionId));
                break;

            case 'ai_invocation':
                events.push(createAiInvocationEvent(eventId++, config.developerId, currentTime, sessionId, config.aiUsageFrequency));
                lastAiInvocation = currentTime;
                
                // Often followed by a paste event
                if (Math.random() < 0.8) {
                    currentTime += 2000 + Math.random() * 8000; // 2-10 seconds later
                    events.push(createPasteEvent(eventId++, config.developerId, currentTime, sessionId, currentTime - lastAiInvocation));
                }
                break;

            case 'error_marker':
                if (activeErrors === 0 && Math.random() < (1 / errorInterval * timeToNextEvent)) {
                    events.push(createErrorAppearanceEvent(eventId++, config.developerId, currentTime, sessionId));
                    activeErrors++;
                } else if (activeErrors > 0 && Math.random() < 0.3) {
                    // Resolve error
                    const errorStartTime = findLastErrorStart(events, currentTime);
                    events.push(createErrorResolutionEvent(eventId++, config.developerId, currentTime, sessionId, errorStartTime));
                    activeErrors--;
                }
                break;

            case 'debug_action':
                if (activeErrors > 0) {
                    events.push(createDebugActionEvent(eventId++, config.developerId, currentTime, sessionId, config.debuggingStyle));
                }
                break;

            case 'file_switch':
                events.push(createFileSwitchEvent(eventId++, config.developerId, currentTime, sessionId));
                break;
        }
    }

    // Calculate expected metrics based on generated events
    const expectedMetrics = calculateExpectedMetrics(events, config);

    return { events, expectedMetrics };
}

/**
 * Generates a multi-day developer activity simulation
 */
export function generateMultiDayActivity(developerId: string, days: number): DeveloperEvent[] {
    const allEvents: DeveloperEvent[] = [];
    const baseTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    for (let day = 0; day < days; day++) {
        const dayStart = baseTime + (day * 24 * 60 * 60 * 1000);
        
        // Simulate 2-3 coding sessions per day
        const sessionsPerDay = 2 + Math.floor(Math.random() * 2);
        
        for (let session = 0; session < sessionsPerDay; session++) {
            const sessionStart = dayStart + (8 * 60 * 60 * 1000) + (session * 4 * 60 * 60 * 1000); // Start at 8 AM, sessions 4 hours apart
            const sessionDuration = (1 + Math.random() * 2) * 60 * 60 * 1000; // 1-3 hours
            
            const config: RealisticScenarioConfig = {
                developerId,
                sessionDuration,
                aiUsageFrequency: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
                debuggingStyle: ['hypothesis-driven', 'trial-and-error', 'mixed'][Math.floor(Math.random() * 3)] as any,
                errorFrequency: 1 + Math.random() * 3 // 1-4 errors per hour
            };

            const sessionResult = generateRealisticCodingSession(config);
            
            // Adjust timestamps to fit the day/session
            const adjustedEvents = sessionResult.events.map(event => ({
                ...event,
                timestamp: sessionStart + (event.timestamp - sessionResult.events[0].timestamp)
            }));

            allEvents.push(...adjustedEvents);
        }
    }

    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Generates events that test specific edge cases and boundary conditions
 */
export function generateEdgeCaseScenarios(developerId: string): DeveloperEvent[] {
    const events: DeveloperEvent[] = [];
    const sessionId = `edge-case-session-${Date.now()}`;
    let eventId = 0;
    let timestamp = Date.now() - 3600000; // 1 hour ago

    // Edge case 1: Very rapid AI invocations (testing rate limiting)
    for (let i = 0; i < 5; i++) {
        events.push({
            id: `edge-${eventId++}`,
            developerId,
            timestamp: timestamp + (i * 100), // 100ms apart
            eventType: 'ai_invocation',
            metadata: {
                toolType: 'copilot',
                invocationContext: 'coding'
            },
            sessionId
        });
    }

    timestamp += 10000;

    // Edge case 2: Very long keystroke burst (testing large data handling)
    events.push({
        id: `edge-${eventId++}`,
        developerId,
        timestamp,
        eventType: 'keystroke_burst',
        metadata: {
            burstDuration: 300000, // 5 minutes
            characterCount: 10000 // Very large
        },
        sessionId
    });

    timestamp += 60000;

    // Edge case 3: Error that never gets resolved
    events.push({
        id: `edge-${eventId++}`,
        developerId,
        timestamp,
        eventType: 'error_marker',
        metadata: {
            errorAppeared: true
        },
        sessionId
    });

    timestamp += 120000;

    // Edge case 4: Paste without prior AI invocation
    events.push({
        id: `edge-${eventId++}`,
        developerId,
        timestamp,
        eventType: 'paste',
        metadata: {
            pasteLength: 500,
            timeSinceAiInvocation: undefined, // No prior AI invocation
            aiContributionLevel: undefined
        },
        sessionId
    });

    // Edge case 5: Very frequent file switching (testing performance)
    for (let i = 0; i < 20; i++) {
        timestamp += 1000; // 1 second apart
        events.push({
            id: `edge-${eventId++}`,
            developerId,
            timestamp,
            eventType: 'file_switch',
            metadata: {
                fileExtension: ['.ts', '.js', '.py', '.java', '.cpp'][i % 5],
                switchFrequency: i + 1
            },
            sessionId
        });
    }

    return events;
}

/**
 * Creates a comprehensive test dataset for performance testing
 */
export function generatePerformanceTestDataset(developerId: string, eventCount: number): DeveloperEvent[] {
    const events: DeveloperEvent[] = [];
    const sessionId = `perf-test-${Date.now()}`;
    const startTime = Date.now() - 86400000; // 24 hours ago

    for (let i = 0; i < eventCount; i++) {
        const timestamp = startTime + (i * (86400000 / eventCount)); // Evenly distributed over 24 hours
        const eventTypes = ['keystroke_burst', 'paste', 'ai_invocation', 'debug_action', 'file_switch', 'error_marker'];
        const eventType = eventTypes[i % eventTypes.length];

        events.push({
            id: `perf-${i}`,
            developerId,
            timestamp,
            eventType: eventType as any,
            metadata: generateMetadataForEventType(eventType),
            sessionId
        });
    }

    return events;
}

// Helper functions

function getKeystrokeBurstInterval(aiUsage: string): number {
    switch (aiUsage) {
        case 'low': return 120000; // 2 minutes
        case 'medium': return 60000; // 1 minute
        case 'high': return 30000; // 30 seconds
        default: return 60000;
    }
}

function getAiInvocationInterval(aiUsage: string): number {
    switch (aiUsage) {
        case 'low': return 600000; // 10 minutes
        case 'medium': return 300000; // 5 minutes
        case 'high': return 120000; // 2 minutes
        default: return 300000;
    }
}

function selectEventType(currentTime: number, lastAiInvocation: number, activeErrors: number, config: RealisticScenarioConfig): string {
    const timeSinceAi = currentTime - lastAiInvocation;
    
    // Higher probability of AI invocation if it's been a while
    if (timeSinceAi > getAiInvocationInterval(config.aiUsageFrequency) && Math.random() < 0.3) {
        return 'ai_invocation';
    }
    
    // Higher probability of debug actions if there are active errors
    if (activeErrors > 0 && Math.random() < 0.4) {
        return 'debug_action';
    }
    
    // Random selection for other events
    const eventTypes = ['keystroke_burst', 'file_switch', 'error_marker'];
    return eventTypes[Math.floor(Math.random() * eventTypes.length)];
}

function createKeystrokeBurstEvent(id: number, developerId: string, timestamp: number, sessionId: string): DeveloperEvent {
    return {
        id: `keystroke-${id}`,
        developerId,
        timestamp,
        eventType: 'keystroke_burst',
        metadata: {
            burstDuration: 1000 + Math.random() * 5000,
            characterCount: 20 + Math.floor(Math.random() * 200)
        },
        sessionId
    };
}

function createAiInvocationEvent(id: number, developerId: string, timestamp: number, sessionId: string, frequency: string): DeveloperEvent {
    const tools = frequency === 'high' ? ['copilot', 'chat'] : ['copilot'];
    const contexts = ['coding', 'debugging', 'documentation'];
    
    return {
        id: `ai-${id}`,
        developerId,
        timestamp,
        eventType: 'ai_invocation',
        metadata: {
            toolType: tools[Math.floor(Math.random() * tools.length)] as any,
            invocationContext: contexts[Math.floor(Math.random() * contexts.length)] as any
        },
        sessionId
    };
}

function createPasteEvent(id: number, developerId: string, timestamp: number, sessionId: string, timeSinceAi: number): DeveloperEvent {
    const aiContribution = timeSinceAi < 10000 ? 'high' : timeSinceAi < 30000 ? 'medium' : 'low';
    
    return {
        id: `paste-${id}`,
        developerId,
        timestamp,
        eventType: 'paste',
        metadata: {
            pasteLength: 50 + Math.floor(Math.random() * 500),
            timeSinceAiInvocation: timeSinceAi,
            aiContributionLevel: aiContribution as any
        },
        sessionId
    };
}

function createErrorAppearanceEvent(id: number, developerId: string, timestamp: number, sessionId: string): DeveloperEvent {
    return {
        id: `error-appear-${id}`,
        developerId,
        timestamp,
        eventType: 'error_marker',
        metadata: {
            errorAppeared: true
        },
        sessionId
    };
}

function createErrorResolutionEvent(id: number, developerId: string, timestamp: number, sessionId: string, errorStartTime: number): DeveloperEvent {
    return {
        id: `error-resolve-${id}`,
        developerId,
        timestamp,
        eventType: 'error_marker',
        metadata: {
            errorResolved: true,
            timeToResolve: timestamp - errorStartTime
        },
        sessionId
    };
}

function createDebugActionEvent(id: number, developerId: string, timestamp: number, sessionId: string, style: string): DeveloperEvent {
    const actionTypes = style === 'hypothesis-driven' ? ['debug'] : ['run', 'debug', 'test'];
    
    return {
        id: `debug-${id}`,
        developerId,
        timestamp,
        eventType: 'debug_action',
        metadata: {
            actionType: actionTypes[Math.floor(Math.random() * actionTypes.length)] as any,
            errorCount: 1 + Math.floor(Math.random() * 3)
        },
        sessionId
    };
}

function createFileSwitchEvent(id: number, developerId: string, timestamp: number, sessionId: string): DeveloperEvent {
    const extensions = ['.ts', '.js', '.py', '.java', '.cpp', '.html', '.css'];
    
    return {
        id: `file-${id}`,
        developerId,
        timestamp,
        eventType: 'file_switch',
        metadata: {
            fileExtension: extensions[Math.floor(Math.random() * extensions.length)],
            switchFrequency: 1 + Math.floor(Math.random() * 10)
        },
        sessionId
    };
}

function findLastErrorStart(events: DeveloperEvent[], currentTime: number): number {
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].eventType === 'error_marker' && events[i].metadata.errorAppeared) {
            return events[i].timestamp;
        }
    }
    return currentTime - 300000; // Default to 5 minutes ago
}

function generateMetadataForEventType(eventType: string): EventMetadata {
    switch (eventType) {
        case 'keystroke_burst':
            return {
                burstDuration: 1000 + Math.random() * 3000,
                characterCount: 20 + Math.floor(Math.random() * 100)
            };
        case 'paste':
            return {
                pasteLength: 50 + Math.floor(Math.random() * 200),
                timeSinceAiInvocation: Math.random() * 60000,
                aiContributionLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any
            };
        case 'ai_invocation':
            return {
                toolType: ['copilot', 'chat'][Math.floor(Math.random() * 2)] as any,
                invocationContext: ['coding', 'debugging'][Math.floor(Math.random() * 2)] as any
            };
        default:
            return {};
    }
}

function calculateExpectedMetrics(events: DeveloperEvent[], config: RealisticScenarioConfig) {
    const aiInvocations = events.filter(e => e.eventType === 'ai_invocation').length;
    const totalEvents = events.length;
    const aiRatio = aiInvocations / totalEvents;

    let aiAssistanceLevel: 'low' | 'medium' | 'high';
    if (aiRatio < 0.1) aiAssistanceLevel = 'low';
    else if (aiRatio < 0.3) aiAssistanceLevel = 'medium';
    else aiAssistanceLevel = 'high';

    return {
        aiAssistanceLevel,
        promptEfficiencyRange: [40, 80] as [number, number],
        debuggingStyleConfidence: 0.7,
        humanRefinementRatio: 0.3 + Math.random() * 0.4
    };
}