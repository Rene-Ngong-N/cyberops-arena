
import express from 'express'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { Server } from 'socket.io'
import cors from 'cors'
import 'dotenv/config'
import OpenAI from 'openai'

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: { origin: true, methods: ['GET', 'POST'] }
})
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})
const rooms = new Map()

const incidents = [
    {
        title: 'Suspicious AWS Login',
        description: 'An unknown IP is attempting administrator access.',
        choices: [
            'Disable credentials and investigate',
            'Ignore the alert',
            'Make S3 buckets public'
        ],
        correct: 0
    },
    {
        title: 'Kubernetes Pod Failure',
        description: 'Production pods are repeatedly restarting.',
        choices: [
            'Delete the cluster',
            'Investigate logs, events, and resource usage',
            'Disable monitoring'
        ],
        correct: 1
    },
    {
        title: 'Public S3 Bucket',
        description: 'Sensitive application files may be publicly exposed.',
        choices: [
            'Leave the bucket public',
            'Delete all IAM users',
            'Block unintended public access and investigate'
        ],
        correct: 2
    }
]
async function generateAIIncidents() {
    try {
        console.log('Generating AI cybersecurity incidents...')

        const response = await openai.responses.create({
            model: 'gpt-4.1-mini',
            instructions: `You are a cloud cybersecurity trainer
creating realistic incident-response questions for a
multiplayer educational game.

Return only valid JSON with this structure:
{
  "incidents": [
    {
      "title": "Short incident title",
      "description": "A realistic incident scenario and question",
      "choices": [
        "Response option 1",
        "Response option 2",
        "Response option 3"
      ],
      "correct": 0
    }
  ]
}

Generate exactly 3 incidents.
Cover AWS, Kubernetes, and cloud security.
Each incident must have exactly 3 choices.
The correct value must be the zero-based index
of the correct choice: 0, 1, or 2.
Only one choice should be clearly correct.
Do not include the correct answer in the description.`,
            input: 'Generate exactly three new cloud cybersecurity incidents. Return the response as valid JSON only.',
            text: {
                format: { type: 'json_object' }
            },
            max_output_tokens: 1500
        })

        const data = JSON.parse(response.output_text)

        if (!Array.isArray(data.incidents) ||
            data.incidents.length !== 3) {
            throw new Error('Expected exactly 3 incidents')
        }

        for (const incident of data.incidents) {
            if (
                typeof incident.title !== 'string' ||
                !incident.title.trim() ||
                typeof incident.description !== 'string' ||
                !incident.description.trim() ||
                !Array.isArray(incident.choices) ||
                incident.choices.length !== 3 ||
                !incident.choices.every(choice =>
                    typeof choice === 'string' && choice.trim()
                ) ||
                !Number.isInteger(incident.correct) ||
                incident.correct < 0 ||
                incident.correct > 2
            ) {
                throw new Error('Invalid AI incident format')
            }
        }

        console.log('Successfully generated 3 AI incidents!')
        return data.incidents

    } catch (error) {
        console.error('AI generation failed:', error.message)
        console.log('Using existing cybersecurity incidents.')
        return incidents.map(incident => ({
            ...incident,
            choices: [...incident.choices]
        }))
    }
}

function publicRoom(room) {
    return {
        code: room.code,
        status: room.status,
        round: room.round,
        cloudHealth: room.cloudHealth,
        roundEndsAt: room.roundEndsAt ?? null,
        players: [...room.players.values()].map(player => ({
            id: player.id,
            name: player.name,
            score: player.score,
            health: player.health
        })),

        incident: room.status === 'playing' && room.incidents[room.round]
            ? {
                title: room.incidents[room.round].title,
                description: room.incidents[room.round].description,
                choices: room.incidents[room.round].choices
            }
            : null
    }
}

function broadcast(room) {
    io.to(room.code).emit('room:update', publicRoom(room))
}

