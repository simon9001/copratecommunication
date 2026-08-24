import { config } from 'dotenv'
import { z } from 'zod'

// Captured before dotenv runs, so we can tell a value that was already in
// the real environment apart from one the .env file supplied.
const preexisting = {
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST,
}

/**
 * `override: true` makes this project's .env win over whatever happens to
 * be sitting in the shell.
 *
 * dotenv's default is the opposite, so that a hosted platform (Render,
 * Fly, Vercel) can inject real credentials over a checked-in file. That
 * reasoning does not apply here: .env and .env.* are gitignored, so a
 * deployed image ships without one — `config()` then parses nothing and
 * there is nothing to override. Platform-injected variables stay intact.
 *
 * What the default *did* cause was a stale machine-wide DATABASE_URL from
 * an unrelated project silently capturing every run, pointing the API at
 * the wrong database. Since this codebase's seeder deletes accounts it
 * does not recognise, that is not a harmless mistake.
 *
 * The rule is now simply: if this project has a .env, that file decides.
 */
const loaded = config({ override: true })

/**
 * Still worth saying out loud when the two disagree — a shell variable
 * that no longer takes effect is confusing in its own right.
 *
 * This uses console rather than the logger because logger.service imports
 * this module — importing it back would be circular.
 */
function noteOverriddenValue(key: 'DATABASE_URL' | 'DB_HOST') {
  const fromFile = loaded.parsed?.[key]
  const fromShell = preexisting[key]
  const redact = (v: string) => v.replace(/:\/\/([^:]+):([^@]*)@/, '://$1:****@')

  // Overriding only applies to keys the file actually defines. If .env
  // omits one, a shell variable still takes over — which looks identical
  // to "my .env is being ignored" and is the trap that started all this.
  if (!fromFile && fromShell && loaded.parsed) {
    console.warn(
      `\n⚠️  ${key} is NOT set in .env, so the value from your shell is being used:\n` +
        `      ${redact(fromShell)}\n` +
        `    If that is not the database you meant, add ${key} to .env.\n`
    )
    return
  }

  if (!fromFile || !fromShell || fromFile === fromShell) return

  console.warn(
    `\nℹ️  ${key} from .env is being used, overriding your shell environment.\n` +
      `    using   (.env)  : ${redact(fromFile)}\n` +
      `    ignored (shell) : ${redact(fromShell)}\n` +
      `    If you wanted the shell value instead, remove ${key} from .env.\n` +
      `    To clear the shell variable entirely:\n` +
      `      PowerShell : [Environment]::SetEnvironmentVariable('${key}', $null, 'User')\n` +
      `      bash       : unset ${key}\n`
  )
}

noteOverriddenValue('DATABASE_URL')
noteOverriddenValue('DB_HOST')

/**
 * An unset variable and one present-but-empty (`SUPABASE_URL=`) mean the
 * same thing in a .env file, but zod sees the second as a string — so a
 * blank line would fail a `.url()` check and take the process down at
 * boot. Normalise empty and whitespace-only values to undefined first.
 */
const optionalString = () =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v
    const trimmed = v.trim()
    return trimmed === '' ? undefined : trimmed
  }, z.string().optional())

const optionalUrl = (message: string) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v
    const trimmed = v.trim()
    return trimmed === '' ? undefined : trimmed
  }, z.string().url(message).optional())

const envSchema = z
  .object({
    PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // ---- PostgreSQL / Supabase ----
    // Either supply DATABASE_URL (what Supabase gives you), or the four
    // discrete DB_* fields below. DATABASE_URL wins when both are present.
    DATABASE_URL: optionalString(),

    DB_HOST: optionalString(),
    DB_PORT: z.string().default('5432').transform((val) => parseInt(val, 10)),
    DB_DATABASE: z.string().default('postgres'),
    DB_USER: optionalString(),
    DB_PASSWORD: optionalString(),

    // Supabase refuses plaintext connections, so this defaults to on.
    DB_SSL: z
      .string()
      .default('true')
      .transform((val) => val.toLowerCase() === 'true'),

    DB_POOL_MAX: z.string().default('10').transform((val) => parseInt(val, 10)),

    // ---- Supabase HTTP APIs (Storage, admin) ----
    // Not needed to read or write the database — DATABASE_URL covers that.
    // Required only for Storage and the admin API.
    //
    // SUPABASE_SERVICE_ROLE_KEY bypasses every access rule in the project.
    // It is a server-only secret: never expose it to a browser, and never
    // put it behind a VITE_ prefix.
    SUPABASE_URL: optionalUrl('SUPABASE_URL must be a full URL, e.g. https://abc123.supabase.co'),
    SUPABASE_ANON_KEY: optionalString(),
    SUPABASE_SERVICE_ROLE_KEY: optionalString(),

    // ---- Authentication ----
    JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
    JWT_EXPIRES_IN: z.string().default('24h'),

    // ---- Cloudinary (optional) ----
    CLOUDINARY_CLOUD_NAME: optionalString(),
    CLOUDINARY_API_KEY: optionalString(),
    CLOUDINARY_API_SECRET: optionalString(),
    CLOUDINARY_UPLOAD_PRESET: optionalString(),

    // ---- Alerting (optional) ----
    ALERT_WEBHOOK_URL: optionalString(),
  })
  // A connection has to be describable one way or the other, otherwise the
  // pool would fail at first query with a much less obvious message.
  .refine(
    (e) => Boolean(e.DATABASE_URL) || Boolean(e.DB_HOST && e.DB_USER && e.DB_PASSWORD),
    {
      message:
        'Set DATABASE_URL (Supabase → Project Settings → Database → Connection string), ' +
        'or all of DB_HOST, DB_USER and DB_PASSWORD',
      path: ['DATABASE_URL'],
    }
  )

let envParsed: z.infer<typeof envSchema>

try {
  envParsed = envSchema.parse(process.env)
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment configuration validation failed:')
    error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    })
  } else {
    console.error('❌ Unknown error while parsing environment variables:', error)
  }
  process.exit(1)
}

export const env = envParsed
