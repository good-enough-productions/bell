// Web Audio API Bell Synthesizer (Works 100% in browser on iOS Safari & Android)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// User interaction unlocker for iOS Safari
export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch (e) {
    // Ignore unlock errors
  }
}

/**
 * Plays a realistic dual-tone service bell chime
 */
export function playBellChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Frequencies: Fundamental (880Hz A5) + Harmonic Overtone (1760Hz A6) + Shimmer (2640Hz)
    const tones = [
      { freq: 880, gain: 0.6, decay: 2.2 },
      { freq: 1760, gain: 0.35, decay: 1.6 },
      { freq: 2640, gain: 0.15, decay: 1.0 },
      { freq: 3520, gain: 0.08, decay: 0.6 }
    ];

    tones.forEach(({ freq, gain, decay }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Instant attack, exponential decay
      gainNode.gain.setValueAtTime(gain, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + decay);
    });
  } catch (e) {
    console.warn('Audio playback error:', e);
  }
}
