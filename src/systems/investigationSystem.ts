import { bridgeArtistClues, type ClueId } from '../data/verticalSlice';

export function getClueKnowledge(clueId: ClueId) {
  return bridgeArtistClues[clueId].knowledge;
}

export function getClueData(clueId: ClueId) {
  return bridgeArtistClues[clueId];
}
