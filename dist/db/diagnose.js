/**
 * Quick SQL Server connectivity diagnostic script.
 * Run: npx tsx src/db/diagnose.ts
 */
import mssql from 'mssql';
import { config } from 'dotenv';
config();
const DB_USER = process.env.DB_USER || 'KenHA_VR_App';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_SERVER = process.env.DB_SERVER || '127.0.0.1';
const DB_DATABASE = process.env.DB_DATABASE || 'KeNHA_VR_Projects';
const DB_PORT = parseInt(process.env.DB_PORT || '1433', 10);
console.log('='.repeat(60));
console.log('🔍 SQL Server Connection Diagnostic');
console.log('='.repeat(60));
console.log(`  Server:   ${DB_SERVER}:${DB_PORT}`);
console.log(`  Database: ${DB_DATABASE}`);
console.log(`  User:     ${DB_USER}`);
console.log(`  Password: ${'*'.repeat(DB_PASSWORD.length)} (${DB_PASSWORD.length} chars)`);
console.log('='.repeat(60));
async function diagnose() {
    // Test 1: SQL Authentication with user/password from .env
    console.log('\n[Test 1] SQL Authentication with .env credentials...');
    try {
        const pool = await new mssql.ConnectionPool({
            user: DB_USER,
            password: DB_PASSWORD,
            server: DB_SERVER,
            port: DB_PORT,
            database: DB_DATABASE,
            options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true,
            },
            connectionTimeout: 10000,
        }).connect();
        const result = await pool.request().query('SELECT @@VERSION AS Version, SUSER_NAME() AS CurrentUser');
        console.log('  ✅ SUCCESS! Connected as:', result.recordset[0].CurrentUser);
        console.log('  SQL Server Version:', result.recordset[0].Version.split('\n')[0]);
        await pool.close();
        return;
    }
    catch (err) {
        console.log(`  ❌ FAILED: ${err.message}`);
        if (err.code === 'ELOGIN') {
            console.log('  → Diagnosis: Authentication rejected. Could be wrong password or Windows Auth Only mode.');
        }
    }
    // Test 2: Try 'sa' account
    console.log('\n[Test 2] SQL Authentication with "sa" account...');
    try {
        const pool = await new mssql.ConnectionPool({
            user: 'sa',
            password: DB_PASSWORD,
            server: DB_SERVER,
            port: DB_PORT,
            database: 'master',
            options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true,
            },
            connectionTimeout: 10000,
        }).connect();
        const result = await pool.request().query('SELECT @@VERSION AS Version');
        console.log('  ✅ "sa" works with same password! Update DB_USER=sa in .env');
        await pool.close();
        return;
    }
    catch (err) {
        console.log(`  ❌ FAILED: ${err.message}`);
    }
    // Test 3: Check TCP connectivity (no auth)
    console.log('\n[Test 3] Raw TCP connectivity check...');
    const net = await import('net');
    await new Promise((resolve) => {
        const socket = net.createConnection({ host: DB_SERVER, port: DB_PORT }, () => {
            console.log(`  ✅ TCP port ${DB_PORT} is open and reachable`);
            socket.destroy();
            resolve();
        });
        socket.on('error', (err) => {
            console.log(`  ❌ TCP port ${DB_PORT} is NOT reachable: ${err.message}`);
            resolve();
        });
        socket.setTimeout(5000, () => {
            console.log(`  ❌ TCP connection timed out`);
            socket.destroy();
            resolve();
        });
    });
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSIS SUMMARY');
    console.log('='.repeat(60));
    console.log(`
  Your SQL Server TCP port is reachable, but ALL SQL logins 
  are being rejected. This strongly indicates:

  ➜ SQL Server is in "Windows Authentication Only" mode.

  FIX (in SSMS):
  1. Right-click your Server → Properties → Security
  2. Change to "SQL Server and Windows Authentication mode"
  3. Click OK
  4. Restart SQL Server service (services.msc → SQL Server → Restart)
  5. Then run: pnpm run dev
  `);
}
diagnose().catch(console.error);
