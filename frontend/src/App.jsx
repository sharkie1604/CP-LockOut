import React, { useState, useEffect, useRef } from 'react';
import { getDeveloperTier } from './theme.js';
import { createMatch, joinMatch, getMatch, leaveMatch, getActiveMatch, startMatch, abandonMatch, API_BASE_URL } from './api.js';
import { supabase } from './db.js';


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
  const [matchResult, setMatchResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Phase 5: Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState(() => {
    try {
      const saved = localStorage.getItem('lockout_onboarding_form');
      return saved ? JSON.parse(saved) : { name: '', college: '', gradYear: '', handle: '' };
    } catch {
      return { name: '', college: '', gradYear: '', handle: '' };
    }
  });
  const [onboardingToken, setOnboardingToken] = useState(() => {
    try {
      return localStorage.getItem('lockout_onboarding_token') || '';
    } catch {
      return '';
    }
  });
  const [onboardingStep, setOnboardingStep] = useState(() => {
    try {
      const saved = localStorage.getItem('lockout_onboarding_step');
      return saved ? Number(saved) : 1;
    } catch {
      return 1;
    }
  });
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  // Persist onboarding state in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lockout_onboarding_form', JSON.stringify(onboardingForm));
    } catch (err) {
      console.warn('Failed to save form to localStorage:', err);
    }
  }, [onboardingForm]);

  useEffect(() => {
    try {
      localStorage.setItem('lockout_onboarding_step', String(onboardingStep));
    } catch (err) {
      console.warn('Failed to save step to localStorage:', err);
    }
  }, [onboardingStep]);

  useEffect(() => {
    try {
      localStorage.setItem('lockout_onboarding_token', onboardingToken);
    } catch (err) {
      console.warn('Failed to save token to localStorage:', err);
    }
  }, [onboardingToken]);

  const showOnboardingRef = useRef(showOnboarding);
  useEffect(() => {
    showOnboardingRef.current = showOnboarding;
  }, [showOnboarding]);

  // Track active Supabase database session state dynamically
  useEffect(() => {
    let isMounted = true;
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          let profile = null;
          try {
            const res = await fetch(`${API_BASE_URL}/api/profile/${session?.user?.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.id) {
                profile = data;
              }
            }
          } catch (err) {
            console.error('Backend profile fetch failed:', err);
          }
          
          if (profile) {
            if (isMounted) {
              setCurrentUser(profile);
              if (profile.status === 'VERIFIED' || profile.handle) {
                setShowOnboarding(false);
              } else if (profile.status === 'NEW' || !profile.handle) {
                setShowOnboarding(true);
                if (!showOnboardingRef.current) {
                  const savedForm = localStorage.getItem('lockout_onboarding_form');
                  const savedStep = localStorage.getItem('lockout_onboarding_step');
                  const savedToken = localStorage.getItem('lockout_onboarding_token');

                  if (!savedForm) {
                    setOnboardingForm({
                      name: profile.name || '',
                      college: profile.college || '',
                      gradYear: profile.grad_year ? String(profile.grad_year) : '',
                      handle: profile.handle || ''
                    });
                  }
                  if (!savedStep) setOnboardingStep(1);
                  if (!savedToken) setOnboardingToken('');
                  setOnboardingError('');
                }
              }
            }
          } else {
            if (isMounted) {
              setCurrentUser({
                id: session?.user?.id,
                handle: '',
                rating: 1000
              });
              setShowOnboarding(true);
              if (!showOnboardingRef.current) {
                const savedForm = localStorage.getItem('lockout_onboarding_form');
                const savedStep = localStorage.getItem('lockout_onboarding_step');
                const savedToken = localStorage.getItem('lockout_onboarding_token');

                if (!savedForm) {
                  setOnboardingForm({
                    name: '',
                    college: '',
                    gradYear: '',
                    handle: ''
                  });
                }
                if (!savedStep) setOnboardingStep(1);
                if (!savedToken) setOnboardingToken('');
                setOnboardingError('');
              }
            }
          }
        } else {
          if (isMounted) setCurrentUser(null);
        }
      } catch (err) {
        console.error('Failed to retrieve auth session:', err);
      } finally {
        if (isMounted) setIsAuthInitializing(false);
      }
    };

    checkUserSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setIsAuthInitializing(true); // Block layout rendering while fetching
        try {
          let profile = null;
          try {
            const res = await fetch(`${API_BASE_URL}/api/profile/${session?.user?.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.id) {
                profile = data;
              }
            }
          } catch (err) {
            console.error('Backend profile fetch failed:', err);
          }
          
          if (!isMounted) return;
          if (profile) {
            setCurrentUser(profile);
            if (profile.status === 'VERIFIED' || profile.handle) {
              setShowOnboarding(false);
            } else if (profile.status === 'NEW' || !profile.handle) {
              setShowOnboarding(true);
              if (!showOnboardingRef.current) {
                const savedForm = localStorage.getItem('lockout_onboarding_form');
                const savedStep = localStorage.getItem('lockout_onboarding_step');
                const savedToken = localStorage.getItem('lockout_onboarding_token');

                if (!savedForm) {
                  setOnboardingForm({
                    name: profile.name || '',
                    college: profile.college || '',
                    gradYear: profile.grad_year ? String(profile.grad_year) : '',
                    handle: profile.handle || ''
                  });
                }
                if (!savedStep) setOnboardingStep(1);
                if (!savedToken) setOnboardingToken('');
                setOnboardingError('');
              }
            }
          } else {
            setCurrentUser({
              id: session?.user?.id,
              handle: '',
              rating: 1000
            });
            setShowOnboarding(true);
            if (!showOnboardingRef.current) {
              const savedForm = localStorage.getItem('lockout_onboarding_form');
              const savedStep = localStorage.getItem('lockout_onboarding_step');
              const savedToken = localStorage.getItem('lockout_onboarding_token');

              if (!savedForm) {
                setOnboardingForm({
                  name: '',
                  college: '',
                  gradYear: '',
                  handle: ''
                });
              }
              if (!savedStep) setOnboardingStep(1);
              if (!savedToken) setOnboardingToken('');
              setOnboardingError('');
            }
          }
        } catch (err) {
          console.error("Auth state change profile fetch error:", err);
        } finally {
          setIsAuthInitializing(false);
        }
      } else {
        if (isMounted) {
          setCurrentUser(null);
          setIsAuthInitializing(false);
        }
      }
    });

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleOAuthLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) setAuthError(error.message);
    } catch (err) {
      console.error('OAuth Login Error:', err);
      setAuthError(err.message || 'An unexpected error occurred during Google sign in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
    } catch (err) {
      console.error('Email Login Error:', err);
      setAuthError(err.message || 'An unexpected error occurred during email sign in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
      else setAuthError('SUCCESS: Check your email for a confirmation link.');
    } catch (err) {
      console.error('Email Signup Error:', err);
      setAuthError(err.message || 'An unexpected error occurred during sign up.');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      if (currentUser?.status === 'VERIFIED' || currentUser?.handle) {
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
      const res = await fetch(`${API_BASE_URL}/api/profile/verify-handle`, {
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
      const res = await fetch(`${API_BASE_URL}/api/profile/verify-handle`, {
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
        gradYear: onboardingForm.gradYear,
        status: 'VERIFIED'
      }));
      try {
        localStorage.removeItem('lockout_onboarding_form');
        localStorage.removeItem('lockout_onboarding_step');
        localStorage.removeItem('lockout_onboarding_token');
      } catch (err) {
        console.warn('Failed to clear localStorage onboarding state:', err);
      }
      setShowOnboarding(false);
    } catch (err) {
      setOnboardingError(err.message);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const player1Profile = activeMatch?.player1_profile || null;
  const player2Profile = activeMatch?.player2_profile || null;
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

  const activeMatchRef = useRef(activeMatch);
  useEffect(() => {
    activeMatchRef.current = activeMatch;
  }, [activeMatch]);

  // Poll backend API for match state updates when in an active match
  useEffect(() => {
    if (!activeMatch?.id) return;

    console.log(`[POLLING] Initiating 2-second HTTP sync loop for match: ${activeMatch?.id}`);
    const interval = setInterval(async () => {
      const currentMatchId = activeMatchRef.current?.id;
      if (!currentMatchId) return;

      try {
        console.log("[POLLING TICK]", new Date().toISOString(), currentMatchId, activeMatchRef.current?.status);
        const res = await fetch(`${API_BASE_URL}/api/matches/${currentMatchId}?t=${Date.now()}`);
        const data = await res.json();
        console.log("[POLLING RESPONSE PAYLOAD]", data);
        
        if (data && !data.error) {
          if (data.status === 'FINISHED' || data.status === 'ABANDONED' || data.status === 'completed' || data.status === 'finished') {
            setMatchResult(data);
            setActiveMatch(null);
            clearInterval(interval);
          } else {
            setActiveMatch(data);
          }
        }
      } catch (err) {
        console.error("Sync error:", err);
      }
    }, 2000);

    return () => {
      console.log(`[POLLING] Clearing 2-second HTTP sync loop.`);
      clearInterval(interval);
    };
  }, [activeMatch?.id, currentUser?.id]);

  const handleCreateMatch = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const match = await createMatch(currentUser?.id, minRating, maxRating, token);
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const match = await joinMatch(currentUser?.id, roomCodeInput, token);
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_BASE_URL}/api/matches/sync/${activeMatch.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to refresh match status.');
      setActiveMatch(data);
      if (data.status === 'FINISHED' || data.status === 'ABANDONED' || data.status === 'completed' || data.status === 'finished') {
        setMatchResult(data);
        setActiveMatch(null);
      }
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
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (activeMatch.status === 'active') {
          await abandonMatch(currentUser?.id, activeMatch.id, token);
        } else {
          await leaveMatch(currentUser?.id, activeMatch.id, token);
        }
      } catch (err) {
        console.warn('Failed to notify backend of exit:', err.message);
      } finally {
        setLoading(false);
      }
    }
    setActiveMatch(null);
    setError('');
  };

  const getPlayerProfile = (id) => {
    if (!activeMatch) return null;
    if (activeMatch.player_1_id === id) return activeMatch.player1_profile || { handle: 'HOST', id };
    if (activeMatch.player_2_id === id) return activeMatch.player2_profile || { handle: 'CHALLENGER', id };
    return null;
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-[#27272A] py-5 px-6 flex justify-between items-center bg-[#09090B] z-10">
        <div className="flex items-center space-x-3">
          <span className="h-2 w-2 bg-[#06B6D4] animate-pulse"></span>
          <h1 className="text-lg font-black tracking-widest font-mono text-white">LOCKOUT.IO</h1>
        </div>
        {currentUser && (
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-500 font-mono tracking-wider">LOGGED IN AS:</span>
              <span className="text-xs font-black font-mono text-[#06B6D4] uppercase tracking-widest">{currentUser?.handle || 'NEWBIE'}</span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-1.5 bg-[#09090B] border border-[#27272A] hover:border-[#EF4444] text-[10px] font-bold font-mono text-slate-400 hover:text-[#EF4444] transition-all duration-200 tracking-wider"
            >
              LOGOUT
            </button>
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

              <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-5">
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 font-mono mb-2">FULL NAME</label>
                  <input
                    type="text"
                    disabled={onboardingStep === 2 || onboardingLoading}
                    value={onboardingForm.name}
                    onChange={(e) => setOnboardingForm({...onboardingForm, name: e.target.value})}
                    className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4] disabled:opacity-60"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 font-mono mb-2">COLLEGE NAME</label>
                  <input
                    type="text"
                    disabled={onboardingStep === 2 || onboardingLoading}
                    value={onboardingForm.college}
                    onChange={(e) => setOnboardingForm({...onboardingForm, college: e.target.value})}
                    className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4] disabled:opacity-60"
                    placeholder="e.g. MIT"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 font-mono mb-2">GRADUATION YEAR</label>
                  <input
                    type="text"
                    maxLength={4}
                    disabled={onboardingStep === 2 || onboardingLoading}
                    value={onboardingForm.gradYear}
                    onChange={(e) => setOnboardingForm({...onboardingForm, gradYear: e.target.value})}
                    className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4] disabled:opacity-60"
                    placeholder="e.g. 2026"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-slate-400 font-mono mb-2">CODEFORCES HANDLE</label>
                  <input
                    type="text"
                    disabled={onboardingStep === 2 || onboardingLoading}
                    value={onboardingForm.handle}
                    onChange={(e) => setOnboardingForm({...onboardingForm, handle: e.target.value})}
                    className="bg-[#09090B] border border-[#27272A] text-slate-100 py-2.5 px-4 font-mono focus:outline-none focus:border-[#06B6D4] disabled:opacity-60"
                  />
                </div>

                {onboardingStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleGenerateToken}
                    disabled={onboardingLoading}
                    className="mt-6 w-full bg-[#18181B] border border-[#06B6D4] hover:bg-[#06B6D4] hover:text-[#09090B] text-[#06B6D4] py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 disabled:opacity-50"
                  >
                    {onboardingLoading ? 'PROCESSING...' : 'GENERATE TOKEN'}
                  </button>
                ) : (
                  <div className="mt-6 space-y-6 pt-4 border-t border-[#27272A]">
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Please update your Codeforces Profile First or Last Name to the exact token below to verify ownership of the handle <strong className="text-white">{onboardingForm.handle}</strong>.
                    </p>
                    
                    <div className="bg-[#09090B] border border-[#06B6D4] p-4 text-center">
                      <span className="text-2xl font-black font-mono tracking-widest text-[#06B6D4]">{onboardingToken}</span>
                    </div>
                    
                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => setOnboardingStep(1)}
                        disabled={onboardingLoading}
                        className="w-1/3 bg-[#18181B] border border-[#27272A] hover:bg-[#27272A] text-slate-400 py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200"
                      >
                        BACK
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifySetup}
                        disabled={onboardingLoading}
                        className="w-2/3 bg-[#18181B] border border-[#10B981] hover:bg-[#10B981] hover:text-[#09090B] text-[#10B981] py-3 text-sm font-bold font-mono tracking-wider transition-all duration-200 disabled:opacity-50"
                      >
                        {onboardingLoading ? 'VERIFYING...' : 'VERIFY & COMPLETE SETUP'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
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
    
            {matchResult ? (
              /* DEDICATED VICTORY/DEFEAT RESULT SCREEN */
              <div className="w-full max-w-4xl mx-auto bg-[#18181B] border border-[#27272A] p-8 shadow-2xl space-y-8 my-auto animate-fadeIn">
                {/* Header Title */}
                <div className="text-center space-y-2 pb-6 border-b border-[#27272A]">
                  {matchResult.status === 'ABANDONED' ? (
                    currentUser?.id === matchResult.winner_id ? (
                      <h2 className="text-3xl font-black font-mono tracking-widest text-[#10B981] drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                        OPPONENT ABANDONED - VICTORY
                      </h2>
                    ) : (
                      <h2 className="text-3xl font-black font-mono tracking-widest text-[#EF4444] drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        YOU ABANDONED - DEFEAT
                      </h2>
                    )
                  ) : currentUser?.id === matchResult.winner_id ? (
                    <h2 className="text-3xl font-black font-mono tracking-widest text-[#10B981] drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                      VICTORY ACHIEVED
                    </h2>
                  ) : matchResult.winner_id ? (
                    <h2 className="text-3xl font-black font-mono tracking-widest text-[#EF4444] drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                      DEFEAT DETECTED
                    </h2>
                  ) : (
                    <h2 className="text-3xl font-black font-mono tracking-widest text-[#F59E0B] drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                      MATCH DRAWN
                    </h2>
                  )}
                  <p className="text-slate-400 font-mono text-sm uppercase tracking-wider">
                    ARENA WORKSPACE EXPULSION: {matchResult.status}
                  </p>
                </div>

                {/* Scoreboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Player 1 Card */}
                  <div className={`p-6 border flex flex-col justify-between ${
                    matchResult.winner_id === matchResult.player_1_id 
                      ? 'bg-[#10B981]/5 border-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-[#09090B] border-[#27272A]'
                  }`}>
                    <div>
                      <span className="text-xs text-slate-400 font-mono">PLAYER 1</span>
                      <h3 className="text-xl font-bold font-mono text-white mt-1">
                        {matchResult.player1_profile?.handle || 'Unknown'}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono uppercase mt-1">
                        COLLEGE: {matchResult.player1_profile?.college || 'Unknown'}
                      </p>
                    </div>
                    <div className="mt-8 border-t border-[#27272A] pt-4 flex justify-between items-baseline">
                      <span className="text-xs text-slate-400 font-mono">LOCKOUT SCORE</span>
                      <span className="text-3xl font-black font-mono text-[#06B6D4]">
                        {matchResult.player_1_score || 0} PTS
                      </span>
                    </div>
                  </div>

                  {/* Player 2 Card */}
                  <div className={`p-6 border flex flex-col justify-between ${
                    matchResult.winner_id === matchResult.player_2_id 
                      ? 'bg-[#10B981]/5 border-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-[#09090B] border-[#27272A]'
                  }`}>
                    <div>
                      <span className="text-xs text-slate-400 font-mono">PLAYER 2</span>
                      <h3 className="text-xl font-bold font-mono text-white mt-1">
                        {matchResult.player2_profile?.handle || 'Unknown'}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono uppercase mt-1">
                        COLLEGE: {matchResult.player2_profile?.college || 'Unknown'}
                      </p>
                    </div>
                    <div className="mt-8 border-t border-[#27272A] pt-4 flex justify-between items-baseline">
                      <span className="text-xs text-slate-400 font-mono">LOCKOUT SCORE</span>
                      <span className="text-3xl font-black font-mono text-[#06B6D4]">
                        {matchResult.player_2_score || 0} PTS
                      </span>
                    </div>
                  </div>
                </div>

                {/* Problem Breakdown List */}
                <div className="bg-[#09090B] border border-[#27272A] p-6 space-y-4">
                  <h3 className="text-sm font-bold font-mono text-slate-300 uppercase tracking-widest mb-4">
                    PROBLEM RESOLUTION BREAKDOWN
                  </h3>
                  <div className="space-y-3">
                    {matchResult.problems && matchResult.problems.map((problem) => {
                      const isLocked = problem.locked === true;
                      const solver = isLocked 
                        ? (problem.locked_by === matchResult.player_1_id 
                          ? matchResult.player1_profile?.handle 
                          : matchResult.player2_profile?.handle) 
                        : null;
                      return (
                        <div key={`${problem.contestId}-${problem.index}`} className="flex justify-between items-center p-4 bg-[#18181B] border border-[#27272A]">
                          <div>
                            <span className="text-sm font-mono text-slate-200">{problem.name}</span>
                            <span className="ml-2 text-xs font-mono text-[#06B6D4] px-1.5 py-0.5 bg-[#09090B] border border-[#27272A]">
                              {problem.points} PTS
                            </span>
                          </div>
                          <div className="text-xs font-mono">
                            {isLocked ? (
                              <span className="text-[#10B981] font-bold">
                                LOCKED BY {solver || 'Unknown'}
                              </span>
                            ) : (
                              <span className="text-slate-500">UNSOLVED</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Exit Button */}
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setMatchResult(null)}
                    className="bg-[#09090B] border border-[#06B6D4] hover:bg-[#06B6D4] hover:text-[#09090B] text-[#06B6D4] px-12 py-4 text-sm font-bold font-mono tracking-widest transition-all duration-200"
                  >
                    RETURN TO LOBBY
                  </button>
                </div>
              </div>
            ) : !activeMatch ? (
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
              <div className="space-y-1.5">
                <div className="flex items-center space-x-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${activeMatch.status === 'active' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`}></span>
                  <span className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
                    ROOM CODE: <span className="text-white bg-[#09090B] px-2 py-0.5 border border-[#27272A] font-mono tracking-normal ml-1">{activeMatch.room_code}</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono tracking-wider">
                  STATUS: <span className="uppercase text-white font-bold tracking-widest">{activeMatch.status}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="bg-[#09090B] border border-[#27272A] hover:border-[#06B6D4] hover:text-[#06B6D4] text-slate-300 px-5 py-2 text-xs font-bold font-mono tracking-wider transition-all duration-200 rounded-none"
                >
                  {loading ? 'RELOADING...' : 'REFRESH STATUS'}
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="bg-[#09090B] border border-red-500/50 hover:bg-red-500 hover:text-black text-red-500 px-5 py-2 text-xs font-bold font-mono tracking-wider transition-all duration-200 rounded-none"
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
                  <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">PLAYER 1 (CHALLENGER)</span>
                  <div className="text-lg font-black font-mono text-white mt-1 uppercase tracking-wider">
                    {player1Profile?.handle || 'Unknown'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">SCORE</span>
                  <div className="text-4xl font-black font-mono text-[#06B6D4] mt-0.5 tracking-wider">
                    {activeMatch.player_1_score || 0}
                  </div>
                </div>
              </div>

              {/* Player 2 Card */}
              <div className="bg-[#18181B] border border-[#27272A] p-6 flex justify-between items-center">
                {activeMatch.player_2_id ? (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">PLAYER 2 (OPPONENT)</span>
                      <div className="text-lg font-black font-mono text-white mt-1 uppercase tracking-wider">
                        {player2Profile?.handle || 'Unknown'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">SCORE</span>
                      <div className="text-4xl font-black font-mono text-[#06B6D4] mt-0.5 tracking-wider">
                        {activeMatch.player_2_score || 0}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center py-2 space-y-2 border border-dashed border-[#27272A] bg-[#09090B] animate-pulse">
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 bg-[#EF4444] rounded-full relative flex">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#EF4444]"></span>
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
                        WAITING FOR OPPONENT TO JOIN
                      </span>
                    </div>
                    <span className="font-mono text-[9px] text-slate-600 uppercase">
                      ARENA ACCESS KEY COMMITTED
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Conditional Lobby or Arena Grid */}
            {activeMatch.status === 'PENDING' ? (
              <div className="bg-[#18181B] border border-[#27272A] p-12 flex flex-col items-center justify-center space-y-6">
                <div className="flex items-center space-x-3">
                  <span className="h-4 w-4 bg-[#06B6D4] animate-pulse rounded-full"></span>
                  <h3 className="text-xl font-bold font-mono tracking-widest uppercase text-slate-200">
                    ARENA LOBBY READY
                  </h3>
                </div>
                {currentUser?.id === activeMatch.player_1_id ? (
                  <button 
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        const match = await startMatch(activeMatch.id, currentUser?.id, token);
                        setActiveMatch(match);
                      } catch (err) {
                        setError(err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="bg-[#09090B] border border-[#06B6D4] hover:bg-[#06B6D4] hover:text-[#09090B] text-[#06B6D4] px-8 py-4 text-sm font-bold font-mono tracking-wider transition-all duration-200 rounded-none disabled:opacity-50"
                  >
                    {loading ? 'STARTING ARENA...' : 'START MATCH NOW'}
                  </button>
                ) : (
                  <p className="text-slate-400 font-mono text-sm uppercase">WAITING FOR HOST TO START ARENA...</p>
                )}
              </div>
            ) : activeMatch.status === 'active' ? (
              <div className="bg-[#09090B] border border-[#27272A] p-6">
                {/* 5-Problem Lockout Grid */}
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
            ) : null}
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
