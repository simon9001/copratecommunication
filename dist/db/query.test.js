import { toPositional } from './query.js';
let pass = 0;
let fail = 0;
function check(name, sql, params, expectText, expectValues) {
    const got = toPositional(sql, params);
    const okText = got.text === expectText;
    const okValues = JSON.stringify(got.values) === JSON.stringify(expectValues);
    if (okText && okValues) {
        pass += 1;
        console.log(`  ok   ${name}`);
    }
    else {
        fail += 1;
        console.log(`  FAIL ${name}`);
        if (!okText) {
            console.log(`       text expected: ${JSON.stringify(expectText)}`);
            console.log(`       text got:      ${JSON.stringify(got.text)}`);
        }
        if (!okValues) {
            console.log(`       values expected: ${JSON.stringify(expectValues)}`);
            console.log(`       values got:      ${JSON.stringify(got.values)}`);
        }
    }
}
console.log('toPositional()\n');
check('single parameter', 'SELECT * FROM "Users" WHERE "Email" = @email', [{ name: 'email', value: 'a@b.com' }], 'SELECT * FROM "Users" WHERE "Email" = $1', ['a@b.com']);
check('multiple parameters keep order', 'INSERT INTO "T" (a, b, c) VALUES (@one, @two, @three)', [{ name: 'one', value: 1 }, { name: 'two', value: 2 }, { name: 'three', value: 3 }], 'INSERT INTO "T" (a, b, c) VALUES ($1, $2, $3)', [1, 2, 3]);
check('a repeated name reuses the same placeholder', 'UPDATE "Projects" SET "CreatedBy" = @uid WHERE "CreatedBy" <> @uid AND "UpdatedBy" = @uid', [{ name: 'uid', value: 7 }], 'UPDATE "Projects" SET "CreatedBy" = $1 WHERE "CreatedBy" <> $1 AND "UpdatedBy" = $1', [7]);
check('numbering follows first appearance, not array order', 'SELECT @b, @a', [{ name: 'a', value: 'A' }, { name: 'b', value: 'B' }], 'SELECT $1, $2', ['B', 'A']);
check('an @ inside a string literal is left alone', `SELECT * FROM "Users" WHERE "Email" = @email OR "Email" = 'literal@example.com'`, [{ name: 'email', value: 'x' }], `SELECT * FROM "Users" WHERE "Email" = $1 OR "Email" = 'literal@example.com'`, ['x']);
check('an unknown @name is not touched', 'SELECT @known, @unknown', [{ name: 'known', value: 1 }], 'SELECT $1, @unknown', [1]);
check('explicit casts survive intact', 'UPDATE "T" SET x = COALESCE(@val::numeric, x), y = COALESCE(@flag::boolean, y)', [{ name: 'val', value: null }, { name: 'flag', value: true }], 'UPDATE "T" SET x = COALESCE($1::numeric, x), y = COALESCE($2::boolean, y)', [null, true]);
check('no parameters is a pass-through', 'SELECT 1', [], 'SELECT 1', []);
check('a name that prefixes another is not truncated', 'SELECT @id, @idExtra', [{ name: 'id', value: 1 }, { name: 'idExtra', value: 2 }], 'SELECT $1, $2', [1, 2]);
check('line comments are ignored', 'SELECT @a -- not @b here\n, @a', [{ name: 'a', value: 9 }, { name: 'b', value: 8 }], 'SELECT $1 -- not @b here\n, $1', [9]);
check('block comments are ignored', 'SELECT /* @b */ @a', [{ name: 'a', value: 1 }, { name: 'b', value: 2 }], 'SELECT /* @b */ $1', [1]);
check('quoted identifiers containing @ are ignored', 'SELECT "we@ird" FROM "T" WHERE x = @x', [{ name: 'x', value: 5 }], 'SELECT "we@ird" FROM "T" WHERE x = $1', [5]);
check('escaped quote inside a literal does not break masking', `SELECT * FROM "T" WHERE n = 'O''Brien @nope' AND id = @id`, [{ name: 'id', value: 3 }, { name: 'nope', value: 'X' }], `SELECT * FROM "T" WHERE n = 'O''Brien @nope' AND id = $1`, [3]);
check('a real multi-line insert', `INSERT INTO "ProjectLocations" (
    "ProjectId", "County", "Latitude", "Longitude", "IsPrimaryLocation"
  ) VALUES (
    @projectId, @county, @lat, @lng, TRUE
  )
  RETURNING *`, [
    { name: 'projectId', value: 12 },
    { name: 'county', value: 'Kisumu' },
    { name: 'lat', value: -0.09 },
    { name: 'lng', value: 34.76 },
], `INSERT INTO "ProjectLocations" (
    "ProjectId", "County", "Latitude", "Longitude", "IsPrimaryLocation"
  ) VALUES (
    $1, $2, $3, $4, TRUE
  )
  RETURNING *`, [12, 'Kisumu', -0.09, 34.76]);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
