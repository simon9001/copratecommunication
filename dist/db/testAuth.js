import { AuthService } from '../modules/auth/auth.service.js';
import { EDITOR_ACCOUNT } from './seed.js';
import { closeDbPool } from './connection.js';
async function testAuth() {
    console.log(`Testing login for ${EDITOR_ACCOUNT.email}...`);
    const res = await AuthService.login({
        email: EDITOR_ACCOUNT.email,
        password: EDITOR_ACCOUNT.password,
    });
    console.log('✅ Login successful!');
    console.log('User:', res.user);
    console.log('Token generated (first 30 chars):', res.token.substring(0, 30) + '...');
    await closeDbPool();
}
testAuth().catch(async (err) => {
    console.error('❌ Auth test failed:', err);
    await closeDbPool();
    process.exit(1);
});
