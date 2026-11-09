
import { useState } from 'react'

export default function AuthPanel({ mode, onBack, onLogin }) {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const isRegister = mode === 'register'



    async function handleSubmit(event) {
        event.preventDefault()

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const apiUrl = import.meta.env.VITE_API_URL

            if (!apiUrl) {
                throw new Error('Authentication API URL is not configured')
            }

            const endpoint = isRegister ? 'register' : 'login'

            const payload = isRegister
                ? { username, email, password }
                : { email, password }

            const response = await fetch(
                `${apiUrl}/api/auth/${endpoint}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            )

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed')
            }

            setPassword('')

            if (isRegister) {
                setSuccess('Account created successfully! You can now log in.')
            } else {
                setSuccess('Login successful!')
                onLogin?.(data.user, data.token)
            }
        } catch (err) {
            setError(err.message || 'Authentication failed')
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="auth-panel">
            <h3>{isRegister ? 'Create Player Account' : 'Player Login'}</h3>

            <p>
                {isRegister
                    ? 'Create your account to begin tracking your training progress.'
                    : 'Welcome back, cloud defender.'}
            </p>

            <form onSubmit={handleSubmit}>
                {isRegister && (
                    <input
                        type="text"
                        placeholder="Username"
                        autoComplete="username"
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        required
                        minLength={3}
                        maxLength={50}
                    />
                )}

                <input
                    type="email"
                    placeholder="Email address"
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    required
                    minLength={isRegister ? 12 : undefined}
                />

                <button type="submit" disabled={loading}>
                    {loading ? 'PLEASE WAIT...' : isRegister ? 'REGISTER' : 'LOGIN'}
                </button>
            </form>
            {error && <p className="danger" role="alert">{error}</p>}
            {success && <p className="good" role="status">{success}</p>}

            <button type="button" onClick={onBack}>
                BACK TO GUEST PLAY
            </button>
        </div>
    )
}
