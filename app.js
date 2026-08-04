/**
 * Tabby Bell PWA - Main Application Logic
 */

(function () {
  'use strict';

  // State Management
  const state = {
    role: localStorage.getItem('tabby_role') || 'Her',
    gasUrl: localStorage.getItem('tabby_gasUrl') || '',
    ntfyTopic: localStorage.getItem('tabby_ntfyTopic') || 'tabby-bell-home-alert',
    soundEnabled: localStorage.getItem('tabby_sound') !== 'false',
    pollEnabled: localStorage.getItem('tabby_poll') !== 'false',
    selectedPreset: '',
    activeRing: null,
    history: JSON.parse(localStorage.getItem('tabby_localHistory') || '[]'),
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
    
    // Check initial status
    fetchStatus();

    // Start background polling if enabled
    if (state.pollEnabled) {
      startPolling();
    }
  }

  // Tab Switching Logic
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
        DOM.customMsgInput.value = ''; // clear custom if preset tapped
      });
    });

    DOM.customMsgInput.addEventListener('input', () => {
      if (DOM.customMsgInput.value.trim().length > 0) {
        DOM.presetChips.forEach(c => c.classList.remove('active'));
        state.selectedPreset = '';
      }
    });
  }

  // Load Saved Settings into UI
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

  // Save Settings
  function setupSettings() {
    DOM.saveSettingsBtn.addEventListener('click', () => {
      const selectedRole = document.querySelector('input[name="user-role"]:checked')?.value || 'Her';
      state.role = selectedRole;
      state.gasUrl = DOM.gasUrlInput.value.trim();
      state.ntfyTopic = DOM.ntfyTopicInput.value.trim();
      state.soundEnabled = DOM.soundToggle.checked;
      state.pollEnabled = DOM.pollToggle.checked;

      localStorage.setItem('tabby_role', state.role);
      localStorage.setItem('tabby_gasUrl', state.gasUrl);
      localStorage.setItem('tabby_ntfyTopic', state.ntfyTopic);
      localStorage.setItem('tabby_sound', state.soundEnabled);
      localStorage.setItem('tabby_poll', state.pollEnabled);

      if (state.pollEnabled) {
        startPolling();
      } else {
        stopPolling();
      }

      updateConnectionStatusBadge();
      alert('Settings saved!');
    });

    DOM.testNtfyBtn.addEventListener('click', () => {
      const topic = DOM.ntfyTopicInput.value.trim() || state.ntfyTopic;
      if (!topic) {
        alert('Please enter a Ntfy Topic name first.');
        return;
      }
      sendNtfyPush(topic, state.role, "Test alert from Tabby Bell!");
      alert('Test notification dispatched to ntfy.sh/' + topic);
    });
  }

  function updateConnectionStatusBadge() {
    const statusText = DOM.connStatus.querySelector('.status-text');
    if (state.gasUrl) {
      DOM.connStatus.classList.remove('offline');
      statusText.textContent = 'Connected (Sheet)';
    } else {
      DOM.connStatus.classList.add('offline');
      statusText.textContent = 'Local Mode';
    }
  }

  // Event Listeners
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

      // Play 2-tone pleasant bell chime
      const playTone = (freq, time, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + duration);
      };

      const now = ctx.currentTime;
      playTone(837.2, now, 1.2);       // High A5 note
      playTone(1046.5, now + 0.25, 1.5); // High C6 note
    } catch (e) {
      console.warn("Audio Context playback error:", e);
    }
  }

  // Direct Client-Side Ntfy Push Dispatch
  function sendNtfyPush(topic, sender, message) {
    if (!topic) return;
    fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Title': '🔔 Urgent Bell Ring!',
        'Priority': '5', // Urgent priority
        'Tags': 'bell,warning,loudspeaker'
      },
      body: `${sender}: ${message}`
    }).catch(err => console.warn('Direct ntfy push error:', err));
  }

  // Action: Ring Bell
  async function ringBell() {
    // Determine message
    const customMsg = DOM.customMsgInput.value.trim();
    const finalMsg = customMsg || state.selectedPreset || "Needs help in another room!";

    playBellChime();

    const newRing = {
      id: 'ring_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      sender: state.role,
      message: finalMsg,
      status: 'PENDING'
    };

    // Optimistic UI update
    state.activeRing = newRing;
    renderActiveCard();
    sendNtfyPush(state.ntfyTopic, state.role, finalMsg);

    // Save to Google Sheet backend if configured
    if (state.gasUrl) {
      try {
        await fetch(state.gasUrl, {
          method: 'POST',
          mode: 'no-cors', // standard for GAS web app cross-origin post
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ring',
            sender: state.role,
            message: finalMsg,
            ntfyTopic: state.ntfyTopic
          })
        });
        setTimeout(fetchStatus, 1500);
      } catch (err) {
        console.error('GAS Ring Post Error:', err);
      }
    } else {
      // Local storage fallback
      state.history.unshift(newRing);
      localStorage.setItem('tabby_localHistory', JSON.stringify(state.history));
      renderHistoryList();
    }
  }

  // Action: Mark Active Ring Completed
  async function markCompleted() {
    if (!state.activeRing) return;

    const ringId = state.activeRing.id;
    const now = new Date();
    const completedAt = now.toISOString();

    state.activeRing = null;
    renderActiveCard();

    if (state.gasUrl) {
      try {
        await fetch(state.gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            id: ringId
          })
        });
        setTimeout(fetchStatus, 1000);
      } catch (err) {
        console.error('GAS Complete Post Error:', err);
      }
    } else {
      // Update local history
      const localItem = state.history.find(item => item.id === ringId);
      if (localItem) {
        localItem.status = 'COMPLETED';
        localItem.completedAt = completedAt;
        const start = new Date(localItem.timestamp).getTime();
        localItem.durationSeconds = Math.round((now.getTime() - start) / 1000);
      }
      localStorage.setItem('tabby_localHistory', JSON.stringify(state.history));
      renderHistoryList();
    }
  }

  // Fetch Status & History from Google Sheet
  async function fetchStatus() {
    if (!state.gasUrl) {
      renderHistoryList();
      renderActiveCard();
      return;
    }

    DOM.historyLoading.style.display = 'flex';

    try {
      const res = await fetch(state.gasUrl);
      const data = await res.json();

      DOM.historyLoading.style.display = 'none';

      if (data && !data.error) {
        state.activeRing = data.active || null;
        state.history = data.history || [];

        renderActiveCard();
        renderHistoryList();
      }
    } catch (err) {
      DOM.historyLoading.style.display = 'none';
      console.warn('Failed to fetch from Google Sheet backend, displaying local state.', err);
      renderActiveCard();
      renderHistoryList();
    }
  }

  // Polling Management
  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(fetchStatus, 5000);
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

  // Render History View List
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

      const durationText = item.durationSeconds 
        ? `${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s` 
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

  // Utilities
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

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
