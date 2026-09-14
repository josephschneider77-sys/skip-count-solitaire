import assert from "node:assert/strict";
import {
  SUITS,
  buildDeck,
  autoHomeAll,
  canAutoHome,
  canPlaceOnCard,
  canPlayToFoundation,
  canStackOnTableau,
  DOUBLE_TAP_MS,
  dealKlondike,
  deckSize,
  drawFromStock,
  emptyColumnHint,
  emptyTableauColumns,
  isDoubleTap,
  isWon,
  multiplesUpTo,
  playToFoundation,
  playToTableau,
  highestMultiple,
  playableFoundationIds,
  playableWasteId,
  hasTableauDrop,
  isLegalTableauPiles,
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
  assert.equal(highestMultiple(level), level * 13);
  assert.equal(multiplesUpTo(level).at(-1), level * 13);
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

assert.equal(DOUBLE_TAP_MS >= 300 && DOUBLE_TAP_MS <= 400, true);
assert.equal(isDoubleTap(null, "c1", 100), false);
assert.equal(isDoubleTap({ id: "c1", time: 0 }, "c1", 360), true);
assert.equal(isDoubleTap({ id: "c1", time: 0 }, "c1", 361), false);
assert.equal(isDoubleTap({ id: "c1", time: 0 }, "c2", 100), false);
assert.equal(isDoubleTap({ id: "c1", time: 50 }, "c1", 40), false);

const redTen = { id: "r10", value: 10, multiplier: 2, suit: "hearts" as const, faceUp: true };
const blackEight = { id: "b8", value: 8, multiplier: 2, suit: "spades" as const, faceUp: true };
const redEight = { id: "r8", value: 8, multiplier: 2, suit: "diamonds" as const, faceUp: true };
const redTwo = { id: "r2", value: 2, multiplier: 2, suit: "hearts" as const, faceUp: true };
const redFour = { id: "r4", value: 4, multiplier: 2, suit: "hearts" as const, faceUp: true };
const redSix = { id: "r6", value: 6, multiplier: 2, suit: "hearts" as const, faceUp: true };
const state2 = dealKlondike(2, rngFrom(2));
assert.equal(canPlaceOnCard(state2, blackEight, redTen), true);
assert.equal(canPlaceOnCard(state2, redEight, redTen), true);
assert.equal(canPlaceOnCard(state2, redTwo, redFour), true);
assert.equal(canPlaceOnCard(state2, redTwo, redSix), false);
assert.equal(canPlaceOnCard(state2, redFour, redTwo), false);

state2.tableau[0] = [];
assert.equal(canStackOnTableau(state2, { ...redTen, value: 26 }, 0), true);
assert.equal(canStackOnTableau(state2, { ...redTen, value: 8 }, 0), true);
assert.equal(canStackOnTableau(state2, redTwo, 0), true);

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

const wastePlay = dealKlondike(2, rngFrom(4));
const wasteEight = { id: "waste-8", value: 8, multiplier: 2, suit: "spades" as const, faceUp: true };
const buriedWaste = { id: "waste-old", value: 12, multiplier: 2, suit: "hearts" as const, faceUp: true };
wastePlay.waste = [buriedWaste, wasteEight];
wastePlay.tableau[2] = [{ id: "tab-10", value: 10, multiplier: 2, suit: "hearts", faceUp: true }];
assert.equal(playableWasteId(wastePlay), "waste-8");
assert.ok(runFrom(wastePlay, "waste-8"));
assert.equal(runFrom(wastePlay, "waste-old"), null);
assert.equal(canStackOnTableau(wastePlay, wasteEight, 2), true);
assert.equal(playToTableau(wastePlay, "waste-8", 2), true);
assert.equal(wastePlay.waste.at(-1)?.id, "waste-old");
assert.equal(wastePlay.tableau[2]?.at(-1)?.id, "waste-8");
assert.equal(playToTableau(wastePlay, "waste-old", 2), false);

const emptyKing = dealKlondike(2, rngFrom(5));
emptyKing.tableau[3] = [];
emptyKing.waste = [{ id: "king-26", value: 26, multiplier: 2, suit: "diamonds", faceUp: true }];
assert.equal(canStackOnTableau(emptyKing, emptyKing.waste[0]!, 3), true);
assert.equal(playToTableau(emptyKing, "king-26", 3), true);
assert.equal(emptyKing.tableau[3]?.[0]?.value, 26);

const wasteNotKing = dealKlondike(2, rngFrom(15));
wasteNotKing.tableau[0] = [];
wasteNotKing.waste = [{ id: "waste-24", value: 24, multiplier: 2, suit: "clubs", faceUp: true }];
assert.equal(canStackOnTableau(wasteNotKing, wasteNotKing.waste[0]!, 0), true);
assert.equal(playToTableau(wasteNotKing, "waste-24", 0), true);
assert.equal(wasteNotKing.tableau[0]?.[0]?.id, "waste-24");

const tableauNotKing = dealKlondike(2, rngFrom(16));
tableauNotKing.tableau[0] = [];
tableauNotKing.tableau[1] = [
  { id: "tab-24", value: 24, multiplier: 2, suit: "spades", faceUp: true },
  { id: "tab-22", value: 22, multiplier: 2, suit: "hearts", faceUp: true },
];
assert.equal(canStackOnTableau(tableauNotKing, tableauNotKing.tableau[1]![0]!, 0), true);
assert.equal(playToTableau(tableauNotKing, "tab-24", 0), true);
assert.deepEqual(
  tableauNotKing.tableau[0]?.map((card) => card.id),
  ["tab-24", "tab-22"],
);

const kingRun = dealKlondike(2, rngFrom(17));
kingRun.tableau[0] = [];
kingRun.tableau[1] = [
  { id: "run-26", value: 26, multiplier: 2, suit: "spades", faceUp: true },
  { id: "run-24", value: 24, multiplier: 2, suit: "hearts", faceUp: true },
];
assert.equal(canStackOnTableau(kingRun, kingRun.tableau[1]![0]!, 0), true);
assert.equal(playToTableau(kingRun, "run-26", 0), true);
assert.deepEqual(
  kingRun.tableau[0]?.map((card) => card.value),
  [26, 24],
);

const emptyLevel3 = dealKlondike(3, rngFrom(18));
emptyLevel3.tableau[2] = [];
assert.equal(emptyLevel3.highest, 39);
assert.equal(
  canStackOnTableau(emptyLevel3, { id: "k39", value: 39, multiplier: 3, suit: "hearts", faceUp: true }, 2),
  true,
);
assert.equal(
  canStackOnTableau(emptyLevel3, { id: "k36", value: 36, multiplier: 3, suit: "hearts", faceUp: true }, 2),
  true,
);

const glowHint = dealKlondike(2, rngFrom(19));
glowHint.tableau[0] = [];
glowHint.waste = [{ id: "glow-26", value: 26, multiplier: 2, suit: "hearts", faceUp: true }];
assert.deepEqual(emptyTableauColumns(glowHint), [0]);
assert.deepEqual(emptyColumnHint(glowHint), { wasteId: "glow-26", columns: [0] });
glowHint.waste = [{ id: "glow-24", value: 24, multiplier: 2, suit: "hearts", faceUp: true }];
assert.deepEqual(emptyColumnHint(glowHint), { wasteId: "glow-24", columns: [0] });
glowHint.waste = [{ id: "glow-26b", value: 26, multiplier: 2, suit: "spades", faceUp: true }];
glowHint.tableau[0] = [{ id: "blocker", value: 8, multiplier: 2, suit: "clubs", faceUp: true }];
assert.equal(emptyColumnHint(glowHint), null);
glowHint.tableau[0] = [];
glowHint.stock = [{ id: "next-draw", value: 4, multiplier: 2, suit: "diamonds", faceUp: false }];
assert.ok(emptyColumnHint(glowHint));
assert.equal(drawFromStock(glowHint), "draw");
assert.equal(glowHint.waste.at(-1)?.id, "next-draw");
assert.deepEqual(emptyColumnHint(glowHint), { wasteId: "next-draw", columns: [0] });

const glowPlayed = dealKlondike(2, rngFrom(20));
glowPlayed.tableau[6] = [];
glowPlayed.waste = [{ id: "play-26", value: 26, multiplier: 2, suit: "clubs", faceUp: true }];
assert.ok(emptyColumnHint(glowPlayed));
assert.equal(playToTableau(glowPlayed, "play-26", 6), true);
assert.equal(emptyColumnHint(glowPlayed), null, "hint stops after the king fills the empty column");

const glowLevel3 = dealKlondike(3, rngFrom(21));
glowLevel3.tableau[1] = [];
glowLevel3.tableau[4] = [];
glowLevel3.waste = [{ id: "glow-39", value: 39, multiplier: 3, suit: "diamonds", faceUp: true }];
assert.deepEqual(emptyColumnHint(glowLevel3), { wasteId: "glow-39", columns: [1, 4] });

const heartsPlay = dealKlondike(2, rngFrom(6));
heartsPlay.waste = [{ id: "waste-2h", value: 2, multiplier: 2, suit: "hearts", faceUp: true }];
heartsPlay.tableau[4] = [{ id: "tab-4h", value: 4, multiplier: 2, suit: "hearts", faceUp: true }];
assert.equal(canStackOnTableau(heartsPlay, heartsPlay.waste[0]!, 4), true);
assert.equal(playToTableau(heartsPlay, "waste-2h", 4), true);
assert.equal(heartsPlay.waste.length, 0);
assert.equal(heartsPlay.tableau[4]?.at(-1)?.id, "waste-2h");
assert.equal(playToTableau(heartsPlay, "waste-2h", 4), false);

const sameSuitRun = dealKlondike(2, rngFrom(8));
sameSuitRun.tableau[5] = [
  { id: "run-4h", value: 4, multiplier: 2, suit: "hearts", faceUp: true },
  { id: "run-2h", value: 2, multiplier: 2, suit: "hearts", faceUp: true },
];
assert.ok(runFrom(sameSuitRun, "run-4h")?.length === 2);
assert.equal(playToTableau(sameSuitRun, "run-4h", 4), false);
sameSuitRun.tableau[6] = [{ id: "run-6h", value: 6, multiplier: 2, suit: "hearts", faceUp: true }];
assert.equal(playToTableau(sameSuitRun, "run-4h", 6), true);
assert.deepEqual(
  sameSuitRun.tableau[6]?.map((card) => card.id),
  ["run-6h", "run-4h", "run-2h"],
);

const autoWaste = dealKlondike(2, rngFrom(30));
const wasteTwo = { id: "home-2d", value: 2, multiplier: 2, suit: "diamonds" as const, faceUp: true };
autoWaste.waste = [wasteTwo];
assert.equal(canAutoHome(autoWaste, "home-2d"), true);
assert.equal(playToFoundation(autoWaste, "home-2d"), true);
assert.equal(autoWaste.waste.length, 0);
assert.equal(autoWaste.foundations[1]?.at(-1)?.id, "home-2d");
assert.equal(canAutoHome(autoWaste, "home-2d"), false);

const wasteFour = dealKlondike(2, rngFrom(31));
wasteFour.waste = [{ id: "home-4s", value: 4, multiplier: 2, suit: "spades", faceUp: true }];
assert.equal(canAutoHome(wasteFour, "home-4s"), false);
assert.equal(playToFoundation(wasteFour, "home-4s"), false);
wasteFour.foundations[3] = [{ id: "home-2s", value: 2, multiplier: 2, suit: "spades", faceUp: true }];
assert.equal(canAutoHome(wasteFour, "home-4s"), true);
assert.equal(playToFoundation(wasteFour, "home-4s"), true);
assert.equal(wasteFour.foundations[3]?.at(-1)?.id, "home-4s");

const tabHome = dealKlondike(2, rngFrom(32));
tabHome.tableau[2] = [
  { id: "buried-8", value: 8, multiplier: 2, suit: "clubs", faceUp: true },
  { id: "tab-2c", value: 2, multiplier: 2, suit: "clubs", faceUp: true },
];
assert.equal(canAutoHome(tabHome, "buried-8"), false);
assert.equal(canAutoHome(tabHome, "tab-2c"), true);
assert.equal(playToFoundation(tabHome, "tab-2c"), true);
assert.equal(tabHome.tableau[2]?.at(-1)?.id, "buried-8");
assert.equal(tabHome.foundations[2]?.at(-1)?.id, "tab-2c");

const cascade = dealKlondike(2, rngFrom(33));
cascade.foundations = [[], [], [], []];
cascade.waste = [{ id: "cas-2h", value: 2, multiplier: 2, suit: "hearts", faceUp: true }];
cascade.tableau[0] = [{ id: "cas-4h", value: 4, multiplier: 2, suit: "hearts", faceUp: true }];
assert.deepEqual(autoHomeAll(cascade), ["cas-2h", "cas-4h"]);
assert.equal(cascade.waste.length, 0);
assert.equal(cascade.tableau[0]?.length, 0);
assert.equal(cascade.foundations[0]?.map((card) => card.value).join(","), "2,4");

const lv4 = dealKlondike(4, rngFrom(44));
assert.equal(lv4.multiplier, 4);
assert.equal(lv4.highest, 52);
const card20 = { id: "lv4-20", value: 20, multiplier: 4, suit: "hearts" as const, faceUp: true };
const card24 = { id: "lv4-24", value: 24, multiplier: 4, suit: "clubs" as const, faceUp: true };
const card32 = { id: "lv4-32", value: 32, multiplier: 4, suit: "spades" as const, faceUp: true };
const card36 = { id: "lv4-36", value: 36, multiplier: 4, suit: "diamonds" as const, faceUp: true };
assert.equal(canPlaceOnCard(lv4, card20, card24), true, "level 4: 20 stacks on 24");
assert.equal(canPlaceOnCard(lv4, card32, card20), false, "level 4: 32 must not stack on 20");
assert.equal(canPlaceOnCard(lv4, card36, card20), false, "level 4: 36 must not stack on 20");
assert.equal(canPlaceOnCard(lv4, card24, card20), false, "level 4: never build up");
assert.equal(canPlaceOnCard(lv4, card32, card36), true);

const waste20on24 = dealKlondike(4, rngFrom(45));
waste20on24.waste = [{ ...card20 }];
waste20on24.tableau[2] = [{ ...card24 }];
assert.equal(canStackOnTableau(waste20on24, card20, 2), true);
assert.equal(playToTableau(waste20on24, "lv4-20", 2), true);
assert.equal(waste20on24.tableau[2]?.at(-1)?.id, "lv4-20");
assert.equal(waste20on24.waste.length, 0);
assert.equal(isLegalTableauPiles(waste20on24), true);

const tab20on24 = dealKlondike(4, rngFrom(46));
tab20on24.tableau[0] = [{ id: "tab-20h", value: 20, multiplier: 4, suit: "hearts", faceUp: true }];
tab20on24.tableau[6] = [{ id: "tab-24c", value: 24, multiplier: 4, suit: "clubs", faceUp: true }];
assert.equal(playToTableau(tab20on24, "tab-20h", 6), true);
assert.deepEqual(
  tab20on24.tableau[6]?.map((card) => card.value),
  [24, 20],
);
assert.equal(isLegalTableauPiles(tab20on24), true);

const rejectUp = dealKlondike(4, rngFrom(47));
rejectUp.tableau[1] = [{ id: "base-20", value: 20, multiplier: 4, suit: "hearts", faceUp: true }];
rejectUp.waste = [{ id: "up-32", value: 32, multiplier: 4, suit: "clubs", faceUp: true }];
assert.equal(canStackOnTableau(rejectUp, rejectUp.waste[0]!, 1), false);
assert.equal(playToTableau(rejectUp, "up-32", 1), false);
assert.equal(rejectUp.tableau[1]?.at(-1)?.id, "base-20");
rejectUp.waste = [{ id: "up-36", value: 36, multiplier: 4, suit: "spades", faceUp: true }];
assert.equal(playToTableau(rejectUp, "up-36", 1), false);
assert.deepEqual(
  rejectUp.tableau[1]?.map((card) => card.value),
  [20],
);

const rejectRunOn20 = dealKlondike(4, rngFrom(53));
rejectRunOn20.tableau = rejectRunOn20.tableau.map(() => []);
rejectRunOn20.waste = [];
rejectRunOn20.stock = [];
rejectRunOn20.tableau[0] = [{ id: "dest-20", value: 20, multiplier: 4, suit: "hearts", faceUp: true }];
rejectRunOn20.tableau[1] = [
  { id: "run-36d", value: 36, multiplier: 4, suit: "diamonds", faceUp: true },
  { id: "run-32d", value: 32, multiplier: 4, suit: "diamonds", faceUp: true },
];
assert.equal(canStackOnTableau(rejectRunOn20, rejectRunOn20.tableau[1]![0]!, 0), false);
assert.equal(playToTableau(rejectRunOn20, "run-36d", 0), false, "36-32 run must not auto-stack onto 20");
assert.deepEqual(
  rejectRunOn20.tableau[0]?.map((card) => card.value),
  [20],
);
assert.deepEqual(
  rejectRunOn20.tableau[1]?.map((card) => card.value),
  [36, 32],
);
assert.equal(isLegalTableauPiles(rejectRunOn20), true);

const midYank = dealKlondike(4, rngFrom(48));
midYank.foundations = [[], [], [], []];
midYank.tableau[3] = [
  { id: "run-36s", value: 36, multiplier: 4, suit: "spades", faceUp: true },
  { id: "run-32s", value: 32, multiplier: 4, suit: "spades", faceUp: true },
  { id: "run-28s", value: 28, multiplier: 4, suit: "spades", faceUp: true },
  { id: "run-24s", value: 24, multiplier: 4, suit: "spades", faceUp: true },
  { id: "run-20s", value: 20, multiplier: 4, suit: "spades", faceUp: true },
];
const midBefore = midYank.tableau[3]!.map((card) => card.id);
assert.equal(canAutoHome(midYank, "run-28s"), false, "buried mid-run card is not homeable");
assert.equal(canAutoHome(midYank, "run-24s"), false);
assert.equal(canAutoHome(midYank, "run-20s"), false);
assert.equal(playToFoundation(midYank, "run-28s"), false);
assert.equal(playToFoundation(midYank, "run-24s"), false);
assert.deepEqual(midYank.tableau[3]?.map((card) => card.id), midBefore);
assert.equal(runFrom(midYank, "run-28s")?.length, 3);
assert.equal(removeRun(midYank, "run-32s").length, 4);
assert.deepEqual(
  midYank.tableau[3]?.map((card) => card.value),
  [36],
  "moving a legal suffix keeps the cards above; never leaves a lone orphan 20",
);

const orphanGuard = dealKlondike(4, rngFrom(49));
orphanGuard.tableau[2] = [
  { id: "gap-36", value: 36, multiplier: 4, suit: "hearts", faceUp: true },
  { id: "gap-32", value: 32, multiplier: 4, suit: "clubs", faceUp: true },
  { id: "gap-20", value: 20, multiplier: 4, suit: "spades", faceUp: true },
];
assert.equal(isLegalTableauPiles(orphanGuard), false);
assert.equal(runFrom(orphanGuard, "gap-36"), null);
assert.equal(runFrom(orphanGuard, "gap-32"), null);
assert.deepEqual(removeRun(orphanGuard, "gap-32"), []);
assert.deepEqual(
  orphanGuard.tableau[2]?.map((card) => card.value),
  [36, 32, 20],
  "cannot yank a mid card out of a broken column",
);
assert.equal(playToFoundation(orphanGuard, "gap-32"), false);
assert.equal(canAutoHome(orphanGuard, "gap-20"), false);

const autoTops = dealKlondike(4, rngFrom(50));
autoTops.foundations = [
  [
    { id: "h4", value: 4, multiplier: 4, suit: "hearts", faceUp: true },
    { id: "h8", value: 8, multiplier: 4, suit: "hearts", faceUp: true },
    { id: "h12", value: 12, multiplier: 4, suit: "hearts", faceUp: true },
    { id: "h16", value: 16, multiplier: 4, suit: "hearts", faceUp: true },
  ],
  [],
  [],
  [],
];
const buriedHome = { id: "buried-20h", value: 20, multiplier: 4, suit: "hearts", faceUp: true };
const wasteTop20 = { id: "waste-20h", value: 20, multiplier: 4, suit: "hearts", faceUp: true };
autoTops.waste = [buriedHome, wasteTop20];
autoTops.tableau = autoTops.tableau.map(() => []);
autoTops.tableau[0] = [
  { id: "col-24c", value: 24, multiplier: 4, suit: "clubs", faceUp: false },
  { id: "col-8c", value: 8, multiplier: 4, suit: "clubs", faceUp: true },
];
autoTops.stock = [];
assert.equal(canAutoHome(autoTops, "buried-20h"), false);
assert.equal(playToFoundation(autoTops, "buried-20h"), false);
assert.equal(canAutoHome(autoTops, "waste-20h"), true);
assert.equal(hasTableauDrop(autoTops, "waste-20h"), false);
assert.ok(playableFoundationIds(autoTops).includes("waste-20h"));
assert.equal(canAutoHome(autoTops, "col-24c"), false);
assert.equal(playToFoundation(autoTops, "col-24c"), false);
assert.equal(autoTops.tableau[0]?.at(-1)?.id, "col-8c");
assert.deepEqual(autoHomeAll(autoTops), ["waste-20h"]);
assert.equal(autoTops.waste.at(-1)?.id, "buried-20h");
assert.equal(autoTops.foundations[0]?.at(-1)?.id, "waste-20h");
assert.equal(isLegalTableauPiles(autoTops), true);

const keepFor24 = dealKlondike(4, rngFrom(51));
keepFor24.foundations = [
  [{ id: "keep-16h", value: 16, multiplier: 4, suit: "hearts", faceUp: true }],
  [],
  [],
  [],
];
keepFor24.waste = [{ id: "keep-20h", value: 20, multiplier: 4, suit: "hearts", faceUp: true }];
keepFor24.tableau = keepFor24.tableau.map(() => []);
keepFor24.tableau[5] = [{ id: "keep-24c", value: 24, multiplier: 4, suit: "clubs", faceUp: true }];
keepFor24.stock = [];
assert.equal(canAutoHome(keepFor24, "keep-20h"), true, "double-tap may still home 20");
assert.equal(hasTableauDrop(keepFor24, "keep-20h"), true);
assert.equal(playableFoundationIds(keepFor24, true).includes("keep-20h"), false);
assert.deepEqual(autoHomeAll(keepFor24, true), []);
assert.equal(keepFor24.waste.at(-1)?.id, "keep-20h");
assert.equal(playToTableau(keepFor24, "keep-20h", 5), true);
assert.deepEqual(
  keepFor24.tableau[5]?.map((card) => card.value),
  [24, 20],
);
assert.equal(isLegalTableauPiles(keepFor24), true);

const homeAfterRun = dealKlondike(4, rngFrom(52));
homeAfterRun.foundations = [
  [],
  [],
  [],
  [
    { id: "s4", value: 4, multiplier: 4, suit: "spades", faceUp: true },
    { id: "s8", value: 8, multiplier: 4, suit: "spades", faceUp: true },
    { id: "s12", value: 12, multiplier: 4, suit: "spades", faceUp: true },
    { id: "s16", value: 16, multiplier: 4, suit: "spades", faceUp: true },
  ],
];
homeAfterRun.tableau = homeAfterRun.tableau.map(() => []);
homeAfterRun.waste = [];
homeAfterRun.stock = [];
homeAfterRun.tableau[4] = [
  { id: "seq-36s", value: 36, multiplier: 4, suit: "spades", faceUp: true },
  { id: "seq-32s", value: 32, multiplier: 4, suit: "spades", faceUp: true },
  { id: "seq-28s", value: 28, multiplier: 4, suit: "spades", faceUp: true },
  { id: "seq-24s", value: 24, multiplier: 4, suit: "spades", faceUp: true },
  { id: "seq-20s", value: 20, multiplier: 4, suit: "spades", faceUp: true },
];
assert.equal(isLegalTableauPiles(homeAfterRun), true);
assert.deepEqual(autoHomeAll(homeAfterRun), ["seq-20s", "seq-24s", "seq-28s", "seq-32s", "seq-36s"]);
assert.equal(homeAfterRun.tableau[4]?.length, 0);
assert.equal(isLegalTableauPiles(homeAfterRun), true);

console.log("rules tests passed");