io.on('connection', socket => {
    socket.on('room:create', ({ name }, reply) => {
        if (typeof name !== 'string' || !name.trim()) {
            return reply({ error: 'Player name required' })
        }

        let code
        do {
            code = randomBytes(3).toString('hex').toUpperCase()
        } while (rooms.has(code))


        const room = {
            code,
            host: socket.id,
            status: 'waiting',
            round: 0,
            cloudHealth: 100,
            players: new Map(),
            answers: new Set(),
            incidents: incidents.map(incident => ({
                ...incident,
                choices: [...incident.choices]
            }))
        }

        room.players.set(socket.id, {
            id: socket.id,
            name: name.trim().slice(0, 24),
            score: 0,
            health: 100
        })

        rooms.set(code, room)
        socket.join(code)
        reply({ code })
        broadcast(room)
    })

    socket.on('room:join', ({ code, name }, reply) => {
        const room = rooms.get(String(code).toUpperCase())

        if (!room || room.status !== 'waiting') {
            return reply({ error: 'Room unavailable' })
        }

        if (room.players.size >= 4) {
            return reply({ error: 'Room is full' })
        }

        if (typeof name !== 'string' || !name.trim()) {
            return reply({ error: 'Player name required' })
        }

        room.players.set(socket.id, {
            id: socket.id,
            name: name.trim().slice(0, 24),
            score: 0,
            health: 100
        })

        socket.join(room.code)
        reply({ code: room.code })
        broadcast(room)
    })


    socket.on('game:start', async ({ code }) => {
        const room = rooms.get(code)

        if (!room || room.host !== socket.id) return
        if (room.status !== 'waiting' || room.players.size < 2) return

        // Prevent duplicate AI requests while generating questions
        room.status = 'generating'
        broadcast(room)

        // Generate new incidents, or use fallback questions
        const newIncidents = await generateAIIncidents()

        // Check that the room still exists and has enough players
        if (rooms.get(code) !== room) return

        if (room.players.size < 2) {
            room.status = 'waiting'
            broadcast(room)
            return
        }

        room.incidents = newIncidents
        room.round = 0
        room.cloudHealth = 100
        room.answers.clear()
        room.status = 'playing'
        room.roundEndsAt = Date.now() + 45_000
        broadcast(room)
    })


    socket.on('game:restart', async ({ code }) => {
        const room = rooms.get(code)

        // Only the host can restart a completed game
        if (!room || room.host !== socket.id) return
        if (room.status !== 'finished') return
        if (room.players.size < 2) return

        // Prevent multiple restart requests while AI generates
        room.status = 'generating'
        broadcast(room)

        // Generate three fresh incidents
        const newIncidents = await generateAIIncidents()

        // Make sure the room still exists
        if (rooms.get(code) !== room) return

        // If too many players disconnected, stop the restart
        if (room.players.size < 2) {
            room.status = 'finished'
            broadcast(room)
            return
        }

        // Reset scores and health
        for (const player of room.players.values()) {
            player.score = 0
            player.health = 100
        }

        // Replace the previous questions
        room.incidents = newIncidents

        // Start the new mission
        room.round = 0
        room.cloudHealth = 100
        room.answers.clear()
        room.status = 'playing'
        room.roundEndsAt = Date.now() + 45_000
        // Update both players
        broadcast(room)
    })

    socket.on('game:answer', ({ code, answer }) => {
        const room = rooms.get(code)
        if (!room || room.status !== 'playing') return
        if (!room.players.has(socket.id)) return
        if (room.answers.has(socket.id)) return
        if (!Number.isInteger(answer) || answer < 0 || answer >= room.incidents[room.round].choices.length) return

        room.answers.add(socket.id)
        const player = room.players.get(socket.id)

        const correct = answer === room.incidents[room.round].correct

        if (correct) {
            player.score += 100
            room.cloudHealth = Math.min(100, room.cloudHealth + 10)
        } else {
            player.health = Math.max(0, player.health - 25)
            room.cloudHealth = Math.max(0, room.cloudHealth - 20)
        }

        io.to(socket.id).emit('game:feedback', {
            correct,
            correctAnswer: room.incidents[room.round].correct
        })

        broadcast(room)


        if (room.cloudHealth <= 40) {
            room.status = 'finished'
            room.answers.clear()

            console.log('TEAM DEFEATED:', room.code)
            broadcast(room)
        } else if (room.answers.size === room.players.size) {
            room.round++
            room.answers.clear()

            if (room.round >= room.incidents.length) {
                room.status = 'finished'
                console.log('TEAM VICTORY:', room.code)
            }

            console.log('GAME STATUS:', room.code, room.status, room.round)
            broadcast(room)
        }
    })

    socket.on('disconnect', () => {
        for (const [code, room] of rooms) {
            if (!room.players.has(socket.id)) continue

            room.players.delete(socket.id)
            room.answers.delete(socket.id)

            if (room.players.size === 0) {
                rooms.delete(code)
                continue
            }

            if (room.host === socket.id) {
                room.host = room.players.keys().next().value
            }

            if (room.status === 'playing' &&
                room.answers.size === room.players.size) {
                room.round++
                room.answers.clear()
                if (room.round >= room.incidents.length) {
                    room.status = 'finished'
                }
            }

            broadcast(room)
        }
    })
})

app.get('/health', (req, res) => {
    res.json({ status: 'online', game: 'CyberOps Arena' })
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CyberOps multiplayer server running on port ${PORT}`)
})
