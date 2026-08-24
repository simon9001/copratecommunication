# Supabase setup

The API reads and writes every table over a plain PostgreSQL connection
(`DATABASE_URL`). PostgREST is not in the request path. `supabase-js` is
present only for Storage and the admin API, which are optional — see
[the two doors](#the-two-doors-into-supabase-and-why-rls-does-not-block-you)
below.

## 1. Create the schema

Open your project in Supabase → **SQL Editor** → **New query**, paste the whole
of [`schema.sql`](./schema.sql), and run it.

It is safe to re-run: the script drops every table it owns first. That also
means **re-running it destroys all data**, so only do that on a database you
are happy to reset.

When it finishes you should see a list of 21 tables.

## The two doors into Supabase (and why RLS does not block you)

These are different transports, and only one of them is a database connection:

| | `DATABASE_URL` | Service role key |
|---|---|---|
| What it is | A PostgreSQL connection string | A JWT for Supabase's HTTP APIs |
| Protocol | Postgres wire protocol, port 5432/6543 | HTTPS to PostgREST / Storage / Auth admin |
| Used for | **Every table read and write in this API** | Storage, admin API |
| Connects as | the `postgres` role | the `service_role` role |
| RLS | Not applied — `postgres` owns the tables | Not applied — `service_role` has `BYPASSRLS` |

**A service role key cannot go in a connection string.** It is not a database
password. Supavisor (the pooler) and Postgres both authenticate with the
database password from Project Settings → Database; they have no idea what a
Supabase JWT is. So there is no way to "use both" for the same query — each
query goes through one door or the other.

If you only have the service role key and not the database password, the
options are: fetch the password from the dashboard (30 seconds, no code
changes), or rewrite the whole repository layer to go through PostgREST. The
second is a large job — PostgREST cannot run arbitrary SQL, so the lateral
joins and the aggregate dashboard queries in this codebase would each need a
hand-written Postgres function.

**Enabling RLS does not lock the API out.** Postgres does not apply RLS policies
to a table's owner, and `schema.sql` creates the tables as `postgres`, which is
the role your `DATABASE_URL` connects as. RLS is there to stop the *anon* and
*authenticated* PostgREST roles from reaching these tables directly over HTTP.

You do not need the service role key for this project to work. Set it only when
you want Storage or the admin API. Both are now wired up and validated at boot.

### Proving it, rather than trusting it

RLS does not raise an error when it hides rows — it just returns fewer of them.
A misconfigured connection therefore looks perfectly healthy while the globe
renders empty. `pnpm db:diagnose` measures the three things that actually decide
the outcome and tells you the verdict:

```
4. RLS: connected as 'postgres' (table owner is 'postgres')
   RLS enabled: yes
   BYPASSRLS:   yes
   Table owner: yes
   → ✅ This connection sees every row (BYPASSRLS).
```

The API repeats this check at startup and logs an error if rows are being
filtered, so the failure is never silent.

## 2. Point the API at it

`.env` already carries the connection string for this project, verified against
the live database — everything except the password:

```
DATABASE_URL=postgresql://postgres.dqsgfddijjcdsoxeowmv:YOUR-DB-PASSWORD@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

Get the password from Supabase → **Project Settings** → **Database** →
**Database password**. You can reset it there; resetting it does not affect
your API keys.

Three things that catch people out:

- **Use the pooler, not the direct host.** `db.<ref>.supabase.co` resolves to an
  IPv6 address only — it has no `A` record. On an IPv4-only network it fails
  with `ENOTFOUND`, and the fix is Supabase's paid IPv4 add-on. The pooler
  hostname is dual-stack and needs no add-on.
- **The region is baked into the pooler hostname.** `aws-1-eu-west-1...` is
  correct for this project; every other region answers `Tenant or user not
  found`, because Supavisor resolves the tenant from the `postgres.<ref>`
  username before it ever checks the password.
- **Password encoding.** If the password contains `@ : / ? #` or `%`, percent-
  encode it inside the URL (`@` → `%40`, `#` → `%23`). Otherwise the URL parser
  reads the password as the hostname.

Port `5432` is session mode — use it for local development. Port `6543` is
transaction mode, for serverless deployments where many short-lived instances
would otherwise exhaust the connection limit. Both work with this codebase,
since every query goes through the simple query path.

### Where config comes from

This project loads `.env` with `override: true`, so **`.env` wins over your
shell environment**. dotenv's default is the opposite — it exists so a hosted
platform can inject credentials over a checked-in file — but `.env` and `.env.*`
are gitignored here, so a deployed image ships without one and there is nothing
to override. Platform-injected variables stay intact.

The default caused real trouble locally: a leftover `DATABASE_URL` from an
unrelated project silently captured every run and pointed the API at the wrong
database.

Two cases are reported at startup and by `pnpm db:diagnose`:

- `.env` **defines** `DATABASE_URL` and the shell has a different one → the
  `.env` value is used, and both are printed so the ignored one is visible.
- `.env` **omits** `DATABASE_URL` but the shell has one → warns that the shell
  value is in play. Overriding only applies to keys the file actually contains,
  so a missing line still falls through, and that looks identical to "my .env is
  being ignored".

To remove a shell variable entirely:
`[Environment]::SetEnvironmentVariable('DATABASE_URL', $null, 'User')`

## 3. (Optional) Add the service role key

Only needed for Storage or the admin API. Supabase → **Project Settings** →
**API**:

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

The key is decoded locally at startup, which catches the three mistakes people
actually make:

- pasting the **anon key** instead — it is subject to RLS, so writes fail later
  in ways that are hard to read
- an **expired** key
- a key from a **different project** than `DATABASE_URL` points at, which would
  put your files and your rows in two different places

> The service role key bypasses every access rule in the project. Keep it
> server-side: never send it to a browser, never give it a `VITE_` prefix, never
> commit it. This repo's `.gitignore` covers `.env` and `.env.*`.

## 4. Verify before starting the app

```
pnpm db:diagnose
```

Checks, in order: DNS, TLS, credentials, that all 21 tables exist, whether RLS
is filtering your connection, row counts, and finally the service role key. Each
failure names its likely fix rather than handing you a bare connection error.

## 5. Start the API

```
pnpm dev
```

On first boot the server creates the single Editor account
(`editor@kenha.co.ke`), binds it to the `Editor` role, removes any other
accounts, and seeds the five sample highway projects.

The account's password is bcrypt-hashed by the API at boot, which is why the
schema file does not seed a user — a password hash has no business sitting in
a checked-in `.sql` file.

## Notes on the schema

**Quoted identifiers.** Postgres folds unquoted identifiers to lower case.
Every table and column here is quoted `"PascalCase"` so rows arrive in Node as
`{ ProjectId, ProjectName, ... }`, matching what the React frontend already
reads. If you write your own queries against this database you must quote them
too:

```sql
SELECT "ProjectName" FROM "Projects";   -- works
SELECT ProjectName FROM Projects;       -- fails: relation "projects" does not exist
```

**Row Level Security** is enabled on every table with no policies attached.
That blocks the `anon` and `authenticated` PostgREST roles from reading these
tables directly, while the API — which connects as the table owner — is
unaffected. All public data reaches visitors through `/api/v1/public/*`.

If you later want to expose read-only published projects through PostgREST,
add a policy rather than disabling RLS:

```sql
CREATE POLICY "public reads published projects"
  ON "Projects" FOR SELECT TO anon
  USING ("IsPublished" = TRUE);
```

**PostGIS is not used.** Nothing in the API runs a spatial query — the globe is
driven by `Latitude`/`Longitude` and routes are stored as GeoJSON text. An
optional block at the bottom of `schema.sql` adds geography columns and GIST
indexes if you later want radius searches or nearest-project lookups.

**Numeric types.** `NUMERIC` and `BIGINT` come back from node-postgres as
strings by default, because both can exceed JavaScript's safe integer range.
`src/db/connection.ts` installs parsers that convert them to numbers, since
every numeric column here is well inside that range and the frontend expects
numbers. `DATE` columns are deliberately left as `YYYY-MM-DD` strings so a
calendar date cannot shift across a timezone boundary.
