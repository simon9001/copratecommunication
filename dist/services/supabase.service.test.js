import { inspectServiceKey, projectRefFromDatabaseUrl } from './supabase.service.js';
let pass = 0;
let fail = 0;
function eq(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) {
        pass += 1;
        console.log(`  ok   ${name}`);
    }
    else {
        fail += 1;
        console.log(`  FAIL ${name}`);
        console.log(`       want: ${JSON.stringify(want)}`);
        console.log(`       got:  ${JSON.stringify(got)}`);
    }
}
/** Builds a syntactically valid JWT. The signature is never checked here. */
function fakeJwt(payload) {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;
}
const future = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
const past = Math.floor(Date.now() / 1000) - 60;
console.log('inspectServiceKey()\n');
const good = inspectServiceKey(fakeJwt({ role: 'service_role', ref: 'abc123xyz', exp: future }));
eq('a valid service_role key is accepted', good.valid, true);
eq('  ...and its project ref is read', good.projectRef, 'abc123xyz');
const anon = inspectServiceKey(fakeJwt({ role: 'anon', ref: 'abc123xyz', exp: future }));
eq('the anon key is rejected', anon.valid, false);
eq('  ...and named as the anon key', anon.problem?.includes('ANON key'), true);
const expired = inspectServiceKey(fakeJwt({ role: 'service_role', ref: 'abc123xyz', exp: past }));
eq('an expired key is rejected', expired.valid, false);
eq('  ...with the reason given', expired.problem, 'the key has expired');
eq('an unset key is reported as unset', inspectServiceKey(undefined).problem, 'not set');
eq('an empty key is reported as unset', inspectServiceKey('').problem, 'not set');
eq('a non-JWT string is rejected', inspectServiceKey('sbp_0102030405').problem, 'not a JWT — expected three dot-separated segments');
eq('undecodable payload is rejected', inspectServiceKey('a.!!!not-base64!!!.c').valid, false);
eq('an unexpected role is named', inspectServiceKey(fakeJwt({ role: 'authenticated', ref: 'r', exp: future })).problem, "unexpected role 'authenticated'");
console.log('\nprojectRefFromDatabaseUrl()\n');
eq('direct connection host', projectRefFromDatabaseUrl('postgresql://postgres:pw@db.abc123xyz.supabase.co:5432/postgres'), 'abc123xyz');
eq('transaction pooler puts the ref in the username', projectRefFromDatabaseUrl('postgresql://postgres.abc123xyz:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'), 'abc123xyz');
eq('a non-Supabase host yields no ref', projectRefFromDatabaseUrl('postgresql://user:pw@localhost:5432/kenha'), null);
eq('an unset url yields no ref', projectRefFromDatabaseUrl(undefined), null);
eq('an unparseable url yields no ref', projectRefFromDatabaseUrl('not a url'), null);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
