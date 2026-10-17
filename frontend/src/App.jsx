
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
  }

  function onConnectError(error) {
    console.error('Multiplayer connection failed:', error.message)
  }

  socket.on('connect', onConnect)
  socket.on('connect_error', onConnectError)
  socket.connect()

  return () => {
    socket.off('connect', onConnect)
    socket.off('connect_error', onConnectError)
    socket.disconnect()
  }
}, [])
  const [player, setPlayer] = useState('')
  const [started, setStarted] = useState(false)
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(100)
  const [feedback, setFeedback] = useState(null)

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

  return (
    <div className="arena">
      <header className="header">
        <div className="brand">🛡️ CYBEROPS <span>ARENA</span></div>
        <div className="status">● SYSTEM ONLINE</div>
      </header>

      <main>
        <div className="intro">
          <p className="eyebrow">CLOUD DEFENSE SIMULATOR</p>
          <h1>Defend the Cloud.</h1>
          <p>Investigate threats. Make critical decisions. Protect your infrastructure.</p>
        </div>

        {!started ? (
          <section className="panel welcome">
            <h2>Enter the Arena</h2>
            <p>Your cybersecurity mission starts here.</p>
            <input
              placeholder="Enter your player name"
              value={player}
              maxLength={24}
              onChange={event => setPlayer(event.target.value)}
            />
            <button onClick={startGame}>START MISSION →</button>
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
    </div>
  )
}

export default App
