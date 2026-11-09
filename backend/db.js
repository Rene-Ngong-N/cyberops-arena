
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
}

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: true
    },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5
})

export async function testDatabaseConnection() {
    const client = await pool.connect()

    try {
        const result = await client.query(
            'SELECT current_database() AS database_name'
        )

        console.log(
            'PostgreSQL connection successful:',
            result.rows[0].database_name
        )
    } finally {
        client.release()
    }
}
