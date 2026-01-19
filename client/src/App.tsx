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
  const { gameState, error, userStats, createRoom, joinRoom, getStats, setReady, playWord, socketId, socket, startGame, fetchRooms, availableRooms } = useGame();
  const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
  const [pendingMove, setPendingMove] = useState<{ r: number; c: number; tile: any }[]>([]);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);

  // New State for UI Features
  const [showMenu, setShowMenu] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [squareIntention, setSquareIntention] = useState<{ r: number, c: number, type: string } | null>(null);
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);

  /* State for theme */
  const [theme, setTheme] = useState('default');
  const [customColors, setCustomColors] = useState({
    bgColor: '#0f172a',
    boardBg: '#334155',
    squareBg: '#1e293b'
  });

  /* State for Zoom & Pan */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  /* State for Blank Tile Selection */
  const [showBlankModal, setShowBlankModal] = useState(false);
  const [pendingBlankTileIndex, setPendingBlankTileIndex] = useState<number | null>(null);
  const [blankTarget, setBlankTarget] = useState<{ r: number, c: number } | null>(null);
  const [showRack, setShowRack] = useState(true);
  const [expandedPlayerHistory, setExpandedPlayerHistory] = useState<string | null>(null);

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
    if (theme === 'custom') {
      document.documentElement.style.setProperty('--bg-color', customColors.bgColor);
      document.documentElement.style.setProperty('--board-bg', customColors.boardBg);
      document.documentElement.style.setProperty('--square-bg', customColors.squareBg);
    } else {
      document.documentElement.style.removeProperty('--bg-color');
      document.documentElement.style.removeProperty('--board-bg');
      document.documentElement.style.removeProperty('--square-bg');
    }
  }, [theme, customColors]);

  /* Clear pending move only when the board updates */
  useEffect(() => {
    setPendingMove([]);
  }, [gameState?.board, gameState?.currentPlayerIndex]);

  const handleCreate = () => createRoom(playerName, userId);
  const handleJoin = () => joinRoom(roomCodeInput, playerName, userId);
  const handleObserver = () => joinRoom(roomCodeInput, '', userId);

  const fetchStats = () => {
    getStats(userId);
    setShowStats(true);
    setShowMenu(false);
  };

  const handleStartGame = () => {
    startGame && startGame();
  };

  const handleOpenBrowser = () => {
    fetchRooms && fetchRooms();
    setShowRoomBrowser(true);
  };

  /* Zoom & Pan Handlers */
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setHasMoved(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Simple threshold to distinguish click from drag
    if (Math.abs(newX - pan.x) > 5 || Math.abs(newY - pan.y) > 5) {
      setHasMoved(true);
    }

    setPan({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      setHasMoved(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    if (Math.abs(newX - pan.x) > 5 || Math.abs(newY - pan.y) > 5) {
      setHasMoved(true);
    }
    setPan({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Render Lobby if no game state
  if (!gameState) {
    return (
      <div className="lobby">
        <h1 style={{ fontSize: '3rem', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          KATTT WORDS
        </h1>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
          <input type="text" placeholder="Your Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: 'white' }} />
          <button className="btn-primary" onClick={handleCreate}>Create New Game</button>

          <hr style={{ width: '100%', borderColor: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Join Existing Room</span>
            <input type="text" placeholder="Room Code" value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: 'white', letterSpacing: '2px', textAlign: 'center' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleJoin}>Join as Player</button>
              <button className="btn-primary" style={{ flex: 1, background: 'transparent', border: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)' }} onClick={handleObserver}>Watch Only</button>
            </div>
          </div>

          <button className="btn-primary" style={{ background: 'var(--glass-bg)', fontSize: '0.8rem', marginTop: '0.5rem' }} onClick={handleOpenBrowser}>Browse Public Rooms</button>

          <button style={{ marginTop: '1rem', fontSize: '0.9rem', background: 'transparent', border: 'none', color: 'var(--text-dim)', textDecoration: 'underline', cursor: 'pointer' }} onClick={fetchStats}>My Profile & Stats</button>

          {error && <p style={{ color: '#f43f5e', fontSize: '0.8rem' }}>{error}</p>}

          {/* Room Browser Modal */}
          {showRoomBrowser && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="glass-panel" style={{ padding: '2rem', width: '300px', maxHeight: '80vh', overflowY: 'auto' }}>
                <h3 style={{ color: 'var(--accent-primary)' }}>Open Rooms</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
                  {availableRooms?.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No rooms found.</p> :
                    availableRooms?.map(r => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                        <span>Room {r.id}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>({r.players}/6)</span>
                        <button style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: 'var(--accent-primary)', border: 'none', borderRadius: '2px' }} onClick={() => { setRoomCodeInput(r.id); setShowRoomBrowser(false); }}>Select</button>
                      </div>
                    ))
                  }
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-primary" onClick={() => { fetchRooms && fetchRooms(); }}>Refresh</button>
                  <button className="btn-primary" style={{ background: '#ef4444' }} onClick={() => setShowRoomBrowser(false)}>Close</button>
                </div>
              </div>
            </div>
          )}

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

          {showBlankModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="glass-panel" style={{ padding: '2rem', maxWidth: '90vw', textAlign: 'center' }}>
                <h3>Select a Letter</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => (
                    <button
                      key={char}
                      onClick={() => handleBlankSelect(char)}
                      style={{ padding: '0.5rem', background: '#334155', color: 'white', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {char}
                    </button>
                  ))}
                </div>
                <button className="btn-primary" style={{ marginTop: '1rem', background: '#ef4444' }} onClick={() => setShowBlankModal(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Safe access to players logic
  const players = gameState.players || [];
  const currentPlayer = players.find(p => p.userId === userId); // Match by userId for persistence
  const activePlayer = players[gameState.currentPlayerIndex];
  const isMyTurn = activePlayer?.id === socketId || (activePlayer?.userId === userId);
  const isHost = players[0]?.userId === userId; // Better host detection logic

  const handleSquareClick = (r: number, c: number) => {
    if (hasMoved) return; // Prevent click if dragging

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

    if (tile.points === 0) {
      setPendingBlankTileIndex(selectedTileIndex);
      setShowBlankModal(true);
      setBlankTarget({ r, c });
      return;
    }

    setPendingMove([...pendingMove, { r, c, tile }]);
    setSelectedTileIndex(null);
  };

  const handleBlankSelect = (letter: string) => {
    if (pendingBlankTileIndex === null || !blankTarget || !currentPlayer) return;

    const originalTile = currentPlayer.rack[pendingBlankTileIndex];
    // Create a new tile object with the selected letter but keep points 0
    const newTile = { ...originalTile, letter: letter, isBlank: true };

    setPendingMove([...pendingMove, { r: blankTarget.r, c: blankTarget.c, tile: newTile }]);

    setShowBlankModal(false);
    setPendingBlankTileIndex(null);
    setBlankTarget(null);
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
    socket?.emit('passTurn');
    setShowMenu(false);
  };

  const handleExit = () => window.location.reload();



  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header className="glass-panel" style={{ margin: '0.5rem', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        {/* Header Content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setShowMenu(true)} style={{ background: 'transparent', border: '1px solid var(--text-dim)', color: 'var(--text-main)', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>☰</button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Room: {gameState.roomCode}</h2>
          </div>
        </div>

        {/* Score Ticker (Compact) */}
        <div style={{ flex: 1, overflow: 'hidden', margin: '0 1rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          {gameState.gameStatus === 'PLAYING' && activePlayer ?
            `Turn: ${activePlayer.name}` : gameState.gameStatus}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Mobile: Hide theme select if too small? Or put in menu. For now keep. */}

          {gameState.gameStatus === 'LOBBY' && !currentPlayer?.isReady && <button className="btn-primary" onClick={setReady}>Ready</button>}
          {gameState.gameStatus === 'LOBBY' && (
            <>
              <button className="btn-primary" style={{ background: 'var(--accent-secondary)' }} onClick={() => socket?.emit('addBot', gameState.roomCode)}>+ Bot</button>
              {players.length >= 2 && players.every(p => p.isReady) && (
                <button className="btn-primary" style={{ background: '#10b981' }} onClick={handleStartGame}>Start</button>
              )}
            </>
          )}

          {isMyTurn && pendingMove.length > 0 && <>
            <button className="btn-primary" style={{ background: '#10b981', padding: '0.25rem 0.5rem' }} onClick={handlePlay}>Play</button>
            <button className="btn-primary" style={{ background: '#ef4444', padding: '0.25rem 0.5rem' }} onClick={handleCancel}>X</button>
          </>}
        </div>
      </header>

      {/* Enhanced Scoreboard (Overlay or Top Bar) */}
      <div className="glass-panel" style={{
        margin: '0 0.5rem',
        padding: '0.5rem',
        zIndex: 40,
        maxHeight: expandedPlayerHistory ? '250px' : '70px',
        transition: 'max-height 0.3s ease',
        overflowY: expandedPlayerHistory ? 'auto' : 'hidden'
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {players.map(p => {
            const isLastMover = gameState.lastMove?.playerId === p.id;
            const isExpanded = expandedPlayerHistory === p.id;
            return (
              <div key={p.id}
                onClick={() => setExpandedPlayerHistory(isExpanded ? null : p.id)}
                style={{
                  padding: '0.25rem 0.75rem',
                  border: p.id === activePlayer?.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  background: p.id === socketId ? 'rgba(255,255,255,0.05)' : 'transparent',
                  borderRadius: '4px',
                  minWidth: '120px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{p.name} {p.isBot ? '🤖' : ''}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
                    <span style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>{p.score}</span>
                    {isLastMover && gameState.lastMove && (
                      <span style={{ fontSize: '0.7rem', color: '#10b981' }}>+{gameState.lastMove.points}</span>
                    )}
                  </div>
                </div>

                {isExpanded && p.moveHistory && p.moveHistory.length > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.25rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    fontSize: '0.7rem'
                  }}>
                    {p.moveHistory.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '2px 0' }}>
                        <span style={{ color: 'var(--text-dim)' }}>{h.word}</span>
                        <span style={{ color: 'var(--accent-primary)' }}>+{h.points}</span>
                      </div>
                    )).reverse()}
                  </div>
                )}

                {isExpanded && (!p.moveHistory || p.moveHistory.length === 0) && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.5rem' }}>No moves yet</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {showMenu && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Game Menu</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>Theme</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ padding: '0.5rem', background: '#334155', color: 'white', border: 'none', borderRadius: '4px' }}>
                <option value="default">Cosmic</option>
                <option value="light">Daylight</option>
                <option value="neon">Cyberpunk</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {theme === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem' }}>Background</span>
                  <input type="color" value={customColors.bgColor} onChange={(e) => setCustomColors({ ...customColors, bgColor: e.target.value })} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem' }}>Board</span>
                  <input type="color" value={customColors.boardBg} onChange={(e) => setCustomColors({ ...customColors, boardBg: e.target.value })} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem' }}>Squares</span>
                  <input type="color" value={customColors.squareBg} onChange={(e) => setCustomColors({ ...customColors, squareBg: e.target.value })} />
                </div>
              </div>
            )}
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

      {showStats && userStats && <div style={{ position: 'fixed', zIndex: 100, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div className='glass-panel' style={{ padding: '2rem' }}><h2 style={{ color: 'var(--accent-primary)' }}>{userStats.name}</h2><button className='btn-primary' onClick={() => setShowStats(false)}>Close</button></div></div>}

      {squareIntention && <div className='glass-panel' style={{ position: 'absolute', zIndex: 51, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', padding: '1rem', textAlign: 'center' }}><h4>Square Info</h4><p>{squareIntention.type}</p><button onClick={() => setSquareIntention(null)}>Close</button></div>}

      {showBlankModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ padding: '2rem', maxWidth: '90vw', textAlign: 'center' }}>
            <h3>Select a Letter</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => (
                <button
                  key={char}
                  onClick={() => handleBlankSelect(char)}
                  style={{ padding: '0.5rem', background: '#334155', color: 'white', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {char}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ marginTop: '1rem', background: '#ef4444' }} onClick={() => setShowBlankModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Board Container with Zoom/Pan */}
      <div
        className="board-container"
        style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="scrabble-board" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}>
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

        {/* Zoom Controls Overlay */}
        <div style={{ position: 'absolute', bottom: '120px', right: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 20 }}>
          <button className="btn-primary" onClick={handleZoomIn} style={{ padding: '0.5rem', width: '40px', height: '40px', fontSize: '1.2rem' }}>+</button>
          <button className="btn-primary" onClick={handleResetZoom} style={{ padding: '0.5rem', width: '40px', height: '40px', fontSize: '0.8rem' }}>R</button>
          <button className="btn-primary" onClick={handleZoomOut} style={{ padding: '0.5rem', width: '40px', height: '40px', fontSize: '1.2rem' }}>-</button>
        </div>
      </div>

      {/* Rack Toggle Button */}
      {gameState.gameStatus === 'PLAYING' && currentPlayer && (
        <button
          onClick={() => setShowRack(!showRack)}
          className="btn-primary"
          style={{
            position: 'fixed',
            bottom: showRack ? '90px' : '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            padding: '0.25rem 1rem',
            fontSize: '0.8rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }}
        >
          {showRack ? 'Hide Tiles ▼' : 'Show Tiles ▲'}
        </button>
      )}

      {/* Fixed Rack */}
      {gameState.gameStatus === 'PLAYING' && currentPlayer && (
        <div
          className="rack-container"
          style={{
            position: 'fixed',
            bottom: showRack ? '0' : '-100px', // Slide out
            left: 0,
            width: '100%',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid var(--glass-border)',
            padding: '1rem 0.5rem',
            zIndex: 55,
            transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div className="rack" style={{ margin: 0 }}>
            {currentPlayer.rack.map((tile, i) => {
              const isUsed = pendingMove.some(m => m.tile === tile);
              return (
                <div
                  key={i}
                  className="tile"
                  onClick={() => !isUsed && setSelectedTileIndex(selectedTileIndex === i ? null : i)}
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
        </div>
      )}

      {/* ... Modals (Menu, Stats, SquareInfo, Room Browser, etc) ... */}
      {/* (Menu logic included above in header, just ensure modal renders here) */}

      {/* ... Other Modals ... */}
      {showStats && userStats && <div style={{ position: 'fixed', zIndex: 100, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div className='glass-panel' style={{ padding: '2rem' }}><h2 style={{ color: 'var(--accent-primary)' }}>{userStats.name}</h2><button className='btn-primary' onClick={() => setShowStats(false)}>Close</button></div></div>}

      {squareIntention && <div className='glass-panel' style={{ position: 'absolute', zIndex: 51, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', padding: '1rem', textAlign: 'center' }}><h4>Square Info</h4><p>{squareIntention.type}</p><button onClick={() => setSquareIntention(null)}>Close</button></div>}

      {/* (Keep Room Browser & Blank Models) */}
      {showRoomBrowser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '300px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ color: 'var(--accent-primary)' }}>Open Rooms</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
              {availableRooms?.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>No rooms found.</p> :
                availableRooms?.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    <span>Room {r.id}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>({r.players}/6)</span>
                    <button style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: 'var(--accent-primary)', border: 'none', borderRadius: '2px' }} onClick={() => { setRoomCodeInput(r.id); setShowRoomBrowser(false); }}>Select</button>
                  </div>
                ))
              }
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" onClick={() => { fetchRooms && fetchRooms(); }}>Refresh</button>
              <button className="btn-primary" style={{ background: '#ef4444' }} onClick={() => setShowRoomBrowser(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showBlankModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ padding: '2rem', maxWidth: '90vw', textAlign: 'center' }}>
            <h3>Select a Letter</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(char => (
                <button
                  key={char}
                  onClick={() => handleBlankSelect(char)}
                  style={{ padding: '0.5rem', background: '#334155', color: 'white', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {char}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ marginTop: '1rem', background: '#ef4444' }} onClick={() => setShowBlankModal(false)}>Cancel</button>
          </div>
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
