/**
 * Supabase / PostgreSQL connection diagnostic.
 *
 *   pnpm db:diagnose
 *
 * Run this first when the API will not start. It reports exactly which
 * step fails — DNS, TLS, credentials, or a missing schema — instead of
 * leaving you with a single opaque connection error.
 */
import pg from 'pg'
import { config } from 'dotenv'

// Captured before dotenv, so a shell variable can be compared with the file.
const shellDatabaseUrl = process.env.DATABASE_URL

// Matches src/config/env.ts: this project's .env decides. See the comment
// there for why overriding is safe for deployments.
const loaded = config({ override: true })

/**
 * Reports where DATABASE_URL actually came from. This is the tool people
 * reach for when a connection is behaving oddly, so it should rule out
 * "the config I edited is not the config being used" before anything else.
 */
function reportConfigSource() {
  const fromFile = loaded.parsed?.DATABASE_URL
  const redact = (v: string) => v.replace(/:\/\/([^:]+):([^@]*)@/, '://$1:****@')

  if (!fromFile && shellDatabaseUrl && loaded.parsed) {
    console.log('⚠️  DATABASE_URL is NOT set in .env — using the value from your shell:')
    console.log(`      ${redact(shellDatabaseUrl)}`)
    console.log('    Add DATABASE_URL to .env if that is not the database you meant.\n')
    return
  }

  if (fromFile && shellDatabaseUrl && fromFile !== shellDatabaseUrl) {
    console.log('ℹ️  Using DATABASE_URL from .env, overriding your shell environment.')
    console.log(`      .env  : ${redact(fromFile)}`)
    console.log(`      shell : ${redact(shellDatabaseUrl)}  (ignored)\n`)
  }
}

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL
const DB_HOST = process.env.DB_HOST
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10)
const DB_DATABASE = process.env.DB_DATABASE || 'postgres'
const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_SSL = (process.env.DB_SSL || 'true').toLowerCase() === 'true'

const EXPECTED_TABLES = [
  'Roles', 'Users', 'UserRoles', 'Permissions', 'RolePermissions',
  'Projects', 'ProjectLocations', 'ProjectCategories', 'ProjectCategoryMap',
  'Organizations', 'ProjectOrganizations', 'ProjectMedia', 'ProjectStatistics',
  'ProjectMilestones', 'ProjectUpdates', 'ProjectDocuments', 'ProjectRoutes',
  'VRProjectSettings', 'VRHotspots', 'ProjectWorkflow', 'AuditLogs',
]

function describeTarget(): string {
  if (DATABASE_URL) {
    try {
      const url = new URL(DATABASE_URL)
      return `${url.hostname}:${url.port || 5432}${url.pathname} (as ${url.username})`
    } catch {
      return 'DATABASE_URL (unparseable — check for unescaped characters in the password)'
    }
  }
  return `${DB_HOST}:${DB_PORT}/${DB_DATABASE} (as ${DB_USER})`
}

/**
 * The service role key is a JWT for Supabase's HTTP APIs, not a database
 * credential. Decoding it locally catches the usual mistakes — the anon
 * key pasted by mistake, an expired key, or a key from another project —
 * before they surface as a confusing 401 during an upload.
 */
