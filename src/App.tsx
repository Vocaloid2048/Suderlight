import { useState, useCallback } from 'react';
import { useGameStore } from './store/gameStore';
import { useDevtoolsHotkeys, isPlaytestEnabled } from './hooks/useDevtoolsHotkeys';
import { useDevtoolsStore } from './store/devtoolsStore';
import ErrorBoundary from './components/ErrorBoundary';
import DevtoolsPanel from './devtools/DevtoolsPanel';
import {
  AftermathReport,
  NpcInnerWorld,
  ChapterSelectorModal,
  EmotionDictionaryPage,
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
  const addFlagToNpc = useGameStore(state => state.addFlagToNpc);

  const [screen, setScreen] = useState<Screen>('title');
  const [returnScreen, setReturnScreen] = useState<Screen>('city');
  const [arcFailureActive, setArcFailureActive] = useState(false);

  // ---- Devtools callbacks ----
  const onForceUnlock = useCallback(() => {
    forceUnlockInnerWorld();
  }, [forceUnlockInnerWorld]);

  const onEnterInnerWorld = useCallback(() => {
    setReturnScreen(screen === 'innerWorld' ? 'city' : screen);
    setScreen('innerWorld');
  }, [screen]);

  const onSelectChapter = useCallback((depth: number) => {
    setInnerWorldDepth(depth - 1);
    setReturnScreen(screen === 'innerWorld' ? 'city' : screen);
    setScreen('innerWorld');
  }, [screen, setInnerWorldDepth]);

  // ---- Devtools: hotkeys + QA panel ----
  const { active: devtoolsActive, demoMode } = useDevtoolsHotkeys({
    onForceUnlock,
    onEnterInnerWorld,
    onSelectChapter,
  });
  const chapterSelectorOpen = useDevtoolsStore((s) => s.chapterSelectorOpen);

  const bridgeArtist = save.npcs.bridge_artist;

  const openScreenWithReturn = (nextScreen: Screen) => {
    if (nextScreen === 'aftermath') {
      const ending = save.npcs.bridge_artist.ending;
      if (ending === 'none') return;
    }
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
          innerWorldDepth={bridgeArtist.innerWorldDepth}
          npcState={bridgeArtist}
          npcId="bridge_artist"
          onClose={() => {
            const layers = save.npcs.bridge_artist.innerWorld?.layers;
            const allLayersComplete = layers && [1, 2, 3, 4].every(l => layers[l]?.completed);
            if (allLayersComplete && bridgeArtist.ending === 'none') {
              completeNpcSuccess('bridge_artist');
              setScreen('aftermath');
            } else {
              setScreen('city');
            }
          }}
          onBackendNpcStateApplied={(state) => applyBackendNpcState('bridge_artist', state)}
          onEnterInnerWorld={() => setScreen('innerWorld')}
          onEndingTriggered={() => setScreen('aftermath')}
        />
      );
    }

    if (screen === 'innerWorld') {
      return (
        <NpcInnerWorld
          npcId="bridge_artist"
          arcFailure={arcFailureActive}
          onOpenReport={() => {
            setArcFailureActive(false);
            openScreenWithReturn('aftermath');
          }}
          onReturnToSurface={(depth) => {
            setInnerWorldDepth(depth);
            setScreen('conversation');
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
          onBack={() => setScreen('city')}
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
        addFlagToNpc={addFlagToNpc}
        onOpenArcFailure={() => {
          setArcFailureActive(true);
          setScreen('innerWorld');
        }}
      />
    );
  })();

  return (
    <ErrorBoundary>
      {content}

      {/* Devtools QA Panel (整合版) */}
      {isPlaytestEnabled() && devtoolsActive && !demoMode && (
        <DevtoolsPanel currentScreen={screen} />
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
