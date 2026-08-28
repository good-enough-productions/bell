import { AppSettings, BellStatusResponse, Ring, UserRole } from '../types/bell';

const SETTINGS_KEY = 'bell_pwa_settings_v2';
const LOCAL_RINGS_KEY = 'bell_local_rings_v2';

export const HARDCODED_NTFY_TOPIC = 'good-enough-bell-danny-bri';
export const DEFAULT_APPS_SCRIPT_URL = '';

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        ntfyTopic: parsed.ntfyTopic || HARDCODED_NTFY_TOPIC
      };
    }
  } catch (e) {
    // Ignore parse errors
  }
  return {
    userRole: 'Bri', // Default to Bri on first launch
    soundEnabled: true,
    appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
    ntfyTopic: HARDCODED_NTFY_TOPIC
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Local storage history
function getLocalRings(): Ring[] {
  try {
    const saved = localStorage.getItem(LOCAL_RINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

function saveLocalRings(rings: Ring[]) {
  localStorage.setItem(LOCAL_RINGS_KEY, JSON.stringify(rings.slice(0, 30)));
}

export async function fetchBellStatus(appsScriptUrl?: string): Promise<BellStatusResponse> {
  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      const res = await fetch(appsScriptUrl.trim(), { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Backend fetch error, using local state:', e);
    }
  }

  // Fallback to local storage state
  const rings = getLocalRings();
  const active = rings.find(r => r.status === 'PENDING') || null;
  return {
    active,
    history: rings
  };
}

export async function ringBell(
  sender: UserRole = 'Bri',
  message: string = 'Need help!',
  appsScriptUrl?: string,
  ntfyTopic: string = HARDCODED_NTFY_TOPIC
): Promise<Ring> {
  const finalMessage = message.trim() ? message.trim() : 'Need help!';
  const newRing: Ring = {
    id: 'ring_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    sender,
    message: finalMessage,
    status: 'PENDING'
  };

  // 1. Save locally
  const rings = getLocalRings();
  rings.unshift(newRing);
  saveLocalRings(rings);

  // 2. Direct high-priority push via ntfy.sh (Instant lockscreen alert to Danny!)
  const topic = ntfyTopic.trim() || HARDCODED_NTFY_TOPIC;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Title': `🔔 ${sender} is Ringing the Bell!`,
        'Priority': '5',
        'Tags': 'bell,warning,rotating_light',
        'Click': 'https://good-enough-productions.github.io/bell/',
        'Actions': 'view, 🏃 Open Bell / On My Way, https://good-enough-productions.github.io/bell/'
      },
      body: finalMessage
    });
  } catch (e) {
    console.warn('Direct ntfy push error:', e);
  }

  // 3. Send to Google Apps Script backend if configured
  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'ring',
          sender,
          message: finalMessage,
          ntfyTopic: topic
        })
      });
    } catch (e) {
      console.warn('Backend ring logging error:', e);
    }
  }

  return newRing;
}

export async function acknowledgeRing(
  ringId: string,
  appsScriptUrl?: string
): Promise<boolean> {
  // Update local ring
  const rings = getLocalRings();
  const target = rings.find(r => r.id === ringId);
  if (target) {
    target.status = 'COMPLETED';
    target.completedAt = new Date().toISOString();
    const duration = Math.round((new Date(target.completedAt).getTime() - new Date(target.timestamp).getTime()) / 1000);
    target.durationSeconds = duration > 0 ? duration : 1;
    saveLocalRings(rings);
  }

  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'complete',
          id: ringId
        })
      });
      return true;
    } catch (e) {
      console.warn('Backend acknowledge error:', e);
    }
  }

  return true;
}