async function checkServiceRoleKey() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url && !key) {
    console.log('6. Supabase HTTP APIs: not configured (optional — only Storage needs them)')
    return
  }

  if (!url || !key) {
    console.log(`6. Supabase HTTP APIs: ❌ only ${url ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'} is set — both are required`)
    return
  }

  const parts = key.split('.')
  if (parts.length !== 3) {
    console.log('6. Supabase HTTP APIs: ❌ SUPABASE_SERVICE_ROLE_KEY is not a JWT')
    return
  }

  let payload: any
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    console.log('6. Supabase HTTP APIs: ❌ could not decode SUPABASE_SERVICE_ROLE_KEY')
    return
  }

  console.log(`6. Supabase HTTP APIs: key role='${payload.role}', project='${payload.ref}'`)

  if (payload.role !== 'service_role') {
    console.log(
      payload.role === 'anon'
        ? '   ❌ That is the ANON key. The anon key is subject to RLS — use the service_role key.'
        : `   ❌ Unexpected role '${payload.role}'.`
    )
    return
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    console.log('   ❌ The key has expired.')
    return
  }

  // Cross-check that the key and the database point at the same project.
  const dbRef = (() => {
    if (!DATABASE_URL) return null
    try {
      const u = new URL(DATABASE_URL)
      const direct = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.(co|com)$/i)
      if (direct) return direct[1]
      const pooled = u.username.match(/^postgres\.([a-z0-9]+)$/i)
      return pooled ? pooled[1] : null
    } catch {
      return null
    }
  })()

  if (dbRef && payload.ref && dbRef !== payload.ref) {
    console.log(`   ❌ Project mismatch: DATABASE_URL is project '${dbRef}', key is project '${payload.ref}'.`)
    return
  }

  // Live check against Storage — the cheapest authenticated endpoint.
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/storage/v1/bucket`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (res.ok) {
      const buckets = (await res.json()) as any[]
      console.log(`   ✅ Key accepted. ${buckets.length} storage bucket(s).`)
    } else {
      console.log(`   ❌ Storage API rejected the key (HTTP ${res.status}).`)
    }
  } catch (err: any) {
    console.log(`   ⚠️  Could not reach the Storage API: ${err.message}`)
  }
}

async function main() {
  console.log('=== KeNHA VR — Supabase / Postgres Diagnostic ===\n')

  reportConfigSource()

  if (!DATABASE_URL && !(DB_HOST && DB_USER && DB_PASSWORD)) {
    console.error('❌ No connection configured.')
    console.error('   Set DATABASE_URL in .env, or all of DB_HOST, DB_USER and DB_PASSWORD.')
    console.error('   Supabase → Project Settings → Database → Connection string → Node.js')
    process.exit(1)
  }

  console.log(`Target: ${describeTarget()}`)
  console.log(`SSL:    ${DB_SSL ? 'on' : 'off'}${DB_SSL ? '' : '  (Supabase requires SSL — expect this to fail)'}\n`)

  const pool = new Pool(
    DATABASE_URL
      ? { connectionString: DATABASE_URL, ssl: DB_SSL ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 15000 }
      : {
          host: DB_HOST,
          port: DB_PORT,
          database: DB_DATABASE,
          user: DB_USER,
          password: DB_PASSWORD,
          ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 15000,
        }
  )

  try {
    // 1. Connect
    process.stdout.write('1. Connecting... ')
    const client = await pool.connect()
    console.log('✅')

    // 2. Identity and version
    const who = await client.query(
      `SELECT current_user AS "user", current_database() AS "db", version() AS "version"`
    )
    console.log(`2. Connected as '${who.rows[0].user}' to '${who.rows[0].db}'`)
    console.log(`   ${String(who.rows[0].version).split(',')[0]}`)

    // 3. Schema check
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    )
    const present = new Set(tables.rows.map((r) => r.table_name))
    const missing = EXPECTED_TABLES.filter((t) => !present.has(t))

    if (missing.length === 0) {
      console.log(`3. Schema: ✅ all ${EXPECTED_TABLES.length} tables present`)
    } else {
      console.log(`3. Schema: ❌ ${missing.length} table(s) missing: ${missing.join(', ')}`)
      console.log('   Run supabase/schema.sql in the Supabase SQL Editor.')
    }

    // 4. Row Level Security — the check that matters most, because RLS
    //    hides rows silently instead of raising an error.
    if (missing.length === 0) {
      const rls = await client.query<{
        role: string
        bypassRls: boolean
        isOwner: boolean
        rlsEnabled: boolean
        rlsForced: boolean
        owner: string
      }>(`
        SELECT
          current_user                                     AS "role",
          COALESCE((SELECT r.rolbypassrls FROM pg_roles r
                    WHERE r.rolname = current_user), FALSE) AS "bypassRls",
          pg_get_userbyid(c.relowner) = current_user        AS "isOwner",
          pg_get_userbyid(c.relowner)                       AS "owner",
          c.relrowsecurity                                  AS "rlsEnabled",
          c.relforcerowsecurity                             AS "rlsForced"
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'Projects'
      `)

      const r = rls.rows[0]
      const seesAll = r.bypassRls || (r.isOwner && !r.rlsForced) || !r.rlsEnabled

      console.log(`4. RLS: connected as '${r.role}' (table owner is '${r.owner}')`)
      console.log(`   RLS enabled: ${r.rlsEnabled ? 'yes' : 'no'}${r.rlsForced ? ' (FORCED)' : ''}`)
      console.log(`   BYPASSRLS:   ${r.bypassRls ? 'yes' : 'no'}`)
      console.log(`   Table owner: ${r.isOwner ? 'yes' : 'no'}`)

      if (seesAll) {
        const why = r.bypassRls ? 'BYPASSRLS' : r.isOwner ? 'owns the table' : 'RLS is off'
        console.log(`   → ✅ This connection sees every row (${why}).`)
      } else {
        console.log('   → ❌ RLS is filtering this connection.')
        console.log('     Queries will return incomplete results WITHOUT raising an error.')
        console.log("     Use the connection string for the 'postgres' role:")
        console.log('     Supabase → Project Settings → Database → Connection string')
      }
    }

    // 5. Row counts, if the schema is there
    if (missing.length === 0) {
      const counts = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM "Users")             AS users,
          (SELECT COUNT(*)::int FROM "Roles")             AS roles,
          (SELECT COUNT(*)::int FROM "Projects")          AS projects,
          (SELECT COUNT(*)::int FROM "ProjectMedia")      AS media,
          (SELECT COUNT(*)::int FROM "ProjectCategories") AS categories
      `)
      const c = counts.rows[0]
      console.log(
        `5. Data: ${c.users} user(s), ${c.roles} role(s), ${c.projects} project(s), ` +
          `${c.media} media, ${c.categories} categor(ies)`
      )

      if (c.users > 1) {
        console.log('   ⚠️  More than one account exists. This system expects exactly one Editor.')
      }
    }

    client.release()
    console.log('\n✅ Database checks complete.')
  } catch (err: any) {
    console.log('❌\n')
    console.error(`Error: ${err.message}`)

    // The failures worth naming, since each has a different fix.
    const host = (() => {
      try {
        return DATABASE_URL ? new URL(DATABASE_URL).hostname : DB_HOST || ''
      } catch {
        return ''
      }
    })()

    // Supavisor rejects an unknown tenant before it ever checks the
    // password, so this means the region in the hostname is wrong.
    if (/tenant or user not found/i.test(err.message || '')) {
      console.error('\n→ The pooler does not host this project in that region.')
      console.error('  The region is part of the hostname (aws-1-<region>.pooler.supabase.com).')
      console.error('  Copy the exact string from Supabase → Project Settings → Database')
      console.error('  → Connection string → Transaction/Session pooler.')
    } else if (err.code === 'ENOTFOUND' && /^db\..*\.supabase\.co$/i.test(host)) {
      console.error(`\n→ '${host}' has no IPv4 address.`)
      console.error('  Supabase direct connections are IPv6-only unless you buy the IPv4 add-on.')
      console.error('  Use the pooler instead — it is dual-stack:')
      console.error('    postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres')
    } else if (err.code === 'ENOTFOUND') {
      console.error('\n→ Host not found. Check the hostname in DATABASE_URL.')
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('\n→ Could not reach the server. Check the port (5432 session, 6543 transaction)')
      console.error('  and that your network permits outbound connections to it.')
    } else if (err.message?.includes('password authentication failed')) {
      console.error('\n→ Wrong password. Reset it under Supabase → Project Settings → Database.')
      console.error('  If the password contains @ : / ? # or %, it must be percent-encoded in the URL.')
    } else if (err.message?.includes('SSL') || err.message?.includes('ssl')) {
      console.error('\n→ TLS problem. Supabase requires SSL: set DB_SSL=true.')
    }
    process.exitCode = 1
  } finally {
    await pool.end()
  }

  // The Supabase HTTP APIs are a different door from the database, so
  // check them whether or not the connection above succeeded — when the
  // password is missing, this is the half that can still be confirmed.
  console.log('')
  await checkServiceRoleKey()

  console.log('\n✅ Diagnostic complete.')
}

main()
