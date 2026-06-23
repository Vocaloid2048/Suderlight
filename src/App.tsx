import { useState, useCallback } from 'react';
import { useGameStore } from './store/gameStore';
import { useNarrativePlaytest } from './hooks/narrativePlaytest';
import { useNarrativePlaytestStore } from './store/narrativePlaytestStore';
import { isPlaytestEnabled } from './hooks/narrativePlaytest';
import ErrorBoundary from './components/ErrorBoundary';
import {
  AftermathReport,
  BridgePainterInnerWorld,
  ChapterSelectorModal,
  EmotionDictionaryPage,
  NarrativePlaytestDashboard,
  OuterWorldConversation,
  OuterWorldExplorer,
  SelfReconciliationPortal,
  SubconsciousTavern,
  TitlePortal,
} from './ui';

type Screen = 'title' | 'city' | 'tavern' | 'conversation' | 'innerWorld' | 'dictionary' | 'aftermath' | 'reconciliation';

export default function App() {
  const save = useGameStore(state => state.save);
  const collectClue = useGameStore(state => state.collectClue);
  const setCurrentLocation = useGameStore(state => state.setCurrentLocation);
  const applyBackendNpcState = useGameStore(state => state.applyBackendNpcState);
  const completeNpcSuccess = useGameStore(state => state.completeNpcSuccess);

  const resetSave = useGameStore(state => state.resetSave);
  const setInnerWorldDepth = useGameStore(state => state.setInnerWorldDepth);
  const advancePsychLayer = useGameStore(state => state.advancePsychLayer);
  const forceUnlockInnerWorld = useGameStore(state => state.forceUnlockInnerWorld);

  const [screen, setScreen] = useState<Screen>('title');
  const [returnScreen, setReturnScreen] = useState<Screen>('city');

  // ---- Playtest callbacks ----
  const onForceUnlock = useCallback(() => {
    forceUnlockInnerWorld();
  }, [forceUnlockInnerWorld]);

  const onEnterInnerWorld = useCallback(() => {
    // Navigate to inner world if unlocked, or just force the screen
    setReturnScreen(screen === 'innerWorld' ? 'city' : screen);
    setScreen('innerWorld');
  }, [screen]);

  const onSelectChapter = useCallback((depth: number) => {
    // Set depth and enter inner world
    setInnerWorldDepth(depth - 1); // depth starts at 1
    setReturnScreen(screen === 'innerWorld' ? 'city' : screen);
    setScreen('innerWorld');
  }, [screen, setInnerWorldDepth]);

  // ---- Narrative Playtest: hotkeys + QA panel ----
  const { active: playtestActive, demoMode } = useNarrativePlaytest({
    onForceUnlock,
    onEnterInnerWorld,
    onSelectChapter,
  });
  const chapterSelectorOpen = useNarrativePlaytestStore((s) => s.chapterSelectorOpen);

  const bridgeArtist = save.npcs.bridge_artist;

  const openScreenWithReturn = (nextScreen: Screen) => {
    setReturnScreen(screen);
    setScreen(nextScreen);
  };

  const resetAndReturnTitle = async () => {
    await resetSave();
    setReturnScreen('city');
    setScreen('title');
  };



  const content = (() => {
    if (screen === 'title') {
      return (
        <TitlePortal
          onStart={() => setScreen('city')}
          onOpenTavern={() => openScreenWithReturn('tavern')}
          onOpenDictionary={() => openScreenWithReturn('dictionary')}
          onOpenReport={() => openScreenWithReturn('aftermath')}
        />
      );
    }

    if (screen === 'tavern') {
      return (
        <SubconsciousTavern
          save={save}
          onBack={() => setScreen(returnScreen)}
          onEnterCity={() => setScreen('city')}
          onOpenReport={() => openScreenWithReturn('aftermath')}
        />
      );
    }

    if (screen === 'conversation') {
      return (
        <OuterWorldConversation
          inventory={save.collectedClues}
          knowledge={save.player.knowledge}
          innerWorldDepth={bridgeArtist.innerWorldDepth}
          npcState={bridgeArtist}
          onClose={() => setScreen('city')}
          onBackendNpcStateApplied={(state) => applyBackendNpcState('bridge_artist', state)}
          onEnterInnerWorld={() => setScreen('innerWorld')}

          onEndingTriggered={() => setScreen('aftermath')}
        />
      );
    }

    if (screen === 'innerWorld') {
      return (
        <BridgePainterInnerWorld
          onReturnToSurface={(depth) => {
            setInnerWorldDepth(depth);
            // depth=3 means all 4 layers completed (full arc)
            if (depth >= 3) {
              completeNpcSuccess('bridge_artist');
              setScreen('aftermath');
            } else {
              setScreen('conversation');
            }
          }}
          onAdvanceLayer={(layer) => advancePsychLayer(layer)}
        />
      );
    }

    if (screen === 'dictionary') {
      return <EmotionDictionaryPage onBack={() => setScreen(returnScreen)} />;
    }

    if (screen === 'aftermath') {
      return (
        <AftermathReport
          save={save}
          onBack={() => setScreen(returnScreen === 'title' ? 'city' : returnScreen)}
          onOpenReconciliation={() => setScreen('reconciliation')}
        />
      );
    }

    if (screen === 'reconciliation') {
      return (
        <SelfReconciliationPortal
          save={save}
          onBack={() => setScreen('city')}
          onRestart={resetAndReturnTitle}
        />
      );
    }

    return (
      <OuterWorldExplorer
        save={save}
        collectClue={collectClue}
        setCurrentLocation={setCurrentLocation}
        resetSave={resetAndReturnTitle}
        onOpenConversation={() => setScreen('conversation')}
        onOpenDictionary={() => openScreenWithReturn('dictionary')}
        onOpenTavern={() => openScreenWithReturn('tavern')}
        onOpenReport={() => openScreenWithReturn('aftermath')}
        onEnterInnerWorld={() => setScreen('innerWorld')}
      />
    );
  })();

  return (
    <ErrorBoundary>
      {content}

      {/* Playtest QA Dashboard */}
      {isPlaytestEnabled() && playtestActive && !demoMode && (
        <NarrativePlaytestDashboard currentScreen={screen} />
      )}

      {/* Chapter Selector Modal (Shift+F9) */}
      {chapterSelectorOpen && (
        <ChapterSelectorModal onSelectChapter={onSelectChapter} />
      )}

      {/* Demo Mode indicator (subtle) */}
      {demoMode && (
        <div style={{
          position: 'fixed',
          bottom: 8,
          right: 8,
          zIndex: 100000,
          padding: '4px 10px',
          borderRadius: 4,
          background: 'rgba(255,152,0,0.25)',
          color: '#ff9800',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}>
          🎬 DEMO MODE · F10 to exit
        </div>
      )}
    </ErrorBoundary>
  );
}
