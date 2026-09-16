import assert from "node:assert/strict";
import { SUITS, dealKlondike, isWon, multiplesUpTo, suitIndex } from "./rules.ts";
import { dealSolvable, isWinnable } from "./solver.ts";

function rngFrom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const finished = dealKlondike(2, rngFrom(1));
const pile = [...finished.stock, ...finished.tableau.flat()];
finished.stock = [];
finished.waste = [];
finished.tableau = [[], [], [], [], [], [], []];
finished.foundations = SUITS.map((suit) =>
  pile
    .filter((card) => card.suit === suit)
    .sort((a, b) => a.value - b.value)
    .map((card) => ({ ...card, faceUp: true })),
);
assert.equal(finished.foundations.reduce((sum, col) => sum + col.length, 0), 52);
assert.equal(isWon(finished), true);
assert.equal(isWinnable(finished), true);

const stacked = dealKlondike(2, rngFrom(4));
stacked.stock = [];
stacked.waste = [];
stacked.foundations = [[], [], [], []];
stacked.tableau = [
  ...SUITS.map((suit) =>
    multiplesUpTo(2)
      .slice()
      .reverse()
      .map((value) => ({
        id: `2-${value}-${suit}`,
        value,
        multiplier: 2,
        suit,
        faceUp: true,
      })),
  ),
  [],
  [],
  [],
];
assert.equal(isWinnable(stacked), true, "face-up skip-count columns should still be winnable by sending cards home");

for (let level = 2; level <= 4; level += 1) {
  const dealt = dealSolvable(level, rngFrom(8));
  assert.equal(dealt.multiplier, level);
  assert.equal(
    dealt.stock.length + dealt.tableau.reduce((sum, col) => sum + col.length, 0),
    52,
  );
  assert.deepEqual(
    dealt.tableau.map((col) => col.length),
    [1, 2, 3, 4, 5, 6, 7],
  );
  dealt.tableau.forEach((col) => {
    const faceUp = col.filter((card) => card.faceUp);
    assert.equal(faceUp.length, 1, `dealSolvable(${level}) must not pre-build face-up stacks`);
    col.forEach((card, index) => {
      assert.equal(card.faceUp, index === col.length - 1);
    });
  });
  assert.equal(isWinnable(dealt), true, `dealSolvable(${level}) should be winnable`);
}

assert.equal(suitIndex("hearts"), 0);
console.log("solver tests passed");
