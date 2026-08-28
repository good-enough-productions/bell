import { AppSettings, BellStatusResponse, Ring, UserRole } from '../types/bell';

const SETTINGS_KEY = 'bell_pwa_settings_v5';

export const HARDCODED_NTFY_TOPIC = 'good-enough-bell-danny-bri';
export const DEFAULT_APPS_SCRIPT_URL = '';

export function loadSettings(): AppSettings {
  // Check URL query param first: e.g. ?role=Danny or ?role=Bri
  let queryRole: UserRole | null = null;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('role');
    if (r === 'Danny' || r === 'Bri') {
      queryRole = r;
    }
  }

  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const effectiveRole = queryRole || parsed.userRole || 'Bri';
      return {
        ...parsed,
        userRole: effectiveRole,
        ntfyTopic: HARDCODED_NTFY_TOPIC
      };
    }
  } catch (e) {
    // Ignore parse errors
  }

  return {
    userRole: queryRole || 'Bri',
    soundEnabled: true,
    appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
    ntfyTopic: HARDCODED_NTFY_TOPIC
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Fetch real-time status and recent history directly from ntfy.sh buffer
export async function fetchNtfyHistory(topic: string = HARDCODED_NTFY_TOPIC): Promise<BellStatusResponse> {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=12h`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    const messages = lines.map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean);

    const history: Ring[] = [];
    let latestRing: Ring | null = null;
    let latestRingTime = 0;
    let latestAckTime = 0;

    for (const msg of messages) {
      if (msg.event !== 'message') continue;
      const title = msg.title || '';
      const timeMs = (msg.time || 0) * 1000;

      if (title.includes('Ringing the Bell') || title.includes('Needs Help') || title.includes('Bri is Ringing')) {
        const ring: Ring = {
          id: msg.id || 'ring_' + timeMs,
          timestamp: new Date(timeMs).toISOString(),
          sender: 'Bri',
          message: msg.message || 'Need help!',
          status: 'PENDING'
        };
        history.unshift(ring);
        if (timeMs > latestRingTime) {
          latestRingTime = timeMs;
          latestRing = ring;
        }
      } else if (title.includes('Danny Answered') || title.includes('Cancelled')) {
        if (timeMs > latestAckTime) {
          latestAckTime = timeMs;
        }
      }
    }

    // Check if the latest ring is still active (unanswered and within the last 20 minutes)
    const isRingActive = latestRing && (latestRingTime > latestAckTime) && (Date.now() - latestRingTime < 20 * 60 * 1000);
    
    // Update statuses in history list
    for (const h of history) {
      const hTime = new Date(h.timestamp).getTime();
      if (hTime <= latestAckTime) {
        h.status = 'COMPLETED';
      }
    }

    return {
      active: isRingActive ? latestRing : null,
      history: history.slice(0, 20)
    };
  } catch (e) {
    console.warn('Failed to poll ntfy history:', e);
    return { active: null, history: [] };
  }
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

  const topic = ntfyTopic.trim() || HARDCODED_NTFY_TOPIC;
  
  // High-priority push with loud "alarm" sound and direct role link:
  const payload = {
    topic: topic,
    title: `Bri is Ringing the Bell!`,
    message: finalMessage,
    priority: 5,
    sound: 'alarm',
    tags: ['bell', 'warning', 'rotating_light'],
    click: 'https://good-enough-productions.github.io/bell/?role=Danny',
    actions: [
      {
        action: 'view',
        label: '🏃 Open Bell / On My Way',
        url: 'https://good-enough-productions.github.io/bell/?role=Danny'
      }
    ]
  };

  try {
    await fetch('https://ntfy.sh', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('ntfy ring broadcast error:', e);
  }

  // Google Apps Script logging if configured
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
      console.warn('Apps Script ring log error:', e);
    }
  }

  return newRing;
}

export async function acknowledgeRing(
  ringId: string,
  appsScriptUrl?: string,
  ntfyTopic: string = HARDCODED_NTFY_TOPIC
): Promise<boolean> {
  const topic = ntfyTopic.trim() || HARDCODED_NTFY_TOPIC;
  
  // Broadcast "Danny Answered" (silent priority so it doesn't alarm Danny)
  try {
    const ackPayload = {
      topic: topic,
      title: 'Danny Answered!',
      message: 'Danny is on his way!',
      priority: 3,
      tags: ['runner', 'white_check_mark']
    };
    await fetch('https://ntfy.sh', {
      method: 'POST',
      body: JSON.stringify(ackPayload)
    });
  } catch (e) {
    console.warn('ntfy ack error:', e);
  }

  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'complete', id: ringId })
      });
    } catch (e) {}
  }

  return true;
}

export async function cancelRing(
  ntfyTopic: string = HARDCODED_NTFY_TOPIC
): Promise<boolean> {
  const topic = ntfyTopic.trim() || HARDCODED_NTFY_TOPIC;
  try {
    const cancelPayload = {
      topic: topic,
      title: 'Bri Cancelled Ring',
      message: 'Ring cancelled by Bri',
      priority: 2,
      tags: ['x']
    };
    await fetch('https://ntfy.sh', {
      method: 'POST',
      body: JSON.stringify(cancelPayload)
    });
  } catch (e) {
    console.warn('ntfy cancel error:', e);
  }
  return true;
}
