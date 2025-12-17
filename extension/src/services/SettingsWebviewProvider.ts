import * as vscode from 'vscode';
import { PrivacyController, PrivacyPreferences } from './PrivacyController';
import { LocalStorageManager } from './LocalStorageManager';

export class SettingsWebviewProvider {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private privacyController: PrivacyController,
        private localStorageManager: LocalStorageManager
    ) {}

    public async showSettings(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'aiDevInsightsSettings',
            'AI Development Insights - Settings',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = await this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            this.context.subscriptions
        );
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'updatePreferences':
                this.privacyController.updatePreferences(message.preferences);
                break;
            case 'exportData':
                await vscode.commands.executeCommand('aiDevInsights.exportData');
                break;
            case 'clearData':
                const confirm = await vscode.window.showWarningMessage(
                    'Are you sure you want to delete all local data? This action cannot be undone.',
                    { modal: true },
                    'Delete All Data',
                    'Cancel'
                );
                if (confirm === 'Delete All Data') {
                    await vscode.commands.executeCommand('aiDevInsights.clearData');
                    this.panel?.webview.postMessage({ command: 'dataCleared' });
                }
                break;
            case 'getStorageStats':
                const stats = await this.localStorageManager.getStorageStats();
                this.panel?.webview.postMessage({ 
                    command: 'storageStats', 
                    stats 
                });
                break;
            case 'refreshData':
                this.panel!.webview.html = await this.getWebviewContent();
                break;
        }
    }

    private async getWebviewContent(): Promise<string> {
        const preferences = this.privacyController.getPreferences();
        const config = vscode.workspace.getConfiguration('aiDevInsights');
        const stats = await this.localStorageManager.getStorageStats();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Development Insights Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background-color: var(--vscode-panel-background);
        }
        .section h2 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
        }
        .setting-label {
            flex: 1;
        }
        .setting-label h4 {
            margin: 0 0 5px 0;
            color: var(--vscode-foreground);
        }
        .setting-label p {
            margin: 0;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
        .setting-control {
            margin-left: 20px;
        }
        input[type="checkbox"] {
            transform: scale(1.2);
        }
        input[type="number"] {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 5px 10px;
            border-radius: 3px;
            width: 80px;
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .stat-card {
            background-color: var(--vscode-input-background);
            padding: 15px;
            border-radius: 4px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .stat-label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .privacy-info {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 15px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 AI Development Insights Settings</h1>
        
        <div class="section">
            <h2>📊 Data Overview</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.eventCount}</div>
                    <div class="stat-label">Total Events</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.unsyncedCount}</div>
                    <div class="stat-label">Unsynced Events</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.oldestEvent ? Math.floor((Date.now() - stats.oldestEvent) / (1000 * 60 * 60 * 24)) : 0}</div>
                    <div class="stat-label">Days of Data</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🎛️ Privacy Controls</h2>
            
            <div class="setting-item">
                <div class="setting-label">
                    <h4>Event Tracking</h4>
                    <p>Enable or disable collection of development events</p>
                </div>
                <div class="setting-control">
                    <input type="checkbox" id="trackingEnabled" ${preferences.trackingEnabled ? 'checked' : ''}>
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-label">
                    <h4>Data Retention Period</h4>
                    <p>Number of days to keep local data before automatic cleanup</p>
                </div>
                <div class="setting-control">
                    <input type="number" id="retentionDays" value="${preferences.dataRetentionDays}" min="1" max="365">
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-label">
                    <h4>Backend Synchronization</h4>
                    <p>Sync data to backend server for insights processing</p>
                </div>
                <div class="setting-control">
                    <input type="checkbox" id="syncEnabled" ${preferences.syncEnabled ? 'checked' : ''}>
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-label">
                    <h4>Privacy Reminders</h4>
                    <p>Show periodic notifications about data collection</p>
                </div>
                <div class="setting-control">
                    <input type="checkbox" id="showPrivacyReminders" ${preferences.showPrivacyReminders ? 'checked' : ''}>
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-label">
                    <h4>Anonymous Usage Analytics</h4>
                    <p>Help improve the extension by sharing anonymous usage data</p>
                </div>
                <div class="setting-control">
                    <input type="checkbox" id="allowAnonymousUsage" ${preferences.allowAnonymousUsage ? 'checked' : ''}>
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-label">
                    <h4>Status Bar Indicator</h4>
                    <p>Show tracking status in VS Code status bar</p>
                </div>
                <div class="setting-control">
                    <input type="checkbox" id="showStatusBar" ${config.get<boolean>('showStatusBar', true) ? 'checked' : ''}>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📁 Data Management</h2>
            <p>Manage your collected development insights data.</p>
            
            <button class="button" onclick="exportData()">📤 Export My Data</button>
            <button class="button secondary" onclick="clearData()">🗑️ Clear All Data</button>
            <button class="button secondary" onclick="refreshData()">🔄 Refresh</button>
        </div>

        <div class="section">
            <h2>🔒 Privacy Information</h2>
            <div class="privacy-info">
                <h4>What We Collect:</h4>
                <ul>
                    <li>Timing metadata (when events occur)</li>
                    <li>Event counts and frequencies</li>
                    <li>File extension information</li>
                    <li>Keystroke burst durations (not content)</li>
                    <li>Paste event lengths (not content)</li>
                    <li>AI tool invocation timing</li>
                </ul>
                
                <h4>What We Never Collect:</h4>
                <ul>
                    <li>Source code content</li>
                    <li>AI prompts or responses</li>
                    <li>Error messages or diagnostic content</li>
                    <li>File names or paths</li>
                    <li>Personal information</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Save preferences when settings change
        function savePreferences() {
            const preferences = {
                trackingEnabled: document.getElementById('trackingEnabled').checked,
                dataRetentionDays: parseInt(document.getElementById('retentionDays').value),
                syncEnabled: document.getElementById('syncEnabled').checked,
                showPrivacyReminders: document.getElementById('showPrivacyReminders').checked,
                allowAnonymousUsage: document.getElementById('allowAnonymousUsage').checked
            };

            vscode.postMessage({
                command: 'updatePreferences',
                preferences: preferences
            });
        }

        // Add event listeners
        document.getElementById('trackingEnabled').addEventListener('change', savePreferences);
        document.getElementById('retentionDays').addEventListener('change', savePreferences);
        document.getElementById('syncEnabled').addEventListener('change', savePreferences);
        document.getElementById('showPrivacyReminders').addEventListener('change', savePreferences);
        document.getElementById('allowAnonymousUsage').addEventListener('change', savePreferences);
        
        document.getElementById('showStatusBar').addEventListener('change', function() {
            const config = vscode.workspace.getConfiguration('aiDevInsights');
            config.update('showStatusBar', this.checked, vscode.ConfigurationTarget.Global);
        });

        function exportData() {
            vscode.postMessage({ command: 'exportData' });
        }

        function clearData() {
            vscode.postMessage({ command: 'clearData' });
        }

        function refreshData() {
            vscode.postMessage({ command: 'refreshData' });
        }

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'dataCleared':
                    refreshData();
                    break;
                case 'storageStats':
                    // Update stats display
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}