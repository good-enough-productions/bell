import { AppSettings, BellStatusResponse, Ring, UserRole } from '../types/bell';

const SETTINGS_KEY = 'bell_pwa_settings_v1';
const LOCAL_RINGS_KEY = 'bell_local_rings_v1';

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return {
    userRole: 'Danny',
    soundEnabled: true,
    appsScriptUrl: '',
    ntfyTopic: 'schmidgall-household-bell'
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Local mock history for offline / standalone mode
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
  sender: UserRole,
  message: string = 'Need help!',
  appsScriptUrl?: string,
  ntfyTopic?: string
): Promise<Ring> {
  const newRing: Ring = {
    id: 'ring_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    sender,
    message,
    status: 'PENDING'
  };

  // Save locally first
  const rings = getLocalRings();
  rings.unshift(newRing);
  saveLocalRings(rings);

  // Send to Apps Script backend if configured
  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'ring',
          sender,
          message,
          ntfyTopic: ntfyTopic || ''
        })
      });
    } catch (e) {
      console.warn('Backend ring error:', e);
    }
  }

  // Also send directly to ntfy.sh topic for instant push
  if (ntfyTopic && ntfyTopic.trim()) {
    try {
      await fetch(`https://ntfy.sh/${ntfyTopic.trim()}`, {
        method: 'POST',
        headers: {
          'Title': '🔔 Urgent Bell Ring!',
          'Priority': '5',
          'Tags': 'bell,warning'
        },
        body: `${sender}: ${message}`
      });
    } catch (e) {
      // Ignore ntfy fetch error
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
