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
    editDistance?: number;
    
    // Paste event metadata
    pasteLength?: number;
    timeSinceAiInvocation?: number;
    aiContributionLevel?: 'low' | 'medium' | 'high';
    
    // AI invocation metadata
    toolType?: 'copilot' | 'chat' | 'other';
    invocationContext?: 'coding' | 'debugging' | 'documentation';
    duringDebuggingSession?: boolean;
    editorPosition?: { line: number; character: number };
    
    // Debug action metadata
    actionType?: 'run' | 'debug' | 'test';
    errorCount?: number;
    debugSessionStarted?: boolean;
    debugSessionEnded?: boolean;
    sessionDuration?: number;
    debugActionsInSession?: number;
    aiInvocationsInSession?: number;
    inDebuggingSession?: boolean;
    debuggingAnalysis?: boolean;
    debuggingStyle?: 'hypothesis-driven' | 'trial-and-error' | 'mixed';
    debuggingStyleConfidence?: number;
    debuggingEfficiency?: number;
    aiDependencyRatio?: number;
    activeErrorCount?: number;
    resolvedErrorCount?: number;
    
    // Enhanced debug action metadata
    undoRedoAction?: 'undo' | 'redo';
    undoRedoCount?: number;
    totalUndoRedoActions?: number;
    undoRedoFrequency?: number;
    timeSinceLastUndoRedo?: number;
    totalRunDebugActions?: number;
    actionFrequency?: number;
    terminalName?: string;
    commandType?: string;
    hasActiveErrors?: boolean;
    
    // Enhanced file switch metadata
    fileExtension?: string;
    switchFrequency?: number;
    totalSwitchCount?: number;
    switchesPerMinute?: number;
    
    // Error marker metadata
    errorAppeared?: boolean;
    errorResolved?: boolean;
    errorCountChanged?: boolean;
    timeToResolve?: number;
    totalDiagnosticTime?: number;
    warningCount?: number;
    errorTypeCount?: number;
    resolvedErrorTypes?: number;
    timeSinceLastResolution?: number;
    errorDelta?: number;
    warningDelta?: number;
    runsPerFix?: number;
}

export interface SyncBatch {
    events: DeveloperEvent[];
    batchId: string;
    timestamp: number;
}