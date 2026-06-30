import { bridgeArtistClues } from '../data/npcs/bridgePainter';
import type { NpcId } from '../data/verticalSlice';

/**
 * 取得線索知識量
 * npcId 向後相容：目前所有線索都屬於 bridge_artist
 */
export function getClueKnowledge(clueId: string, _npcId: NpcId = 'bridge_artist') {
  const clue = (bridgeArtistClues as Record<string, { knowledge: number }>)[clueId];
  return clue?.knowledge ?? 0;
}

export function getClueData(clueId: string, _npcId: NpcId = 'bridge_artist') {
  return (bridgeArtistClues as Record<string, unknown>)[clueId];
}
