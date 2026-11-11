import crypto from 'crypto';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface StructuredLog {
  id: string;
  requestId?: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, any>;
}

class LoggerService {
  private logs: StructuredLog[] = [];
  private readonly maxLogs = 500;

  /**
   * Sensitive keywords that must NEVER appear in plain text in logs
   */
  private sensitivePatterns = [
    /api[-_]?key/i,
    /secret/i,
    /password/i,
    /otp/i,
    /pin/i,
    /authorization/i,
    /token/i,
    /card[-_]?number/i,
    /cvv/i,
    /bank[-_]?account/i,
  ];

  /**
   * Recursively sanitize any sensitive fields from logging context
   */
  public sanitize(data: any): any {
    if (!data) return data;
    if (typeof data === 'string') {
      // Mask bearer tokens
      if (data.startsWith('Bearer ') || data.startsWith('oup_')) {
        return data.slice(0, 8) + '********' + data.slice(-4);
      }
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }
    if (typeof data === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        const isSensitive = this.sensitivePatterns.some((pattern) => pattern.test(key));
        if (isSensitive) {
          sanitized[key] = '[REDACTED_SENSITIVE_CREDENTIAL]';
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    return data;
  }

  public log(level: LogLevel, module: string, message: string, context?: Record<string, any>, requestId?: string) {
    const entry: StructuredLog = {
      id: 'log_' + crypto.randomBytes(6).toString('hex'),
      requestId,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      context: this.sanitize(context),
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.module}]` + (requestId ? ` [req:${requestId}]` : '');
    if (level === 'ERROR') {
      console.error(`${prefix} ${message}`, entry.context ? JSON.stringify(entry.context) : '');
    } else if (level === 'WARN') {
      console.warn(`${prefix} ${message}`, entry.context ? JSON.stringify(entry.context) : '');
    } else {
      console.log(`${prefix} ${message}`, entry.context ? JSON.stringify(entry.context) : '');
    }
  }

  public info(module: string, message: string, context?: Record<string, any>, requestId?: string) {
    this.log('INFO', module, message, context, requestId);
  }

  public warn(module: string, message: string, context?: Record<string, any>, requestId?: string) {
    this.log('WARN', module, message, context, requestId);
  }

  public error(module: string, message: string, context?: Record<string, any>, requestId?: string) {
    this.log('ERROR', module, message, context, requestId);
  }

  public getRecentLogs(limit: number = 100, level?: LogLevel): StructuredLog[] {
    if (level) {
      return this.logs.filter((l) => l.level === level).slice(0, limit);
    }
    return this.logs.slice(0, limit);
  }

  public clearLogs() {
    this.logs = [];
  }
}

export const logger = new LoggerService();
