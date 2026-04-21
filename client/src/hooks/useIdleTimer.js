import { useEffect, useState, useRef, useCallback } from 'react';

const IDLE_MS = 30 * 60 * 1000; // 30 min of inactivity → logout
const WARN_MS = 2 * 60 * 1000;  // show warning in the final 2 min
const CHECK_INTERVAL_MS = 5 * 1000;
const LS_KEY = 'statice-last-activity';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'];

function readLastActivity() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : Date.now();
  } catch {
    return Date.now();
  }
}

function writeLastActivity(ts) {
  try {
    localStorage.setItem(LS_KEY, String(ts));
  } catch {
    // ignore
  }
}

/**
 * Tracks user activity across tabs. When no activity for IDLE_MS, calls onTimeout.
 * Surfaces a warning state during the final WARN_MS so the UI can confirm.
 */
export default function useIdleTimer({ onTimeout, enabled = true }) {
  const [warning, setWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const extendSession = useCallback(() => {
    writeLastActivity(Date.now());
    setWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    // Initialise timestamp so a fresh session doesn't immediately expire.
    try {
      if (!localStorage.getItem(LS_KEY)) {
        writeLastActivity(Date.now());
      }
    } catch {
      writeLastActivity(Date.now());
    }

    // Throttle activity writes: at most once per 5s to avoid localStorage thrash.
    let lastWriteTs = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWriteTs < 5000) return;
      lastWriteTs = now;
      writeLastActivity(now);
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    );

    const interval = setInterval(() => {
      const last = readLastActivity();
      const idleFor = Date.now() - last;
      const remaining = IDLE_MS - idleFor;

      if (remaining <= 0) {
        setWarning(false);
        onTimeoutRef.current?.();
      } else if (remaining <= WARN_MS) {
        setWarning(true);
        setSecondsRemaining(Math.ceil(remaining / 1000));
      } else if (remaining > WARN_MS) {
        setWarning(false);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      clearInterval(interval);
    };
  }, [enabled]);

  return { warning, secondsRemaining, extendSession };
}
