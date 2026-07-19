import React, { useState, useEffect } from 'react';
import { getDeveloperTier } from './theme.js';
import { createMatch, joinMatch, getMatch } from './api.js';

// Pre-defined Mock Users for development testing
const MOCK_USERS = [
  { id: '11111111-1111-1111-1111-111111111111', handle: 'tourist', rating: 3500 },
  { id: '22222222-2222-2222-2222-222222222222', handle: 'Benq', rating: 3400 },
  { id: '33333333-3333-3333-3333-333333333333', handle: 'ecnerwala', rating: 3350 },
  { id: '44444444-4444-4444-4444-444444444444', handle: 'neal', rating: 2800 },
  { id: '55555555-5555-5555-5555-555555555555', handle: 'lockout_newbie', rating: 1100 },
];

function App() {
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [minRating, setMinRating] = useState(1500);
  const [maxRating, setMaxRating] = useState(2000);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeMatch, setActiveMatch] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getPlayerProfile = (id) => {
    if (!id) return null;
    const user = MOCK_USERS.find((u) => u.id === id);
    if (user) return user;
    return { id, handle: `Player_${id.slice(0, 4)}`, rating: 1000 };
  };

  const player1Profile = activeMatch ? getPlayerProfile(activeMatch.player_1_id) : null;
  const player2Profile = activeMatch ? getPlayerProfile(activeMatch.player_2_id) : null;
  const p1Tier = player1Profile ? getDeveloperTier(player1Profile.rating) : null;
  const p2Tier = player2Profile ? getDeveloperTier(player2Profile.rating) : null;

  // Poll match updates every 3 seconds if in an active/waiting room
  useEffect(() => {
    if (!activeMatch) return;

    const interval = setInterval(async () => {
      try {
        const freshMatch = await getMatch(activeMatch.id);
        setActiveMatch(freshMatch);
      } catch (err) {
        console.error('Failed to poll match status:', err.message);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeMatch]);

  const handleCreateMatch = async () => {
    setLoading(true);
    setError('');
    try {
      const match = await createMatch(currentUser.id, minRating, maxRating);
      setActiveMatch(match);
    } catch (err) {
      setError(err.message || 'Failed to create match.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMatch = async () => {
    if (!roomCodeInput) {
      setError('Please enter a 4-digit room code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const match = await joinMatch(currentUser.id, roomCodeInput);
      setActiveMatch(match);
    } catch (err) {
      setError(err.message || 'Failed to join match.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!activeMatch) return;
    setLoading(true);
    setError('');
    try {
      const freshMatch = await getMatch(activeMatch.id);
      setActiveMatch(freshMatch);
    } catch (err) {
      setError(err.message || 'Failed to refresh match status.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    setActiveMatch(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-[#27272A] py-5 px-6 flex justify-between items-center bg-[#09090B] z-10">
        <div className="flex items-center space-x-3">
          <span className="h-3 w-3 bg-[#06B6D4] animate-pulse"></span>
          <h1 className="text-xl font-bold tracking-wider font-mono">LOCKOUT.IO</h1>
        </div>
        <div className="flex items-center space-x-4">
          <label className="text-xs text-slate-400 font-mono">USER SIMULATION:</label>
          <select
            className="bg-[#18181B] border border-[#27272A] text-sm text-slate-200 py-1.5 px-3 rounded-none focus:outline-none focus:border-[#06B6D4] font-mono"
            value={currentUser.id}
            onChange={(e) => {
              const selected = MOCK_USERS.find(u => u.id === e.target.value);
              if (selected) setCurrentUser(selected);
            }}
            disabled={!!activeMatch}
          >
            {MOCK_USERS.map((user) => (
              <option key={user.id} value={user.id}>
                {user.handle} ({user.rating})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col justify-start">
        {error && (
          <div className="bg-[#18181B] border border-red-500/50 text-red-500 p-4 mb-6 rounded-none flex justify-between items-center font-mono text-sm">
            <span>ERROR: {error}</span>
            <button onClick={() => setError('')} className="hover:text-white">✕</button>
          </div>
        )}

        {!activeMatch ? (
          /* LOBBY DASHBOARD */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-auto">
            {/* Create Room Area */}
            <div className="bg-[#18181B] border border-[#27272A] p-8 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold font-mono border-b border-[#27272A] pb-3 mb-6 flex items-center space-x-2">
                  <span className="h-2.5 w-2.5 bg-[#06B6D4]"></span>
                  <span>CREATE ARENA</span>
                </h2>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  Scaffold a new 1v1 lockout workspace. Five unique Codeforces problems will be fetched within your selected rating boundaries.
                </p>
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <label className="text-xs text-slate-400 font-mono mb-2">MIN PROBLEM RATING</label>
                    <input
                      type="number"
                      value={minRating}
                      onChange={(e) => setMinRating(parseInt(e.target.value) || 800)}
                      className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4] rounded-none"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-slate-400 font-mono mb-2">MAX PROBLEM RATING</label>
                    <input
                      type="number"
                      value={maxRating}
                      onChange={(e) => setMaxRating(parseInt(e.target.value) || 3500)}
                      className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4] rounded-none"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleCreateMatch}
                disabled={loading}
                className="mt-8 w-full bg-[#18181B] border border-[#06B6D4] hover:bg-[#06B6D4] hover:text-[#09090B] text-[#06B6D4] py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 rounded-none disabled:opacity-50"
              >
                {loading ? 'GENERATING...' : 'INITIALIZE DUEL'}
              </button>
            </div>

            {/* Join Room Area */}
            <div className="bg-[#18181B] border border-[#27272A] p-8 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold font-mono border-b border-[#27272A] pb-3 mb-6 flex items-center space-x-2">
                  <span className="h-2.5 w-2.5 bg-[#06B6D4]"></span>
                  <span>ENTER ARENA CODE</span>
                </h2>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  Join an active lobby. Enter the 4-digit numeric code generated by the match creator to immediately launch the duel.
                </p>
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 font-mono mb-2">ROOM CODE</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4022"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, ''))}
                    className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono text-center tracking-widest text-lg focus:outline-none focus:border-[#06B6D4] rounded-none placeholder:text-zinc-700"
                  />
                </div>
              </div>
              <button
                onClick={handleJoinMatch}
                disabled={loading}
                className="mt-8 w-full bg-[#18181B] border border-[#06B6D4] hover:bg-[#06B6D4] hover:text-[#09090B] text-[#06B6D4] py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 rounded-none disabled:opacity-50"
              >
                {loading ? 'CONNECTING...' : 'ENTER workspace'}
              </button>
            </div>
          </div>
        ) : (
          /* ARENA WORKSPACE */
          <div className="space-y-6">
            {/* Arena Header Status Panel */}
            <div className="bg-[#18181B] border border-[#27272A] p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${activeMatch.status === 'active' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`}></span>
                  <span className="text-sm font-bold font-mono uppercase tracking-wider text-slate-300">
                    ROOM CODE: <span className="text-white bg-[#09090B] px-2 py-0.5 border border-[#27272A] font-sans">{activeMatch.room_code}</span>
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  STATUS: <span className="uppercase text-white font-bold">{activeMatch.status}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="bg-[#18181B] border border-[#27272A] hover:border-[#06B6D4] hover:text-white text-slate-300 px-4 py-2 text-xs font-mono tracking-wider transition-all duration-200 rounded-none"
                >
                  {loading ? 'RELOADING...' : 'REFRESH STATUS'}
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="bg-[#18181B] border border-red-500/50 hover:bg-red-500 hover:text-black text-red-500 px-4 py-2 text-xs font-mono tracking-wider transition-all duration-200 rounded-none"
                >
                  LEAVE ROOM
                </button>
              </div>
            </div>

            {/* Duelists Rating / Score Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player 1 Card */}
              <div className="bg-[#18181B] border border-[#27272A] p-6 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 font-mono">PLAYER 1 (CHALLENGER)</span>
                  <div className="text-lg font-bold flex items-center space-x-2 mt-1">
                    <span>{player1Profile?.handle || 'Unknown'}</span>
                    {p1Tier && (
                      <span 
                        className="text-xs px-2 py-0.5 bg-[#09090B] border font-mono font-bold uppercase"
                        style={{ color: p1Tier.colorHex, borderColor: p1Tier.colorHex }}
                      >
                        {p1Tier.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-mono">SCORE</span>
                  <div className="text-3xl font-extrabold font-mono text-[#10B981] mt-0.5">
                    {activeMatch.player_1_score || 0}
                  </div>
                </div>
              </div>

              {/* Player 2 Card */}
              <div className="bg-[#18181B] border border-[#27272A] p-6 flex justify-between items-center">
                {activeMatch.player_2_id ? (
                  <>
                    <div>
                      <span className="text-xs text-slate-400 font-mono">PLAYER 2 (OPPONENT)</span>
                      <div className="text-lg font-bold flex items-center space-x-2 mt-1">
                        <span>{player2Profile?.handle || 'Unknown'}</span>
                        {p2Tier && (
                          <span 
                            className="text-xs px-2 py-0.5 bg-[#09090B] border font-mono font-bold uppercase"
                            style={{ color: p2Tier.colorHex, borderColor: p2Tier.colorHex }}
                          >
                            {p2Tier.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-mono">SCORE</span>
                      <div className="text-3xl font-extrabold font-mono text-[#10B981] mt-0.5">
                        {activeMatch.player_2_score || 0}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between text-slate-500 py-2">
                    <div className="flex items-center space-x-3">
                      <span className="h-2 w-2 bg-[#EF4444] animate-ping rounded-full"></span>
                      <span className="font-mono text-xs uppercase tracking-wider">Waiting for Opponent to Join...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 5-Problem Lockout Grid */}
            <div className="bg-[#18181B] border border-[#27272A] p-6">
              <h3 className="text-sm font-bold font-mono tracking-wider border-b border-[#27272A] pb-3 mb-6 flex items-center space-x-2">
                <span className="h-2 w-2 bg-[#06B6D4]"></span>
                <span>LOCKOUT PROBLEM SET</span>
              </h3>
              
              <div className="space-y-4">
                {activeMatch.problems && activeMatch.problems.map((problem, index) => {
                  const isLocked = problem.locked === true;
                  const solverProfile = isLocked ? getPlayerProfile(problem.locked_by) : null;
                  const solverHandle = solverProfile ? solverProfile.handle : '';

                  return (
                    <div
                      key={`${problem.contestId}-${problem.index}`}
                      className={`bg-[#09090B] border ${isLocked ? 'border-red-500/50' : 'border-[#27272A]'} p-4 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-bold font-mono text-slate-400">
                            [{problem.contestId}{problem.index}]
                          </span>
                          <a
                            href={`https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-slate-200 hover:text-[#06B6D4] underline transition-colors"
                          >
                            {problem.name}
                          </a>
                        </div>
                        <div className="flex space-x-4 text-xs font-mono text-slate-400">
                          <span>DIFFICULTY: <span className="text-white">{problem.rating}</span></span>
                        </div>
                      </div>

                      {/* Points / Status Panel */}
                      <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-mono uppercase block">POINTS</span>
                          <span className="text-lg font-black font-mono text-[#06B6D4]">+{problem.points}</span>
                        </div>
                        
                        <div className="w-32 text-right">
                          {isLocked ? (
                            <span className="text-xs bg-red-950 border border-red-500/50 text-red-400 font-mono px-2.5 py-1 uppercase font-bold tracking-wider inline-block">
                              Locked ({solverHandle})
                            </span>
                          ) : (
                            <span className="text-xs bg-slate-900 border border-[#27272A] text-slate-400 font-mono px-2.5 py-1 uppercase tracking-wider inline-block">
                              OPEN
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
