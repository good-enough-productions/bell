/**
 * Bell PWA - Main Application Logic
 * Real-time sync via ntfy.sh, Web Audio chime, Android lock-screen notifications, and history tracking.
 */

(function () {
  'use strict';

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
    pollTimer: null
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
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    roleInputs: document.querySelectorAll('input[name="user-role"]'),
    gasUrlInput: document.getElementById('gas-url-input'),
    ntfyTopicInput: document.getElementById('ntfy-topic-input'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    testNtfyBtn: document.getElementById('test-ntfy-btn'),
    enableNotifBtn: document.getElementById('enable-native-notif-btn'),
    soundToggle: document.getElementById('sound-toggle'),
    pollToggle: document.getElementById('poll-toggle'),
    connStatus: document.getElementById('connection-status')
  };

  // Save history to localStorage
  function saveHistory() {
    localStorage.setItem('bell_localHistory', JSON.stringify(state.history));
  }

  // Initialization
  function init() {
    setupTabNavigation();
    setupPresetChips();
    setupSettings();
    setupEventListeners();
    loadSavedSettings();

    // Find active ring from history if any
    const pendingRing = state.history.find(item => item.status === 'PENDING');
    if (pendingRing) {
      state.activeRing = pendingRing;
    }

    renderActiveCard();
    renderHistoryList();

    // Realtime sync from ntfy topic feed
    fetchStatus();

    // Start background sync polling if enabled
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
          renderHistoryList();
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
      triggerNativeNotification('🔔 Bell Test Alert', `${state.role}: Testing notifications!`);
      sendNtfyNotification(topic, state.role, "Testing notification!");
      alert('Test alert dispatched to phone & ntfy.sh/' + topic);
    });

    if (DOM.enableNotifBtn) {
      DOM.enableNotifBtn.addEventListener('click', () => {
        if ('Notification' in window) {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              alert('Phone notifications enabled! You will now receive alerts when the bell is rung.');
              triggerNativeNotification('🔔 Notifications Enabled!', 'You will get alerts when your partner rings.');
            } else {
              alert('Notification permission was denied. You can enable it in your browser site settings.');
            }
          });
        } else {
          alert('Notifications are not supported by this browser.');
        }
      });
    }
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
    if (DOM.clearHistoryBtn) {
      DOM.clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all local history?')) {
          state.history = [];
          state.activeRing = null;
          saveHistory();
          renderActiveCard();
          renderHistoryList();
        }
      });
    }
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

  // Native Browser Notification Trigger
  function triggerNativeNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="M12 2a2 2 0 0 0-2 2v.29C7.12 5.14 5 7.82 5 11v6H3v2h18v-2h-2v-6c0-3.18-2.12-5.86-5-6.71V4a2 2 0 0 0-2-2zm0 20a3 3 0 0 0 3-3h-6a3 3 0 0 0 3 3z"/></svg>',
          vibrate: [300, 100, 300, 100, 300],
          tag: 'bell-urgent-call',
          renotify: true,
          requireInteraction: true
        });
      } catch (e) {
        console.warn('Native notification trigger error:', e);
      }
    }
  }

  // Dispatch Push Notification to ntfy.sh
  async function sendNtfyNotification(topic, sender, message) {
    if (!topic) return;
    try {
      await fetch(`https://ntfy.sh/${encodeURIComponent(topic.trim())}`, {
        method: 'POST',
        headers: {
          'Title': '🔔 Urgent Bell Ring!',
          'Priority': '5',
          'Tags': 'bell,warning,loudspeaker'
        },
        body: `${sender}: ${message}`
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
    const newRing = {
      id: ringId,
      timestamp: new Date().toISOString(),
      sender: state.role,
      message: finalMsg,
      status: 'PENDING',
      completedAt: null,
      durationSeconds: null
    };

    // 1. Store in local history & state
    state.history.unshift(newRing);
    state.activeRing = newRing;
    saveHistory();

    // 2. Immediate UI update
    renderActiveCard();
    renderHistoryList();

    // 3. Trigger native notification & ntfy push
    triggerNativeNotification(`${state.role} needs assistance!`, finalMsg);
    sendNtfyNotification(state.ntfyTopic, state.role, finalMsg);

    // 4. Dispatch to Google Sheet if configured
    sendToGoogleSheet({ action: 'ring', id: ringId, sender: state.role, message: finalMsg });
  }

  // Action: Mark Complete
  async function markCompleted() {
    if (!state.activeRing) return;

    const ringId = state.activeRing.id;
    const now = new Date();
    const completedAt = now.toISOString();

    // Update item in state.history
    const historyItem = state.history.find(item => item.id === ringId);
    if (historyItem) {
      historyItem.status = 'COMPLETED';
      historyItem.completedAt = completedAt;
      const start = new Date(historyItem.timestamp).getTime();
      historyItem.durationSeconds = Math.max(0, Math.round((now.getTime() - start) / 1000));
    }

    state.activeRing = null;
    saveHistory();

    // Immediate UI update
    renderActiveCard();
    renderHistoryList();

    // Dispatch completion notification
    sendNtfyNotification(state.ntfyTopic, state.role, "Help request completed");
    sendToGoogleSheet({ action: 'complete', id: ringId });
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

  // Real-time Feed Fetching from ntfy.sh Topic
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

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          if (entry.event !== 'message' || !entry.message) return;

          const msgStr = entry.message;
          const parts = msgStr.split(': ');
          const sender = parts[0] || 'Partner';
          const message = parts.slice(1).join(': ') || msgStr;

          if (message.includes('completed')) return;

          const ringId = 'ring_ntfy_' + entry.id;

          // Check if already in local history
          const exists = state.history.some(item => item.id === ringId || (item.sender === sender && Math.abs(new Date(item.timestamp).getTime() - (entry.time * 1000)) < 15000));

          if (!exists) {
            const remoteRing = {
              id: ringId,
              timestamp: new Date(entry.time * 1000).toISOString(),
              sender: sender,
              message: message,
              status: 'PENDING',
              completedAt: null,
              durationSeconds: null
            };

            state.history.unshift(remoteRing);
            
            // If from partner, set active ring & trigger alerts!
            if (sender !== state.role) {
              state.activeRing = remoteRing;
              playBellChime();
              triggerNativeNotification(`${sender} needs assistance!`, message);
            }
          }
        } catch (err) {
          // ignore parsing error for single line
        }
      });

      saveHistory();
      renderActiveCard();
      renderHistoryList();
    } catch (err) {
      console.warn('ntfy poll error:', err);
      renderActiveCard();
      renderHistoryList();
    }
  }

  // Realtime Polling Loop
  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(fetchStatus, 3000);
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
