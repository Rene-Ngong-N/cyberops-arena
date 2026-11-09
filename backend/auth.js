import { rateLimit } from 'express-rate-limit'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from './db.js'
import jwt from 'jsonwebtoken'
import { requireAuth } from './authMiddleware.js'

const router = Router()

const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: 'Too many registration attempts. Please try again in 15 minutes.'
    }
})

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: 'Too many login attempts. Please try again in 15 minutes.'
    }
})

router.post('/register', registrationLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body ?? {}

        if (
            typeof username !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                error: 'Username, email and password are required'
            })
        }

        const cleanUsername = username.trim()
        const cleanEmail = email.trim().toLowerCase()

        if (
            !/^[a-zA-Z0-9_]{3,50}$/.test(cleanUsername) ||
            cleanEmail.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
            password.length < 12 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                error: 'Invalid username, email or password format'
            })
        }

        const passwordHash = await bcrypt.hash(password, 12)

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, role, created_at`,
            [cleanUsername, cleanEmail, passwordHash]
        )

        return res.status(201).json({
            message: 'Registration successful',
            user: result.rows[0]
        })
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                error: 'Username or email already registered'
            })
        }

        console.error('Registration failed:', error.message)

        return res.status(500).json({
            error: 'Unable to complete registration'
        })
    }
})


router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body ?? {}

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: 'Email and password are required'
            })
        }

        const cleanEmail = email.trim().toLowerCase()

        if (cleanEmail.length > 255 || password.length > 1024) {
            return res.status(400).json({
                error: 'Invalid email or password'
            })
        }

        const result = await pool.query(
            `SELECT id, username, email, password_hash, role
             FROM users
             WHERE email = $1`,
            [cleanEmail]
        )

        const user = result.rows[0]

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({
                error: 'Invalid email or password'
            })
        }

        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
            throw new Error('JWT_SECRET is missing or too short')
        }

        const token = jwt.sign(
            { role: user.role },
            process.env.JWT_SECRET,
            {
                subject: String(user.id),
                expiresIn: '1h',
                algorithm: 'HS256'
            }
        )

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        })
    } catch (error) {
        console.error('Login failed:', error.message)

        return res.status(500).json({
            error: 'Unable to complete login'
        })
    }
})

router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, role, created_at
             FROM users
             WHERE id = $1`,
            [req.auth.userId]
        )

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Account no longer exists'
            })
        }

        return res.status(200).json({
            user: result.rows[0]
        })
    } catch (error) {
        console.error('Profile retrieval failed:', error.message)

        return res.status(500).json({
            error: 'Unable to retrieve player profile'
        })
    }
})

export default router
