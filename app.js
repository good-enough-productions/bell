/**
 * Bell PWA - Main Application Logic
 * Real-time sync via ntfy.sh, Web Audio chime, Android lock-screen notifications, and history tracking.
 */

(function () {
  'use strict';

  // Default shared topic name for instant real-time sync & notifications
  const DEFAULT_NTFY_TOPIC = 'bell-home-alert-13579';

  // State Management
  const state = {
    role: localStorage.getItem('bell_role') || 'Her',
    ntfyTopic: localStorage.getItem('bell_ntfyTopic') || DEFAULT_NTFY_TOPIC,
    gasUrl: localStorage.getItem('bell_gasUrl') || '',
    soundEnabled: localStorage.getItem('bell_sound') !== 'false',
    pollEnabled: localStorage.getItem('bell_poll') !== 'false',
    selectedPreset: '',
    activeRing: null,
    history: JSON.parse(localStorage.getItem('bell_localHistory') || '[]'),
    pollTimer: null,
    lastPolledMessageId: null
  };

  // DOM Elements
  const DOM = {
    tabs: document.querySelectorAll('.nav-tab'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    bellBtn: document.getElementById('bell-button'),
    presetChips: document.querySelectorAll('.preset-chips .chip'),
    customMsgInput: document.getElementById('custom-message-input'),
    activeCard: document.getElementById('active-ring-card'),
    activeSender: document.getElementById('active-sender'),
    activeMsg: document.getElementById('active-message'),
    activeTime: document.getElementById('active-time'),
    completeBtn: document.getElementById('complete-btn'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    historyLoading: document.getElementById('history-loading'),
    historyBadge: document.getElementById('history-badge'),
    refreshHistoryBtn: document.getElementById('refresh-history-btn'),
    roleInputs: document.querySelectorAll('input[name="user-role"]'),
    gasUrlInput: document.getElementById('gas-url-input'),
    ntfyTopicInput: document.getElementById('ntfy-topic-input'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    testNtfyBtn: document.getElementById('test-ntfy-btn'),
    soundToggle: document.getElementById('sound-toggle'),
    pollToggle: document.getElementById('poll-toggle'),
    connStatus: document.getElementById('connection-status')
  };

  // Initialization
  function init() {
    setupTabNavigation();
    setupPresetChips();
    setupSettings();
    setupEventListeners();
    loadSavedSettings();
    
    // Initial fetch & render
    fetchStatus();

    // Start real-time polling if enabled
    if (state.pollEnabled) {
      startPolling();
    }
  }

  // Tab Navigation
  function setupTabNavigation() {
    DOM.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTabId = tab.getAttribute('data-tab');

        DOM.tabs.forEach(t => t.classList.remove('active'));
        DOM.tabPanels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(targetTabId).classList.add('active');

        if (targetTabId === 'history-tab') {
          fetchStatus();
        }
      });
    });
  }

  // Preset Chips Selection
  function setupPresetChips() {
    DOM.presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        DOM.presetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.selectedPreset = chip.getAttribute('data-msg');
        DOM.customMsgInput.value = '';
      });
    });

    DOM.customMsgInput.addEventListener('input', () => {
      if (DOM.customMsgInput.value.trim().length > 0) {
        DOM.presetChips.forEach(c => c.classList.remove('active'));
        state.selectedPreset = '';
      }
    });
  }

  // Settings Management
  function loadSavedSettings() {
    DOM.gasUrlInput.value = state.gasUrl;
    DOM.ntfyTopicInput.value = state.ntfyTopic;
    DOM.soundToggle.checked = state.soundEnabled;
    DOM.pollToggle.checked = state.pollEnabled;

    DOM.roleInputs.forEach(input => {
      if (input.value === state.role) {
        input.checked = true;
      }
    });

    updateConnectionStatusBadge();
  }

  function setupSettings() {
    DOM.saveSettingsBtn.addEventListener('click', () => {
      const selectedRole = document.querySelector('input[name="user-role"]:checked')?.value || 'Her';
      state.role = selectedRole;
      state.gasUrl = DOM.gasUrlInput.value.trim();
      state.ntfyTopic = DOM.ntfyTopicInput.value.trim() || DEFAULT_NTFY_TOPIC;
      state.soundEnabled = DOM.soundToggle.checked;
      state.pollEnabled = DOM.pollToggle.checked;

      localStorage.setItem('bell_role', state.role);
      localStorage.setItem('bell_gasUrl', state.gasUrl);
      localStorage.setItem('bell_ntfyTopic', state.ntfyTopic);
      localStorage.setItem('bell_sound', state.soundEnabled);
      localStorage.setItem('bell_poll', state.pollEnabled);

      if (state.pollEnabled) {
        startPolling();
      } else {
        stopPolling();
      }

      updateConnectionStatusBadge();
      fetchStatus();
      alert('Settings saved successfully!');
    });

    DOM.testNtfyBtn.addEventListener('click', () => {
      const topic = DOM.ntfyTopicInput.value.trim() || state.ntfyTopic;
      if (!topic) {
        alert('Please enter a Ntfy Topic name first.');
        return;
      }
      sendNtfyNotification(topic, state.role, "Test alert from Bell!");
      alert('Test notification sent to ntfy.sh/' + topic);
    });
  }

  function updateConnectionStatusBadge() {
    const statusText = DOM.connStatus.querySelector('.status-text');
    if (state.ntfyTopic) {
      DOM.connStatus.classList.remove('offline');
      statusText.textContent = 'Live (' + state.ntfyTopic + ')';
    } else {
      DOM.connStatus.classList.add('offline');
      statusText.textContent = 'Offline';
    }
  }

  function setupEventListeners() {
    DOM.bellBtn.addEventListener('click', ringBell);
    DOM.completeBtn.addEventListener('click', markCompleted);
    DOM.refreshHistoryBtn.addEventListener('click', fetchStatus);
  }

  // Web Audio Synth Bell Chime
  function playBellChime() {
    if (!state.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq, time, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.6, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + duration);
      };

      const now = ctx.currentTime;
      playTone(837.2, now, 1.2);         // High A5
      playTone(1046.5, now + 0.25, 1.5);   // High C6
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  }

  // Dispatch Urgent Push Notification via ntfy.sh
  async function sendNtfyNotification(topic, sender, message, payloadData) {
    if (!topic) return;
    try {
      const bodyText = payloadData ? JSON.stringify(payloadData) : `${sender}: ${message}`;
      await fetch(`https://ntfy.sh/${encodeURIComponent(topic.trim())}`, {
        method: 'POST',
        headers: {
          'Title': '🔔 Urgent Bell Ring!',
          'Priority': '5', // Urgent high priority alert
          'Tags': 'bell,warning,loudspeaker'
        },
        body: bodyText
      });
    } catch (err) {
      console.warn('Ntfy push error:', err);
    }
  }

  // Action: Ring Bell
  async function ringBell() {
    const customMsg = DOM.customMsgInput.value.trim();
    const finalMsg = customMsg || state.selectedPreset || "Needs help in another room!";

    playBellChime();

    const ringId = 'ring_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const ringEvent = {
      type: 'BELL_EVENT',
      action: 'ring',
      id: ringId,
      timestamp: new Date().toISOString(),
      sender: state.role,
      message: finalMsg
    };

    // Optimistic UI update
    state.activeRing = {
      id: ringId,
      timestamp: ringEvent.timestamp,
      sender: state.role,
      message: finalMsg,
      status: 'PENDING'
    };
    renderActiveCard();

    // Broadcast to ntfy.sh real-time topic
    await sendNtfyNotification(state.ntfyTopic, state.role, finalMsg, ringEvent);

    // Send to Google Sheet if configured
    if (state.gasUrl) {
      sendToGoogleSheet({ action: 'ring', sender: state.role, message: finalMsg });
    }

    // Refresh status
    setTimeout(fetchStatus, 800);
  }

  // Action: Mark Complete
  async function markCompleted() {
    if (!state.activeRing) return;

    const ringId = state.activeRing.id;
    const completeEvent = {
      type: 'BELL_EVENT',
      action: 'complete',
      id: ringId,
      completedBy: state.role,
      timestamp: new Date().toISOString()
    };

    state.activeRing = null;
    renderActiveCard();

    // Broadcast completion to ntfy.sh topic
    await sendNtfyNotification(state.ntfyTopic, state.role, "Help request completed", completeEvent);

    // Send completion to Google Sheet if configured
    if (state.gasUrl) {
      sendToGoogleSheet({ action: 'complete', id: ringId });
    }

    setTimeout(fetchStatus, 800);
  }

  // Send Event to Google Apps Script Backend (safely handled)
  function sendToGoogleSheet(payload) {
    if (!state.gasUrl) return;
    fetch(state.gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('GAS POST error:', err));
  }

  // Fetch Real-time Status & History from ntfy.sh Topic Feed
  async function fetchStatus() {
    if (!state.ntfyTopic) {
      renderActiveCard();
      renderHistoryList();
      return;
    }

    try {
      const res = await fetch(`https://ntfy.sh/${encodeURIComponent(state.ntfyTopic.trim())}/json?poll=1`);
      const text = await res.text();
      
      if (!text) return;

      const lines = text.trim().split('\n');
      const ringsMap = new Map();

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          if (entry.event !== 'message') return;

          let data = null;
          try {
            data = JSON.parse(entry.message);
          } catch (e) {
            // Raw text fallback message
            data = {
              type: 'BELL_EVENT',
              action: 'ring',
              id: 'ring_' + entry.id,
              timestamp: new Date(entry.time * 1000).toISOString(),
              sender: entry.message.split(':')[0] || 'Partner',
              message: entry.message.split(':')[1] || entry.message
            };
          }

          if (!data || data.type !== 'BELL_EVENT') return;

          if (data.action === 'ring') {
            ringsMap.set(data.id, {
              id: data.id,
              timestamp: data.timestamp,
              sender: data.sender || 'Partner',
              message: data.message || '',
              status: 'PENDING',
              completedAt: null,
              durationSeconds: null
            });
          } else if (data.action === 'complete') {
            const existing = ringsMap.get(data.id);
            if (existing) {
              existing.status = 'COMPLETED';
              existing.completedAt = data.timestamp;
              const start = new Date(existing.timestamp).getTime();
              const end = new Date(data.timestamp).getTime();
              existing.durationSeconds = Math.max(0, Math.round((end - start) / 1000));
            }
          }
        } catch (err) {
          // ignore malformed lines
        }
      });

      const parsedHistory = Array.from(ringsMap.values()).reverse(); // newest first

      // Check if there is an incoming active ring from partner
      const active = parsedHistory.find(item => item.status === 'PENDING') || null;

      // Play chime if new ring received from partner!
      if (active && (!state.activeRing || state.activeRing.id !== active.id)) {
        if (active.sender !== state.role) {
          playBellChime();
        }
      }

      state.activeRing = active;
      state.history = parsedHistory;
      localStorage.setItem('bell_localHistory', JSON.stringify(state.history));

      renderActiveCard();
      renderHistoryList();
    } catch (err) {
      console.warn('ntfy fetch error:', err);
      renderActiveCard();
      renderHistoryList();
    }
  }

  // Realtime Polling Loop
  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(fetchStatus, 3000); // Check every 3s
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  // Render Active Ring Card
  function renderActiveCard() {
    if (state.activeRing && state.activeRing.status === 'PENDING') {
      DOM.activeCard.style.display = 'flex';
      DOM.activeSender.textContent = state.activeRing.sender + ' needs assistance!';
      DOM.activeMsg.textContent = `"${state.activeRing.message}"`;
      DOM.activeTime.textContent = 'Rung at ' + formatTime(state.activeRing.timestamp);
      DOM.historyBadge.style.display = 'inline-block';
      DOM.historyBadge.textContent = '1 Active';
    } else {
      DOM.activeCard.style.display = 'none';
      DOM.historyBadge.style.display = 'none';
    }
  }

  // Render History Feed List
  function renderHistoryList() {
    DOM.historyList.innerHTML = '';

    if (!state.history || state.history.length === 0) {
      DOM.historyEmpty.style.display = 'flex';
      return;
    }

    DOM.historyEmpty.style.display = 'none';

    state.history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const isPending = item.status === 'PENDING';
      const badgeClass = isPending ? 'pending' : 'completed';
      const statusLabel = isPending ? 'Active' : 'Completed';

      const durationText = item.durationSeconds !== null && item.durationSeconds !== undefined
        ? (item.durationSeconds < 60 ? `${item.durationSeconds}s` : `${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s`)
        : (isPending ? 'Waiting...' : '');

      li.innerHTML = `
        <div class="history-main">
          <div class="history-header-line">
            <span class="history-sender">${escapeHTML(item.sender)}</span>
            <span class="history-badge ${badgeClass}">${statusLabel}</span>
          </div>
          <span class="history-msg">"${escapeHTML(item.message)}"</span>
          <span class="history-time">${formatDateTime(item.timestamp)}</span>
        </div>
        <div class="history-meta">
          <span>${durationText}</span>
        </div>
      `;

      DOM.historyList.appendChild(li);
    });
  }

  // Format Helpers
  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + formatTime(isoStr);
  }

  function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[match]);
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
