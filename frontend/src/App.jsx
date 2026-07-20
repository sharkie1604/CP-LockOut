import React, { useState, useEffect } from 'react';
import { getDeveloperTier } from './theme.js';
import { createMatch, joinMatch, getMatch, leaveMatch, getActiveMatch } from './api.js';
import { supabase } from './db.js';

// Pre-defined Mock Users for development testing
const MOCK_USERS = [
  { id: '11111111-1111-1111-1111-111111111111', handle: 'tourist', rating: 3500 },
  { id: '22222222-2222-2222-2222-222222222222', handle: 'Benq', rating: 3400 },
  { id: '33333333-3333-3333-3333-333333333333', handle: 'ecnerwala', rating: 3350 },
  { id: '44444444-4444-4444-4444-444444444444', handle: 'neal', rating: 2800 },
  { id: '55555555-5555-5555-5555-555555555555', handle: 'lockout_newbie', rating: 1100 },
];

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);

  // Auth View State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [minRating, setMinRating] = useState(1500);
  const [maxRating, setMaxRating] = useState(2000);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeMatch, setActiveMatch] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Phase 5: Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({ name: '', college: '', gradYear: '', handle: '' });
  const [onboardingToken, setOnboardingToken] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  // Track active Supabase database session state dynamically
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session?.user?.id)
            .maybeSingle();
          
          if (profile) {
            setCurrentUser(profile);
          } else {
            setCurrentUser({
              id: session?.user?.id,
              handle: '',
              rating: 1000
            });
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Failed to retrieve auth session:', err);
      } finally {
        setIsAuthInitializing(false);
      }
    };

    checkUserSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session?.user?.id)
          .maybeSingle();
        
        if (profile) {
          setCurrentUser(profile);
        } else {
          setCurrentUser({
            id: session?.user?.id,
            handle: '',
            rating: 1000
          });
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleOAuthLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    else setAuthError('SUCCESS: Check your email for a confirmation link.');
    setAuthLoading(false);
  };

  useEffect(() => {
    if (currentUser) {
      if (!currentUser?.name || !currentUser?.college || !currentUser?.gradYear) {
        setShowOnboarding(true);
        setOnboardingForm(prev => ({ ...prev, handle: currentUser?.handle || '' }));
        setOnboardingStep(1);
        setOnboardingToken('');
        setOnboardingError('');
      } else {
        setShowOnboarding(false);
      }
    }
  }, [currentUser]);

  const handleGenerateToken = async (e) => {
    e.preventDefault();
    setOnboardingError('');
    if (!onboardingForm.name || !onboardingForm.college || !onboardingForm.gradYear || !onboardingForm.handle) {
      setOnboardingError('All fields are required.');
      return;
    }
    
    if (!/^\d{4}$/.test(onboardingForm.gradYear)) {
      setOnboardingError('Graduation year must be a 4-digit number.');
      return;
    }

    setOnboardingLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/profile/verify-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          handle: onboardingForm.handle,
          name: onboardingForm.name,
          college: onboardingForm.college,
          gradYear: onboardingForm.gradYear,
          check: false
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to generate token.');
      
      setOnboardingToken(data.token);
      setOnboardingStep(2);
    } catch (err) {
      setOnboardingError(err.message);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    setOnboardingError('');
    setOnboardingLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/profile/verify-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          handle: onboardingForm.handle,
          name: onboardingForm.name,
          college: onboardingForm.college,
          gradYear: onboardingForm.gradYear,
          check: true
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Verification failed.');
      
      setCurrentUser(prev => ({
        ...prev,
        handle: onboardingForm.handle,
        name: onboardingForm.name,
        college: onboardingForm.college,
        gradYear: onboardingForm.gradYear
      }));
      setShowOnboarding(false);
    } catch (err) {
      setOnboardingError(err.message);
    } finally {
      setOnboardingLoading(false);
    }
  };

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

  // Session Recovery & Concurrency Cleanup Loop
  useEffect(() => {
    if (!currentUser) return;

    const restoreSession = async () => {
      setLoading(true);
      setError('');
      try {
        console.log(`[SESSION] Running recovery check for user: ${currentUser?.handle}`);
        
        // Fetch via Express API endpoint to ensure server-side auth is utilized
        const recoveredMatch = await getActiveMatch(currentUser?.id);

        if (recoveredMatch) {
          console.log('[SESSION] Recovered active match:', recoveredMatch);
          setActiveMatch(recoveredMatch);
        } else {
          setActiveMatch(null);
        }
      } catch (err) {
        console.error('[SESSION] Recovery workflow failed:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [currentUser?.id]);

  // Poll backend API for match state updates when in an active match
  useEffect(() => {
    if (!activeMatch) return;

    console.log(`[POLLING] Initiating 1.5-second HTTP sync loop for user: ${currentUser?.id}`);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/matches/active/${currentUser?.id}`);
        const data = await res.json();
        if (data.activeMatch) {
          setActiveMatch(data.activeMatch);
        }
      } catch (err) {
        console.error("Sync error:", err);
      }
    }, 1500);

    return () => {
      console.log(`[POLLING] Clearing 1.5-second HTTP sync loop.`);
      clearInterval(interval);
    };
  }, [activeMatch?.id, currentUser?.id]);

  const handleCreateMatch = async () => {
    setLoading(true);
    setError('');
    try {
      const match = await createMatch(currentUser?.id, minRating, maxRating);
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
      const match = await joinMatch(currentUser?.id, roomCodeInput);
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

  const handleLeaveRoom = async () => {
    if (activeMatch) {
      setLoading(true);
      try {
        await leaveMatch(currentUser?.id, activeMatch.id);
      } catch (err) {
        console.warn('Failed to notify backend of exit:', err.message);
      } finally {
        setLoading(false);
      }
    }
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
        {currentUser && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-mono">LOGGED IN AS:</span>
            <span className="text-xs font-bold font-mono text-[#06B6D4] uppercase tracking-widest">{currentUser?.handle || 'NEWBIE'}</span>
          </div>
        )}
      </header>

      {/* Main body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col justify-start">
        {isAuthInitializing ? (
          <div className="flex-1 flex flex-col items-center justify-center font-mono text-[#06B6D4] animate-pulse tracking-widest text-lg">
            INITIALIZING SECURE LINK...
          </div>
        ) : !currentUser ? (
          /* AUTHENTICATION VIEW */
          <div className="flex-1 flex flex-col items-center justify-center my-auto">
            <div className="w-full max-w-md bg-[#18181B] border border-[#27272A] p-8 shadow-2xl">
              <h2 className="text-xl font-bold font-mono border-b border-[#27272A] pb-4 mb-6 flex items-center space-x-3">
                <span className="h-3 w-3 bg-[#06B6D4]"></span>
                <span>SYSTEM AUTHENTICATION</span>
              </h2>
              
              {authError && (
                <div className={`border p-3 mb-6 rounded-none font-mono text-sm ${authError.startsWith('SUCCESS') ? 'bg-green-950/30 border-[#10B981] text-[#10B981]' : 'bg-red-950/30 border-[#EF4444] text-[#EF4444]'}`}>
                  {authError}
                </div>
              )}

              <button
                onClick={handleOAuthLogin}
                disabled={authLoading}
                className="w-full bg-[#09090B] border border-[#27272A] hover:bg-[#27272A] text-slate-100 py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 mb-6 flex justify-center items-center space-x-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                <span>SIGN IN WITH GOOGLE</span>
              </button>

              <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-[#27272A]"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-mono">OR</span>
                <div className="flex-grow border-t border-[#27272A]"></div>
              </div>

              <form className="space-y-4">
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 font-mono mb-2">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 font-mono mb-2">PASSWORD</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={handleEmailLogin}
                    disabled={authLoading}
                    className="w-full bg-[#18181B] border border-[#06B6D4] hover:bg-[#06B6D4] hover:text-[#09090B] text-[#06B6D4] py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 disabled:opacity-50"
                  >
                    SIGN IN
                  </button>
                  <button
                    onClick={handleEmailSignup}
                    disabled={authLoading}
                    className="w-full bg-[#18181B] border border-[#27272A] hover:bg-[#27272A] text-slate-300 py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 disabled:opacity-50"
                  >
                    SIGN UP
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : showOnboarding ? (
          /* ONBOARDING OVERLAY */
          <div className="flex-1 flex flex-col items-center justify-center my-auto">
            <div className="w-full max-w-lg bg-[#18181B] border border-[#27272A] p-8 shadow-2xl">
              <h2 className="text-xl font-bold font-mono border-b border-[#27272A] pb-4 mb-6 flex items-center space-x-3">
                <span className="h-3 w-3 bg-[#06B6D4] animate-pulse"></span>
                <span>PROFILE ONBOARDING</span>
              </h2>
              
              {onboardingError && (
                <div className="bg-red-950/30 border border-[#EF4444] text-[#EF4444] p-3 mb-6 rounded-none font-mono text-sm">
                  {onboardingError}
                </div>
              )}

              {onboardingStep === 1 ? (
                <form onSubmit={handleGenerateToken} className="space-y-5">
                  <div className="flex flex-col">
                    <label className="text-xs text-slate-400 font-mono mb-2">FULL NAME</label>
                    <input
                      type="text"
                      value={onboardingForm.name}
                      onChange={(e) => setOnboardingForm({...onboardingForm, name: e.target.value})}
                      className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4]"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-slate-400 font-mono mb-2">COLLEGE NAME</label>
                    <input
                      type="text"
                      value={onboardingForm.college}
                      onChange={(e) => setOnboardingForm({...onboardingForm, college: e.target.value})}
                      className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4]"
                      placeholder="e.g. MIT"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-slate-400 font-mono mb-2">GRADUATION YEAR</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={onboardingForm.gradYear}
                      onChange={(e) => setOnboardingForm({...onboardingForm, gradYear: e.target.value})}
                      className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4]"
                      placeholder="e.g. 2026"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-slate-400 font-mono mb-2">CODEFORCES HANDLE</label>
                    <input
                      type="text"
                      value={onboardingForm.handle}
                      onChange={(e) => setOnboardingForm({...onboardingForm, handle: e.target.value})}
                      className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={onboardingLoading}
                    className="mt-6 w-full bg-[#18181B] border border-[#06B6D4] hover:bg-[#06B6D4] hover:text-[#09090B] text-[#06B6D4] py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 disabled:opacity-50"
                  >
                    {onboardingLoading ? 'PROCESSING...' : 'GENERATE TOKEN'}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Please update your Codeforces Profile First or Last Name to the exact token below to verify ownership of the handle <strong className="text-white">{onboardingForm.handle}</strong>.
                  </p>
                  
                  <div className="bg-[#09090B] border border-[#06B6D4] p-4 text-center">
                    <span className="text-2xl font-black font-mono tracking-widest text-[#06B6D4]">{onboardingToken}</span>
                  </div>
                  
                  <button
                    onClick={handleVerifySetup}
                    disabled={onboardingLoading}
                    className="w-full bg-[#18181B] border border-[#10B981] hover:bg-[#10B981] hover:text-[#09090B] text-[#10B981] py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 disabled:opacity-50"
                  >
                    {onboardingLoading ? 'VERIFYING...' : 'VERIFY & COMPLETE SETUP'}
                  </button>
                  
                  <button
                    onClick={() => setOnboardingStep(1)}
                    disabled={onboardingLoading}
                    className="w-full border border-[#27272A] hover:bg-[#27272A] text-slate-400 py-2 text-xs font-mono tracking-wider transition-all duration-200"
                  >
                    GO BACK
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
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
            <div className="bg-[#09090B] border border-[#27272A] p-6">
              
              <div className="space-y-6">
                {activeMatch.problems && activeMatch.problems.map((problem, index) => {
                  const isLocked = problem.locked === true;
                  const isCurrentUserLock = isLocked && problem.locked_by === currentUser?.id;
                  const solverProfile = isLocked ? getPlayerProfile(problem.locked_by) : null;
                  const solverHandle = solverProfile ? solverProfile.handle : '';

                  return (
                    <div
                      key={`${problem.contestId}-${problem.index}`}
                      className={`relative border p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 transition-all duration-300 ${
                        isCurrentUserLock 
                          ? 'bg-[#10B981] border-[#10B981] text-black shadow-[0_0_25px_rgba(16,185,129,0.3)]' 
                          : isLocked 
                            ? 'bg-[#18181B] border-[#EF4444] animate-pulse' 
                            : 'bg-[#18181B] border-[#27272A] hover:border-[#06B6D4] hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      }`}
                    >
                      {/* Tier Bounty Indicator */}
                      <div className={`absolute top-0 left-0 px-3 py-1 text-[10px] font-black font-mono uppercase tracking-widest ${
                        isCurrentUserLock ? 'bg-black text-[#10B981]' : isLocked ? 'bg-[#EF4444] text-white' : 'bg-[#27272A] text-slate-300'
                      }`}>
                        {problem.points} PTS
                      </div>

                      <div className="space-y-1.5 mt-4 md:mt-0 w-full md:w-2/3 pl-2">
                        <div className="flex items-center space-x-3">
                          <span className={`text-xs font-bold font-mono ${isCurrentUserLock ? 'text-black/60' : 'text-slate-500'}`}>
                            [{problem.contestId}{problem.index}]
                          </span>
                          
                          {/* Problem Link */}
                          {isLocked && !isCurrentUserLock ? (
                            <span className="font-bold text-slate-500 line-through text-lg">
                              {problem.name}
                            </span>
                          ) : (
                            <a
                              href={`https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`font-bold text-lg underline transition-colors ${
                                isCurrentUserLock ? 'text-black hover:text-white' : 'text-slate-200 hover:text-[#06B6D4]'
                              }`}
                            >
                              {problem.name}
                            </a>
                          )}
                        </div>
                        
                        <div className={`flex space-x-4 text-xs font-mono ${isCurrentUserLock ? 'text-black/70' : 'text-slate-400'}`}>
                          <span>DIFFICULTY: <span className={isCurrentUserLock ? 'font-bold text-black' : 'text-white font-mono'}>{problem.rating}</span></span>
                        </div>
                      </div>

                      {/* Status / Solver Panel */}
                      <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end pr-2">
                        <div className="text-right">
                          {isLocked ? (
                            <span 
                              className={`text-xs border font-mono px-4 py-2 uppercase font-black tracking-widest inline-block ${
                                isCurrentUserLock 
                                  ? 'border-black text-black bg-black/10' 
                                  : 'border-[#EF4444] text-[#EF4444] bg-red-950/30'
                              }`}
                            >
                              LOCKED: {solverHandle}
                            </span>
                          ) : (
                            <span className="text-xs bg-[#09090B] border border-[#27272A] text-[#06B6D4] font-mono px-4 py-2 uppercase font-bold tracking-widest inline-block">
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
          </>
        )}
      </main>
    </div>
  );
}

export default App;
