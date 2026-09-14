export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type PileKind = "stock" | "waste" | "foundation" | "tableau";

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export const SUIT_GLYPH: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export const SUIT_COLOR: Record<Suit, "red" | "black"> = {
  hearts: "red",
  diamonds: "red",
  clubs: "black",
  spades: "black",
};

export type CardModel = {
  id: string;
  value: number;
  multiplier: number;
  suit: Suit;
  faceUp: boolean;
};

export type GameState = {
  multiplier: number;
  lowest: number;
  highest: number;
  stock: CardModel[];
  waste: CardModel[];
  foundations: CardModel[][];
  tableau: CardModel[][];
};

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    const swap = copy[j];
    if (current === undefined || swap === undefined) continue;
    copy[i] = swap;
    copy[j] = current;
  }
  return copy;
}

export const RANKS_PER_SUIT = 13;

export function highestMultiple(multiplier: number): number {
  return multiplier * RANKS_PER_SUIT;
}

/** Skip-count ranks for a level: N, 2N, …, 13N (classic 13-rank suit). */
export function multiplesUpTo(multiplier: number): number[] {
  const values: number[] = [];
  const cap = highestMultiple(multiplier);
  for (let value = multiplier; value <= cap; value += multiplier) {
    values.push(value);
  }
  return values;
}

export function buildDeck(multiplier: number): CardModel[] {
  const values = multiplesUpTo(multiplier);
  const cards: CardModel[] = [];
  values.forEach((value) => {
    SUITS.forEach((suit) => {
      cards.push({
        id: `${multiplier}-${value}-${suit}`,
        value,
        multiplier,
        suit,
        faceUp: false,
      });
    });
  });
  return cards;
}

export function dealKlondike(multiplier: number, rng: () => number = Math.random): GameState {
  const values = multiplesUpTo(multiplier);
  const lowest = values[0] ?? multiplier;
  const highest = values[values.length - 1] ?? multiplier;
  const deck = shuffle(buildDeck(multiplier), rng);
  const tableau: CardModel[][] = Array.from({ length: 7 }, () => []);
  for (let column = 0; column < 7; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      const card = deck.pop();
      if (!card) break;
      card.faceUp = row === column;
      tableau[column]?.push(card);
    }
  }
  return {
    multiplier,
    lowest,
    highest,
    stock: deck,
    waste: [],
    foundations: Array.from({ length: 4 }, () => []),
    tableau,
  };
}

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

export function findCard(state: GameState, id: string): { pile: PileKind; column?: number; index: number } | null {
  const wasteIndex = state.waste.findIndex((card) => card.id === id);
  if (wasteIndex >= 0) return { pile: "waste", index: wasteIndex };
  const stockIndex = state.stock.findIndex((card) => card.id === id);
  if (stockIndex >= 0) return { pile: "stock", index: stockIndex };
  for (let column = 0; column < state.foundations.length; column += 1) {
    const pile = state.foundations[column];
    if (!pile) continue;
    const index = pile.findIndex((card) => card.id === id);
    if (index >= 0) return { pile: "foundation", column, index };
  }
  for (let column = 0; column < state.tableau.length; column += 1) {
    const pile = state.tableau[column];
    if (!pile) continue;
    const index = pile.findIndex((card) => card.id === id);
    if (index >= 0) return { pile: "tableau", column, index };
  }
  return null;
}

export function canPlayToFoundation(state: GameState, card: CardModel): boolean {
  const pile = state.foundations[suitIndex(card.suit)];
  if (!pile) return false;
  if (pile.length === 0) return card.value === state.lowest;
  const top = pile[pile.length - 1];
  return Boolean(top && top.suit === card.suit && card.value - top.value === state.multiplier);
}

/** Kid-friendly double-tap window (touch + mouse). */
export const DOUBLE_TAP_MS = 360;

export function isDoubleTap(
  prev: { id: string; time: number } | null,
  id: string,
  now: number,
  windowMs = DOUBLE_TAP_MS,
): boolean {
  return Boolean(prev && prev.id === id && now - prev.time <= windowMs && now >= prev.time);
}

