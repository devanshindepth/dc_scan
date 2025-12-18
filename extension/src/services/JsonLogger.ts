import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LogEntry, LogLevel, LogContext, ComparisonLog } from '../types/logger';

export class JsonLogger {
    private logFilePath: string;
    private tempFilePath: string;
    private backupDir: string;
    private isWriting: boolean = false;
    private writeQueue: Array<() => Promise<void>> = [];
    private readonly MAX_BACKUPS = 5;

    constructor(private storagePath: string) {
        this.logFilePath = path.join(storagePath, 'logs.json');
        this.tempFilePath = path.join(storagePath, 'logs.tmp.json');
        this.backupDir = path.join(storagePath, 'backups');
        this.ensureDirectories();
    }

    private ensureDirectories(): void {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
        if (!fs.existsSync(this.logFilePath)) {
            fs.writeFileSync(this.logFilePath, JSON.stringify([], null, 2), 'utf-8');
        }
    }

    private async readLogs(): Promise<LogEntry[]> {
        try {
            const content = fs.readFileSync(this.logFilePath, 'utf-8');
            return JSON.parse(content) as LogEntry[];
        } catch (error) {
            console.error('Failed to read logs:', error);
            return [];
        }
    }

    private async writeLogs(logs: LogEntry[]): Promise<void> {
        // Add to queue if already writing
        if (this.isWriting) {
            return new Promise((resolve, reject) => {
                this.writeQueue.push(async () => {
                    try {
                        await this.performWrite(logs);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }

        await this.performWrite(logs);
        await this.processQueue();
    }

    private async performWrite(logs: LogEntry[]): Promise<void> {
        this.isWriting = true;

        try {
            // Create backup before writing
            if (fs.existsSync(this.logFilePath)) {
                await this.createBackup();
            }

            // Write to temp file first (atomic write)
            const content = JSON.stringify(logs, null, 2);
            fs.writeFileSync(this.tempFilePath, content, 'utf-8');

            // Rename temp file to actual file (atomic operation)
            fs.renameSync(this.tempFilePath, this.logFilePath);

            // Rotate backups
            await this.rotateBackups();
        } finally {
            this.isWriting = false;
        }
    }

    private async processQueue(): Promise<void> {
        while (this.writeQueue.length > 0) {
            const task = this.writeQueue.shift();
            if (task) {
                await task();
            }
        }
    }

    private async createBackup(): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `logs-${timestamp}.json`);
        fs.copyFileSync(this.logFilePath, backupPath);
    }

    private async rotateBackups(): Promise<void> {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('logs-') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    mtime: fs.statSync(path.join(this.backupDir, file)).mtime
                }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            // Keep only the latest MAX_BACKUPS
            if (backups.length > this.MAX_BACKUPS) {
                const toDelete = backups.slice(this.MAX_BACKUPS);
                toDelete.forEach(backup => {
                    fs.unlinkSync(backup.path);
                });
            }
        } catch (error) {
            console.error('Failed to rotate backups:', error);
        }
    }

    public async log(level: LogLevel, message: string, context: LogContext = {}): Promise<void> {
        const entry: LogEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            synced: false
        };

        const logs = await this.readLogs();
        logs.push(entry);
        await this.writeLogs(logs);
    }

    public async logComparison(aiCode: string, humanCode: string, aiScore: number, humanScore: number): Promise<void> {
        const context: LogContext = {
            aiScore,
            humanScore,
            codeLength: humanCode.length,
            aiCodeLength: aiCode.length,
            comparison: true
        };

        await this.log('INFO', 'Code comparison logged', context);
    }

    public async getUnsyncedLogs(): Promise<LogEntry[]> {
        const logs = await this.readLogs();
        return logs.filter(log => !log.synced);
    }

    public async markAsSynced(logIds: string[]): Promise<void> {
        const logs = await this.readLogs();
        const updatedLogs = logs.map(log => {
            if (logIds.includes(log.id)) {
                return { ...log, synced: true };
            }
            return log;
        });
        await this.writeLogs(updatedLogs);
    }

    public async clearOldLogs(olderThanDays: number): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const logs = await this.readLogs();
        const initialCount = logs.length;

        const filteredLogs = logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= cutoffDate;
        });

        await this.writeLogs(filteredLogs);
        return initialCount - filteredLogs.length;
    }

    public async getAllLogs(): Promise<LogEntry[]> {
        return await this.readLogs();
    }

    public async getLogStats(): Promise<{
        total: number;
        unsynced: number;
        byLevel: Record<LogLevel, number>;
    }> {
        const logs = await this.readLogs();
        const stats = {
            total: logs.length,
            unsynced: logs.filter(log => !log.synced).length,
            byLevel: {
                INFO: 0,
                ERROR: 0,
                WARN: 0,
                DEBUG: 0
            } as Record<LogLevel, number>
        };

        logs.forEach(log => {
            stats.byLevel[log.level]++;
        });

        return stats;
    }

    public async exportLogs(filePath: string): Promise<void> {
        const logs = await this.readLogs();
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
    }

    public async clearAllLogs(): Promise<void> {
        await this.writeLogs([]);
    }

    public dispose(): void {
        // Clean up temp file if it exists
        if (fs.existsSync(this.tempFilePath)) {
            fs.unlinkSync(this.tempFilePath);
        }
    }
}
