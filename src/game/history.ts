import type { CardModel, GameState } from "./rules";

export type PileSnap = { id: string; faceUp: boolean };

export type GameSnap = {
  stock: PileSnap[];
  waste: PileSnap[];
  foundations: PileSnap[][];
  tableau: PileSnap[][];
};

function snapPile(pile: CardModel[]): PileSnap[] {
  return pile.map((card) => ({ id: card.id, faceUp: card.faceUp }));
}

export function snapshotState(state: GameState): GameSnap {
  return {
    stock: snapPile(state.stock),
    waste: snapPile(state.waste),
    foundations: state.foundations.map(snapPile),
    tableau: state.tableau.map(snapPile),
  };
}

export function restoreState(state: GameState, snap: GameSnap): void {
  const byId = new Map<string, CardModel>();
  for (const pile of [state.stock, state.waste, ...state.foundations, ...state.tableau]) {
    for (const card of pile) byId.set(card.id, card);
  }

  const restorePile = (snaps: PileSnap[]): CardModel[] =>
    snaps.map((entry) => {
      const card = byId.get(entry.id);
      if (!card) throw new Error(`Missing card ${entry.id}`);
      card.faceUp = entry.faceUp;
      return card;
    });

  state.stock = restorePile(snap.stock);
  state.waste = restorePile(snap.waste);
  state.foundations = snap.foundations.map(restorePile);
  state.tableau = snap.tableau.map(restorePile);
}
