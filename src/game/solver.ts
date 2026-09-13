import {
  autoHomeAll,
  canStackOnTableau,
  cloneState,
  dealKlondike,
  drawFromStock,
  findCard,
  isWon,
  playToTableau,
  playableWasteId,
  runFrom,
  type GameState,
} from "./rules.ts";

/** Enough retries for kid levels without stalling the deal animation. */
export const DEAL_TRIES = 40;

/**
 * Node cap for the browser solver. These ease-ups (any-on-empty + auto-home)
 * make most deals winnable; a timeout is usually search limits, not a brick.
 */
export const SOLVER_STEP_LIMIT = 3500;

type SearchMove = { kind: "play"; id: string; column: number } | { kind: "draw" };

function stateKey(state: GameState): string {
  const pile = (cards: { id: string; faceUp: boolean }[]) => cards.map((card) => `${card.id}${card.faceUp ? "+" : "-"}`).join("");
  return [
    pile(state.stock),
    pile(state.waste),
    state.foundations.map(pile).join("/"),
    state.tableau.map(pile).join("/"),
  ].join("|");
}

function firstEmptyColumn(state: GameState): number {
  return state.tableau.findIndex((pile) => pile.length === 0);
}

function moveScore(state: GameState, move: SearchMove): number {
  if (move.kind === "draw") return 0;
  const loc = findCard(state, move.id);
  let score = 10;
  if (loc?.pile === "waste") score += 30;
  if (loc?.pile === "tableau" && loc.column !== undefined) {
    const pile = state.tableau[loc.column];
    const under = pile?.[loc.index - 1];
    if (under && !under.faceUp) score += 80;
    if (loc.index === 0) score += 25;
  }
  const dest = state.tableau[move.column];
  if (dest && dest.length > 0) score += 15;
  return score;
}

function legalMoves(state: GameState): SearchMove[] {
  const moves: SearchMove[] = [];
  const empty = firstEmptyColumn(state);
  const consider = (id: string, dest: number): void => {
    const loc = findCard(state, id);
    if (loc?.pile === "tableau" && loc.column === dest) return;
    const destPile = state.tableau[dest];
    if (!destPile) return;
    if (destPile.length === 0 && loc?.pile === "tableau") {
      if (loc.index === 0 || loc.column === undefined) return;
      const source = state.tableau[loc.column];
      const under = source?.[loc.index - 1];
      const run = runFrom(state, id);
      if (!under) return;
      if (under.faceUp && run && runFrom(state, under.id)?.length === run.length + 1) return;
    }
    const run = runFrom(state, id);
    if (!run?.[0] || !canStackOnTableau(state, run[0], dest)) return;
    moves.push({ kind: "play", id, column: dest });
  };

  const wasteId = playableWasteId(state);
  if (wasteId) {
    state.tableau.forEach((pile, dest) => {
      if (pile.length === 0 && dest !== empty) return;
      consider(wasteId, dest);
    });
  }

  state.tableau.forEach((pile) => {
    pile.forEach((card) => {
      if (!card.faceUp || !runFrom(state, card.id)) return;
      state.tableau.forEach((destPile, dest) => {
        if (destPile.length === 0 && dest !== empty) return;
        consider(card.id, dest);
      });
    });
  });

  moves.sort((a, b) => moveScore(state, b) - moveScore(state, a));
  if (state.stock.length > 0 || state.waste.length > 0) moves.push({ kind: "draw" });
  return moves;
}

function applyMove(state: GameState, move: SearchMove): boolean {
  if (move.kind === "draw") return drawFromStock(state) !== "empty";
  return playToTableau(state, move.id, move.column);
}

function playGreedy(state: GameState): boolean {
  const seen = new Set<string>();
  for (let i = 0; i < 400; i += 1) {
    autoHomeAll(state);
    if (isWon(state)) return true;
    const key = stateKey(state);
    if (seen.has(key)) break;
    seen.add(key);
    const useful = legalMoves(state).filter((move) => move.kind !== "draw");
    const best = useful[0];
    if (best) {
      applyMove(state, best);
      continue;
    }
    if (state.stock.length > 0 || state.waste.length > 0) {
      drawFromStock(state);
      continue;
    }
    break;
  }
  return isWon(state);
}

/** True if a clone of this deal can be won with current ease-up rules. */
export function isWinnable(start: GameState, stepLimit = SOLVER_STEP_LIMIT): boolean {
  if (playGreedy(cloneState(start))) return true;

  const root = cloneState(start);
  autoHomeAll(root);
  if (isWon(root)) return true;

  const visited = new Set<string>([stateKey(root)]);
  const stack: GameState[] = [root];
  let steps = 0;

  while (stack.length > 0 && steps < stepLimit) {
    const current = stack.pop();
    if (!current) break;
    const moves = legalMoves(current);
    // Push low-priority first so DFS pops useful tableau plays before stock cycling.
    for (let i = moves.length - 1; i >= 0; i -= 1) {
      const move = moves[i];
      if (!move) continue;
      steps += 1;
      if (steps > stepLimit) return false;
      const next = cloneState(current);
      if (!applyMove(next, move)) continue;
      autoHomeAll(next);
      if (isWon(next)) return true;
      const key = stateKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      stack.push(next);
    }
  }
  return false;
}

export function dealSolvable(multiplier: number, rng: () => number = Math.random): GameState {
  let fallback = dealKlondike(multiplier, rng);
  for (let attempt = 0; attempt < DEAL_TRIES; attempt += 1) {
    const deal = attempt === 0 ? fallback : dealKlondike(multiplier, rng);
    if (isWinnable(deal)) return deal;
    fallback = deal;
  }
  // Best-effort fallback: prefer shipping a deal over blocking the kid on a solver timeout.
  return fallback;
}
