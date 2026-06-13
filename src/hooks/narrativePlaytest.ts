// ============================================================
// Narrative QA / Playtest Hook
//
// Access: import.meta.env.DEV  → always active
//         ?playtest param     → writes sessionStorage flag
//         sessionStorage flag  → persistent within tab
//
// Hotkeys:
//   F7          = Force Unlock Inner World conditions
//   F8          = Toggle QA Dashboard
//   F9          = Enter Inner World directly
//   Shift+F9    = Select Inner World chapter
//   F10         = Toggle Demo Mode (clean recording)
//   Ctrl+Shift+D = Toggle QA Dashboard
//   Konami Code  = Toggle QA Dashboard
// ============================================================

import { useEffect } from 'react';
import { useNarrativePlaytestStore } from '../store/narrativePlaytestStore';

const PLTEST_KEY = '__suderlight_playtest';

// Check once at module load so sessionStorage isn't read every render
const params = new URLSearchParams(window.location.search);
const playtestEnabled = import.meta.env.DEV || params.has('playtest') || sessionStorage.getItem(PLTEST_KEY) === '1';

const KONAMI = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
];

export type PlaytestCallbacks = {
  /** F7 — 強制滿足內心世界觸發條件 */
  onForceUnlock: () => void;
  /** F9 — 直接進入內心世界（chapter 預設為當前深度+1 或 1） */
  onEnterInnerWorld: () => void;
  /** Shift+F9 — 選擇章節後進入 */
  onSelectChapter: (depth: number) => void;
};

export function useNarrativePlaytest(callbacks: PlaytestCallbacks) {
  const active = useNarrativePlaytestStore((s) => s.active);
  const toggle = useNarrativePlaytestStore((s) => s.toggle);
  const demoMode = useNarrativePlaytestStore((s) => s.demoMode);
  const toggleDemo = useNarrativePlaytestStore((s) => s.toggleDemo);
  const openChapterSelector = useNarrativePlaytestStore((s) => s.openChapterSelector);
  const pushLog = useNarrativePlaytestStore((s) => s.pushLog);

  useEffect(() => {
    // ---- Access Gate ----
    if (!playtestEnabled) return;

    // Persist ?playtest to sessionStorage so hotkeys work on subsequent navigations
    if (params.has('playtest') && !sessionStorage.getItem(PLTEST_KEY)) {
      sessionStorage.setItem(PLTEST_KEY, '1');
      window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&]playtest(=[^&]*)?/, '').replace(/^\?$/, ''));
    }

    let konamiIndex = 0;
    const KONAMI_TIMEOUT = 3000;
    let konamiTimer: ReturnType<typeof setTimeout> | null = null;

    const resetKonami = () => {
      konamiIndex = 0;
      if (konamiTimer) clearTimeout(konamiTimer);
      konamiTimer = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      // ---- F7: Force Unlock ----
      if (e.code === 'F7') {
        e.preventDefault();
        callbacks.onForceUnlock();
        pushLog({ type: 'force_unlock', message: 'F7 強制解鎖內心世界', detail: '信任→50, 知識→70, 解鎖內心世界' });
        return;
      }

      // ---- Shift+F9: Chapter Selector ----
      if (e.shiftKey && e.code === 'F9') {
        e.preventDefault();
        openChapterSelector();
        return;
      }

      // ---- F9: Enter Inner World ----
      if (e.code === 'F9') {
        e.preventDefault();
        callbacks.onEnterInnerWorld();
        pushLog({ type: 'inner_world', message: 'F9 直接進入內心世界' });
        return;
      }

      // ---- F10: Demo Mode ----
      if (e.code === 'F10') {
        e.preventDefault();
        toggleDemo();
        pushLog({ type: 'demo', message: demoMode ? 'Demo Mode OFF' : 'Demo Mode ON' });
        return;
      }

      // ---- F8: Toggle QA Panel ----
      if (e.code === 'F8') {
        e.preventDefault();
        toggle();
        resetKonami();
        return;
      }

      // ---- Ctrl+Shift+D ----
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
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
  }, [toggle, toggleDemo, demoMode, callbacks, openChapterSelector, pushLog]);

  return {
    active,
    toggle,
    demoMode,
    toggleDemo,
    /** Whether the playtest system is available at all */
    enabled: playtestEnabled,
  } as const;
}

/** Pure function — can be used outside React to check if playtest is enabled */
export function isPlaytestEnabled(): boolean {
  return playtestEnabled;
}
