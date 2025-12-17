import * as vscode from 'vscode';
import { EventTracker } from './services/EventTracker';
import { LocalStorageManager } from './services/LocalStorageManager';
import { SyncManager } from './services/SyncManager';
import { HeuristicAnalyzer } from './services/HeuristicAnalyzer';
import { PrivacyController } from './services/PrivacyController';
import { SettingsWebviewProvider } from './services/SettingsWebviewProvider';

let eventTracker: EventTracker;
let localStorageManager: LocalStorageManager;
let syncManager: SyncManager;
let heuristicAnalyzer: HeuristicAnalyzer;
let privacyController: PrivacyController;
let settingsWebviewProvider: SettingsWebviewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 AI Development Insights extension is activating...');

    try {
        // Initialize services in order
        console.log('📦 Initializing LocalStorageManager...');
        localStorageManager = new LocalStorageManager(context.globalStorageUri.fsPath);
        
        console.log('🧠 Initializing HeuristicAnalyzer...');
        heuristicAnalyzer = new HeuristicAnalyzer();
        
        console.log('🔄 Initializing SyncManager...');
        syncManager = new SyncManager(localStorageManager);
        
        console.log('🔒 Initializing PrivacyController...');
        privacyController = new PrivacyController();
        
        console.log('⚙️ Initializing SettingsWebviewProvider...');
        settingsWebviewProvider = new SettingsWebviewProvider(context, privacyController, localStorageManager);
        
        console.log('📊 Initializing EventTracker...');
        eventTracker = new EventTracker(
            localStorageManager,
            heuristicAnalyzer,
            privacyController
        );

        console.log('✅ All services initialized successfully');

        // Register commands
        console.log('🎯 Registering commands...');
        const pauseCommand = vscode.commands.registerCommand('aiDevInsights.pauseTracking', () => {
            console.log('⏸️ Pause tracking command executed');
            privacyController.pauseTracking();
            vscode.window.showInformationMessage('AI Development Insights tracking paused');
        });

        const resumeCommand = vscode.commands.registerCommand('aiDevInsights.resumeTracking', () => {
            console.log('▶️ Resume tracking command executed');
            privacyController.resumeTracking();
            vscode.window.showInformationMessage('AI Development Insights tracking resumed');
        });

        const toggleCommand = vscode.commands.registerCommand('aiDevInsights.toggleTracking', () => {
            console.log('🔄 Toggle tracking command executed');
            privacyController.toggleTracking();
            const status = privacyController.isTrackingEnabled() ? 'enabled' : 'disabled';
            vscode.window.showInformationMessage(`AI Development Insights tracking ${status}`);
        });

        const showInsightsCommand = vscode.commands.registerCommand('aiDevInsights.showInsights', () => {
            console.log('📊 Show insights command executed');
            vscode.window.showInformationMessage('Insights feature coming soon!');
        });

        const exportDataCommand = vscode.commands.registerCommand('aiDevInsights.exportData', async () => {
            console.log('📤 Export data command executed');
            try {
                const data = await localStorageManager.exportData();
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file('ai-dev-insights-data.json'),
                    filters: {
                        'JSON Files': ['json']
                    }
                });
                
                if (uri) {
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
                    vscode.window.showInformationMessage('Data exported successfully');
                }
            } catch (error) {
                console.error('Export failed:', error);
                vscode.window.showErrorMessage(`Export failed: ${error}`);
            }
        });

        const clearDataCommand = vscode.commands.registerCommand('aiDevInsights.clearData', async () => {
            console.log('🗑️ Clear data command executed');
            try {
                await localStorageManager.clearAllData();
                vscode.window.showInformationMessage('All local data cleared successfully');
            } catch (error) {
                console.error('Clear data failed:', error);
                vscode.window.showErrorMessage(`Clear data failed: ${error}`);
            }
        });

        const showPrivacyInfoCommand = vscode.commands.registerCommand('aiDevInsights.showPrivacyInfo', async () => {
            console.log('🔒 Show privacy info command executed');
            await privacyController.showPrivacyExplanation();
        });

        const openPrivacySettingsCommand = vscode.commands.registerCommand('aiDevInsights.openPrivacySettings', async () => {
            console.log('⚙️ Open privacy settings command executed');
            await privacyController.openPrivacySettings();
        });

        const statusBarMenuCommand = vscode.commands.registerCommand('aiDevInsights.statusBarMenu', async () => {
            console.log('📋 Status bar menu command executed');
            await privacyController.showStatusBarMenu();
        });

        const openSettingsCommand = vscode.commands.registerCommand('aiDevInsights.openSettings', async () => {
            console.log('⚙️ Open settings command executed');
            await settingsWebviewProvider.showSettings();
        });

        console.log('🎬 Starting services...');
        
        // Initialize tracking
        console.log('📊 Initializing event tracking...');
        eventTracker.initialize();
        
        // Start sync manager
        console.log('🔄 Starting sync manager...');
        syncManager.startPeriodicSync();

        // Show initial privacy reminder if enabled
        setTimeout(async () => {
            if (privacyController.shouldShowPrivacyReminder()) {
                console.log('🔔 Showing privacy reminder...');
                await privacyController.showPeriodicPrivacyReminder();
            }
        }, 5000); // Show after 5 seconds to avoid startup noise

        // Add to subscriptions
        context.subscriptions.push(
            pauseCommand,
            resumeCommand,
            toggleCommand,
            showInsightsCommand,
            exportDataCommand,
            clearDataCommand,
            showPrivacyInfoCommand,
            openPrivacySettingsCommand,
            statusBarMenuCommand,
            openSettingsCommand,
            eventTracker,
            syncManager,
            privacyController
        );

        console.log('🎉 Extension activation completed successfully!');
        
        // Show a subtle notification that the extension is ready
        vscode.window.showInformationMessage('AI Development Insights is now active', 'Show Commands').then(selection => {
            if (selection === 'Show Commands') {
                vscode.commands.executeCommand('workbench.action.showCommands', 'AI Dev Insights');
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to activate AI Development Insights extension:', error);
        vscode.window.showErrorMessage(`AI Development Insights failed to activate: ${error}`);
        throw error;
    }
}

export function deactivate() {
    if (eventTracker) {
        eventTracker.dispose();
    }
    if (syncManager) {
        syncManager.dispose();
    }
}