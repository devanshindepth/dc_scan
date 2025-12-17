import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { DeveloperEvent, EventMetadata } from '../types/events';
import { LocalStorageManager } from './LocalStorageManager';
import { HeuristicAnalyzer } from './HeuristicAnalyzer';
import { PrivacyController } from './PrivacyController';

interface KeystrokeEntry {
    timestamp: number;
    count: number;
    isTyping: boolean;
}

interface ErrorMarkerState {
    uri: string;
    errorCount: number;
    warningCount: number;
    timestamp: number;
    firstErrorTime: number;
    lastResolutionTime?: number;
    errorTypes: Set<string>; // Track types of errors without content
}

interface PendingAiEdit {
    timestamp: number;
    documentUri: string;
    position: vscode.Position;
    originalLength: number;
    insertedLength: number;
}

export class EventTracker implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private sessionId: string;
    private developerId: string;
    private lastAiInvocation: number = 0;
    private keystrokeBuffer: KeystrokeEntry[] = [];
    private lastFileSwitch: number = 0;
    private errorMarkerStates: Map<string, ErrorMarkerState> = new Map();
    private undoRedoCount: number = 0;
    private lastUndoRedoTime: number = 0;
    private debugSessionActive: boolean = false;
    private debugSessionStartTime: number = 0;
    private debugActionsInSession: number = 0;
    private aiInvocationsInDebugSession: number = 0;
    private runsPerErrorFix: Map<string, number> = new Map(); // Track runs per error resolution
    private pendingAiEdits: PendingAiEdit[] = []; // Track AI edits for edit distance calculation
    private fileSwitchCount: number = 0;
    private totalUndoRedoActions: number = 0;
    private runDebugActionCount: number = 0;

    constructor(
        private localStorageManager: LocalStorageManager,
        private heuristicAnalyzer: HeuristicAnalyzer,
        private privacyController: PrivacyController
    ) {
        this.sessionId = uuidv4();
        this.developerId = this.generateDeveloperId();
    }

    public initialize(): void {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Text document change events (for keystroke burst detection and paste monitoring)
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.onTextDocumentChange.bind(this))
        );

        // Active editor change events (for file switching tracking)
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChange.bind(this))
        );

        // Diagnostic change events (for error marker tracking)
        this.disposables.push(
            vscode.languages.onDidChangeDiagnostics(this.onDiagnosticsChange.bind(this))
        );

        // Terminal events (for debug action tracking)
        this.disposables.push(
            vscode.window.onDidOpenTerminal(this.onTerminalOpen.bind(this))
        );

        // Command execution events (for run/debug/test actions)
        this.disposables.push(
            vscode.commands.registerCommand('aiDevInsights.trackCommand', this.onCommandExecution.bind(this))
        );

        // Track undo/redo operations
        this.disposables.push(
            vscode.commands.registerCommand('undo', this.onUndoCommand.bind(this)),
            vscode.commands.registerCommand('redo', this.onRedoCommand.bind(this))
        );

        // Set up periodic keystroke burst processing
        const keystrokeTimer = setInterval(() => {
            this.processKeystrokeBuffer();
        }, 2000); // Process every 2 seconds

        // Set up periodic debugging session analysis
        const debugAnalysisTimer = setInterval(() => {
            this.analyzeCurrentDebuggingSession();
        }, 60000); // Analyze every minute

        this.disposables.push({
            dispose: () => {
                clearInterval(keystrokeTimer);
                clearInterval(debugAnalysisTimer);
            }
        });

        // AI tool integration listeners
        this.setupAiToolListeners();
    }

    private async onTextDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        const now = Date.now();
        const documentUri = event.document.uri.toString();
        
        // Process each content change
        for (const change of event.contentChanges) {
            const changeLength = change.text.length;
            const deletedLength = change.rangeLength;
            
            // Calculate edit distance for AI-related changes
            const editDistance = await this.calculateEditDistanceForChange(
                documentUri, change, now
            );
            
            // Detect paste events (large single insertions)
            if (changeLength > 50 && deletedLength === 0) {
                await this.recordPasteEvent(changeLength, now, editDistance);
            } 
            // Detect large deletions (could be AI content being removed)
            else if (deletedLength > 50 && changeLength === 0) {
                await this.recordEvent('paste', {
                    pasteLength: -deletedLength, // Negative indicates deletion
                    timeSinceAiInvocation: now - this.lastAiInvocation < 30000 ? now - this.lastAiInvocation : undefined,
                    editDistance
                });
            }
            // Track regular typing for keystroke burst detection
            else if (changeLength > 0 && changeLength <= 50) {
                this.trackKeystrokeBurst(changeLength, now, true);
                
                // Track edit distance for small changes too if they're after AI invocation
                if (editDistance > 0) {
                    await this.recordEvent('keystroke_burst', {
                        characterCount: changeLength,
                        editDistance,
                        timeSinceAiInvocation: now - this.lastAiInvocation
                    });
                }
            }
            // Track deletions for keystroke burst detection
            else if (deletedLength > 0 && deletedLength <= 50) {
                this.trackKeystrokeBurst(deletedLength, now, false);
                
                // Track edit distance for deletions too if they're after AI invocation
                if (editDistance > 0) {
                    await this.recordEvent('keystroke_burst', {
                        characterCount: -deletedLength,
                        editDistance,
                        timeSinceAiInvocation: now - this.lastAiInvocation
                    });
                }
            }
        }
    }

    private async onActiveEditorChange(editor: vscode.TextEditor | undefined): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        const now = Date.now();
        
        if (editor) {
            this.fileSwitchCount++;
            const fileExtension = editor.document.fileName.split('.').pop() || '';
            const timeSinceLastSwitch = this.lastFileSwitch > 0 ? now - this.lastFileSwitch : 0;
            
            // Calculate switch frequency (switches per minute over last 5 minutes)
            const switchFrequency = this.calculateFileSwitchFrequency(now);

            await this.recordEvent('file_switch', {
                fileExtension,
                switchFrequency: timeSinceLastSwitch,
                totalSwitchCount: this.fileSwitchCount,
                switchesPerMinute: switchFrequency,
                inDebuggingSession: this.debugSessionActive
            });

            this.lastFileSwitch = now;
        }
    }

    private async onDiagnosticsChange(event: vscode.DiagnosticChangeEvent): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        const now = Date.now();

        // Track error marker appearances and disappearances
        for (const uri of event.uris) {
            const uriString = uri.toString();
            const diagnostics = vscode.languages.getDiagnostics(uri);
            
            // Separate errors and warnings
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
            const currentErrorCount = errors.length;
            const currentWarningCount = warnings.length;
            
            // Extract error types without content (privacy-safe)
            const errorTypes = new Set<string>();
            errors.forEach(error => {
                // Use error source and code as type identifier, not the message
                const errorType = `${error.source || 'unknown'}:${error.code || 'generic'}`;
                errorTypes.add(errorType);
            });
            
            const previousState = this.errorMarkerStates.get(uriString);
            
            if (!previousState) {
                // First time seeing this file
                if (currentErrorCount > 0 || currentWarningCount > 0) {
                    await this.recordEvent('error_marker', {
                        errorAppeared: currentErrorCount > 0,
                        errorCount: currentErrorCount,
                        warningCount: currentWarningCount,
                        errorTypeCount: errorTypes.size
                    });
                    
                    this.errorMarkerStates.set(uriString, {
                        uri: uriString,
                        errorCount: currentErrorCount,
                        warningCount: currentWarningCount,
                        timestamp: now,
                        firstErrorTime: currentErrorCount > 0 ? now : 0,
                        errorTypes
                    });
                }
            } else {
                // File was tracked before
                const errorCountChanged = previousState.errorCount !== currentErrorCount;
                const warningCountChanged = previousState.warningCount !== currentWarningCount;
                
                if (previousState.errorCount > 0 && currentErrorCount === 0) {
                    // All errors were resolved
                    const timeToResolve = now - previousState.firstErrorTime;
                    const totalDiagnosticTime = now - previousState.timestamp;
                    
                    // Calculate runs per fix for this error resolution
                    const runsForThisError = this.runsPerErrorFix.get(uriString) || 0;
                    
                    await this.recordEvent('error_marker', {
                        errorResolved: true,
                        timeToResolve,
                        totalDiagnosticTime,
                        errorCount: 0,
                        warningCount: currentWarningCount,
                        resolvedErrorTypes: previousState.errorTypes.size,
                        runsPerFix: runsForThisError
                    });
                    
                    // Reset runs counter for this file
                    this.runsPerErrorFix.delete(uriString);
                    
                    // Update resolution time
                    previousState.lastResolutionTime = now;
                } else if (previousState.errorCount === 0 && currentErrorCount > 0) {
                    // New errors appeared
                    await this.recordEvent('error_marker', {
                        errorAppeared: true,
                        errorCount: currentErrorCount,
                        warningCount: currentWarningCount,
                        errorTypeCount: errorTypes.size,
                        timeSinceLastResolution: previousState.lastResolutionTime ? 
                            now - previousState.lastResolutionTime : undefined
                    });
                    
                    // Reset runs counter for new error session
                    this.runsPerErrorFix.set(uriString, 0);
                    
                    // Update first error time for new error session
                    previousState.firstErrorTime = now;
                } else if (errorCountChanged || warningCountChanged) {
                    // Error/warning count changed but not resolved completely
                    await this.recordEvent('error_marker', {
                        errorCountChanged: errorCountChanged,
                        errorCount: currentErrorCount,
                        warningCount: currentWarningCount,
                        errorTypeCount: errorTypes.size,
                        errorDelta: currentErrorCount - previousState.errorCount,
                        warningDelta: currentWarningCount - previousState.warningCount
                    });
                }
                
                // Update state
                this.errorMarkerStates.set(uriString, {
                    uri: uriString,
                    errorCount: currentErrorCount,
                    warningCount: currentWarningCount,
                    timestamp: now,
                    firstErrorTime: currentErrorCount > 0 ? 
                        (previousState.errorCount === 0 ? now : previousState.firstErrorTime) : 0,
                    lastResolutionTime: currentErrorCount === 0 && previousState.errorCount > 0 ? 
                        now : previousState.lastResolutionTime,
                    errorTypes
                });
            }
        }

        // Check for debugging session state changes after processing all diagnostics
        await this.checkForDebuggingSessionStart();
        await this.checkForDebuggingSessionEnd();
    }

    private async onTerminalOpen(terminal: vscode.Terminal): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        // Detect debug/run actions based on terminal name
        const terminalName = terminal.name.toLowerCase();
        let actionType: 'run' | 'debug' | 'test' = 'run';

        if (terminalName.includes('debug')) {
            actionType = 'debug';
        } else if (terminalName.includes('test')) {
            actionType = 'test';
        }

        // Track debug actions in session
        if (this.debugSessionActive) {
            this.debugActionsInSession++;
        }

        // Track runs per error fix
        if (actionType === 'run') {
            this.trackRunForErrorFix();
            this.runDebugActionCount++;
        }

        // Calculate run/debug action frequency
        const actionFrequency = this.calculateRunDebugFrequency();

        await this.recordEvent('debug_action', {
            actionType,
            inDebuggingSession: this.debugSessionActive,
            totalRunDebugActions: this.runDebugActionCount,
            actionFrequency,
            terminalName: terminalName.substring(0, 20), // Limit length for privacy
            hasActiveErrors: this.hasActiveErrors(),
            aiInvocationsInSession: this.aiInvocationsInDebugSession
        });

        // Check if this should start a debugging session
        await this.checkForDebuggingSessionStart();
    }

    private async onCommandExecution(command: string): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        // Track common debug/run/test commands
        let actionType: 'run' | 'debug' | 'test' | undefined;
        
        const lowerCommand = command.toLowerCase();
        if (lowerCommand.includes('debug') || lowerCommand.includes('launch')) {
            actionType = 'debug';
        } else if (lowerCommand.includes('test')) {
            actionType = 'test';
        } else if (lowerCommand.includes('run') || lowerCommand.includes('start')) {
            actionType = 'run';
        }

        if (actionType) {
            // Track debug actions in session
            if (this.debugSessionActive) {
                this.debugActionsInSession++;
            }

            // Track runs per error fix
            if (actionType === 'run') {
                this.trackRunForErrorFix();
                this.runDebugActionCount++;
            }

            // Calculate run/debug action frequency
            const actionFrequency = this.calculateRunDebugFrequency();

            await this.recordEvent('debug_action', {
                actionType,
                inDebuggingSession: this.debugSessionActive,
                totalRunDebugActions: this.runDebugActionCount,
                actionFrequency,
                commandType: lowerCommand.substring(0, 20), // Limit length for privacy
                hasActiveErrors: this.hasActiveErrors(),
                aiInvocationsInSession: this.aiInvocationsInDebugSession
            });

            // Check if this should start a debugging session
            await this.checkForDebuggingSessionStart();
        }
    }

    private async onUndoCommand(): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        const now = Date.now();
        this.undoRedoCount++;
        this.totalUndoRedoActions++;
        this.lastUndoRedoTime = now;
        
        // Calculate undo/redo frequency (actions per minute over last 5 minutes)
        const undoRedoFrequency = this.calculateUndoRedoFrequency(now);
        
        // Record undo action with enhanced metadata
        await this.recordEvent('debug_action', {
            actionType: 'run',
            undoRedoAction: 'undo',
            undoRedoCount: this.undoRedoCount,
            totalUndoRedoActions: this.totalUndoRedoActions,
            undoRedoFrequency,
            timeSinceLastUndoRedo: this.lastUndoRedoTime > 0 ? now - this.lastUndoRedoTime : 0,
            inDebuggingSession: this.debugSessionActive
        });
    }

    private async onRedoCommand(): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        const now = Date.now();
        this.undoRedoCount++;
        this.totalUndoRedoActions++;
        this.lastUndoRedoTime = now;
        
        // Calculate undo/redo frequency (actions per minute over last 5 minutes)
        const undoRedoFrequency = this.calculateUndoRedoFrequency(now);
        
        // Record redo action with enhanced metadata
        await this.recordEvent('debug_action', {
            actionType: 'run',
            undoRedoAction: 'redo',
            undoRedoCount: this.undoRedoCount,
            totalUndoRedoActions: this.totalUndoRedoActions,
            undoRedoFrequency,
            timeSinceLastUndoRedo: this.lastUndoRedoTime > 0 ? now - this.lastUndoRedoTime : 0,
            inDebuggingSession: this.debugSessionActive
        });
    }

    private trackKeystrokeBurst(characterCount: number, timestamp: number, isTyping: boolean): void {
        this.keystrokeBuffer.push({ 
            timestamp, 
            count: characterCount, 
            isTyping 
        });
        
        // Clean old entries (older than 5 seconds)
        const cutoff = timestamp - 5000;
        this.keystrokeBuffer = this.keystrokeBuffer.filter(entry => entry.timestamp > cutoff);
    }

    private async processKeystrokeBuffer(): Promise<void> {
        if (this.keystrokeBuffer.length === 0) {
            return;
        }

        const now = Date.now();
        const recentEntries = this.keystrokeBuffer.filter(entry => now - entry.timestamp < 5000);
        
        if (recentEntries.length >= 5) { // Minimum threshold for a burst
            const totalChars = recentEntries.reduce((sum, entry) => sum + entry.count, 0);
            const duration = recentEntries[recentEntries.length - 1].timestamp - recentEntries[0].timestamp;
            const typingEntries = recentEntries.filter(entry => entry.isTyping);
            
            // Only record if there's sustained typing activity
            if (typingEntries.length >= 3 && duration > 1000) {
                await this.recordEvent('keystroke_burst', {
                    burstDuration: duration,
                    characterCount: totalChars
                });
                
                // Clear processed entries
                this.keystrokeBuffer = this.keystrokeBuffer.filter(entry => 
                    !recentEntries.includes(entry)
                );
            }
        }
    }

    private async recordPasteEvent(pasteLength: number, timestamp: number, editDistance?: number): Promise<void> {
        const timeSinceAiInvocation = timestamp - this.lastAiInvocation;
        
        // Correlate with AI invocation if recent
        let aiContributionLevel: 'low' | 'medium' | 'high' | undefined;
        if (timeSinceAiInvocation < 30000) { // Within 30 seconds
            aiContributionLevel = await this.correlateAiContribution(pasteLength, timeSinceAiInvocation);
        }
        
        await this.recordEvent('paste', {
            pasteLength,
            timeSinceAiInvocation: timeSinceAiInvocation < 30000 ? timeSinceAiInvocation : undefined,
            editDistance: editDistance || 0,
            // Add AI contribution level to metadata without exposing content
            ...(aiContributionLevel && { aiContributionLevel })
        });
    }

    private setupAiToolListeners(): void {
        // Try to detect GitHub Copilot extension
        this.setupCopilotListeners();
        
        // Try to detect VS Code Chat API usage
        this.setupChatApiListeners();
        
        // Monitor for other AI tool extensions
        this.setupGenericAiToolListeners();
    }

    private setupCopilotListeners(): void {
        try {
            // Check if GitHub Copilot extension is installed
            const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
            
            if (copilotExtension) {
                // Monitor for Copilot-related commands
                const copilotCommands = [
                    'github.copilot.generate',
                    'github.copilot.acceptCursorPanelSolution',
                    'github.copilot.acceptPanelSolution',
                    'github.copilot.openPanel',
                    'github.copilot.toggleCopilot'
                ];

                copilotCommands.forEach(command => {
                    this.disposables.push(
                        vscode.commands.registerCommand(`aiDevInsights.track.${command}`, () => {
                            this.recordAiInvocation('copilot', this.determineContext());
                        })
                    );
                });

                // Try to intercept Copilot completions by monitoring text changes after short delays
                this.setupCopilotCompletionDetection();
            }
        } catch (error) {
            console.log('Copilot integration setup failed:', error);
        }
    }

    private setupChatApiListeners(): void {
        try {
            // Monitor for chat-related commands
            const chatCommands = [
                'workbench.action.chat.open',
                'workbench.action.chat.openInSidebar',
                'workbench.action.quickchat.toggle',
                'workbench.action.chat.openEditSession'
            ];

            chatCommands.forEach(command => {
                this.disposables.push(
                    vscode.commands.registerCommand(`aiDevInsights.track.${command}`, () => {
                        this.recordAiInvocation('chat', this.determineContext());
                    })
                );
            });
        } catch (error) {
            console.log('Chat API integration setup failed:', error);
        }
    }

    private setupGenericAiToolListeners(): void {
        // Monitor for other AI-related extensions and commands
        const aiRelatedCommands = [
            'codeium',
            'tabnine',
            'aicommits',
            'continue',
            'cursor'
        ];

        // Check for AI-related extensions
        const extensions = vscode.extensions.all;
        extensions.forEach(extension => {
            const extensionId = extension.id.toLowerCase();
            const isAiTool = aiRelatedCommands.some(tool => extensionId.includes(tool));
            
            if (isAiTool && extension.isActive) {
                // Set up generic monitoring for this AI tool
                this.monitorAiToolExtension(extension.id);
            }
        });
    }

    private setupCopilotCompletionDetection(): void {
        let lastChangeTime = 0;
        let pendingCompletionCheck: NodeJS.Timeout | undefined;

        // Enhanced text change monitoring for Copilot detection
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (!this.privacyController.isTrackingEnabled()) {
                    return;
                }

                const now = Date.now();
                lastChangeTime = now;

                // Clear any pending check
                if (pendingCompletionCheck) {
                    clearTimeout(pendingCompletionCheck);
                }

                // Check for potential Copilot completion after a short delay
                pendingCompletionCheck = setTimeout(() => {
                    this.checkForCopilotCompletion(event, lastChangeTime);
                }, 100);
            })
        );
    }

    private async checkForCopilotCompletion(event: vscode.TextDocumentChangeEvent, changeTime: number): Promise<void> {
        // Heuristic: Large single insertions that happen quickly might be Copilot
        for (const change of event.contentChanges) {
            if (change.text.length > 20 && change.rangeLength === 0) {
                // Check if this looks like a code completion (contains keywords, proper formatting)
                if (this.looksLikeCodeCompletion(change.text)) {
                    await this.recordAiInvocation('copilot', this.determineContext());
                    break;
                }
            }
        }
    }

    private looksLikeCodeCompletion(text: string): boolean {
        // Simple heuristics to identify AI-generated code
        const codePatterns = [
            /function\s+\w+\s*\(/,
            /const\s+\w+\s*=/,
            /if\s*\([^)]+\)\s*{/,
            /for\s*\([^)]+\)\s*{/,
            /class\s+\w+/,
            /import\s+.*from/,
            /\/\*\*[\s\S]*\*\//  // JSDoc comments
        ];

        return codePatterns.some(pattern => pattern.test(text)) && 
               text.includes('\n') && // Multi-line
               text.length > 50; // Substantial content
    }

    private monitorAiToolExtension(extensionId: string): void {
        // Generic monitoring for AI tool extensions
        console.log(`Monitoring AI tool extension: ${extensionId}`);
        
        // This is a placeholder for more specific integration
        // Each AI tool would need custom integration based on their APIs
    }

    private determineContext(): 'coding' | 'debugging' | 'documentation' {
        // Determine context based on current editor state and recent actions
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor) {
            return 'coding';
        }

        const document = activeEditor.document;
        const fileName = document.fileName.toLowerCase();
        
        // Check if we're in a documentation file
        if (fileName.includes('readme') || fileName.includes('doc') || 
            fileName.endsWith('.md') || fileName.endsWith('.txt')) {
            return 'documentation';
        }

        // Check if there are recent error markers (indicating debugging)
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const hasErrors = diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error);
        
        if (hasErrors || this.undoRedoCount > 3) {
            return 'debugging';
        }

        return 'coding';
    }

    public async recordAiInvocation(toolType: 'copilot' | 'chat' | 'other', context: 'coding' | 'debugging' | 'documentation'): Promise<void> {
        if (!this.privacyController.isTrackingEnabled()) {
            return;
        }

        this.lastAiInvocation = Date.now();
        
        // Count AI invocations during debugging sessions
        if (this.debugSessionActive) {
            this.aiInvocationsInDebugSession++;
        }
        
        // Track current editor position for edit distance calculation
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const position = activeEditor.selection.active;
            this.pendingAiEdits.push({
                timestamp: this.lastAiInvocation,
                documentUri: activeEditor.document.uri.toString(),
                position,
                originalLength: 0, // Will be updated when edit occurs
                insertedLength: 0  // Will be updated when edit occurs
            });
            
            // Clean old pending edits (older than 2 minutes)
            const cutoff = this.lastAiInvocation - 120000;
            this.pendingAiEdits = this.pendingAiEdits.filter(edit => edit.timestamp > cutoff);
        }
        
        await this.recordEvent('ai_invocation', {
            toolType,
            invocationContext: context,
            duringDebuggingSession: this.debugSessionActive,
            editorPosition: activeEditor ? {
                line: activeEditor.selection.active.line,
                character: activeEditor.selection.active.character
            } : undefined
        });
    }

    public async correlateAiContribution(pasteLength: number, timeSinceInvocation: number): Promise<'low' | 'medium' | 'high'> {
        // Correlation logic to estimate AI contribution level
        let contributionLevel: 'low' | 'medium' | 'high' = 'low';

        // Time-based correlation (closer to AI invocation = higher likelihood)
        if (timeSinceInvocation < 5000) { // Within 5 seconds
            if (pasteLength > 200) {
                contributionLevel = 'high';
            } else if (pasteLength > 50) {
                contributionLevel = 'medium';
            }
        } else if (timeSinceInvocation < 15000) { // Within 15 seconds
            if (pasteLength > 100) {
                contributionLevel = 'medium';
            }
        }

        // Record the correlation for analysis
        await this.recordEvent('ai_invocation', {
            toolType: 'other', // Generic correlation event
            invocationContext: 'coding',
            // Store correlation metadata in a way that doesn't expose content
            pasteLength,
            timeSinceAiInvocation: timeSinceInvocation
        });

        return contributionLevel;
    }

    private async recordEvent(eventType: DeveloperEvent['eventType'], metadata: EventMetadata): Promise<void> {
        const event: DeveloperEvent = {
            id: uuidv4(),
            developerId: this.developerId,
            timestamp: Date.now(),
            eventType,
            metadata,
            sessionId: this.sessionId
        };

        await this.localStorageManager.storeEvent(event);
    }

    private generateDeveloperId(): string {
        // Generate a consistent but anonymous developer ID
        // This could be based on machine ID or workspace hash
        return uuidv4();
    }

    private async startDebuggingSession(): Promise<void> {
        if (this.debugSessionActive) {
            return; // Already in a debugging session
        }

        const now = Date.now();
        this.debugSessionActive = true;
        this.debugSessionStartTime = now;
        this.debugActionsInSession = 0;
        this.aiInvocationsInDebugSession = 0;

        await this.recordEvent('debug_action', {
            actionType: 'debug',
            debugSessionStarted: true
        });
    }

    private async endDebuggingSession(): Promise<void> {
        if (!this.debugSessionActive) {
            return; // No active debugging session
        }

        const now = Date.now();
        const sessionDuration = now - this.debugSessionStartTime;
        
        await this.recordEvent('debug_action', {
            actionType: 'debug',
            debugSessionEnded: true,
            sessionDuration,
            debugActionsInSession: this.debugActionsInSession,
            aiInvocationsInSession: this.aiInvocationsInDebugSession
        });

        this.debugSessionActive = false;
        this.debugSessionStartTime = 0;
        this.debugActionsInSession = 0;
        this.aiInvocationsInDebugSession = 0;
    }

    private async checkForDebuggingSessionStart(): Promise<void> {
        // Start debugging session if we have errors and recent debug actions
        const hasActiveErrors = Array.from(this.errorMarkerStates.values())
            .some(state => state.errorCount > 0);
        
        const recentDebugActions = this.debugActionsInSession > 0 || this.undoRedoCount > 2;
        
        if (hasActiveErrors && recentDebugActions && !this.debugSessionActive) {
            await this.startDebuggingSession();
        }
    }

    private async checkForDebuggingSessionEnd(): Promise<void> {
        // End debugging session if no errors remain and some time has passed
        const hasActiveErrors = Array.from(this.errorMarkerStates.values())
            .some(state => state.errorCount > 0);
        
        const now = Date.now();
        const sessionRunningLongEnough = now - this.debugSessionStartTime > 30000; // 30 seconds
        
        if (!hasActiveErrors && sessionRunningLongEnough && this.debugSessionActive) {
            await this.endDebuggingSession();
        }
    }

    private async analyzeCurrentDebuggingSession(): Promise<void> {
        if (!this.debugSessionActive) {
            return;
        }

        const now = Date.now();
        const sessionDuration = now - this.debugSessionStartTime;
        
        // Get recent events for analysis
        const recentEvents = await this.getRecentEvents(this.debugSessionStartTime);
        const debuggingStyle = this.heuristicAnalyzer.analyzeDebuggingStyle(recentEvents);
        
        // Calculate debugging efficiency metrics
        const errorStates = Array.from(this.errorMarkerStates.values());
        const activeErrors = errorStates.filter(state => state.errorCount > 0);
        const resolvedErrors = errorStates.filter(state => 
            state.lastResolutionTime && state.lastResolutionTime > this.debugSessionStartTime
        );

        const debuggingEfficiency = resolvedErrors.length / Math.max(1, activeErrors.length + resolvedErrors.length);
        const aiDependencyRatio = this.aiInvocationsInDebugSession / Math.max(1, this.debugActionsInSession);

        await this.recordEvent('debug_action', {
            actionType: 'debug',
            debuggingAnalysis: true,
            sessionDuration,
            debuggingStyle: debuggingStyle.style,
            debuggingStyleConfidence: debuggingStyle.confidence,
            debuggingEfficiency,
            aiDependencyRatio,
            activeErrorCount: activeErrors.length,
            resolvedErrorCount: resolvedErrors.length
        });
    }

    private trackRunForErrorFix(): void {
        // Increment run counter for all files that currently have errors
        for (const [uriString, state] of this.errorMarkerStates.entries()) {
            if (state.errorCount > 0) {
                const currentRuns = this.runsPerErrorFix.get(uriString) || 0;
                this.runsPerErrorFix.set(uriString, currentRuns + 1);
            }
        }
    }

    private async getRecentEvents(since: number): Promise<DeveloperEvent[]> {
        // This would typically fetch from local storage
        // For now, we'll return an empty array as a placeholder
        // In a real implementation, this would query the LocalStorageManager
        return [];
    }

    private calculateFileSwitchFrequency(currentTime: number): number {
        // Calculate file switches per minute over the last 5 minutes
        const fiveMinutesAgo = currentTime - 300000; // 5 minutes in milliseconds
        const recentSwitches = this.fileSwitchCount; // Simplified - in real implementation would filter by time
        return Math.round((recentSwitches / 5) * 10) / 10; // Switches per minute, rounded to 1 decimal
    }

    private calculateUndoRedoFrequency(currentTime: number): number {
        // Calculate undo/redo actions per minute over the last 5 minutes
        const fiveMinutesAgo = currentTime - 300000; // 5 minutes in milliseconds
        const recentActions = this.totalUndoRedoActions; // Simplified - in real implementation would filter by time
        return Math.round((recentActions / 5) * 10) / 10; // Actions per minute, rounded to 1 decimal
    }

    private calculateRunDebugFrequency(): number {
        // Calculate run/debug actions per session
        const sessionDuration = this.debugSessionActive ? 
            (Date.now() - this.debugSessionStartTime) / 60000 : 1; // Convert to minutes
        return Math.round((this.runDebugActionCount / Math.max(sessionDuration, 1)) * 10) / 10;
    }

    private hasActiveErrors(): boolean {
        return Array.from(this.errorMarkerStates.values()).some(state => state.errorCount > 0);
    }

    private async calculateEditDistanceForChange(
        documentUri: string, 
        change: vscode.TextDocumentContentChangeEvent, 
        timestamp: number
    ): Promise<number> {
        // Find matching pending AI edit
        const matchingEdit = this.pendingAiEdits.find(edit => 
            edit.documentUri === documentUri && 
            timestamp - edit.timestamp < 30000 && // Within 30 seconds
            this.isPositionNear(edit.position, change.range.start)
        );

        if (!matchingEdit) {
            return 0; // No AI edit to compare against
        }

        // Calculate simple edit distance based on change characteristics
        const insertedLength = change.text.length;
        const deletedLength = change.rangeLength;
        
        // Update the pending edit with actual change data
        matchingEdit.insertedLength = insertedLength;
        matchingEdit.originalLength = deletedLength;

        // Simple edit distance calculation (Levenshtein-like)
        // This is a heuristic since we don't have the original content
        const editDistance = Math.abs(insertedLength - deletedLength) + 
                           Math.min(insertedLength, deletedLength);

        // Remove the processed edit
        const editIndex = this.pendingAiEdits.indexOf(matchingEdit);
        if (editIndex > -1) {
            this.pendingAiEdits.splice(editIndex, 1);
        }

        return editDistance;
    }

    private isPositionNear(pos1: vscode.Position, pos2: vscode.Position): boolean {
        // Consider positions "near" if they're within 5 lines and 50 characters
        return Math.abs(pos1.line - pos2.line) <= 5 && 
               Math.abs(pos1.character - pos2.character) <= 50;
    }

    public dispose(): void {
        // End any active debugging session before disposing
        if (this.debugSessionActive) {
            this.endDebuggingSession();
        }
        
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}