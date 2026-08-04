/**
 * Bell PWA - Main Application Logic
 *
 * Roles:
 *   partner1 = rings the bell, sees bell UI, does NOT get notified
 *   partner2 = gets notified, sees incoming alert UI, responds
 *
 * Notifications: sent client-side to ntfy.sh
 * History:       synced via Google Apps Script Web App (GAS)
 */

(function () {
  'use strict';

  const state = {
    role: localStorage.getItem('bell_role') || 'partner1',
    gasUrl: localStorage.getItem('bell_gasUrl') || '',
    ntfyTopic: localStorage.getItem('bell_ntfyTopic') || '',
    soundEnabled: localStorage.getItem('bell_sound') !== 'false',
    pollEnabled: localStorage.getItem('bell_poll') !== 'false',
    selectedPreset: '',
    activeRing: null,
    history: [],
    pollTimer: null,
    lastSeenRingId: localStorage.getItem('bell_lastSeenRingId') || null
  };

  const $ = id => document.getElementById(id);
  const DOM = {
    tabs: document.querySelectorAll('.nav-tab'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    roleSubtitle: $('role-subtitle'),
    ringTabLabel: $('ring-tab-label'),
    connStatus: $('connection-status'),
    activeCard: $('active-ring-card'),
    activeSender: $('active-sender'),
    activeMsg: $('active-message'),
    activeTime: $('active-time'),
    cancelBtn: $('cancel-btn'),
    incomingCard: $('incoming-ring-card'),
    incomingSender: $('incoming-sender'),
    incomingMsg: $('incoming-message'),
    incomingTime: $('incoming-time'),
    onMyWayBtn: $('on-my-way-btn'),
    giveMeFiveBtn: $('give-me-5-btn'),
    completeBtn: $('complete-btn'),
    responseMessageInput: $('response-message-input'),
    bellSection: $('bell-section'),
    bellBtn: $('bell-button'),
    messageSection: $('message-section'),
    presetChips: document.querySelectorAll('.preset-chips .chip'),
    customMsgInput: $('custom-message-input'),
    p2Standby: $('p2-standby'),
    historyList: $('history-list'),
    historyEmpty: $('history-empty'),
    historyLoading: $('history-loading'),
    historyBadge: $('history-badge'),
    refreshHistoryBtn: $('refresh-history-btn'),
    roleInputs: document.querySelectorAll('input[name="user-role"]'),
    gasUrlInput: $('gas-url-input'),
    ntfyTopicInput: $('ntfy-topic-input'),
    ntfySubscribeLink: $('ntfy-subscribe-link'),
    saveSettingsBtn: $('save-settings-btn'),
    testNtfyBtn: $('test-ntfy-btn'),
    soundToggle: $('sound-toggle'),
    pollToggle: $('poll-toggle')
  };

  function init() {
    setupTabNavigation();
    setupPresetChips();
    setupEventListeners();
    loadSavedSettings();
    applyRoleUI();
    fetchStatus();
    if (state.pollEnabled) startPolling();
  }

  function setupTabNavigation() {
    DOM.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        DOM.tabs.forEach(t => t.classList.remove('active'));
        DOM.tabPanels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
        if (target === 'history-tab') fetchStatus();
      });
    });
  }

  function applyRoleUI() {
    const isP2 = state.role === 'partner2';
    DOM.roleSubtitle.textContent = isP2 ? 'Partner 2 · Receiver' : 'Partner 1 · Ringer';
    DOM.ringTabLabel.textContent = isP2 ? 'Alerts' : 'Ring Bell';
    DOM.bellSection.style.display = isP2 ? 'none' : 'flex';
    DOM.messageSection.style.display = isP2 ? 'none' : 'block';
    DOM.p2Standby.style.display = isP2 ? 'flex' : 'none';
    updateNtfyLink();
  }

  function updateNtfyLink() {
    const topic = state.ntfyTopic;
    DOM.ntfySubscribeLink.href = topic
      ? `https://ntfy.sh/${encodeURIComponent(topic)}`
      : 'https://ntfy.sh/';
  }

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

  function loadSavedSettings() {
    DOM.gasUrlInput.value = state.gasUrl;
    DOM.ntfyTopicInput.value = state.ntfyTopic;
    DOM.soundToggle.checked = state.soundEnabled;
    DOM.pollToggle.checked = state.pollEnabled;
    DOM.roleInputs.forEach(input => { input.checked = (input.value === state.role); });
    updateConnectionStatusBadge();
  }

  function saveSettings() {
    const selectedRole = document.querySelector('input[name="user-role"]:checked')?.value || 'partner1';
    state.role = selectedRole;
    state.gasUrl = DOM.gasUrlInput.value.trim();
    state.ntfyTopic = DOM.ntfyTopicInput.value.trim();
    state.soundEnabled = DOM.soundToggle.checked;
    state.pollEnabled = DOM.pollToggle.checked;

    localStorage.setItem('bell_role', state.role);
    localStorage.setItem('bell_gasUrl', state.gasUrl);
    localStorage.setItem('bell_ntfyTopic', state.ntfyTopic);
    localStorage.setItem('bell_sound', state.soundEnabled);
    localStorage.setItem('bell_poll', state.pollEnabled);

    if (state.pollEnabled) startPolling(); else stopPolling();
    applyRoleUI();
    updateConnectionStatusBadge();

    DOM.saveSettingsBtn.textContent = '✓ Saved!';
    DOM.saveSettingsBtn.classList.add('btn-success');
    setTimeout(() => {
      DOM.saveSettingsBtn.textContent = 'Save Settings';
      DOM.saveSettingsBtn.classList.remove('btn-success');
    }, 2000);
  }

  function updateConnectionStatusBadge() {
    const t = DOM.connStatus.querySelector('.status-text');
    if (state.gasUrl) {
      DOM.connStatus.classList.remove('offline');
      t.textContent = 'Connected';
    } else {
      DOM.connStatus.classList.add('offline');
      t.textContent = 'Local Mode';
    }
  }

  function setupEventListeners() {
    DOM.bellBtn.addEventListener('click', ringBell);
    DOM.cancelBtn.addEventListener('click', cancelRing);
    DOM.onMyWayBtn.addEventListener('click', () => respondToRing('on_my_way'));
    DOM.giveMeFiveBtn.addEventListener('click', () => respondToRing('give_me_5'));
    DOM.completeBtn.addEventListener('click', () => respondToRing('complete'));
    DOM.refreshHistoryBtn.addEventListener('click', fetchStatus);
    DOM.saveSettingsBtn.addEventListener('click', saveSettings);
    DOM.testNtfyBtn.addEventListener('click', () => {
      const topic = DOM.ntfyTopicInput.value.trim() || state.ntfyTopic;
      if (!topic) { alert('Enter an ntfy Topic Name first.'); return; }
      sendNtfyPush(topic, 'Test', '🔔 Test alert from Bell app!');
      DOM.testNtfyBtn.textContent = '✓ Sent!';
      setTimeout(() => { DOM.testNtfyBtn.textContent = 'Send Test Notification'; }, 2000);
    });
    DOM.ntfyTopicInput.addEventListener('input', () => {
      state.ntfyTopic = DOM.ntfyTopicInput.value.trim();
      updateNtfyLink();
    });
  }

  function playBellChime() {
    if (!state.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playTone = (freq, time, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(time); osc.stop(time + dur);
      };
      const now = ctx.currentTime;
      playTone(837.2, now, 1.2);
      playTone(1046.5, now + 0.25, 1.5);
    } catch(e) { console.warn('Audio error:', e); }
  }

  // ntfy push - JSON body required for priority/tags to work
  function sendNtfyPush(topic, sender, message, actions = []) {
    if (!topic) return Promise.resolve();
    const body = { topic, title: '🔔 Bell — ' + sender, message, priority: 5, tags: ['bell','loudspeaker'] };
    if (actions.length) body.actions = actions;
    return fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(err => console.warn('ntfy error:', err));
  }

  async function ringBell() {
    if (!state.ntfyTopic) {
      alert('⚠️ Please set an ntfy Topic Name in Settings first, then have Partner 2 subscribe to it in the ntfy app.');
      return;
    }
    const customMsg = DOM.customMsgInput.value.trim();
    const finalMsg = customMsg || state.selectedPreset || 'Needs help — come find me!';

    playBellChime();
    DOM.bellBtn.classList.add('ringing');
    setTimeout(() => DOM.bellBtn.classList.remove('ringing'), 1500);

    const newRing = {
      id: 'ring_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      sender: state.role === 'partner1' ? 'Partner 1' : 'Partner 2',
      message: finalMsg,
      status: 'PENDING'
    };

    state.activeRing = newRing;
    renderRingTab();

    const appUrl = window.location.href;
    const senderName = state.role === 'partner1' ? 'Partner 1' : 'Partner 2';
    await sendNtfyPush(state.ntfyTopic, senderName + ' needs you!', finalMsg, [
      { action: 'view', label: '📱 Open Bell App', url: appUrl }
    ]);

    if (state.gasUrl) {
      try {
        await gasPost({ action: 'ring', sender: senderName, message: finalMsg, id: newRing.id, ntfyTopic: state.ntfyTopic, appUrl });
        setTimeout(fetchStatus, 1500);
      } catch(err) {
        console.error('GAS ring error:', err);
        saveLocalRing(newRing);
      }
    } else {
      saveLocalRing(newRing);
    }
  }

  function saveLocalRing(ring) {
    state.history.unshift(ring);
    localStorage.setItem('bell_localHistory', JSON.stringify(state.history.slice(0, 50)));
    renderHistoryList();
  }

  async function cancelRing() {
    if (!state.activeRing) return;
    const id = state.activeRing.id;
    state.activeRing = null;
    renderRingTab();
    if (state.gasUrl) {
      try { await gasPost({ action: 'complete', id, response: 'cancelled' }); }
      catch(e) { console.error('GAS cancel error:', e); }
    }
  }

  async function respondToRing(responseType) {
    if (!state.activeRing) return;
    const id = state.activeRing.id;
    const note = DOM.responseMessageInput.value.trim();
    const labels = { on_my_way: 'On My Way!', give_me_5: 'Give Me 5 Min', complete: 'Done' };
    const label = labels[responseType] || responseType;
    const fullResponse = note ? `${label}: ${note}` : label;

    [DOM.onMyWayBtn, DOM.giveMeFiveBtn, DOM.completeBtn].forEach(b => b.disabled = true);

    if (state.ntfyTopic) await sendNtfyPush(state.ntfyTopic, 'Partner 2 replied', fullResponse);

    const isComplete = responseType === 'complete';
    const status = isComplete ? 'COMPLETED' : `RESPONDED: ${label}`;

    if (state.gasUrl) {
      try { await gasPost({ action: 'complete', id, response: status }); }
      catch(e) { console.error('GAS respond error:', e); }
    }

    if (isComplete || responseType === 'on_my_way') {
      state.activeRing = null;
    } else if (state.activeRing) {
      state.activeRing.status = status;
    }

    DOM.responseMessageInput.value = '';
    renderRingTab();
    setTimeout(fetchStatus, 1000);
  }

  async function gasPost(body) {
    if (!state.gasUrl) return;
    // GAS requires no-cors for POST; we read state via GET polling instead
    await fetch(state.gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function fetchStatus() {
    const localHistory = JSON.parse(localStorage.getItem('bell_localHistory') || '[]');

    if (!state.gasUrl) {
      state.history = localHistory;
      state.activeRing = localHistory.find(r => r.status === 'PENDING') || null;
      renderRingTab(); renderHistoryList();
      return;
    }

    DOM.historyLoading.style.display = 'flex';
    try {
      // redirect:follow is critical for GAS web apps
      const res = await fetch(state.gasUrl, { method: 'GET', redirect: 'follow', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      DOM.historyLoading.style.display = 'none';

      if (data && !data.error) {
        const prevActive = state.activeRing;
        state.activeRing = data.active || null;
        state.history = data.history || [];

        // Partner 2: chime on new ring
        if (state.role === 'partner2' && state.activeRing && state.activeRing.status === 'PENDING') {
          if (state.activeRing.id !== state.lastSeenRingId) {
            state.lastSeenRingId = state.activeRing.id;
            localStorage.setItem('bell_lastSeenRingId', state.lastSeenRingId);
            playBellChime();
          }
        }
        renderRingTab(); renderHistoryList();
      }
    } catch(err) {
      DOM.historyLoading.style.display = 'none';
      console.warn('fetchStatus error:', err.message);
      state.history = localHistory;
      state.activeRing = localHistory.find(r => r.status === 'PENDING') || null;
      renderRingTab(); renderHistoryList();
    }
  }

  function startPolling() { stopPolling(); state.pollTimer = setInterval(fetchStatus, 5000); }
  function stopPolling() { if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; } }

  function renderRingTab() {
    const isP2 = state.role === 'partner2';
    const hasActive = state.activeRing && (
      state.activeRing.status === 'PENDING' || state.activeRing.status?.startsWith('RESPONDED')
    );

    if (isP2) {
      DOM.incomingCard.style.display = hasActive ? 'flex' : 'none';
      DOM.p2Standby.style.display = hasActive ? 'none' : 'flex';
      DOM.activeCard.style.display = 'none';
      DOM.bellSection.style.display = 'none';
      DOM.messageSection.style.display = 'none';

      if (hasActive && state.activeRing) {
        DOM.incomingSender.textContent = (state.activeRing.sender || 'Partner 1') + ' needs you!';
        DOM.incomingMsg.textContent = state.activeRing.message ? `"${state.activeRing.message}"` : '';
        DOM.incomingTime.textContent = 'Rung at ' + formatTime(state.activeRing.timestamp);
        [DOM.onMyWayBtn, DOM.giveMeFiveBtn, DOM.completeBtn].forEach(b => b.disabled = false);
        const title = DOM.incomingCard.querySelector('.incoming-title');
        if (state.activeRing.status?.startsWith('RESPONDED')) {
          title.textContent = '⏳ ' + state.activeRing.status.replace('RESPONDED: ','') + ' (pending)';
        } else {
          title.textContent = '🔔 BELL RUNG!';
        }
      }
    } else {
      DOM.activeCard.style.display = hasActive ? 'flex' : 'none';
      DOM.bellSection.style.display = hasActive ? 'none' : 'flex';
      DOM.messageSection.style.display = hasActive ? 'none' : 'block';
      DOM.incomingCard.style.display = 'none';
      DOM.p2Standby.style.display = 'none';

      if (hasActive && state.activeRing) {
        DOM.activeSender.textContent = 'Alert sent! Waiting for Partner 2...';
        DOM.activeMsg.textContent = state.activeRing.message ? `"${state.activeRing.message}"` : '';
        DOM.activeTime.textContent = 'Sent at ' + formatTime(state.activeRing.timestamp);
      }
    }

    DOM.historyBadge.style.display = hasActive ? 'inline-block' : 'none';
    if (hasActive) DOM.historyBadge.textContent = '!';
  }

  function renderHistoryList() {
    DOM.historyList.innerHTML = '';
    if (!state.history || !state.history.length) { DOM.historyEmpty.style.display = 'flex'; return; }
    DOM.historyEmpty.style.display = 'none';
    state.history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const isPending = item.status === 'PENDING';
      const isResponded = item.status?.startsWith('RESPONDED');
      const badgeClass = isPending ? 'pending' : (isResponded ? 'responded' : 'completed');
      const statusLabel = isPending ? 'Active' : (isResponded ? item.status.replace('RESPONDED: ','') : 'Completed');
      const dur = item.durationSeconds
        ? `${Math.floor(item.durationSeconds/60)}m ${item.durationSeconds%60}s`
        : (isPending ? 'Waiting...' : '');
      li.innerHTML = `
        <div class="history-main">
          <div class="history-header-line">
            <span class="history-sender">${escapeHTML(item.sender||'Partner 1')}</span>
            <span class="history-badge ${badgeClass}">${escapeHTML(statusLabel)}</span>
          </div>
          <span class="history-msg">${item.message ? '"'+escapeHTML(item.message)+'"' : '<em>No message</em>'}</span>
          <span class="history-time">${formatDateTime(item.timestamp)}</span>
        </div>
        <div class="history-meta"><span>${dur}</span></div>
      `;
      DOM.historyList.appendChild(li);
    });
  }

  function formatTime(s) { if (!s) return ''; return new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
  function formatDateTime(s) { if (!s) return ''; const d=new Date(s); return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+formatTime(s); }
  function escapeHTML(s) { return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
