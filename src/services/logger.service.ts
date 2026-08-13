import { env } from '../config/env.js'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const logLevelWeights: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class LoggerService {
  private currentLevelWeight: number

  constructor() {
    this.currentLevelWeight = logLevelWeights[env.LOG_LEVEL as LogLevel] || 1
  }

  private shouldLog(level: LogLevel): boolean {
    return logLevelWeights[level] >= this.currentLevelWeight
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaStr}`
  }

  public debug(message: string, meta?: unknown): void {
    if (this.shouldLog('debug')) {
      console.log(`\x1b[36m${this.formatMessage('debug', message, meta)}\x1b[0m`)
    }
  }

  public info(message: string, meta?: unknown): void {
    if (this.shouldLog('info')) {
      console.log(`\x1b[32m${this.formatMessage('info', message, meta)}\x1b[0m`)
    }
  }

  public warn(message: string, meta?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(`\x1b[33m${this.formatMessage('warn', message, meta)}\x1b[0m`)
    }
  }

  public error(message: string, meta?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(`\x1b[31m${this.formatMessage('error', message, meta)}\x1b[0m`)
    }
  }
}

export const logger = new LoggerService()
