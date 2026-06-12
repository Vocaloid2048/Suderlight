import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import type { DialogueEvaluationResult } from './systems/npcStateEngine';
import {
  AftermathReport,
  EmotionDictionaryPage,
  InnerWorldAbyss,
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
  const evaluateDialogue = useGameStore(state => state.evaluateDialogue);
  const completeNpcSuccess = useGameStore(state => state.completeNpcSuccess);
  const failNpc = useGameStore(state => state.failNpc);
  const resetSave = useGameStore(state => state.resetSave);

  const [screen, setScreen] = useState<Screen>('title');
  const [returnScreen, setReturnScreen] = useState<Screen>('city');

  const bridgeArtist = save.npcs.bridge_artist;

  const openScreenWithReturn = (nextScreen: Screen) => {
    setReturnScreen(screen);
    setScreen(nextScreen);
  };

  const resetAndReturnTitle = () => {
    resetSave();
    setReturnScreen('city');
    setScreen('title');
  };

  const handleDialogueEvaluated = (playerInput: string): DialogueEvaluationResult => {
    return evaluateDialogue('bridge_artist', playerInput);
  };

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
        npcState={bridgeArtist}
        onClose={() => setScreen('city')}
        onDialogueEvaluated={handleDialogueEvaluated}
        onEnterInnerWorld={() => setScreen('innerWorld')}
        onEndingTriggered={() => setScreen('aftermath')}
      />
    );
  }

  if (screen === 'innerWorld') {
    return (
      <InnerWorldAbyss
        npcState={bridgeArtist}
        onBack={() => setScreen('city')}
        onResolveSuccess={() => {
          completeNpcSuccess('bridge_artist');
          setScreen('aftermath');
        }}
        onResolveFailure={() => {
          failNpc('bridge_artist');
          setScreen('aftermath');
        }}
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
    />
  );
}
