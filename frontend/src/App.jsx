
import { useEffect, useState } from 'react'
import './App.css'
import { socket } from './socket'
const incidents = [
  {
    title: 'Suspicious AWS Login',
    severity: 'HIGH',
    description: 'An unknown IP address is attempting to access your AWS administrator account.',
    choices: [
      'Disable the affected credentials and investigate',
      'Ignore the alert',
      'Make the S3 buckets public'
    ],
    correct: 0
  },
  {
    title: 'Kubernetes Pod Failure',
    severity: 'MEDIUM',
    description: 'Multiple application pods are restarting in your production Kubernetes cluster.',
    choices: [
      'Delete the entire cluster',
      'Investigate pod logs, events, and resource usage',
      'Disable monitoring'
    ],
    correct: 1
  },
  {
    title: 'Public S3 Bucket Detected',
    severity: 'CRITICAL',
    description: 'A bucket containing sensitive application files has been exposed publicly.',
    choices: [
      'Leave the bucket accessible',
      'Delete all IAM users',
      'Block unintended public access and investigate exposure'
    ],
    correct: 2
  }
]

function App() {

  useEffect(() => {
    function onConnect() {
      console.log('CyberOps multiplayer connected:', socket.id)
      setConnected(true)
    }

    function onDisconnect() {
      setConnected(false)
      setRoom(null)
    }

    function onConnectError(err) {
      console.error('Multiplayer connection failed:', err.message)
      setConnected(false)
      setError('Unable to connect to multiplayer server.')
    }

    function onRoomUpdate(updatedRoom) {
      console.log('ROOM UPDATE:', updatedRoom.status, updatedRoom.round)
      setRoom(updatedRoom)
    }
    function onGameFeedback(result) {
      setMultiplayerFeedback(result)
      setSubmitted(true)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('room:update', onRoomUpdate)
    socket.on('game:feedback', onGameFeedback)

    if (!socket.connected) socket.connect()
    else setConnected(true)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('room:update', onRoomUpdate)
      socket.off('game:feedback', onGameFeedback)
      socket.disconnect()
    }
  }, [])


  const [player, setPlayer] = useState('')
  const [started, setStarted] = useState(false)
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(100)
  const [feedback, setFeedback] = useState(null)
  const [room, setRoom] = useState(null)
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(socket.connected)
  const [multiplayerFeedback, setMultiplayerFeedback] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const incident = incidents[round]
  const finished = round >= incidents.length

  function startGame() {
    if (!player.trim()) return
    setScore(0)
    setHealth(100)
    setRound(0)
    setFeedback(null)
    setStarted(true)
  }

  function respond(index) {
    if (feedback) return

    const correct = index === incident.correct

    setScore(previous => previous + (correct ? 100 : 0))
    setHealth(previous => Math.max(0, previous - (correct ? 0 : 25)))
    setFeedback(correct ? 'correct' : 'incorrect')
  }

  function nextRound() {
    setRound(previous => previous + 1)
    setFeedback(null)
  }

  function createRoom() {
    if (!player.trim()) {
      setError('Please enter your player name.')
      return
    }

    if (!socket.connected) {
      setError('Multiplayer server is not connected.')
      return
    }

    setError('')

    socket.timeout(5000).emit(
      'room:create',
      { name: player.trim() },
      (err, response) => {
        if (err) {
          setError('Server did not respond. Please try again.')
        } else if (response?.error) {
          setError(response.error)
        } else {
          setRoomCode(response.code)
        }
      }
    )
  }

  function joinRoom() {
    if (!player.trim() || !roomCode.trim()) {
      setError('Enter your name and room code.')
      return
    }

    if (!socket.connected) {
      setError('Multiplayer server is not connected.')
      return
    }

    setError('')

    socket.timeout(5000).emit(
      'room:join',
      { name: player.trim(), code: roomCode.trim().toUpperCase() },
      (err, response) => {
        if (err) {
          setError('Server did not respond. Please try again.')
        } else if (response?.error) {
          setError(response.error)
        } else {
          setRoomCode(response.code)
        }
      }
    )
  }

  function startMultiplayer() {
    if (room && room.players[0]?.id === socket.id) {
      socket.emit('game:start', { code: room.code })
    }
  }

  function restartMultiplayer() {
    if (!room || room.status !== 'finished') return
    if (room.players[0]?.id !== socket.id) return

    setSubmitted(false)
    setMultiplayerFeedback(null)
    setError('')

    socket.emit('game:restart', { code: room.code })
  }
  function submitMultiplayerAnswer(answerIndex) {
    if (!room || room.status !== 'playing' || submitted) return

    setSubmitted(true)
    socket.emit('game:answer', {
      code: room.code,
      answer: answerIndex
    })
  }
  useEffect(() => {
    setSubmitted(false)
    setMultiplayerFeedback(null)
  }, [room?.round])


  return (
    <div className="arena">
      <header className="header">
        <div className="brand">🛡️ CYBEROPS <span>ARENA</span></div>
        <div className="status">● SYSTEM ONLINE</div>
      </header>

      <main>
        <div className="intro">
          <p className="eyebrow">CLOUD DEFENSE SIMULATOR BY RENE N</p>
          <h1>Defend the Cloud.</h1>
          <p>Investigate threats. Make critical decisions. Protect your infrastructure.</p>
        </div>

        {!started ? (

          <section className="panel welcome">
            {!room ? (
              <>
                <h2>Enter the Multiplayer Arena</h2>
                <p>Challenge other cloud defenders in real time.</p>

                <input
                  placeholder="Enter your player name"
                  value={player}
                  maxLength={24}
                  onChange={event => setPlayer(event.target.value)}
                />

                <p className={connected ? 'good' : 'danger'}>
                  {connected ? '● Multiplayer Connected' : '● Connecting to Server'}
                </p>

                <button onClick={createRoom} disabled={!connected}>
                  CREATE ROOM
                </button>

                <p>— OR —</p>

                <input
                  placeholder="Enter 6-character room code"
                  value={roomCode}
                  maxLength={6}
                  onChange={event => setRoomCode(event.target.value.toUpperCase())}
                />

                <button onClick={joinRoom} disabled={!connected}>
                  JOIN ROOM
                </button>
              </>
            ) : (
              <>
                <h2>Multiplayer Lobby</h2>
                <p>ROOM CODE</p>
                <h1 className="room-code">{room.code}</h1>

                <button onClick={() => navigator.clipboard.writeText(room.code)}>
                  COPY ROOM CODE
                </button>

                <h3>Connected Players ({room.players.length}/4)</h3>

                <div className="player-list">
                  {room.players.map((p, index) => (
                    <div className="player-entry" key={p.id}>
                      <span>🛡️ {p.name}</span>
                      <span>{index === 0 ? 'HOST' : 'READY'}</span>
                    </div>
                  ))}
                </div>

                {room.status === 'waiting' && (
                  room.players[0]?.id === socket.id ? (
                    <button
                      disabled={room.players.length < 2}
                      onClick={startMultiplayer}
                    >
                      START MULTIPLAYER MISSION
                    </button>
                  ) : (
                    <p>Waiting for the host to start the mission...</p>
                  )
                )}

                {room.status === 'generating' && (
                  <div className="ai-loading">
                    <h3>🤖 AI MISSION GENERATION</h3>
                    <p>OpenAI is preparing your cybersecurity incidents...</p>
                    <p>Analyzing AWS, Kubernetes, and cloud security threats.</p>
                    <p>Please wait. Your mission will begin automatically.</p>
                  </div>
                )}


                {room.status === 'playing' && room.incident && (
                  <div className="multiplayer-game">
                    <h3>⚠ ACTIVE SECURITY INCIDENT</h3>

                    <p className="eyebrow">
                      ROUND {room.round + 1} OF 3
                    </p>

                    <h2>{room.incident.title}</h2>
                    <p>{room.incident.description}</p>

                    <h3>Choose your response:</h3>

                    <div className="choices">
                      {room.incident.choices.map((choice, index) => (
                        <button
                          key={index}
                          className="choice"
                          disabled={submitted}
                          onClick={() => submitMultiplayerAnswer(index)}
                        >
                          <span>{String.fromCharCode(65 + index)}</span>
                          {choice}
                        </button>
                      ))}
                    </div>

                    {multiplayerFeedback && (
                      <div className={`feedback ${multiplayerFeedback.correct ? 'correct' : 'incorrect'
                        }`}>
                        {multiplayerFeedback.correct
                          ? '✓ Correct! You earned 100 points.'
                          : '✕ Incorrect response. Health reduced by 25%.'}
                      </div>
                    )}

                    {submitted && (
                      <p>Waiting for other players to finish...</p>
                    )}

                    <h3>🏆 Live Leaderboard</h3>

                    <div className="player-list">
                      {[...room.players]
                        .sort((a, b) => b.score - a.score)
                        .map((p, index) => (
                          <div className="player-entry" key={p.id}>
                            <span>
                              {index + 1}. {p.name}
                            </span>
                            <span>
                              {p.score} PTS | {p.health}% HP
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {room.status === 'finished' && (
                  <div className="game-results">
                    <h2>🏆 Mission Complete!</h2>
                    <p>Final Multiplayer Rankings</p>

                    {[...room.players]
                      .sort((a, b) => b.score - a.score)
                      .map((p, index) => (
                        <div className="player-entry" key={p.id}>
                          <span>{index === 0 ? '🏆' : '🛡️'} {p.name}</span>
                          <span>{p.score} Points</span>
                        </div>
                      ))}

                    <p className="good">
                      {(() => {
                        const highest = Math.max(...room.players.map(p => p.score))
                        const winners = room.players.filter(p => p.score === highest)
                        return winners.length > 1
                          ? 'Mission ended in a tie!'
                          : `${winners[0].name} wins the CyberOps Arena!`
                      })()}
                    </p>

                    {room.players[0]?.id === socket.id ? (
                      <button
                        onClick={restartMultiplayer}
                        disabled={room.players.length < 2}
                      >
                        🔄 PLAY AGAIN
                      </button>
                    ) : (
                      <p>Waiting for the host to restart the mission...</p>
                    )}
                  </div>
                )}
              </>
            )}

            {error && <p className="danger">{error}</p>}
          </section>

        ) : (
          <>
            <div className="stats">
              <div className="stat">
                <small>OPERATIVE</small>
                <strong>{player}</strong>
              </div>
              <div className="stat">
                <small>DEFENSE SCORE</small>
                <strong>{score}</strong>
              </div>
              <div className="stat">
                <small>SYSTEM HEALTH</small>
                <strong className={health <= 50 ? 'danger' : 'good'}>
                  {health}%
                </strong>
              </div>
              <div className="stat">
                <small>MISSION PROGRESS</small>
                <strong>{Math.min(round + 1, incidents.length)} / {incidents.length}</strong>
              </div>
            </div>

            {finished ? (
              <section className="panel welcome">
                <h2>Mission Complete!</h2>
                <p>Final score: {score} points</p>
                <p>Infrastructure health: {health}%</p>
                <button onClick={startGame}>PLAY AGAIN</button>
              </section>
            ) : (
              <section className="panel incident">
                <div className="incident-top">
                  <span>⚠ ACTIVE SECURITY INCIDENT</span>
                  <span className="severity">{incident.severity}</span>
                </div>
                <h2>{incident.title}</h2>
                <p>{incident.description}</p>
                <h3>Choose your response:</h3>

                <div className="choices">
                  {incident.choices.map((choice, index) => (
                    <button
                      key={index}
                      className="choice"
                      disabled={feedback !== null}
                      onClick={() => respond(index)}
                    >
                      <span>{String.fromCharCode(65 + index)}</span>
                      {choice}
                    </button>
                  ))}
                </div>

                {feedback && (
                  <div className={`feedback ${feedback}`}>
                    <strong>
                      {feedback === 'correct'
                        ? '✓ Threat handled successfully! +100 points'
                        : '✕ Incorrect response. Infrastructure health -25%'}
                    </strong>
                    <p>
                      Recommended response: {incident.choices[incident.correct]}
                    </p>
                    <button onClick={nextRound}>NEXT INCIDENT →</button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer>CYBEROPS ARENA • AI-POWERED CLOUD DEFENSE CHALLENGE</footer>
    </div >
  )
}

export default App
