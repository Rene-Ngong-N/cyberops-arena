
import express from 'express'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] }
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

function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    players: [...room.players.values()].map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      health: player.health
    })),
    incident: room.status === 'playing'
      ? {
          title: incidents[room.round].title,
          description: incidents[room.round].description,
          choices: incidents[room.round].choices
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
      players: new Map(),
      answers: new Set()
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

  socket.on('game:start', ({ code }) => {
    const room = rooms.get(code)
    if (!room || room.host !== socket.id) return
    if (room.status !== 'waiting' || room.players.size < 2) return

    room.status = 'playing'
    room.round = 0
    room.answers.clear()
    broadcast(room)
  })

  socket.on('game:answer', ({ code, answer }) => {
    const room = rooms.get(code)
    if (!room || room.status !== 'playing') return
    if (!room.players.has(socket.id)) return
    if (room.answers.has(socket.id)) return
    if (!Number.isInteger(answer) || answer < 0 || answer >= incidents[room.round].choices.length) return

    room.answers.add(socket.id)
    const player = room.players.get(socket.id)
    const correct = answer === incidents[room.round].correct

    if (correct) player.score += 100
    else player.health = Math.max(0, player.health - 25)

    io.to(socket.id).emit('game:feedback', {
      correct,
      correctAnswer: incidents[room.round].correct
    })

    broadcast(room)

    if (room.answers.size === room.players.size) {
      room.round++
      room.answers.clear()

      if (room.round >= incidents.length) {
        room.status = 'finished'
      }

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
        if (room.round >= incidents.length) {
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
