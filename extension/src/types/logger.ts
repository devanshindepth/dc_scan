export type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';

export interface LogContext {
    aiScore?: number;
    humanScore?: number;
    codeLength?: number;
    fileType?: string;
    [key: string]: any;
}

export interface LogEntry {
    id: string;
    timestamp: string; // ISO 8601
    level: LogLevel;
    message: string;
    context: LogContext;
    synced: boolean;
}

export interface ComparisonLog {
    aiCode: string;
    humanCode: string;
    aiScore: number;
    humanScore: number;
}
