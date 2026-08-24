import pg from 'pg'
import { env } from '../config/env.js'
import { alertService } from '../services/alert.service.js'
import { logger } from '../services/logger.service.js'

const { Pool, types } = pg

/**
 * ============================================================
 * TYPE PARSERS
 * ============================================================
 * node-postgres hands back NUMERIC and BIGINT as strings, because both
 * can exceed IEEE-754 precision. Every numeric column in this schema
 * (costs, kilometres, latitudes, percentages) is comfortably inside
 * Number range, and the whole API — plus the React frontend — expects
 * real numbers, the way the previous SQL Server driver returned them.
 * These parsers restore that.
 *
 * DATE (not timestamp) is kept as the raw 'YYYY-MM-DD' string. Letting
 * it become a JS Date would anchor it to midnight in the server's local
 * zone, which shifts calendar dates like StartDate across a timezone
 * boundary. Timestamps stay as Date objects and serialise to ISO.
 */
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)))
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)))
types.setTypeParser(types.builtins.DATE, (v) => v)

let pool: pg.Pool | null = null

/**
 * Supabase hands out two connection strings:
 *   - Session / direct  (port 5432) — full Postgres, one backend per client
 *   - Transaction pooler (port 6543) — PgBouncer, better for many short-lived
 *     connections; does not support prepared statements or LISTEN/NOTIFY
 *
 * Either works here because every query goes through the simple query
 * path. Prefer the pooler when running on serverless infrastructure.
 */
function buildPoolConfig(): pg.PoolConfig {
  const base: pg.PoolConfig = {
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    // Supabase terminates non-TLS connections. `rejectUnauthorized: false`
    // accepts their pooler certificate, which is not in the Node CA bundle.
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
    application_name: 'kenha-vr-api',
  }

  if (env.DATABASE_URL) {
    return { ...base, connectionString: env.DATABASE_URL }
  }

  return {
    ...base,
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_DATABASE,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  }
}

/** Never log the password, whichever form the config came in. */
function describeTarget(): string {
  if (env.DATABASE_URL) {
    try {
      const url = new URL(env.DATABASE_URL)
      return `${url.hostname}:${url.port || 5432}${url.pathname}`
    } catch {
      return 'the configured DATABASE_URL'
    }
  }
  return `${env.DB_HOST}:${env.DB_PORT}/${env.DB_DATABASE}`
}

export async function getDbPool(): Promise<pg.Pool> {
  if (pool) return pool

  const target = describeTarget()
  logger.info(`[Postgres] Connecting to ${target}...`)

  try {
    const created = new Pool(buildPoolConfig())

    // An idle client erroring (Supabase restart, pooler timeout) must not
    // take the process down with an unhandled 'error' event.
    created.on('error', (err) => {
      logger.error('[Postgres Pool Error] Idle client error:', err)
      alertService.triggerAlert({
        severity: 'CRITICAL',
        title: 'Database Pool Error',
        message: `Postgres pool connection error: ${err.message}`,
        details: err,
      })
    })

    // Fail loudly here rather than on the first real query.
    const probe = await created.connect()
    probe.release()

    pool = created
    logger.info(`[Postgres] Connected successfully to ${target}`)
    return pool
  } catch (error: any) {
    logger.error(`[Postgres Connection Failed] Could not connect to ${target}`, error)
    alertService.triggerAlert({
      severity: 'FATAL',
      title: 'Database Connection Failure',
      message: `Failed to connect to Postgres at ${target}: ${error?.message || error}`,
      details: error,
    })
    pool = null
    throw error
  }
}

export async function closeDbPool(): Promise<void> {
  if (!pool) return
  try {
    await pool.end()
    logger.info('[Postgres] Connection pool closed successfully.')
  } catch (err) {
    logger.error('[Postgres] Error closing connection pool:', err)
  } finally {
    pool = null
  }
}

export interface RlsAccessReport {
  role: string
  bypassRls: boolean
  isOwner: boolean
  rlsEnabled: boolean
  rlsForced: boolean
  /** True when this connection sees every row regardless of RLS policies. */
  seesAllRows: boolean
  visibleProjects: number
}

/**
 * Reports whether this connection can actually see the data.
 *
 * Postgres does not raise an error when RLS hides rows — it silently
 * returns fewer of them, or none at all. A misconfigured connection
 * therefore looks perfectly healthy while the globe renders empty, which
 * is a genuinely nasty thing to debug. This measures the three things
 * that decide the outcome rather than assuming any of them:
 *
 *   - BYPASSRLS on the role (service_role and, on Supabase, postgres)
 *   - ownership of the table (owners skip policies...)
 *   - FORCE ROW LEVEL SECURITY (...unless the table forces them back on)
 */
export async function checkRlsAccess(): Promise<RlsAccessReport | null> {
  const pool = await getDbPool()

  const { rows } = await pool.query<{
    role: string
    bypassRls: boolean
    isOwner: boolean
    rlsEnabled: boolean
    rlsForced: boolean
  }>(`
    SELECT
      current_user                                            AS "role",
      COALESCE((SELECT r.rolbypassrls FROM pg_roles r
                WHERE r.rolname = current_user), FALSE)        AS "bypassRls",
      pg_get_userbyid(c.relowner) = current_user               AS "isOwner",
      c.relrowsecurity                                         AS "rlsEnabled",
      c.relforcerowsecurity                                    AS "rlsForced"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'Projects'
  `)

  if (rows.length === 0) return null // schema not applied yet

  const r = rows[0]
  const seesAllRows = r.bypassRls || (r.isOwner && !r.rlsForced) || !r.rlsEnabled

  const counted = await pool.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM "Projects"')

  return { ...r, seesAllRows, visibleProjects: counted.rows[0]?.n ?? 0 }
}

/** Startup guard: say something useful before the app looks mysteriously empty. */
export async function warnIfRlsBlocksAccess(): Promise<void> {
  try {
    const report = await checkRlsAccess()
    if (!report) return

    if (report.seesAllRows) {
      logger.info(
        `[RLS] Connected as '${report.role}' — sees all rows ` +
          `(${report.bypassRls ? 'BYPASSRLS' : report.isOwner ? 'table owner' : 'RLS disabled'}). ` +
          `${report.visibleProjects} project(s) visible.`
      )
      return
    }

    logger.error(
      `[RLS] Row Level Security is filtering this connection. Role '${report.role}' ` +
        `is not the table owner and lacks BYPASSRLS` +
        (report.rlsForced ? ', and the table has FORCE ROW LEVEL SECURITY' : '') +
        `. Queries will return incomplete results with no error — ` +
        `only ${report.visibleProjects} project(s) are visible. ` +
        `Use the DATABASE_URL from Supabase → Project Settings → Database (the 'postgres' role).`
    )
  } catch (err: any) {
    logger.warn('[RLS] Could not determine row visibility:', err?.message || err)
  }
}

export async function checkDbHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const currentPool = await getDbPool()
    const result = await currentPool.query('SELECT 1 AS "HealthCheck"')
    const latencyMs = Date.now() - start

    if (result.rows[0]?.HealthCheck === 1) {
      return { status: 'healthy', latencyMs }
    }
    return { status: 'unhealthy', latencyMs, error: 'Unexpected health response' }
  } catch (err: any) {
    return { status: 'unhealthy', latencyMs: Date.now() - start, error: err?.message || 'Database query failed' }
  }
}
