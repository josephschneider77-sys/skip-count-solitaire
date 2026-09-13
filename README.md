# Skip Count Solitaire

Kid-safe **Klondike** with Lisa Frank neon style and skip-count decks. One multiplier per level. Four suits.

Play here: https://josephschneider77-sys.github.io/skip-count-solitaire/

## Deck

Classic **52-card** decks (13 ranks × 4 suits), but ranks are skip-count multiples instead of A–K. Level **N** uses N, 2N, …, 13N in **♥ ♦ ♣ ♠**.

- Level 2: 2, 4, …, 26
- Level 3: 3, 6, …, 39
- Level 4: 4, 8, …, 52
- … through Level 10: 10, 20, …, 130

## How to play

Classic 7-column Klondike plus a draw pile and waste.

1. Build each suit’s **home** by skip-counting (same suit, up by N). Homes start with N itself.
2. On the tableau, stack the **next-smaller** multiple (skip-count down by N). Suit and color do not matter.
3. Empty columns want the **biggest** multiple (the “king”).
4. Tap the deck to draw and flip. Face-down cards flip when uncovered.

## Develop

```bash
npm install
npm test
npm run dev
npm run build
```

Vite `base` is `/skip-count-solitaire/` for GitHub Pages. Browser game only — no Play Store listing.
