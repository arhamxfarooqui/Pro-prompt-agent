/**
 * Phase 1.5: Awake Timer System
 * 
 * Prevents the Manifest V3 background service worker from sleeping after 30 seconds
 * of inactivity by triggering periodic pings using `chrome.alarms`.
 */

const ALARM_NAME = 'awake-timer';
const ALARM_PERIOD_IN_MINUTES = 0.5; // 30 seconds

/**
 * Registers the awake timer alarm if it doesn't already exist.
 */
function registerAwakeTimer() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      // Create an alarm that fires repeatedly every 0.5 minutes.
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: ALARM_PERIOD_IN_MINUTES
      });
      console.log(`[Awake Timer] Alarm registered to ping every ${ALARM_PERIOD_IN_MINUTES} minutes.`);
    }
  });
}

/**
 * Triggered when the extension is first installed or updated.
 * Ensures the awake cycle starts immediately.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Awake Timer] Extension installed/updated. Initializing timer...');
  registerAwakeTimer();
});

/**
 * Triggered when the browser starts up.
 * Re-registers the alarm to guarantee the background service worker stays alive
 * across browser sessions.
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[Awake Timer] Browser started. Re-initializing timer...');
  registerAwakeTimer();
});

/**
 * Listens for firing alarms specifically matching our registered name.
 * Logs a simple ping to the console to verify execution.
 * 
 * In Manifest V3, the mere act of this event firing resets the 30-second
 * inactivity timer for the background service worker, keeping it alive.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Awake Timer] Ping! Service worker kept alive at ${timestamp}`);
  }
});
