import { seedDemoUsers } from './seed.js';
import { closeDbPool } from './connection.js';
import { query } from './query.js';
async function run() {
    console.log('--- Starting KeNHA Account Seeding ---');
    await seedDemoUsers();
    console.log('\n--- Verifying Seeded Users in Database ---');
    const users = await query(`
    SELECT 
      u.UserId,
      u.FullName,
      u.Email,
      u.IsActive,
      STRING_AGG(r.RoleName, ', ') AS Roles
    FROM Users u
    LEFT JOIN UserRoles ur ON u.UserId = ur.UserId
    LEFT JOIN Roles r ON ur.RoleId = r.RoleId
    GROUP BY u.UserId, u.FullName, u.Email, u.IsActive
    ORDER BY u.UserId ASC
  `);
    console.table(users);
    await closeDbPool();
    console.log('--- Seeding Completed Successfully ---');
}
run().catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
});
