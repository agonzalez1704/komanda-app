import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Subscribes to the OS "Reduce Motion" accessibility setting.
 *
 * Per Apple HIG Accessibility guidance, when this setting is on we should:
 *   - tighten springs and shorten durations
 *   - replace x/y/z slides with fades
 *   - avoid animating depth / blur / peripheral motion
 *
 * Usage:
 *   const reduceMotion = useReduceMotion();
 *   <Modal animationType={reduceMotion ? 'none' : 'slide'} />
 */
export function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setEnabled(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setEnabled(v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return enabled;
}

/**
 * Announces a short message to VoiceOver. Safe to call even when VoiceOver
 * is off — it's a no-op. Keep messages concise and intent-focused
 * (e.g. "Added 2 pastor tacos. Cart has 5 items.").
 */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
