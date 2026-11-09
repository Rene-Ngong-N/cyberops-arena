
import 'dotenv/config'
import jwt from 'jsonwebtoken'

const token = process.argv[2]

if (!token) {
    console.error('Token argument is required')
    process.exit(1)
}

try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256']
    })

    console.log('JWT signature valid:', true)
    console.log('User ID:', decoded.sub)
    console.log('Role:', decoded.role)
    console.log('Expires in approximately:',
        Math.round((decoded.exp - decoded.iat) / 60),
        'minutes'
    )
} catch (error) {
    console.error('JWT verification failed:', error.message)
    process.exitCode = 1
}
