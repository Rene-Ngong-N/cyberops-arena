
import { pool } from './db.js'
import bcrypt from 'bcryptjs'

try {
    const result = await pool.query(
        `SELECT id, username, password_hash
         FROM users
         WHERE email = $1`,
        ['testplayer01@example.com']
    )

    if (result.rows.length === 0) {
        throw new Error('Test user not found')
    }

    const user = result.rows[0]

    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(
        user.password_hash
    )

    const passwordMatches = await bcrypt.compare(
        'CyberOpsTest2026!Secure',
        user.password_hash
    )

    console.log('User ID:', user.id)
    console.log('Username:', user.username)
    console.log('Bcrypt hash detected:', isBcryptHash)
    console.log('Password verification:', passwordMatches)

    if (!isBcryptHash || !passwordMatches) {
        process.exitCode = 1
    }
} catch (error) {
    console.error('Verification failed:', error.message)
    process.exitCode = 1
} finally {
    await pool.end()
}
