import React, { useState, useEffect, useRef } from 'react';
import { Bell, Volume2, VolumeX, Settings as SettingsIcon, CheckCircle, Clock, Send, ShieldAlert, Sparkles, X } from 'lucide-react';
import { AppSettings, Ring, UserRole } from './types/bell';
import { acknowledgeRing, fetchBellStatus, loadSettings, ringBell, saveSettings } from './services/bellService';
import { playBellChime, unlockAudio } from './utils/sound';
import { triggerHaptic } from './utils/haptics';

export function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [activeRing, setActiveRing] = useState<Ring | null>(null);
  const [history, setHistory] = useState<Ring[]>([]);
  const [isRingingSelf, setIsRingingSelf] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lastRungTime, setLastRungTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const partnerRole: UserRole = settings.userRole === 'Danny' ? 'Bri' : 'Danny';
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for bell status every 3 seconds
  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      const data = await fetchBellStatus(settings.appsScriptUrl);
      if (!isMounted) return;

      setActiveRing(data.active);
      setHistory(data.history || []);

      // If partner is currently ringing, trigger chime & haptics!
      if (data.active && data.active.sender !== settings.userRole && data.active.status === 'PENDING') {
        if (settings.soundEnabled && !audioIntervalRef.current) {
          playBellChime();
          triggerHaptic();
          audioIntervalRef.current = setInterval(() => {
            playBellChime();
            triggerHaptic();
          }, 4000);
        }
      } else {
        if (audioIntervalRef.current) {
          clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = null;
        }
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [settings.appsScriptUrl, settings.userRole, settings.soundEnabled]);

  // Elapsed seconds counter for active ring
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

  const handleRing = async () => {
    unlockAudio();
    setIsRingingSelf(true);
    triggerHaptic();
    if (settings.soundEnabled) {
      playBellChime();
    }

    const ring = await ringBell(settings.userRole, 'Need help!', settings.appsScriptUrl, settings.ntfyTopic);
    setActiveRing(ring);
    setLastRungTime(Date.now());
    setHistory(prev => [ring, ...prev]);
  };

  const handleAcknowledge = async () => {
    unlockAudio();
    triggerHaptic();
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    if (activeRing) {
      await acknowledgeRing(activeRing.id, settings.appsScriptUrl);
      setActiveRing(null);
      setIsRingingSelf(false);
      // Refresh status
      const data = await fetchBellStatus(settings.appsScriptUrl);
      setActiveRing(data.active);
      setHistory(data.history || []);
    }
  };

  const toggleUserRole = () => {
    const next: UserRole = settings.userRole === 'Danny' ? 'Bri' : 'Danny';
    const updated = { ...settings, userRole: next };
    setSettings(updated);
    saveSettings(updated);
  };

  const isPartnerRingingMe = activeRing && activeRing.sender !== settings.userRole && activeRing.status === 'PENDING';
  const isMyRingPending = activeRing && activeRing.sender === settings.userRole && activeRing.status === 'PENDING';

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500/30">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bell className="w-5 h-5 text-slate-950 fill-current" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">Household Bell</h1>
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active & Ready</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Identity Switcher Button */}
            <button
              onClick={toggleUserRole}
              className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/70 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <span>{settings.userRole === 'Danny' ? '👨' : '👩'}</span>
              <span>I am {settings.userRole}</span>
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
        {/* State 1: Partner is Ringing You! (Urgent Call Alert) */}
        {isPartnerRingingMe ? (
          <div className="w-full bg-gradient-to-b from-amber-500/20 to-red-500/10 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl shadow-amber-500/30 text-center animate-bounce">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/50">
              <ShieldAlert className="w-8 h-8 text-slate-950 animate-pulse" />
            </div>

            <h2 className="text-2xl font-black text-white mb-1">
              🚨 {activeRing?.sender} Needs Help!
            </h2>
            <p className="text-sm text-amber-200/90 mb-4">
              Ringing for <span className="font-mono font-bold text-white text-base">{elapsedSeconds}s</span>
            </p>

            <button
              onClick={handleAcknowledge}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-lg shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <span>🏃</span>
              <span>ON MY WAY!</span>
            </button>
          </div>
        ) : isMyRingPending ? (
          /* State 2: You Rung the Bell and are Waiting */
          <div className="w-full bg-slate-800/80 border border-amber-500/40 rounded-3xl p-8 shadow-xl text-center">
            <div className="relative w-24 h-24 mx-auto mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"></div>
              <div className="w-20 h-20 rounded-full bg-amber-500/30 flex items-center justify-center border border-amber-500">
                <Bell className="w-10 h-10 text-amber-400 animate-pulse" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">
              Ringing {partnerRole}...
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Waiting for response ({elapsedSeconds}s)
            </p>

            <button
              onClick={handleAcknowledge}
              className="px-6 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-300 transition-all active:scale-95"
            >
              Cancel / Dismiss
            </button>
          </div>
        ) : (
          /* State 3: Idle (Ready to Ring) */
          <div className="w-full flex flex-col items-center">
            <div className="relative group cursor-pointer" onClick={handleRing}>
              {/* Outer Pulse Glow */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 blur-2xl group-hover:blur-3xl transition-all opacity-75 group-hover:opacity-100"></div>

              {/* Giant Bell Button */}
              <button
                className="relative w-56 h-56 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-4 border-amber-300/40 shadow-2xl shadow-amber-500/40 flex flex-col items-center justify-center text-slate-950 active:scale-95 transition-all"
              >
                <Bell className="w-20 h-20 fill-current mb-2 drop-shadow-md" />
                <span className="font-black text-xl tracking-wider">RING BELL</span>
                <span className="text-[11px] font-semibold opacity-90">Need Help!</span>
              </button>
            </div>

            <p className="mt-8 text-center text-xs text-slate-400 max-w-xs">
              Tap to alert <span className="font-semibold text-slate-200">{partnerRole}</span> on their phone with an instant chime & alert.
            </p>
          </div>
        )}
      </main>

      {/* Activity History Drawer */}
      <footer className="max-w-md w-full mx-auto px-6 pb-6 pt-2">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-400">
            <span>RECENT CALLS</span>
            <span className="text-[10px] text-slate-500">Auto-logged to Sheets</span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No recent rings. Tap the bell anytime you need help!
              </div>
            ) : (
              history.slice(0, 4).map(ring => {
                const isDanny = ring.sender === 'Danny';
                const time = ring.timestamp ? new Date(ring.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div
                    key={ring.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-800/40 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span>{isDanny ? '👨' : '👩'}</span>
                      <span className="font-medium text-slate-200">
                        {ring.sender}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        "{ring.message}"
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                      {ring.durationSeconds ? (
                        <span className="text-emerald-400 font-mono">✓ {ring.durationSeconds}s</span>
                      ) : (
                        <span className="text-amber-400">Pending</span>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
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
                <label className="block text-slate-400 font-medium mb-1.5">My Identity</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const updated = { ...settings, userRole: 'Danny' as UserRole };
                      setSettings(updated);
                      saveSettings(updated);
                    }}
                    className={`py-2 rounded-xl font-semibold border transition-all ${
                      settings.userRole === 'Danny'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    👨 Danny
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...settings, userRole: 'Bri' as UserRole };
                      setSettings(updated);
                      saveSettings(updated);
                    }}
                    className={`py-2 rounded-xl font-semibold border transition-all ${
                      settings.userRole === 'Bri'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    👩 Bri
                  </button>
                </div>
              </div>

              {/* Sound Test */}
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">Chime Sound</label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                  <div className="flex items-center space-x-2 text-slate-200 font-medium">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Play Sound on Ring</span>
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

              {/* Google Apps Script Backend URL */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Apps Script Web App URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={settings.appsScriptUrl}
                  onChange={e => {
                    const updated = { ...settings, appsScriptUrl: e.target.value };
                    setSettings(updated);
                    saveSettings(updated);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Connects to the Bell_Database script to auto-log rings to Google Sheets.
                </span>
              </div>

              {/* ntfy.sh Topic */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Push Notification Topic (ntfy.sh)
                </label>
                <input
                  type="text"
                  placeholder="schmidgall-household-bell"
                  value={settings.ntfyTopic}
                  onChange={e => {
                    const updated = { ...settings, ntfyTopic: e.target.value };
                    setSettings(updated);
                    saveSettings(updated);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Subscribe to this topic on the free ntfy iOS/Android app for instant lock-screen alerts.
                </span>
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