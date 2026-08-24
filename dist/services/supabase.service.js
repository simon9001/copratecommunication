import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from './logger.service.js';
/**
 * ============================================================
 * SUPABASE SERVICE-ROLE CLIENT
 * ============================================================
 * Two separate doors into the same Supabase project, and it matters
 * which one you are standing at:
 *
 *   DATABASE_URL  -> a direct PostgreSQL connection. This is how the API
 *                    reads and writes every table. It connects as the
 *                    role that owns the tables, and Postgres does not
 *                    apply RLS policies to a table's owner, so RLS being
 *                    enabled does not block it.
 *
 *   SERVICE ROLE  -> a JWT for the HTTP APIs (PostgREST, Storage, Auth
 *     KEY            admin). The `service_role` Postgres role carries
 *                    BYPASSRLS, so it also sees through RLS — but it is
 *                    not a database password and cannot appear in a
 *                    connection string.
 *
 * The service role key bypasses every access rule in the project. It is
 * a server-only secret: never send it to a browser, never put it in a
 * VITE_* variable, never log it.
 */
let client = null;
/**
 * Decodes the key's JWT payload locally — no network call, no signature
 * check. The point is to catch the two mistakes people actually make:
 * pasting the anon key where the service role key belongs, and pasting a
 * key from a different project than DATABASE_URL points at. Both fail
 * later in ways that are hard to read; here they are obvious.
 */
export function inspectServiceKey(key) {
    if (!key)
        return { valid: false, problem: 'not set' };
    const parts = key.split('.');
    if (parts.length !== 3) {
        return { valid: false, problem: 'not a JWT — expected three dot-separated segments' };
    }
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const role = payload.role;
        const projectRef = payload.ref;
        const expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined;
        if (role !== 'service_role') {
            return {
                valid: false,
                role,
                projectRef,
                expiresAt,
                problem: role === 'anon'
                    ? 'this is the ANON key, not the service role key — the anon key is subject to RLS'
                    : `unexpected role '${role ?? 'missing'}'`,
            };
        }
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            return { valid: false, role, projectRef, expiresAt, problem: 'the key has expired' };
        }
        return { valid: true, role, projectRef, expiresAt };
    }
    catch {
        return { valid: false, problem: 'could not decode the JWT payload' };
    }
}
/** The project ref embedded in a Supabase DATABASE_URL, if there is one. */
export function projectRefFromDatabaseUrl(databaseUrl) {
    if (!databaseUrl)
        return null;
    try {
        const host = new URL(databaseUrl).hostname;
        // db.<ref>.supabase.co  |  aws-0-<region>.pooler.supabase.com (ref is in the username)
        const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.(co|com)$/i);
        if (direct)
            return direct[1];
        const user = new URL(databaseUrl).username;
        const pooled = user.match(/^postgres\.([a-z0-9]+)$/i);
        if (pooled)
            return pooled[1];
        return null;
    }
    catch {
        return null;
    }
}
export function isSupabaseConfigured() {
    return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
/**
 * The shared service-role client. Created on first use so that a project
 * running purely on DATABASE_URL never pays for it.
 */
export function getSupabaseAdmin() {
    if (client)
        return client;
    if (!isSupabaseConfigured())
        return null;
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            // A server has no user session to persist or refresh.
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: { 'X-Client-Info': 'kenha-vr-api' },
        },
    });
    return client;
}
/**
 * Confirms the key is accepted by the project. Storage is the cheapest
 * authenticated endpoint that does not touch application data.
 */
export async function checkSupabaseHealth() {
    const admin = getSupabaseAdmin();
    if (!admin) {
        return { status: 'unconfigured', latencyMs: 0 };
    }
    const inspection = inspectServiceKey(env.SUPABASE_SERVICE_ROLE_KEY);
    if (!inspection.valid) {
        return { status: 'disconnected', latencyMs: 0, error: `Service role key rejected: ${inspection.problem}` };
    }
    const start = Date.now();
    try {
        const { error } = await admin.storage.listBuckets();
        const latencyMs = Date.now() - start;
        if (error) {
            return { status: 'disconnected', latencyMs, projectRef: inspection.projectRef, error: error.message };
        }
        return { status: 'connected', latencyMs, projectRef: inspection.projectRef };
    }
    catch (err) {
        return {
            status: 'disconnected',
            latencyMs: Date.now() - start,
            projectRef: inspection.projectRef,
            error: err?.message || 'Supabase request failed',
        };
    }
}
/**
 * Startup validation. Catches a wrong key, an expired key, or a key that
 * belongs to a different project than DATABASE_URL, and says so plainly
 * rather than letting it surface as a 401 during a media upload later.
 */
export function validateSupabaseConfigAtStartup() {
    const hasUrl = Boolean(env.SUPABASE_URL);
    const hasKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasUrl && !hasKey)
        return; // Not using the Supabase HTTP APIs. Fine.
    if (hasUrl !== hasKey) {
        logger.warn(`[Supabase] Only ${hasUrl ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'} is set. ` +
            'Both are needed before Storage or the admin API can be used.');
        return;
    }
    const inspection = inspectServiceKey(env.SUPABASE_SERVICE_ROLE_KEY);
    if (!inspection.valid) {
        logger.error(`[Supabase] SUPABASE_SERVICE_ROLE_KEY problem: ${inspection.problem}`);
        return;
    }
    const dbRef = projectRefFromDatabaseUrl(env.DATABASE_URL);
    if (dbRef && inspection.projectRef && dbRef !== inspection.projectRef) {
        logger.warn(`[Supabase] Project mismatch: DATABASE_URL points at project '${dbRef}' but ` +
            `SUPABASE_SERVICE_ROLE_KEY belongs to project '${inspection.projectRef}'. ` +
            'Storage writes and database writes would land in different projects.');
        return;
    }
    logger.info(`[Supabase] Service role key valid for project '${inspection.projectRef ?? 'unknown'}' ` +
        `(expires ${inspection.expiresAt?.slice(0, 10) ?? 'never'})`);
}
