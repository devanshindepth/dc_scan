import * as vscode from 'vscode';

export interface PrivacyPreferences {
    trackingEnabled: boolean;
    dataRetentionDays: number;
    syncEnabled: boolean;
    showPrivacyReminders: boolean;
    allowAnonymousUsage: boolean;
}

export class PrivacyController {
    private trackingEnabled: boolean = true;
    private statusBarItem: vscode.StatusBarItem;
    private preferences: PrivacyPreferences;
    private readonly onTrackingStateChangedEmitter = new vscode.EventEmitter<boolean>();
    public readonly onTrackingStateChanged = this.onTrackingStateChangedEmitter.event;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.preferences = this.loadPreferences();
        this.trackingEnabled = this.preferences.trackingEnabled;
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    public isTrackingEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('aiDevInsights');
        const globalEnabled = config.get<boolean>('enabled', true);
        return globalEnabled && this.trackingEnabled;
    }

    public pauseTracking(): void {
        this.trackingEnabled = false;
        this.preferences.trackingEnabled = false;
        this.savePreferences();
        this.updateStatusBar();
        this.onTrackingStateChangedEmitter.fire(false);
        console.log('AI Development Insights tracking paused');
    }

    public resumeTracking(): void {
        this.trackingEnabled = true;
        this.preferences.trackingEnabled = true;
        this.savePreferences();
        this.updateStatusBar();
        this.onTrackingStateChangedEmitter.fire(true);
        console.log('AI Development Insights tracking resumed');
    }

    public toggleTracking(): void {
        if (this.trackingEnabled) {
            this.pauseTracking();
        } else {
            this.resumeTracking();
        }
    }

    public getPreferences(): PrivacyPreferences {
        return { ...this.preferences };
    }

    public updatePreferences(newPreferences: Partial<PrivacyPreferences>): void {
        this.preferences = { ...this.preferences, ...newPreferences };
        
        // Update tracking state if it changed
        if (newPreferences.trackingEnabled !== undefined && 
            newPreferences.trackingEnabled !== this.trackingEnabled) {
            this.trackingEnabled = newPreferences.trackingEnabled;
            this.onTrackingStateChangedEmitter.fire(this.trackingEnabled);
        }
        
        this.savePreferences();
        this.updateStatusBar();
    }

    private loadPreferences(): PrivacyPreferences {
        const config = vscode.workspace.getConfiguration('aiDevInsights');
        return {
            trackingEnabled: config.get<boolean>('enabled', true),
            dataRetentionDays: config.get<number>('retentionDays', 30),
            syncEnabled: config.get<boolean>('syncEnabled', true),
            showPrivacyReminders: config.get<boolean>('showPrivacyReminders', true),
            allowAnonymousUsage: config.get<boolean>('allowAnonymousUsage', true)
        };
    }

    private savePreferences(): void {
        const config = vscode.workspace.getConfiguration('aiDevInsights');
        config.update('enabled', this.preferences.trackingEnabled, vscode.ConfigurationTarget.Global);
        config.update('retentionDays', this.preferences.dataRetentionDays, vscode.ConfigurationTarget.Global);
        config.update('syncEnabled', this.preferences.syncEnabled, vscode.ConfigurationTarget.Global);
        config.update('showPrivacyReminders', this.preferences.showPrivacyReminders, vscode.ConfigurationTarget.Global);
        config.update('allowAnonymousUsage', this.preferences.allowAnonymousUsage, vscode.ConfigurationTarget.Global);
    }

    private updateStatusBar(): void {
        const config = vscode.workspace.getConfiguration('aiDevInsights');
        const showStatusBar = config.get<boolean>('showStatusBar', true);
        
        if (!showStatusBar) {
            this.statusBarItem.hide();
            return;
        }

        if (this.isTrackingEnabled()) {
            this.statusBarItem.text = "$(eye) AI Insights";
            this.statusBarItem.tooltip = "AI Development Insights is tracking\nClick to pause • Right-click for menu";
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.command = 'aiDevInsights.statusBarMenu';
        } else {
            this.statusBarItem.text = "$(eye-closed) AI Insights";
            this.statusBarItem.tooltip = "AI Development Insights is paused\nClick to resume • Right-click for menu";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.command = 'aiDevInsights.statusBarMenu';
        }
        
        this.statusBarItem.show();
    }

    public async showStatusBarMenu(): Promise<void> {
        const items: vscode.QuickPickItem[] = [
            {
                label: `$(${this.trackingEnabled ? 'debug-pause' : 'debug-start'}) ${this.trackingEnabled ? 'Pause' : 'Resume'} Tracking`,
                description: this.trackingEnabled ? 'Stop collecting events' : 'Start collecting events',
                detail: 'Toggle event tracking'
            },
            {
                label: '$(gear) Settings',
                description: 'Open settings panel',
                detail: 'Configure all preferences in a dedicated panel'
            },
            {
                label: '$(shield) Privacy Settings',
                description: 'Quick privacy preferences',
                detail: 'Manage data collection and retention'
            },
            {
                label: '$(info) Privacy Information',
                description: 'Learn what data is collected',
                detail: 'View detailed privacy explanation'
            },
            {
                label: '$(graph) Show Insights',
                description: 'View your development insights',
                detail: 'Coming soon!'
            },
            {
                label: '$(export) Export Data',
                description: 'Download your data',
                detail: 'Export all collected events as JSON'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            title: 'AI Development Insights',
            placeHolder: 'Select an action'
        });

        if (selected) {
            if (selected.label.includes('Pause') || selected.label.includes('Resume')) {
                this.toggleTracking();
            } else if (selected.label.includes('Settings') && !selected.label.includes('Privacy')) {
                await vscode.commands.executeCommand('aiDevInsights.openSettings');
            } else if (selected.label.includes('Privacy Settings')) {
                await this.openPrivacySettings();
            } else if (selected.label.includes('Privacy Information')) {
                await this.showPrivacyExplanation();
            } else if (selected.label.includes('Show Insights')) {
                await vscode.commands.executeCommand('aiDevInsights.showInsights');
            } else if (selected.label.includes('Export Data')) {
                await vscode.commands.executeCommand('aiDevInsights.exportData');
            }
        }
    }

    public getPrivacyExplanation(): string {
        return `
AI Development Insights Privacy Protection:

✅ WHAT WE COLLECT:
- Timing metadata (when events occur)
- Event counts and frequencies
- File extension information
- Keystroke burst durations (not content)
- Paste event lengths (not content)
- AI tool invocation timing
- Error marker appearances/disappearances (not error content)

❌ WHAT WE NEVER COLLECT:
- Source code content
- AI prompts or responses
- Error messages or diagnostic content
- File names or paths
- Personal information
- Exact productivity metrics

🔒 PRIVACY FEATURES:
- All data stored locally first
- Only metadata synced to backend
- Heuristic analysis only
- Trend-based insights (not absolute measurements)
- Full user control over tracking
- Data retention policies enforced
- Export and delete capabilities

🎯 PURPOSE:
Help developers understand their AI tool usage patterns and improve their coding effectiveness through privacy-safe insights.
        `.trim();
    }

    public async showPrivacyExplanation(): Promise<void> {
        const explanation = this.getPrivacyExplanation();
        
        const action = await vscode.window.showInformationMessage(
            'AI Development Insights Privacy Information',
            { modal: true, detail: explanation },
            'OK',
            'Open Settings',
            'Export My Data'
        );

        switch (action) {
            case 'Open Settings':
                await this.openPrivacySettings();
                break;
            case 'Export My Data':
                await vscode.commands.executeCommand('aiDevInsights.exportData');
                break;
        }
    }

    public async openPrivacySettings(): Promise<void> {
        const preferences = this.getPreferences();
        
        const items: vscode.QuickPickItem[] = [
            {
                label: `$(${preferences.trackingEnabled ? 'check' : 'x'}) Tracking Enabled`,
                description: preferences.trackingEnabled ? 'Currently tracking events' : 'Tracking is paused',
                detail: 'Toggle event tracking on/off'
            },
            {
                label: `$(database) Data Retention: ${preferences.dataRetentionDays} days`,
                description: 'How long to keep local data',
                detail: 'Configure automatic data cleanup'
            },
            {
                label: `$(sync) Sync to Backend: ${preferences.syncEnabled ? 'Enabled' : 'Disabled'}`,
                description: preferences.syncEnabled ? 'Data syncs to backend' : 'Only local storage',
                detail: 'Control backend synchronization'
            },
            {
                label: `$(bell) Privacy Reminders: ${preferences.showPrivacyReminders ? 'On' : 'Off'}`,
                description: 'Show periodic privacy information',
                detail: 'Toggle privacy reminder notifications'
            },
            {
                label: `$(person) Anonymous Usage: ${preferences.allowAnonymousUsage ? 'Allowed' : 'Disabled'}`,
                description: 'Allow anonymous usage analytics',
                detail: 'Help improve the extension'
            },
            {
                label: `$(layout-statusbar) Status Bar: ${vscode.workspace.getConfiguration('aiDevInsights').get<boolean>('showStatusBar', true) ? 'Visible' : 'Hidden'}`,
                description: 'Show/hide status bar indicator',
                detail: 'Toggle status bar visibility'
            },
            {
                label: '$(info) View Privacy Details',
                description: 'Show detailed privacy information',
                detail: 'Learn what data is collected'
            },
            {
                label: '$(export) Export My Data',
                description: 'Download all collected data',
                detail: 'Export data as JSON file'
            },
            {
                label: '$(trash) Clear All Data',
                description: 'Delete all local data',
                detail: 'Permanently remove stored events'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            title: 'AI Development Insights - Privacy Settings',
            placeHolder: 'Select a privacy setting to modify'
        });

        if (selected) {
            await this.handlePrivacySettingSelection(selected.label);
        }
    }

    private async handlePrivacySettingSelection(label: string): Promise<void> {
        if (label.includes('Tracking Enabled')) {
            this.toggleTracking();
            vscode.window.showInformationMessage(
                `Tracking ${this.trackingEnabled ? 'enabled' : 'disabled'}`
            );
        } else if (label.includes('Data Retention')) {
            const days = await vscode.window.showInputBox({
                prompt: 'Enter number of days to retain data (1-365)',
                value: this.preferences.dataRetentionDays.toString(),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 365) {
                        return 'Please enter a number between 1 and 365';
                    }
                    return null;
                }
            });
            if (days) {
                this.updatePreferences({ dataRetentionDays: parseInt(days) });
                vscode.window.showInformationMessage(`Data retention set to ${days} days`);
            }
        } else if (label.includes('Sync to Backend')) {
            this.updatePreferences({ syncEnabled: !this.preferences.syncEnabled });
            vscode.window.showInformationMessage(
                `Backend sync ${this.preferences.syncEnabled ? 'enabled' : 'disabled'}`
            );
        } else if (label.includes('Privacy Reminders')) {
            this.updatePreferences({ showPrivacyReminders: !this.preferences.showPrivacyReminders });
            vscode.window.showInformationMessage(
                `Privacy reminders ${this.preferences.showPrivacyReminders ? 'enabled' : 'disabled'}`
            );
        } else if (label.includes('Anonymous Usage')) {
            this.updatePreferences({ allowAnonymousUsage: !this.preferences.allowAnonymousUsage });
            vscode.window.showInformationMessage(
                `Anonymous usage analytics ${this.preferences.allowAnonymousUsage ? 'enabled' : 'disabled'}`
            );
        } else if (label.includes('Status Bar')) {
            const config = vscode.workspace.getConfiguration('aiDevInsights');
            const currentValue = config.get<boolean>('showStatusBar', true);
            await config.update('showStatusBar', !currentValue, vscode.ConfigurationTarget.Global);
            this.updateStatusBar();
            vscode.window.showInformationMessage(
                `Status bar indicator ${!currentValue ? 'enabled' : 'disabled'}`
            );
        } else if (label.includes('View Privacy Details')) {
            await this.showPrivacyExplanation();
        } else if (label.includes('Export My Data')) {
            await vscode.commands.executeCommand('aiDevInsights.exportData');
        } else if (label.includes('Clear All Data')) {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to delete all local data? This action cannot be undone.',
                { modal: true },
                'Delete All Data',
                'Cancel'
            );
            if (confirm === 'Delete All Data') {
                await vscode.commands.executeCommand('aiDevInsights.clearData');
            }
        }
    }

    public shouldShowPrivacyReminder(): boolean {
        return this.preferences.showPrivacyReminders;
    }

    public async showPeriodicPrivacyReminder(): Promise<void> {
        if (!this.shouldShowPrivacyReminder()) {
            return;
        }

        const action = await vscode.window.showInformationMessage(
            'AI Development Insights is collecting privacy-safe metadata to help improve your coding effectiveness.',
            'Learn More',
            'Settings',
            'Don\'t Show Again'
        );

        switch (action) {
            case 'Learn More':
                await this.showPrivacyExplanation();
                break;
            case 'Settings':
                await this.openPrivacySettings();
                break;
            case 'Don\'t Show Again':
                this.updatePreferences({ showPrivacyReminders: false });
                break;
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
        this.onTrackingStateChangedEmitter.dispose();
    }
}