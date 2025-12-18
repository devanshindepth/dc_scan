import * as vscode from 'vscode';
import { EventTracker } from './services/EventTracker';
import { LocalStorageManager } from './services/LocalStorageManager';
import { SyncManager } from './services/SyncManager';
import { HeuristicAnalyzer } from './services/HeuristicAnalyzer';
import { PrivacyController } from './services/PrivacyController';
import { SettingsWebviewProvider } from './services/SettingsWebviewProvider';
import { JsonLogger } from './services/JsonLogger';

let eventTracker: EventTracker;
let localStorageManager: LocalStorageManager;
let syncManager: SyncManager;
let heuristicAnalyzer: HeuristicAnalyzer;
let privacyController: PrivacyController;
let settingsWebviewProvider: SettingsWebviewProvider;
let jsonLogger: JsonLogger;

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

		console.log('📝 Initializing JsonLogger...');
		jsonLogger = new JsonLogger(context.globalStorageUri.fsPath);

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

		const viewLogsCommand = vscode.commands.registerCommand('aiDevInsights.viewLogs', async () => {
			console.log('📋 View logs command executed');
			try {
				const logs = await jsonLogger.getAllLogs();
				const panel = vscode.window.createWebviewPanel(
					'aiDevInsightsLogs',
					'AI Dev Insights - Logs',
					vscode.ViewColumn.One,
					{}
				);
				panel.webview.html = `
					<!DOCTYPE html>
					<html>
					<head>
						<style>
							body { font-family: var(--vscode-font-family); padding: 20px; }
							.log-entry { margin: 10px 0; padding: 10px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
							.log-header { font-weight: bold; margin-bottom: 5px; }
							.INFO { border-left: 4px solid #4CAF50; }
							.ERROR { border-left: 4px solid #f44336; }
							.WARN { border-left: 4px solid #ff9800; }
							.DEBUG { border-left: 4px solid #2196F3; }
							.synced { opacity: 0.6; }
						</style>
					</head>
					<body>
						<h1>Logs (${logs.length} entries)</h1>
						${logs.map(log => `
							<div class="log-entry ${log.level} ${log.synced ? 'synced' : ''}">
								<div class="log-header">
									[${log.level}] ${new Date(log.timestamp).toLocaleString()} ${log.synced ? '✓' : '○'}
								</div>
								<div>${log.message}</div>
								<pre>${JSON.stringify(log.context, null, 2)}</pre>
							</div>
						`).join('')}
					</body>
					</html>
				`;
			} catch (error) {
				console.error('View logs failed:', error);
				vscode.window.showErrorMessage(`Failed to view logs: ${error}`);
			}
		});

		const exportLogsCommand = vscode.commands.registerCommand('aiDevInsights.exportLogs', async () => {
			console.log('📤 Export logs command executed');
			try {
				const uri = await vscode.window.showSaveDialog({
					defaultUri: vscode.Uri.file('ai-dev-insights-logs.json'),
					filters: {
						'JSON Files': ['json']
					}
				});

				if (uri) {
					await jsonLogger.exportLogs(uri.fsPath);
					vscode.window.showInformationMessage('Logs exported successfully');
				}
			} catch (error) {
				console.error('Export logs failed:', error);
				vscode.window.showErrorMessage(`Export logs failed: ${error}`);
			}
		});

		const clearOldLogsCommand = vscode.commands.registerCommand('aiDevInsights.clearOldLogs', async () => {
			console.log('🗑️ Clear old logs command executed');
			try {
				const days = await vscode.window.showInputBox({
					prompt: 'Clear logs older than how many days?',
					value: '30',
					validateInput: (value) => {
						const num = parseInt(value);
						return isNaN(num) || num < 1 ? 'Please enter a valid number of days' : null;
					}
				});

				if (days) {
					const deleted = await jsonLogger.clearOldLogs(parseInt(days));
					vscode.window.showInformationMessage(`Cleared ${deleted} old log entries`);
				}
			} catch (error) {
				console.error('Clear old logs failed:', error);
				vscode.window.showErrorMessage(`Clear old logs failed: ${error}`);
			}
		});

		const syncLogsCommand = vscode.commands.registerCommand('aiDevInsights.syncLogs', async () => {
			console.log('🔄 Sync logs command executed');
			try {
				const unsyncedLogs = await jsonLogger.getUnsyncedLogs();
				if (unsyncedLogs.length === 0) {
					vscode.window.showInformationMessage('No unsynced logs to sync');
					return;
				}

				// TODO: Implement actual backend sync logic here
				vscode.window.showInformationMessage(`Found ${unsyncedLogs.length} unsynced logs. Backend sync not yet implemented.`);
			} catch (error) {
				console.error('Sync logs failed:', error);
				vscode.window.showErrorMessage(`Sync logs failed: ${error}`);
			}
		});

		const showLogStatsCommand = vscode.commands.registerCommand('aiDevInsights.showLogStats', async () => {
			console.log('📊 Show log stats command executed');
			try {
				const stats = await jsonLogger.getLogStats();
				const message = `
Log Statistics:
- Total Logs: ${stats.total}
- Unsynced: ${stats.unsynced}
- INFO: ${stats.byLevel.INFO}
- ERROR: ${stats.byLevel.ERROR}
- WARN: ${stats.byLevel.WARN}
- DEBUG: ${stats.byLevel.DEBUG}
				`;
				vscode.window.showInformationMessage(message);
			} catch (error) {
				console.error('Show log stats failed:', error);
				vscode.window.showErrorMessage(`Show log stats failed: ${error}`);
			}
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
			viewLogsCommand,
			exportLogsCommand,
			clearOldLogsCommand,
			syncLogsCommand,
			showLogStatsCommand,
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
