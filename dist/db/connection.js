import mssql from 'mssql';
import { env } from '../config/env.js';
import { alertService } from '../services/alert.service.js';
import { logger } from '../services/logger.service.js';
function buildSqlConfig(server) {
    return {
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        server,
        database: env.DB_DATABASE,
        port: env.DB_PORT,
        options: {
            encrypt: env.DB_ENCRYPT,
            trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
            enableArithAbort: true,
            ...(env.DB_INSTANCE_NAME ? { instanceName: env.DB_INSTANCE_NAME } : {}),
        },
        pool: {
            max: 20,
            min: 0,
            idleTimeoutMillis: 30000,
        },
        connectionTimeout: 15000,
        requestTimeout: 30000,
    };
}
let pool = null;
let isConnecting = false;
export async function getDbPool() {
    if (pool && pool.connected) {
        return pool;
    }
    if (isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (pool && pool.connected)
            return pool;
    }
    isConnecting = true;
    try {
        const primaryServer = env.DB_SERVER || '127.0.0.1';
        logger.info(`[MSSQL] Connecting to SQL Server database '${env.DB_DATABASE}' at ${primaryServer}:${env.DB_PORT}...`);
        try {
            pool = await new mssql.ConnectionPool(buildSqlConfig(primaryServer)).connect();
        }
        catch (primaryErr) {
            // Fallback: If primaryServer was 'localhost', try IPv4 '127.0.0.1'
            if (primaryServer === 'localhost') {
                logger.warn(`[MSSQL] Primary host 'localhost' connection failed. Attempting fallback to '127.0.0.1'...`);
                pool = await new mssql.ConnectionPool(buildSqlConfig('127.0.0.1')).connect();
            }
            else {
                throw primaryErr;
            }
        }
        pool.on('error', (err) => {
            logger.error('[MSSQL Pool Error] Pool encountered an unhandled error:', err);
            alertService.triggerAlert({
                severity: 'CRITICAL',
                title: 'Database Pool Error',
                message: `SQL Server pool connection error: ${err.message}`,
                details: err,
            });
        });
        logger.info(`[MSSQL] Connected successfully to database '${env.DB_DATABASE}'`);
        return pool;
    }
    catch (error) {
        logger.error(`[MSSQL Connection Failed] Could not establish pool to ${env.DB_SERVER}:${env.DB_PORT}`, error);
        alertService.triggerAlert({
            severity: 'FATAL',
            title: 'Database Connection Failure',
            message: `Failed to connect to SQL Server database ${env.DB_DATABASE}: ${error?.message || error}`,
            details: error,
        });
        pool = null;
        throw error;
    }
    finally {
        isConnecting = false;
    }
}
export async function closeDbPool() {
    if (pool) {
        try {
            await pool.close();
            logger.info('[MSSQL] Connection pool closed successfully.');
            pool = null;
        }
        catch (err) {
            logger.error('[MSSQL] Error closing connection pool:', err);
        }
    }
}
export async function checkDbHealth() {
    const start = Date.now();
    try {
        const currentPool = await getDbPool();
        const result = await currentPool.request().query('SELECT 1 AS HealthCheck');
        const latencyMs = Date.now() - start;
        if (result.recordset[0]?.HealthCheck === 1) {
            return { status: 'healthy', latencyMs };
        }
        return { status: 'unhealthy', latencyMs, error: 'Unexpected health response' };
    }
    catch (err) {
        const latencyMs = Date.now() - start;
        return { status: 'unhealthy', latencyMs, error: err?.message || 'Database query failed' };
    }
}
