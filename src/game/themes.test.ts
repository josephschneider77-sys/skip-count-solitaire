import assert from "node:assert/strict";
import { confettiThemeFor } from "./themes.ts";

const motifs = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
  const theme = confettiThemeFor(level);
  assert.equal(theme.multiplier, level);
  assert.ok(theme.colors.length >= 4);
  assert.ok(theme.icons.length >= 1);
  assert.ok(theme.density >= 80);
  return `${theme.icons.join("+")}|${theme.colors[0]}|${theme.density}`;
});
assert.equal(new Set(motifs).size, 9, "each level needs its own confetti palette or motif");
assert.ok(confettiThemeFor(2).icons.includes("heart"));
assert.ok(confettiThemeFor(3).icons.includes("star"));
assert.ok(confettiThemeFor(4).icons.includes("butterfly"));
assert.ok(confettiThemeFor(5).icons.includes("flower"));
assert.ok(confettiThemeFor(9).icons.includes("kitty"));
assert.ok(confettiThemeFor(10).icons.includes("rainbow"));
assert.ok(confettiThemeFor(10).density > confettiThemeFor(2).density);
assert.notEqual(confettiThemeFor(6).colors[0], confettiThemeFor(8).colors[0]);

console.log("themes tests passed");
