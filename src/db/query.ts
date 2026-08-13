import mssql from 'mssql'
import { getDbPool } from './connection.js'
import { DatabaseError } from '../errors/AppError.js'
import { logger } from '../services/logger.service.js'
import { PrometheusService } from '../services/prometheus.service.js'

export interface SqlParam {
  name: string
  type?: mssql.ISqlType
  value: any
}

/**
 * Execute parameterized SELECT query returning recordset
 */
export async function query<T = any>(
  sqlQuery: string,
  params: SqlParam[] = []
): Promise<T[]> {
  const start = Date.now()
  try {
    const pool = await getDbPool()
    const request = pool.request()

    for (const p of params) {
      if (p.type) {
        request.input(p.name, p.type, p.value)
      } else {
        request.input(p.name, p.value)
      }
    }

    const result = await request.query(sqlQuery)
    const durationSec = (Date.now() - start) / 1000

    PrometheusService.dbQueryDurationHistogram.observe({ operation: 'SELECT' }, durationSec)
    PrometheusService.dbConnectionGauge.set(1)

    if (durationSec > 0.5) {
      logger.warn(`[Slow SQL Query Warning] Duration: ${(durationSec * 1000).toFixed(0)}ms`, { sqlQuery })
    }

    return result.recordset as T[]
  } catch (err: any) {
    PrometheusService.dbConnectionGauge.set(0)
    logger.error(`[SQL Query Error]: ${err.message}`, { sqlQuery, params })
    throw new DatabaseError(`SQL query execution failed: ${err.message}`, {
      originalError: err.message,
      code: err.code,
    })
  }
}

/**
 * Execute query returning single record or null
 */
export async function queryOne<T = any>(
  sqlQuery: string,
  params: SqlParam[] = []
): Promise<T | null> {
  const rows = await query<T>(sqlQuery, params)
  return rows.length > 0 ? rows[0] : null
}

/**
 * Execute INSERT/UPDATE/DELETE query returning rowsAffected
 */
export async function execute(
  sqlQuery: string,
  params: SqlParam[] = []
): Promise<{ rowsAffected: number[]; recordset?: any[] }> {
  const start = Date.now()
  try {
    const pool = await getDbPool()
    const request = pool.request()

    for (const p of params) {
      if (p.type) {
        request.input(p.name, p.type, p.value)
      } else {
        request.input(p.name, p.value)
      }
    }

    const result = await request.query(sqlQuery)
    const durationSec = (Date.now() - start) / 1000

    PrometheusService.dbQueryDurationHistogram.observe({ operation: 'EXECUTE' }, durationSec)
    PrometheusService.dbConnectionGauge.set(1)

    return {
      rowsAffected: result.rowsAffected,
      recordset: result.recordset,
    }
  } catch (err: any) {
    PrometheusService.dbConnectionGauge.set(0)
    logger.error(`[SQL Execute Error]: ${err.message}`, { sqlQuery, params })
    throw new DatabaseError(`SQL command execution failed: ${err.message}`, {
      originalError: err.message,
      code: err.code,
    })
  }
}

/**
 * Run a unit of work inside a SQL Server Transaction
 */
export async function transaction<T>(
  callback: (txRequest: mssql.Request) => Promise<T>
): Promise<T> {
  const pool = await getDbPool()
  const tx = new mssql.Transaction(pool)
  const start = Date.now()

  try {
    await tx.begin()
    const request = tx.request()
    const result = await callback(request)
    await tx.commit()

    const durationSec = (Date.now() - start) / 1000
    PrometheusService.dbQueryDurationHistogram.observe({ operation: 'TRANSACTION' }, durationSec)
    PrometheusService.dbConnectionGauge.set(1)

    return result
  } catch (err: any) {
    PrometheusService.dbConnectionGauge.set(0)
    try {
      await tx.rollback()
    } catch (rollbackErr) {
      logger.error('[SQL Transaction Rollback Failed]', rollbackErr)
    }
    logger.error('[SQL Transaction Error]', err)
    throw new DatabaseError(`Transaction failed and rolled back: ${err.message}`, err)
  }
}

export const SqlTypes = mssql
