
import { pool, testDatabaseConnection } from './db.js'

try {
    await testDatabaseConnection()
} catch (error) {
    console.error('Database connection failed:', error.message)
    process.exitCode = 1
} finally {
    await pool.end()
}
