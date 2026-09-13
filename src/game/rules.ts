export type PileKind = "stock" | "waste" | "foundation" | "tableau";

export type CardModel = {
  id: string;
  value: number;
  multiplier: number;
};

export type GameState = {
  multiplier: number;
  stock: CardModel[];
  waste: CardModel[];
  foundation: CardModel[];
  tableau: CardModel[][];
};

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = copy[i];
    const swap = copy[j];
    if (current === undefined || swap === undefined) continue;
    copy[i] = swap;
    copy[j] = current;
  }
  return copy;
}

export function nextNeeded(state: GameState): number {
  return state.multiplier * (state.foundation.length + 1);
}

export function canPlayToFoundation(state: GameState, card: CardModel): boolean {
  return card.value === nextNeeded(state);
}

export function canStackOnTableau(state: GameState, card: CardModel, column: number): boolean {
  const dest = state.tableau[column];
  if (!dest) return false;
  if (dest.length === 0) return true;
  const top = dest[dest.length - 1];
  if (!top || top.id === card.id) return false;
  return top.value - card.value === state.multiplier;
}

export function findCard(state: GameState, id: string): { pile: PileKind; column?: number; index: number } | null {
  const wasteIndex = state.waste.findIndex((card) => card.id === id);
  if (wasteIndex >= 0) return { pile: "waste", index: wasteIndex };
  const stockIndex = state.stock.findIndex((card) => card.id === id);
  if (stockIndex >= 0) return { pile: "stock", index: stockIndex };
  const foundationIndex = state.foundation.findIndex((card) => card.id === id);
  if (foundationIndex >= 0) return { pile: "foundation", index: foundationIndex };
  for (let column = 0; column < state.tableau.length; column += 1) {
    const pile = state.tableau[column];
    if (!pile) continue;
    const index = pile.findIndex((card) => card.id === id);
    if (index >= 0) return { pile: "tableau", column, index };
  }
  return null;
}

export function isTopPlayable(state: GameState, id: string): boolean {
  const loc = findCard(state, id);
  if (!loc) return false;
  if (loc.pile === "waste") return loc.index === state.waste.length - 1;
  if (loc.pile === "tableau" && loc.column !== undefined) {
    const pile = state.tableau[loc.column];
    return Boolean(pile && loc.index === pile.length - 1);
  }
  return false;
}

export function removeCard(state: GameState, id: string): CardModel | null {
  const loc = findCard(state, id);
  if (!loc) return null;
  if (loc.pile === "waste") {
    const [card] = state.waste.splice(loc.index, 1);
    return card ?? null;
  }
  if (loc.pile === "stock") {
    const [card] = state.stock.splice(loc.index, 1);
    return card ?? null;
  }
  if (loc.pile === "foundation") {
    const [card] = state.foundation.splice(loc.index, 1);
    return card ?? null;
  }
  if (loc.pile === "tableau" && loc.column !== undefined) {
    const pile = state.tableau[loc.column];
    if (!pile) return null;
    const [card] = pile.splice(loc.index, 1);
    return card ?? null;
  }
  return null;
}

export function dealState(multiplier: number, values: number[], columns: number): GameState {
  const cards = shuffle(
    values.map((value, i) => ({
      id: `${multiplier}-${value}-${i}`,
      value,
      multiplier,
    })),
  );
  const keepInStock = Math.min(Math.max(3, Math.floor(cards.length * 0.35)), Math.max(0, cards.length - columns));
  const tableauCards = cards.slice(0, cards.length - keepInStock);
  const stock = cards.slice(cards.length - keepInStock);
  const tableau: CardModel[][] = Array.from({ length: columns }, () => []);
  tableauCards.forEach((card, index) => {
    const column = tableau[index % columns];
    column?.push(card);
  });
  return {
    multiplier,
    stock,
    waste: [],
    foundation: [],
    tableau,
  };
}

export function playableCardIds(state: GameState): string[] {
  const ids: string[] = [];
  const wasteTop = state.waste[state.waste.length - 1];
  if (wasteTop && canPlayToFoundation(state, wasteTop)) ids.push(wasteTop.id);
  state.tableau.forEach((pile) => {
    const top = pile[pile.length - 1];
    if (top && canPlayToFoundation(state, top)) ids.push(top.id);
  });
  return ids;
}
