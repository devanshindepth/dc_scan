export interface DeveloperEvent {
    id: string;
    developerId: string;
    timestamp: number;
    eventType: 'keystroke_burst' | 'paste' | 'ai_invocation' | 'debug_action' | 'file_switch' | 'error_marker';
    metadata: EventMetadata;
    sessionId: string;
}

export interface EventMetadata {
    // Keystroke burst metadata
    burstDuration?: number;
    characterCount?: number;
    
    // Paste event metadata
    pasteLength?: number;
    timeSinceAiInvocation?: number;
    
    // AI invocation metadata
    toolType?: 'copilot' | 'chat' | 'other';
    invocationContext?: 'coding' | 'debugging' | 'documentation';
    
    // Debug action metadata
    actionType?: 'run' | 'debug' | 'test';
    errorCount?: number;
    
    // File switch metadata
    fileExtension?: string;
    switchFrequency?: number;
    
    // Error marker metadata
    errorAppeared?: boolean;
    errorResolved?: boolean;
    timeToResolve?: number;
}

export interface SyncBatch {
    events: DeveloperEvent[];
    batchId: string;
    timestamp: number;
}

export interface DailyMetrics {
    developerId: string;
    date: string;
    aiAssistanceLevel: 'low' | 'medium' | 'high';
    humanRefinementRatio: number;
    promptEfficiencyScore: number;
    debuggingStyle: 'hypothesis-driven' | 'trial-and-error' | 'mixed';
    errorResolutionTime: number;
    aiDependencyRatio: number;
    sessionCount: number;
    activeTime: number; // in minutes
}

export interface SkillAssessment {
    developerId: string;
    assessmentDate: string;
    promptMaturity: {
        score: number; // 0-100
        trend: 'improving' | 'stable' | 'declining';
        explanation: string;
    };
    debuggingSkill: {
        score: number; // 0-100
        style: 'hypothesis-driven' | 'trial-and-error' | 'mixed';
        trend: 'improving' | 'stable' | 'declining';
        explanation: string;
    };
    aiCollaboration: {
        score: number; // 0-100
        dependencyLevel: 'low' | 'medium' | 'high';
        refinementSkill: number; // 0-100
        explanation: string;
    };
}