/** Waste top or face-up tableau top that can legally go to its suit home. */
export function canAutoHome(state: GameState, id: string): boolean {
  const loc = findCard(state, id);
  if (!loc) return false;
  if (loc.pile === "waste") {
    const top = state.waste[state.waste.length - 1];
    return Boolean(top && top.id === id && top.faceUp && canPlayToFoundation(state, top));
  }
  if (loc.pile === "tableau" && loc.column !== undefined) {
    const pile = state.tableau[loc.column];
    const top = pile?.[pile.length - 1];
    return Boolean(top && top.id === id && top.faceUp && canPlayToFoundation(state, top));
  }
  return false;
}

export function playToFoundation(state: GameState, id: string): boolean {
  if (!canAutoHome(state, id) || !isTopWasteOrTableau(state, id)) return false;
  const loc = findCard(state, id);
  if (!loc) return false;
  const moved = removeRun(state, id);
  const card = moved[0];
  if (!card || moved.length !== 1) {
    if (loc.pile === "waste") state.waste.push(...moved);
    else if (loc.pile === "tableau" && loc.column !== undefined) state.tableau[loc.column]?.push(...moved);
    return false;
  }
  state.foundations[suitIndex(card.suit)]?.push(card);
  return true;
}

/** Tableau builds down by exactly one skip: dest − moving === multiplier (never up, never a gap). */
export function canPlaceOnCard(state: GameState, moving: CardModel, dest: CardModel): boolean {
  return dest.value - moving.value === state.multiplier;
}

/** True when this waste/tableau card starts a run that can legally drop on another column. */
export function hasTableauDrop(state: GameState, id: string): boolean {
  const run = runFrom(state, id);
  if (!run?.[0]) return false;
  const loc = findCard(state, id);
  return state.tableau.some((pile, column) => {
    if (pile.length === 0) return false;
    if (loc?.pile === "tableau" && loc.column === column) return false;
    return canStackOnTableau(state, run[0]!, column);
  });
}

/** Face-up suffix of every column must be a contiguous descending skip-count (no orphans / gaps). */
export function isLegalTableauPiles(state: GameState): boolean {
  return state.tableau.every((pile) => {
    let seenFaceUp = false;
    for (let i = 0; i < pile.length; i += 1) {
      const card = pile[i];
      if (!card) return false;
      if (!card.faceUp) {
        if (seenFaceUp) return false;
        continue;
      }
      seenFaceUp = true;
      const above = pile[i - 1];
      if (above?.faceUp && !canPlaceOnCard(state, card, above)) return false;
    }
    return true;
  });
}

export function canStackOnTableau(state: GameState, moving: CardModel, column: number): boolean {
  const dest = state.tableau[column];
  if (!dest) return false;
  if (dest.length === 0) return true;
  const top = dest[dest.length - 1];
  return Boolean(top && top.faceUp && canPlaceOnCard(state, moving, top));
}

export function playableWasteId(state: GameState): string | undefined {
  const top = state.waste[state.waste.length - 1];
  return top?.faceUp ? top.id : undefined;
}

export function emptyTableauColumns(state: GameState): number[] {
  return state.tableau.flatMap((pile, index) => (pile.length === 0 ? [index] : []));
}

/**
 * Waste top that can fill an empty column (any face-up card is legal).
 */
export function emptyColumnHint(state: GameState): { wasteId: string; columns: number[] } | null {
  const top = state.waste[state.waste.length - 1];
  if (!top?.faceUp) return null;
  const columns = emptyTableauColumns(state);
  if (columns.length === 0) return null;
  return { wasteId: top.id, columns };
}

export function cloneState(state: GameState): GameState {
  const copy = (card: CardModel): CardModel => ({ ...card });
  return {
    multiplier: state.multiplier,
    lowest: state.lowest,
    highest: state.highest,
    stock: state.stock.map(copy),
    waste: state.waste.map(copy),
    foundations: state.foundations.map((pile) => pile.map(copy)),
    tableau: state.tableau.map((pile) => pile.map(copy)),
  };
}

