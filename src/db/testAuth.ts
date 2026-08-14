import { AuthService } from '../modules/auth/auth.service.js'
import { closeDbPool } from './connection.js'

async function testAuth() {
  console.log('Testing login for admin@kenha.co.ke...')
  const res = await AuthService.login({
    email: 'admin@kenha.co.ke',
    password: 'Admin@KeNHA2026!',
  })

  console.log('✅ Login successful!')
  console.log('User:', res.user)
  console.log('Token generated (first 30 chars):', res.token.substring(0, 30) + '...')

  await closeDbPool()
}

testAuth().catch((err) => {
  console.error('❌ Auth test failed:', err)
  process.exit(1)
})
