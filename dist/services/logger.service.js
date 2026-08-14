import { env } from '../config/env.js';
const logLevelWeights = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
class LoggerService {
    currentLevelWeight;
    constructor() {
        this.currentLevelWeight = logLevelWeights[env.LOG_LEVEL] || 1;
    }
    shouldLog(level) {
        return logLevelWeights[level] >= this.currentLevelWeight;
    }
    formatMessage(level, message, meta) {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaStr}`;
    }
    debug(message, meta) {
        if (this.shouldLog('debug')) {
            console.log(`\x1b[36m${this.formatMessage('debug', message, meta)}\x1b[0m`);
        }
    }
    info(message, meta) {
        if (this.shouldLog('info')) {
            console.log(`\x1b[32m${this.formatMessage('info', message, meta)}\x1b[0m`);
        }
    }
    warn(message, meta) {
        if (this.shouldLog('warn')) {
            console.warn(`\x1b[33m${this.formatMessage('warn', message, meta)}\x1b[0m`);
        }
    }
    error(message, meta) {
        if (this.shouldLog('error')) {
            console.error(`\x1b[31m${this.formatMessage('error', message, meta)}\x1b[0m`);
        }
    }
}
export const logger = new LoggerService();
