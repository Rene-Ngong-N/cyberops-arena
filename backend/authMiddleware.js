
import 'dotenv/config'
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
    const authorization = req.headers.authorization

    if (
        typeof authorization !== 'string' ||
        !authorization.startsWith('Bearer ')
    ) {
        return res.status(401).json({
            error: 'Authentication required'
        })
    }

    const token = authorization.slice(7).trim()

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required'
        })
    }

    if (!process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 64) {
        console.error('JWT_SECRET is not properly configured')

        return res.status(500).json({
            error: 'Authentication service unavailable'
        })
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ['HS256']
            }
        )

        if (
            typeof decoded.sub !== 'string' ||
            !/^[0-9]+$/.test(decoded.sub)
        ) {
            return res.status(401).json({
                error: 'Invalid authentication token'
            })
        }

        req.auth = {
            userId: decoded.sub
        }

        next()
    } catch {
        return res.status(401).json({
            error: 'Invalid or expired authentication token'
        })
    }
}
