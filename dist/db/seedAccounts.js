import { seedEditorAccount } from './seed.js';
import { closeDbPool } from './connection.js';
import { query } from './query.js';
async function run() {
    console.log('--- Provisioning the single KeNHA Editor account ---');
    await seedEditorAccount();
    console.log('\n--- Accounts present in the database ---');
    const users = await query(`
    SELECT
      u."UserId",
      u."FullName",
      u."Email",
      u."IsActive",
      STRING_AGG(r."RoleName", ', ') AS "Roles"
    FROM "Users" u
    LEFT JOIN "UserRoles" ur ON u."UserId" = ur."UserId"
    LEFT JOIN "Roles" r      ON ur."RoleId" = r."RoleId"
    GROUP BY u."UserId", u."FullName", u."Email", u."IsActive"
    ORDER BY u."UserId" ASC
  `);
    console.table(users);
    if (users.length !== 1) {
        console.warn(`WARNING: expected exactly 1 account, found ${users.length}.`);
    }
    await closeDbPool();
    console.log('--- Done ---');
}
run().catch(async (err) => {
    console.error('Seeding error:', err);
    await closeDbPool();
    process.exit(1);
});