/** Send every currently legal waste/tableau top home, repeating as new tops appear. */
export function autoHomeAll(state: GameState, preferTableau = false): string[] {
  const moved: string[] = [];
  let ids = playableFoundationIds(state, preferTableau);
  while (ids[0]) {
    const id = ids[0];
    if (!playToFoundation(state, id)) break;
    moved.push(id);
    ids = playableFoundationIds(state, preferTableau);
  }
  return moved;
}

/** Move a waste or tableau run onto a column. Returns false if the play is illegal. */
export function playToTableau(state: GameState, id: string, column: number): boolean {
  const run = runFrom(state, id);
  if (!run?.[0] || !canStackOnTableau(state, run[0], column)) return false;
  const moved = removeRun(state, id);
  if (moved.length === 0) return false;
  state.tableau[column]?.push(...moved);
  return true;
}

export function runFrom(state: GameState, id: string): CardModel[] | null {
  const loc = findCard(state, id);
  if (!loc) return null;
  if (loc.pile === "waste") {
    const top = state.waste[state.waste.length - 1];
    return top && top.id === id && top.faceUp ? [top] : null;
  }
  if (loc.pile !== "tableau" || loc.column === undefined) return null;
  const pile = state.tableau[loc.column];
  if (!pile) return null;
  const run = pile.slice(loc.index);
  if (run.length === 0 || run.some((card) => !card.faceUp)) return null;
  for (let i = 1; i < run.length; i += 1) {
    const above = run[i - 1];
    const below = run[i];
    if (!above || !below || !canPlaceOnCard(state, below, above)) return null;
  }
  return run;
}

export function isTopWasteOrTableau(state: GameState, id: string): boolean {
  const loc = findCard(state, id);
  if (!loc) return false;
  if (loc.pile === "waste") return loc.index === state.waste.length - 1;
  if (loc.pile === "tableau" && loc.column !== undefined) {
    const pile = state.tableau[loc.column];
    return Boolean(pile && loc.index === pile.length - 1);
  }
  return false;
}

export function removeRun(state: GameState, id: string): CardModel[] {
  const loc = findCard(state, id);
  if (!loc) return [];
  if (loc.pile === "waste") {
    if (loc.index !== state.waste.length - 1) return [];
    const card = state.waste.pop();
    return card ? [card] : [];
  }
  if (loc.pile === "foundation" && loc.column !== undefined) {
    const pile = state.foundations[loc.column];
    if (!pile || loc.index !== pile.length - 1) return [];
    const card = pile.pop();
    return card ? [card] : [];
  }
  if (loc.pile === "tableau" && loc.column !== undefined) {
    const pile = state.tableau[loc.column];
    if (!pile) return [];
    const legal = runFrom(state, id);
    if (!legal?.length) return [];
    const run = pile.splice(loc.index, legal.length);
    const exposed = pile[pile.length - 1];
    if (exposed && !exposed.faceUp) exposed.faceUp = true;
    return run;
  }
  return [];
}

export function drawFromStock(state: GameState): "draw" | "recycle" | "empty" {
  if (state.stock.length > 0) {
    const card = state.stock.pop();
    if (!card) return "empty";
    card.faceUp = true;
    state.waste.push(card);
    return "draw";
  }
  if (state.waste.length === 0) return "empty";
  state.stock = state.waste
    .splice(0, state.waste.length)
    .reverse()
    .map((card) => {
      card.faceUp = false;
      return card;
    });
  return "recycle";
}

export function playableFoundationIds(state: GameState, preferTableau = false): string[] {
  const ids: string[] = [];
  const consider = (card: CardModel | undefined): void => {
    if (!card?.faceUp || !canPlayToFoundation(state, card)) return;
    if (!isTopWasteOrTableau(state, card.id)) return;
    if (preferTableau && hasTableauDrop(state, card.id)) return;
    ids.push(card.id);
  };
  consider(state.waste[state.waste.length - 1]);
  state.tableau.forEach((pile) => consider(pile[pile.length - 1]));
  return ids;
}

export function foundationCount(state: GameState): number {
  return state.foundations.reduce((sum, pile) => sum + pile.length, 0);
}

export function deckSize(multiplier: number): number {
  return multiplesUpTo(multiplier).length * SUITS.length;
}

export function isWon(state: GameState): boolean {
  return foundationCount(state) === deckSize(state.multiplier);
}
