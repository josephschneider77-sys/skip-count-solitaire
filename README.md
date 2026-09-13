# Skip Count Solitaire

Kid-safe **Klondike** with Lisa Frank neon style and skip-count decks. One multiplier per level. Four suits.

Play here: https://josephschneider77-sys.github.io/skip-count-solitaire/

## Deck

Not a 52-card A–K deck. Level **N** uses every multiple of N up to about 100, in **♥ ♦ ♣ ♠**.

- Level 2: 2, 4, 6, …, 100 × 4 suits (200 cards)
- Level 3: 3, 6, 9, …, 99 × 4 suits
- … through Level 10: 10, 20, …, 100 × 4 suits

## How to play

Classic 7-column Klondike plus a draw pile and waste.

1. Build each suit’s **home** by skip-counting (same suit, up by N). Homes start with N itself.
2. On the tableau, stack the **next-smaller** multiple and **switch colors** (red/black).
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
