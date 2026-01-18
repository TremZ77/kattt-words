import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useGame } from './hooks/useGame';
import { getBoardLayout } from './shared/constants';
import './index.css';

const LAYOUT = getBoardLayout();

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'white', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <p>{this.state.error?.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>Reload Game</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { gameState, error, userStats, createRoom, joinRoom, getStats, setReady, playWord, socketId, socket } = useGame();
  const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
  const [pendingMove, setPendingMove] = useState<{ r: number; c: number; tile: any }[]>([]);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);

  // New State for UI Features
  const [showMenu, setShowMenu] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [squareIntention, setSquareIntention] = useState<{ r: number, c: number, type: string } | null>(null);

  /* State for theme */
  const [theme, setTheme] = useState('default');

  // Initialize User ID
  useEffect(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = 'user-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('userId', id);
    }
    setUserId(id);
  }, []);

  // Save Player Name
  useEffect(() => {
    if (playerName) localStorage.setItem('playerName', playerName);
  }, [playerName]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /* Clear pending move only when the board updates */
  useEffect(() => {
    setPendingMove([]);
  }, [gameState?.board, gameState?.currentPlayerIndex]);

  const handleCreate = () => createRoom(playerName, userId);
  const handleJoin = () => joinRoom(roomCodeInput, playerName, userId);
  const handleObserver = () => joinRoom(roomCodeInput, '', userId); // Observer usually doesn't need ID but passing anyway for consistency

  const fetchStats = () => {
    getStats(userId);
    setShowStats(true);
    setShowMenu(false);
  };

  if (!gameState) {
    return (
      <div className="lobby">
        <h1 style={{ fontSize: '3rem', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          KATTT WORDS
        </h1>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
          <input
            type="text"
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: 'white' }}
          />
          <button className="btn-primary" onClick={handleCreate}>Create Game</button>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Room Code"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: 'white', flex: 1 }}
            />
            <button className="btn-primary" onClick={handleJoin}>Join</button>
          </div>
          <button
            style={{ background: 'transparent', border: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)' }}
            className="btn-primary"
            onClick={handleObserver}
          >
            View Board (Observer)
          </button>

          <button
            style={{ marginTop: '1rem', fontSize: '0.9rem', background: 'transparent', border: 'none', color: 'var(--text-dim)', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={fetchStats}
          >
            My Profile & Stats
          </button>

          {error && <p style={{ color: '#f43f5e', fontSize: '0.8rem' }}>{error}</p>}

          {/* Stats Modal in Lobby */}
          {showStats && userStats && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="glass-panel" style={{ padding: '2rem', width: '300px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--accent-primary)' }}>{userStats.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0', textAlign: 'left' }}>
                  <div>Games Played:</div><div style={{ textAlign: 'right' }}>{userStats.games_played}</div>
                  <div>Wins:</div><div style={{ textAlign: 'right' }}>{userStats.games_won}</div>
                  <div>Win Rate:</div><div style={{ textAlign: 'right' }}>{userStats.games_played ? Math.round((userStats.games_won / userStats.games_played) * 100) : 0}%</div>
                  <div>High Score:</div><div style={{ textAlign: 'right' }}>{userStats.high_score}</div>
                </div>
                <button className="btn-primary" onClick={() => setShowStats(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Safe access to players logic
  const players = gameState.players || [];
  const currentPlayer = players.find(p => p.id === socketId);
  const activePlayer = players[gameState.currentPlayerIndex];
  const isMyTurn = activePlayer?.id === socketId;

  const handleSquareClick = (r: number, c: number) => {
    // Show info if empty and no tile selected
    if (!gameState.board[r][c] && selectedTileIndex === null && pendingMove.length === 0) {
      const type = LAYOUT[r][c];
      setSquareIntention({ r, c, type });
      return;
    }

    if (!isMyTurn || gameState.board[r][c] || selectedTileIndex === null || !currentPlayer) return;
    if (pendingMove.some(m => m.r === r && m.c === c)) return;

    const tile = currentPlayer.rack[selectedTileIndex];
    if (!tile) return;

    setPendingMove([...pendingMove, { r, c, tile }]);
    setSelectedTileIndex(null);
  };

  const handlePlay = () => {
    if (pendingMove.length === 0) return;
    playWord(pendingMove);
  };

  const handleCancel = () => {
    setPendingMove([]);
    setSelectedTileIndex(null);
  };

  const handleSkip = () => {
    alert("Skip Turn feature coming in next update! (Server logic pending)");
    setShowMenu(false);
  };

  const handleExit = () => {
    window.location.reload();
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-panel" style={{ margin: '0.5rem', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setShowMenu(true)}
            style={{ background: 'transparent', border: '1px solid var(--text-dim)', color: 'var(--text-main)', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
          >
            ☰ Menu
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Room: {gameState.roomCode}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                Bag: {gameState.tileBagCount} | {gameState.gameStatus}
              </p>
              {error && <span style={{ color: '#f43f5e', fontSize: '0.8rem', fontWeight: 'bold' }}>⚠️ {error}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{ background: 'var(--glass-bg)', color: 'var(--text-main)', border: '1px solid var(--glass-border)', padding: '0.25rem', borderRadius: '4px' }}
          >
            <option value="default">Cosmic</option>
            <option value="light">Daylight</option>
            <option value="neon">Cyberpunk</option>
          </select>

          {gameState.gameStatus === 'LOBBY' && !currentPlayer?.isReady && (
            <button className="btn-primary" onClick={setReady}>Ready</button>
          )}
          {gameState.gameStatus === 'LOBBY' && (
            <button className="btn-primary" style={{ background: '#6366f1' }} onClick={() => socket?.emit('addBot', gameState.roomCode)}>+ Bot</button>
          )}
          {isMyTurn && pendingMove.length > 0 && (
            <>
              <button className="btn-primary" style={{ background: '#10b981' }} onClick={handlePlay}>Play</button>
              <button className="btn-primary" style={{ background: '#ef4444' }} onClick={handleCancel}>X</button>
            </>
          )}
          {gameState.gameStatus === 'PLAYING' && (
            <div style={{ padding: '0.5rem 1rem', background: isMyTurn ? 'var(--accent-primary)' : 'transparent', borderRadius: '20px', border: isMyTurn ? 'none' : '1px solid var(--text-dim)', fontWeight: 'bold' }}>
              {isMyTurn ? "YOUR TURN" : `${activePlayer?.name || 'Unknown'}`}
            </div>
          )}
        </div>
      </header>

      {/* Menu Modal */}
      {showMenu && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Game Menu</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{ padding: '0.5rem', background: '#334155', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                <option value="default">Cosmic</option>
                <option value="light">Daylight</option>
                <option value="neon">Cyberpunk</option>
              </select>
            </div>
            <button onClick={fetchStats} className="btn-primary" style={{ background: 'var(--accent-secondary)' }}>My Stats</button>
            <hr style={{ borderColor: 'var(--glass-border)', width: '100%' }} />
            {gameState.gameStatus === 'PLAYING' && isMyTurn && (
              <button className="btn-primary" style={{ background: '#eab308' }} onClick={handleSkip}>Skip Turn</button>
            )}
            <button className="btn-primary" style={{ background: '#ef4444' }} onClick={handleExit}>Exit Game</button>
            <button className="btn-primary" style={{ background: '#64748b' }} onClick={() => setShowMenu(false)}>Close Menu</button>
          </div>
        </div>
      )}

      {/* Stats Modal In Game */}
      {showStats && userStats && gameState && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '300px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent-primary)' }}>{userStats.name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0', textAlign: 'left' }}>
              <div>Games Played:</div><div style={{ textAlign: 'right' }}>{userStats.games_played}</div>
              <div>Wins:</div><div style={{ textAlign: 'right' }}>{userStats.games_won}</div>
              <div>Win Rate:</div><div style={{ textAlign: 'right' }}>{userStats.games_played ? Math.round((userStats.games_won / userStats.games_played) * 100) : 0}%</div>
              <div>High Score:</div><div style={{ textAlign: 'right' }}>{userStats.high_score}</div>
            </div>
            <button className="btn-primary" onClick={() => setShowStats(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Square Info Modal */}
      {squareIntention && (
        <div className="glass-panel" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '1rem', zIndex: 50, textAlign: 'center' }}>
          <h4>Square Info</h4>
          <p>Type: <strong>{squareIntention.type}</strong></p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            {squareIntention.type === 'DW' && 'Double Word Score'}
            {squareIntention.type === 'TW' && 'Triple Word Score'}
            {squareIntention.type === 'QW' && 'Quadruple Word Score'}
            {squareIntention.type === 'DL' && 'Double Letter Score'}
            {squareIntention.type === 'TL' && 'Triple Letter Score'}
            {squareIntention.type === 'QL' && 'Quadruple Letter Score'}
            {squareIntention.type === 'NONE' && 'Normal Square'}
          </p>
          <button style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem' }} onClick={() => setSquareIntention(null)}>Close</button>
        </div>
      )}

      <div className="board-container">
        <div className="scrabble-board">
          {gameState.board.map((row, r) => (
            row.map((tile, c) => {
              const pending = pendingMove.find(m => m.r === r && m.c === c);
              const displayTile = tile || pending?.tile;
              const multiplier = LAYOUT[r][c];
              const isCenter = r === 10 && c === 10;

              return (
                <div
                  key={`${r}-${c}`}
                  className={`square ${multiplier} ${isCenter ? 'center-star' : ''}`}
                  onClick={() => handleSquareClick(r, c)}
                  style={{ opacity: pending ? 0.7 : 1, border: pending ? '1px dashed white' : 'none' }}
                >
                  {displayTile ? (
                    <div className="tile">
                      {displayTile.letter}
                      <span className="points">{displayTile.points}</span>
                    </div>
                  ) : (
                    isCenter ? <span style={{ fontSize: '20px' }}>★</span> :
                      multiplier !== 'NONE' ? multiplier : ''
                  )}
                </div>
              );
            })
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ margin: '0.5rem', padding: '0.5rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {players.map(p => (
            <div key={p.id} style={{ padding: '0.25rem 0.75rem', border: p.id === activePlayer?.id ? '1px solid var(--accent-primary)' : '1px solid transparent', background: p.id === socketId ? 'rgba(255,255,255,0.05)' : 'transparent', borderRadius: '4px', minWidth: '100px', fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 'bold' }}>{p.name} {p.isReady && gameState.gameStatus === 'LOBBY' ? '✓' : ''}</div>
              <div style={{ color: 'var(--accent-primary)' }}>{p.score} pts</div>
            </div>
          ))}
        </div>
      </div>

      {gameState.gameStatus === 'PLAYING' && currentPlayer && (
        <div className="rack">
          {currentPlayer.rack.map((tile, i) => {
            const isUsed = pendingMove.some(m => m.tile === tile);
            return (
              <div
                key={i}
                className="tile"
                onClick={() => !isUsed && setSelectedTileIndex(i)}
                style={{
                  transform: selectedTileIndex === i ? 'translateY(-15px) scale(1.1)' : 'none',
                  opacity: isUsed ? 0.4 : 1,
                  border: selectedTileIndex === i ? '2px solid var(--accent-primary)' : 'none',
                  pointerEvents: isUsed ? 'none' : 'auto'
                }}
              >
                {tile.letter}
                <span className="points">{tile.points}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
