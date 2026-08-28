import React, { useState, useEffect, useRef } from 'react';
import { Bell, Volume2, Settings as SettingsIcon, ShieldAlert, MessageSquare, X, Smartphone } from 'lucide-react';
import { AppSettings, Ring, UserRole } from './types/bell';
import { acknowledgeRing, cancelRing, fetchNtfyHistory, HARDCODED_NTFY_TOPIC, loadSettings, ringBell, saveSettings } from './services/bellService';
import { playBellChime, unlockAudio } from './utils/sound';
import { triggerHaptic } from './utils/haptics';

export function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [activeRing, setActiveRing] = useState<Ring | null>(null);
  const [history, setHistory] = useState<Ring[]>([]);
  const [customNote, setCustomNote] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isRingingLoading, setIsRingingLoading] = useState<boolean>(false);
  const [answeredByDanny, setAnsweredByDanny] = useState<boolean>(false);

  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isBri = settings.userRole === 'Bri';

  // Check URL param on mount: ?role=Danny or ?role=Bri
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'Danny' || roleParam === 'Bri') {
      const updated = { ...settings, userRole: roleParam as UserRole };
      setSettings(updated);
      saveSettings(updated);
    }
  }, []);

  // Initial State Hydration from ntfy server buffer
  const loadNtfyData = async () => {
    const data = await fetchNtfyHistory(settings.ntfyTopic);
    setActiveRing(data.active);
    setHistory(data.history || []);

    // If Danny is in Receiver mode and there is an active ring, start alarm
    if (data.active && settings.userRole === 'Danny') {
      playBellChime();
      triggerHaptic();
      if (settings.soundEnabled && !audioIntervalRef.current) {
        audioIntervalRef.current = setInterval(() => {
          playBellChime();
          triggerHaptic();
        }, 3500);
      }
    }
  };

  useEffect(() => {
    loadNtfyData();
  }, [settings.ntfyTopic, settings.userRole]);

  // Listen to live Server-Sent Events (SSE) from ntfy.sh
  useEffect(() => {
    const topic = settings.ntfyTopic || HARDCODED_NTFY_TOPIC;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'message') {
            const title = data.title || '';
            const msg = data.message || 'Need help!';

            if (title.includes('Ringing the Bell') || title.includes('Bri is Ringing')) {
              // Received new ring from Bri!
              const newRing: Ring = {
                id: data.id || 'ring_' + Date.now(),
                timestamp: new Date(data.time ? data.time * 1000 : Date.now()).toISOString(),
                sender: 'Bri',
                message: msg,
                status: 'PENDING'
              };
              setActiveRing(newRing);
              setAnsweredByDanny(false);
              setHistory(prev => [newRing, ...prev.filter(r => r.id !== newRing.id)]);

              // If Danny is in Receiver mode, trigger alarm chime & vibrate!
              if (settings.userRole === 'Danny') {
                playBellChime();
                triggerHaptic();
                if (settings.soundEnabled && !audioIntervalRef.current) {
                  audioIntervalRef.current = setInterval(() => {
                    playBellChime();
                    triggerHaptic();
                  }, 3500);
                }
              }
            } else if (title.includes('Danny Answered')) {
              // Danny answered!
              if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
                audioIntervalRef.current = null;
              }
              setActiveRing(null);
              setAnsweredByDanny(true);
              setHistory(prev =>
                prev.map(r => (r.status === 'PENDING' ? { ...r, status: 'COMPLETED', completedAt: new Date().toISOString() } : r))
              );
            } else if (title.includes('Bri Cancelled')) {
              // Bri cancelled ring
              if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
                audioIntervalRef.current = null;
              }
              setActiveRing(null);
              setAnsweredByDanny(false);
            }
          }
        } catch (e) {
          console.warn('SSE parse error:', e);
        }
      };
    } catch (e) {
      console.warn('EventSource initialization error:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    };
  }, [settings.ntfyTopic, settings.userRole, settings.soundEnabled]);

  // Elapsed seconds timer for active ring
  useEffect(() => {
    if (!activeRing || activeRing.status !== 'PENDING') {
      setElapsedSeconds(0);
      return;
    }

    const start = new Date(activeRing.timestamp).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.round((now - start) / 1000)));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [activeRing]);

  // Bri rings the bell
  const handleRingBell = async () => {
    unlockAudio();
    setIsRingingLoading(true);
    triggerHaptic();
    if (settings.soundEnabled) {
      playBellChime();
    }

    const msg = customNote.trim() ? customNote.trim() : 'Need help!';
    const ring = await ringBell('Bri', msg, settings.appsScriptUrl, settings.ntfyTopic);
    setActiveRing(ring);
    setAnsweredByDanny(false);
    setHistory(prev => [ring, ...prev]);
    setIsRingingLoading(false);
  };

  // Bri cancels her active ring
  const handleBriCancel = async () => {
    unlockAudio();
    triggerHaptic();
    setActiveRing(null);
    setAnsweredByDanny(false);
    await cancelRing(settings.ntfyTopic);
  };

  // Danny acknowledges the ring
  const handleDannyAcknowledge = async () => {
    unlockAudio();
    triggerHaptic();
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    const ringId = activeRing?.id || 'ring_ack';
    setActiveRing(null);
    await acknowledgeRing(ringId, settings.appsScriptUrl, settings.ntfyTopic);
  };

  const toggleUserRole = () => {
    const next: UserRole = settings.userRole === 'Bri' ? 'Danny' : 'Bri';
    const updated = { ...settings, userRole: next };
    setSettings(updated);
    saveSettings(updated);
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500/30">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bell className="w-5 h-5 text-slate-950 fill-current" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">Household Bell</h1>
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{isBri ? 'Bri (Ringer)' : 'Danny (Receiver)'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Identity Switcher Button */}
            <button
              onClick={toggleUserRole}
              className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/70 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <span>{isBri ? '👩 Bri' : '👨 Danny'}</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-6 flex flex-col justify-center items-center">
        {/* ======================================================== */}
        {/* VIEW 1: BRI'S SCREEN (THE CALLER)                        */}
        {/* ======================================================== */}
        {isBri ? (
          <div className="w-full flex flex-col items-center">
            {/* If Bri has rung and it is pending Danny's answer */}
            {activeRing && activeRing.status === 'PENDING' ? (
              <div className="w-full bg-slate-800/90 border-2 border-amber-500/60 rounded-3xl p-7 shadow-2xl text-center animate-pulse">
                <div className="relative w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"></div>
                  <div className="w-16 h-16 rounded-full bg-amber-500/30 flex items-center justify-center border border-amber-500">
                    <Bell className="w-8 h-8 text-amber-400" />
                  </div>
                </div>

                <h2 className="text-2xl font-black text-white mb-1">
                  Ringing Danny...
                </h2>
                <p className="text-sm text-amber-300 font-medium mb-1">
                  "{activeRing.message}"
                </p>
                <p className="text-xs text-slate-400 mb-6 font-mono">
                  Waiting for response ({elapsedSeconds}s)
                </p>

                <button
                  onClick={handleBriCancel}
                  className="px-6 py-2.5 rounded-xl bg-slate-700/90 hover:bg-slate-600 text-xs font-semibold text-slate-300 transition-all active:scale-95"
                >
                  Dismiss / Cancel
                </button>
              </div>
            ) : answeredByDanny ? (
              /* Danny tapped On My Way! */
              <div className="w-full bg-emerald-950/40 border-2 border-emerald-500/70 rounded-3xl p-7 shadow-2xl text-center mb-6 animate-fadeIn">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl">
                  🏃
                </div>
                <h2 className="text-2xl font-black text-emerald-400 mb-1">
                  Danny is On His Way!
                </h2>
                <p className="text-xs text-emerald-300/80 mb-4">
                  Bell acknowledged and answered!
                </p>
                <button
                  onClick={() => setAnsweredByDanny(false)}
                  className="px-5 py-2 rounded-xl bg-emerald-800/60 hover:bg-emerald-700 text-xs font-semibold text-emerald-200 transition-all"
                >
                  OK
                </button>
              </div>
            ) : (
              /* Big Ring Bell Button */
              <>
                <div className="relative group cursor-pointer mb-6" onClick={handleRingBell}>
                  {/* Outer Glow Pulse */}
                  <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 blur-2xl group-hover:blur-3xl transition-all opacity-80 group-hover:opacity-100"></div>

                  {/* Giant Bell Button */}
                  <button
                    disabled={isRingingLoading}
                    className="relative w-56 h-56 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-4 border-amber-300/40 shadow-2xl shadow-amber-500/40 flex flex-col items-center justify-center text-slate-950 active:scale-95 transition-all"
                  >
                    <Bell className="w-20 h-20 fill-current mb-2 drop-shadow-md" />
                    <span className="font-black text-2xl tracking-wider">RING BELL</span>
                    <span className="text-xs font-semibold opacity-90">Tap to call Danny</span>
                  </button>
                </div>

                {/* Optional Custom Note Input */}
                <div className="w-full max-w-sm">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Add note (optional)... e.g. Bring water"
                      value={customNote}
                      onChange={e => setCustomNote(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                    <MessageSquare className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    {customNote && (
                      <button
                        onClick={() => setCustomNote('')}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: DANNY'S SCREEN (THE RECEIVER)                    */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center">
            {activeRing && activeRing.status === 'PENDING' ? (
              /* Bri is Ringing Danny! (Urgent Alarm State) */
              <div className="w-full bg-gradient-to-b from-amber-500/20 to-red-500/15 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl shadow-amber-500/40 text-center animate-bounce">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/50">
                  <ShieldAlert className="w-8 h-8 text-slate-950 animate-pulse" />
                </div>

                <h2 className="text-2xl font-black text-white mb-1">
                  🚨 Bri Needs Help!
                </h2>
                <div className="my-3 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-amber-500/30 text-amber-200 font-semibold text-base">
                  "{activeRing.message}"
                </div>
                <p className="text-xs text-slate-300 mb-5">
                  Ringing for <span className="font-mono font-bold text-white text-sm">{elapsedSeconds}s</span>
                </p>

                <button
                  onClick={handleDannyAcknowledge}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center space-x-2"
                >
                  <span>🏃</span>
                  <span>ON MY WAY!</span>
                </button>
              </div>
            ) : (
              /* Danny Idle State */
              <div className="w-full text-center py-10">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
                  <Smartphone className="w-9 h-9 opacity-60" />
                </div>
                <h3 className="font-bold text-lg text-slate-200 mb-1">Receiver Mode</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
                  Ready to receive calls from Bri. Your phone will chime and alert when she rings.
                </p>

                <button
                  onClick={loadNtfyData}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-all active:scale-95 mb-4"
                >
                  🔄 Check Status
                </button>

                <div className="block">
                  <span className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Push Channel: {HARDCODED_NTFY_TOPIC}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Activity History Drawer */}
      <footer className="max-w-md w-full mx-auto px-6 pb-6 pt-2">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-400">
            <span>RECENT CALLS</span>
            <span className="text-[10px] text-slate-500">Live SSE Stream</span>
          </div>

          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-500">
                No recent rings recorded yet.
              </div>
            ) : (
              history.slice(0, 4).map(ring => {
                const time = ring.timestamp ? new Date(ring.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div
                    key={ring.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-800/40 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span>👩</span>
                      <span className="font-medium text-slate-200">Bri</span>
                      <span className="text-slate-400 text-[11px] truncate max-w-[130px]">
                        "{ring.message}"
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                      {ring.status === 'COMPLETED' ? (
                        <span className="text-emerald-400 font-mono">✓ Answered</span>
                      ) : (
                        <span className="text-amber-400 animate-pulse">Ringing</span>
                      )}
                      <span>{time}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
              <span>Bell Settings</span>
            </h2>

            <div className="space-y-4 text-xs">
              {/* Identity Setting */}
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">Active Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const updated = { ...settings, userRole: 'Bri' as UserRole };
                      setSettings(updated);
                      saveSettings(updated);
                    }}
                    className={`py-2 rounded-xl font-semibold border transition-all ${
                      isBri
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    👩 Bri (Caller)
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...settings, userRole: 'Danny' as UserRole };
                      setSettings(updated);
                      saveSettings(updated);
                    }}
                    className={`py-2 rounded-xl font-semibold border transition-all ${
                      !isBri
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    👨 Danny (Receiver)
                  </button>
                </div>
              </div>

              {/* Sound Test */}
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">Chime Sound</label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                  <div className="flex items-center space-x-2 text-slate-200 font-medium">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Bell Chime</span>
                  </div>
                  <button
                    onClick={() => {
                      unlockAudio();
                      playBellChime();
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-amber-300"
                  >
                    Test Chime
                  </button>
                </div>
              </div>

              {/* Hardcoded Topic Info */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-slate-400">
                <span className="font-semibold text-slate-300 block mb-1">Live Push Channel</span>
                <span>Subscribed to: <code className="text-amber-400 font-mono">{HARDCODED_NTFY_TOPIC}</code></span>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-slate-950 transition-all text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;