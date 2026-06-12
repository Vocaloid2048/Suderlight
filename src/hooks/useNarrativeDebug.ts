// ============================================================
// Narrative Debug Activation Hook (DEV ONLY)
// Activation: Ctrl+Shift+D  |  Konami Code  |  F8 toggle
// ============================================================

import { useEffect } from 'react';
import { useNarrativeDebugStore } from '../store/narrativeDebugStore';

const KONAMI = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
];

export function useNarrativeDebug() {
  const active = useNarrativeDebugStore((s) => s.active);
  const toggle = useNarrativeDebugStore((s) => s.toggle);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    let konamiIndex = 0;
    const KONAMI_TIMEOUT = 3000;
    let konamiTimer: ReturnType<typeof setTimeout> | null = null;

    const resetKonami = () => {
      konamiIndex = 0;
      if (konamiTimer) clearTimeout(konamiTimer);
      konamiTimer = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // ---- Ctrl+Shift+D ----
      if (e.ctrlKey && e.shiftKey && (e.code === 'KeyD')) {
        e.preventDefault();
        toggle();
        resetKonami();
        return;
      }

      // ---- F8 toggle ----
      if (e.code === 'F8') {
        e.preventDefault();
        toggle();
        resetKonami();
        return;
      }

      // ---- Konami Code ----
      if (e.code === KONAMI[konamiIndex]) {
        konamiIndex++;
        if (konamiTimer) clearTimeout(konamiTimer);
        konamiTimer = setTimeout(resetKonami, KONAMI_TIMEOUT);

        if (konamiIndex === KONAMI.length) {
          toggle();
          resetKonami();
        }
      } else {
        // Check if this key could be a valid START of the sequence
        if (e.code === KONAMI[0]) {
          konamiIndex = 1;
          if (konamiTimer) clearTimeout(konamiTimer);
          konamiTimer = setTimeout(resetKonami, KONAMI_TIMEOUT);
        } else {
          resetKonami();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (konamiTimer) clearTimeout(konamiTimer);
    };
  }, [toggle]);

  return { active, toggle } as const;
}

/**
 * Convenience re-export so App.tsx imports stay clean.
 * Use `const { active } = useNarrativeDebug()` — the hook handles
 * all activation shortcuts internally.
 */
export function useIsNarrativeDebugActive() {
  // Only subscribe in DEV; otherwise always false
  if (!import.meta.env.DEV) return false;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useNarrativeDebugStore((s) => s.active);
}
