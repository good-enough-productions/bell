export function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([120, 60, 120, 60, 240]);
    } catch (e) {
      // Ignore vibration errors
    }
  }
}
