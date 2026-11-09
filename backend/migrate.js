
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { pool } from './db.js'

try {
    console.log('Starting CyberOps Arena V2 database migration...')

    const sql = await readFile(
        new URL('./create-users.sql', import.meta.url),
        'utf8'
    )

    await pool.query(sql)

    console.log('Users table created successfully!')

    const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
        ORDER BY ordinal_position
    `)

    console.table(result.rows)
} catch (error) {
    console.error('Database migration failed:', error.message)
    process.exitCode = 1
} finally {
    await pool.end()
}
