import type pg from 'pg'
import { getDbPool } from './connection.js'
import { DatabaseError } from '../errors/AppError.js'
import { logger } from '../services/logger.service.js'
import { PrometheusService } from '../services/prometheus.service.js'

export interface SqlParam {
  name: string
  value: any
}

/**
 * ============================================================
 * NAMED PARAMETERS ON TOP OF node-postgres
 * ============================================================
 * Postgres speaks positional parameters ($1, $2, ...). Every repository
 * in this codebase was written against named ones (@projectId), which
 * read far better in long INSERT statements and let a single value be
 * referenced more than once.
 *
 * Rather than renumber hundreds of parameters by hand — a mechanical
 * edit with plenty of room for an off-by-one — this translates the named
 * form into the positional form at call time. A name used twice maps to
 * the same $n, so `WHERE "UserId" <> @editorUserId` and
 * `SET "CreatedBy" = @editorUserId` share one value.
 *
 * Only genuine placeholders are rewritten. Postgres uses `@` as an
 * operator (absolute value) and `@>` / `<@` for containment, and casts
 * are written `::type` — the pattern below requires an identifier-shaped
 * name after the `@`, and string literals and comments are masked out
 * first so a literal '@name' inside quotes is never touched.
 */
const NAMED_PARAM = /@([A-Za-z_][A-Za-z0-9_]*)/g

/**
 * Replaces the contents of string literals, quoted identifiers, and
 * comments with same-length filler, so the placeholder scan only ever
 * sees real SQL. Positions are preserved, so offsets map 1:1 back onto
 * the original text.
 */
function maskLiterals(sql: string): string {
  let out = ''
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]

    // Single-quoted string literal ('' escapes a quote)
    if (ch === "'") {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue }
        if (sql[j] === "'") break
        j += 1
      }
      out += "'" + ' '.repeat(Math.max(0, j - i - 1)) + (j < sql.length ? "'" : '')
      i = j + 1
      continue
    }

    // Double-quoted identifier ("" escapes a quote)
    if (ch === '"') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') { j += 2; continue }
        if (sql[j] === '"') break
        j += 1
      }
      out += '"' + ' '.repeat(Math.max(0, j - i - 1)) + (j < sql.length ? '"' : '')
      i = j + 1
      continue
    }

    // Line comment
    if (ch === '-' && sql[i + 1] === '-') {
      let j = i
      while (j < sql.length && sql[j] !== '\n') j += 1
      out += ' '.repeat(j - i)
      i = j
      continue
    }

    // Block comment
    if (ch === '/' && sql[i + 1] === '*') {
      let j = i + 2
      while (j < sql.length && !(sql[j] === '*' && sql[j + 1] === '/')) j += 1
      j = Math.min(sql.length, j + 2)
      out += ' '.repeat(j - i)
      i = j
      continue
    }

    out += ch
    i += 1
  }

  return out
}

export function toPositional(sql: string, params: SqlParam[]): { text: string; values: any[] } {
  if (params.length === 0) return { text: sql, values: [] }

  const byName = new Map<string, any>()
  for (const p of params) byName.set(p.name, p.value)

  const masked = maskLiterals(sql)
  const order: string[] = []
  const index = new Map<string, number>()

  let text = ''
  let cursor = 0
  let match: RegExpExecArray | null

  NAMED_PARAM.lastIndex = 0
  while ((match = NAMED_PARAM.exec(masked)) !== null) {
    const name = match[1]
    if (!byName.has(name)) continue // not one of ours — leave it alone

    let position = index.get(name)
    if (position === undefined) {
      order.push(name)
      position = order.length
      index.set(name, position)
    }

    text += sql.slice(cursor, match.index) + '$' + position
    cursor = match.index + match[0].length
  }

  text += sql.slice(cursor)

  return { text, values: order.map((n) => byName.get(n)) }
}

async function run(
  sqlQuery: string,
  params: SqlParam[],
  operation: 'SELECT' | 'EXECUTE'
): Promise<pg.QueryResult<any>> {
  const start = Date.now()
  const { text, values } = toPositional(sqlQuery, params)

  try {
    const pool = await getDbPool()
    const result = await pool.query(text, values)
    const durationSec = (Date.now() - start) / 1000

    PrometheusService.dbQueryDurationHistogram.observe({ operation }, durationSec)
    PrometheusService.dbConnectionGauge.set(1)

    if (durationSec > 0.5) {
      logger.warn(`[Slow SQL Query Warning] Duration: ${(durationSec * 1000).toFixed(0)}ms`, { sqlQuery })
    }

    return result
  } catch (err: any) {
    PrometheusService.dbConnectionGauge.set(0)
    logger.error(`[SQL ${operation} Error]: ${err.message}`, { sqlQuery, text, params })
    throw new DatabaseError(`SQL ${operation === 'SELECT' ? 'query' : 'command'} execution failed: ${err.message}`, {
      originalError: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
    })
  }
}

/** Parameterised SELECT returning all rows. */
export async function query<T = any>(sqlQuery: string, params: SqlParam[] = []): Promise<T[]> {
  const result = await run(sqlQuery, params, 'SELECT')
  return result.rows as T[]
}

/** Parameterised SELECT returning the first row, or null. */
export async function queryOne<T = any>(sqlQuery: string, params: SqlParam[] = []): Promise<T | null> {
  const rows = await query<T>(sqlQuery, params)
  return rows.length > 0 ? rows[0] : null
}

/**
 * INSERT / UPDATE / DELETE.
 *
 * `rowsAffected` stays an array and `recordset` stays the returned rows,
 * matching the shape the repositories were already written against, so a
 * statement with `RETURNING *` reads back the same way it always did.
 */
export async function execute(
  sqlQuery: string,
  params: SqlParam[] = []
): Promise<{ rowsAffected: number[]; recordset?: any[] }> {
  const result = await run(sqlQuery, params, 'EXECUTE')
  return {
    rowsAffected: [result.rowCount ?? 0],
    recordset: result.rows,
  }
}

/**
 * Runs a unit of work on a single client inside BEGIN/COMMIT.
 * The callback gets a scoped `query` helper that uses the same named
 * parameter style as the module-level one.
 */
export async function transaction<T>(
  callback: (tx: { query: <R = any>(sql: string, params?: SqlParam[]) => Promise<R[]> }) => Promise<T>
): Promise<T> {
  const pool = await getDbPool()
  const client = await pool.connect()
  const start = Date.now()

  try {
    await client.query('BEGIN')

    const result = await callback({
      query: async <R = any>(sql: string, params: SqlParam[] = []): Promise<R[]> => {
        const { text, values } = toPositional(sql, params)
        const res = await client.query(text, values)
        return res.rows as R[]
      },
    })

    await client.query('COMMIT')

    PrometheusService.dbQueryDurationHistogram.observe({ operation: 'TRANSACTION' }, (Date.now() - start) / 1000)
    PrometheusService.dbConnectionGauge.set(1)

    return result
  } catch (err: any) {
    PrometheusService.dbConnectionGauge.set(0)
    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr) {
      logger.error('[SQL Transaction Rollback Failed]', rollbackErr)
    }
    logger.error('[SQL Transaction Error]', err)
    throw new DatabaseError(`Transaction failed and rolled back: ${err.message}`, err)
  } finally {
    client.release()
  }
}
