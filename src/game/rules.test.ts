import assert from "node:assert/strict";
import {
  SUITS,
  buildDeck,
  canPlaceOnCard,
  canPlayToFoundation,
  canStackOnTableau,
  dealKlondike,
  deckSize,
  drawFromStock,
  isWon,
  multiplesUpTo,
  removeRun,
  runFrom,
} from "./rules.ts";

function rngFrom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

assert.deepEqual(multiplesUpTo(2).slice(0, 5), [2, 4, 6, 8, 10]);
assert.equal(multiplesUpTo(2).at(-1), 26);
assert.equal(multiplesUpTo(2).length, 13);
assert.equal(multiplesUpTo(3).at(-1), 39);
assert.equal(multiplesUpTo(4).at(-1), 52);
assert.equal(multiplesUpTo(5).at(-1), 65);
assert.equal(multiplesUpTo(6).at(-1), 78);
assert.equal(multiplesUpTo(7).at(-1), 91);
assert.equal(multiplesUpTo(8).at(-1), 104);
assert.equal(multiplesUpTo(9).at(-1), 117);
assert.equal(multiplesUpTo(10).at(-1), 130);

for (let level = 2; level <= 10; level += 1) {
  assert.equal(multiplesUpTo(level).length, 13);
  assert.equal(deckSize(level), 52);
  assert.equal(buildDeck(level).length, 52);
}
assert.equal(new Set(buildDeck(4).map((card) => card.suit)).size, 4);

const dealt = dealKlondike(7, rngFrom(7));
assert.equal(dealt.tableau.length, 7);
assert.deepEqual(
  dealt.tableau.map((col) => col.length),
  [1, 2, 3, 4, 5, 6, 7],
);
assert.equal(
  dealt.tableau.reduce((sum, col) => sum + col.length, 0) + dealt.stock.length,
  52,
);
assert.equal(dealt.stock.length, 24);
dealt.tableau.forEach((col) => {
  col.forEach((card, index) => {
    assert.equal(card.faceUp, index === col.length - 1);
  });
});
assert.equal(dealt.lowest, 7);
assert.equal(dealt.highest, 91);

const ace = { id: "a", value: 7, multiplier: 7, suit: SUITS[0], faceUp: true } as const;
assert.equal(canPlayToFoundation(dealt, { ...ace }), true);
assert.equal(canPlayToFoundation(dealt, { ...ace, value: 14 }), false);

const redTen = { id: "r10", value: 10, multiplier: 2, suit: "hearts" as const, faceUp: true };
const blackEight = { id: "b8", value: 8, multiplier: 2, suit: "spades" as const, faceUp: true };
const redEight = { id: "r8", value: 8, multiplier: 2, suit: "diamonds" as const, faceUp: true };
const state2 = dealKlondike(2, rngFrom(2));
assert.equal(canPlaceOnCard(state2, blackEight, redTen), true);
assert.equal(canPlaceOnCard(state2, redEight, redTen), false);

state2.tableau[0] = [];
assert.equal(canStackOnTableau(state2, { ...redTen, value: 26 }, 0), true);
assert.equal(canStackOnTableau(state2, { ...redTen, value: 98 }, 0), false);

const wasteCard = { id: "w", value: 7, multiplier: 7, suit: SUITS[1], faceUp: true } as const;
dealt.waste = [{ ...wasteCard }];
const drawn = drawFromStock(dealt);
assert.ok(drawn === "draw" || drawn === "empty" || drawn === "recycle");

const runState = dealKlondike(10, rngFrom(11));
runState.tableau[1] = [
  { id: "t1", value: 40, multiplier: 10, suit: "hearts", faceUp: true },
  { id: "t2", value: 30, multiplier: 10, suit: "clubs", faceUp: true },
];
const run = runFrom(runState, "t1");
assert.ok(run && run.length === 2);
const moved = removeRun(runState, "t1");
assert.equal(moved.length, 2);
assert.equal(runState.tableau[1]?.length, 0);

assert.equal(isWon(dealKlondike(10, rngFrom(3))), false);

console.log("rules tests passed");
