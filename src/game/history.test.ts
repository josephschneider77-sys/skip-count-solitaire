import assert from "node:assert/strict";
import { restoreState, snapshotState } from "./history.ts";
import {
  SUITS,
  canPlayToFoundation,
  dealKlondike,
  drawFromStock,
  playToTableau,
  removeRun,
  suitIndex,
} from "./rules.ts";

function rngFrom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const dealt = dealKlondike(2, rngFrom(21));
const firstStock = dealt.stock[dealt.stock.length - 1];
assert.ok(firstStock);
const snap = snapshotState(dealt);
firstStock.faceUp = true;
assert.equal(snap.stock.at(-1)?.faceUp, false, "snapshot must copy faceUp, not alias the card");

restoreState(dealt, snap);
assert.equal(firstStock.faceUp, false);
assert.equal(dealt.stock.at(-1), firstStock, "restore must reuse the same card objects");

const beforeDraw = snapshotState(dealt);
assert.equal(drawFromStock(dealt), "draw");
assert.equal(dealt.waste.at(-1)?.id, firstStock.id);
assert.equal(dealt.waste.at(-1)?.faceUp, true);
restoreState(dealt, beforeDraw);
assert.deepEqual(snapshotState(dealt), beforeDraw);
assert.equal(dealt.waste.length, 0);
assert.equal(dealt.stock.at(-1)?.id, firstStock.id);
assert.equal(firstStock.faceUp, false);

dealt.waste = [
  { id: "recycle-a", value: 8, multiplier: 2, suit: SUITS[0], faceUp: true },
  { id: "recycle-b", value: 10, multiplier: 2, suit: SUITS[1], faceUp: true },
];
dealt.stock = [];
const beforeRecycle = snapshotState(dealt);
assert.equal(drawFromStock(dealt), "recycle");
assert.equal(dealt.waste.length, 0);
assert.equal(dealt.stock.length, 2);
assert.equal(dealt.stock.every((card) => !card.faceUp), true);
restoreState(dealt, beforeRecycle);
assert.deepEqual(snapshotState(dealt), beforeRecycle);
assert.equal(dealt.waste.at(-1)?.id, "recycle-b");
assert.equal(dealt.waste.at(-1)?.faceUp, true);

const table = dealKlondike(2, rngFrom(22));
table.tableau[0] = [];
table.tableau[1] = [
  { id: "tab-26", value: 26, multiplier: 2, suit: "spades", faceUp: true },
  { id: "tab-24", value: 24, multiplier: 2, suit: "hearts", faceUp: true },
];
const beforeKing = snapshotState(table);
assert.equal(playToTableau(table, "tab-26", 0), true);
assert.deepEqual(
  table.tableau[0]?.map((card) => card.value),
  [26, 24],
);
restoreState(table, beforeKing);
assert.equal(table.tableau[0]?.length, 0);
assert.deepEqual(
  table.tableau[1]?.map((card) => card.id),
  ["tab-26", "tab-24"],
);

const home = dealKlondike(2, rngFrom(23));
const starter = { id: "home-2", value: 2, multiplier: 2, suit: SUITS[0], faceUp: true };
home.waste = [starter];
assert.equal(canPlayToFoundation(home, starter), true);
const beforeHome = snapshotState(home);
const moved = removeRun(home, "home-2");
home.foundations[suitIndex(starter.suit)]?.push(...moved);
assert.equal(home.foundations[suitIndex(starter.suit)]?.at(-1)?.id, "home-2");
restoreState(home, beforeHome);
assert.equal(home.waste.at(-1)?.id, "home-2");
assert.equal(home.foundations[suitIndex(starter.suit)]?.length, 0);

console.log("history tests passed");
