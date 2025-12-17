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
    console.log('AI Development Insights extension is now active');

    // Initialize services
    localStorageManager = new LocalStorageManager(context.globalStorageUri.fsPath);
    heuristicAnalyzer = new HeuristicAnalyzer();
    syncManager = new SyncManager(localStorageManager);
    privacyController = new PrivacyController();
    settingsWebviewProvider = new SettingsWebviewProvider(context, privacyController, localStorageManager);
    eventTracker = new EventTracker(
        localStorageManager,
        heuristicAnalyzer,
        privacyController
    );

    // Register commands
    const pauseCommand = vscode.commands.registerCommand('aiDevInsights.pauseTracking', () => {
        privacyController.pauseTracking();
        vscode.window.showInformationMessage('AI Development Insights tracking paused');
    });

    const resumeCommand = vscode.commands.registerCommand('aiDevInsights.resumeTracking', () => {
        privacyController.resumeTracking();
        vscode.window.showInformationMessage('AI Development Insights tracking resumed');
    });

    const toggleCommand = vscode.commands.registerCommand('aiDevInsights.toggleTracking', () => {
        privacyController.toggleTracking();
        const status = privacyController.isTrackingEnabled() ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`AI Development Insights tracking ${status}`);
    });

    const showInsightsCommand = vscode.commands.registerCommand('aiDevInsights.showInsights', () => {
        vscode.window.showInformationMessage('Insights feature coming soon!');
    });

    const exportDataCommand = vscode.commands.registerCommand('aiDevInsights.exportData', async () => {
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
            vscode.window.showErrorMessage(`Export failed: ${error}`);
        }
    });

    const clearDataCommand = vscode.commands.registerCommand('aiDevInsights.clearData', async () => {
        try {
            await localStorageManager.clearAllData();
            vscode.window.showInformationMessage('All local data cleared successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Clear data failed: ${error}`);
        }
    });

    const showPrivacyInfoCommand = vscode.commands.registerCommand('aiDevInsights.showPrivacyInfo', async () => {
        await privacyController.showPrivacyExplanation();
    });

    const openPrivacySettingsCommand = vscode.commands.registerCommand('aiDevInsights.openPrivacySettings', async () => {
        await privacyController.openPrivacySettings();
    });

    const statusBarMenuCommand = vscode.commands.registerCommand('aiDevInsights.statusBarMenu', async () => {
        await privacyController.showStatusBarMenu();
    });

    const openSettingsCommand = vscode.commands.registerCommand('aiDevInsights.openSettings', async () => {
        await settingsWebviewProvider.showSettings();
    });

    // Initialize tracking
    eventTracker.initialize();
    
    // Start sync manager
    syncManager.startPeriodicSync();

    // Show initial privacy reminder if enabled
    setTimeout(async () => {
        if (privacyController.shouldShowPrivacyReminder()) {
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
}

export function deactivate() {
    if (eventTracker) {
        eventTracker.dispose();
    }
    if (syncManager) {
        syncManager.dispose();
    }
}