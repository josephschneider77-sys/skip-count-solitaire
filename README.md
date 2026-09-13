# Skip Count Solitaire

A kid-safe skip-counting card game in a Lisa Frank neon style. Each level uses **one themed deck** and one multiplier at a time.

Play here: https://josephschneider77-sys.github.io/skip-count-solitaire/

## How to play

1. Open the title screen and tap **Play** (or pick a level).
2. Level 2 is multiples of 2 up to 100. Levels 3–10 are that number times 1 through 10 (sevens go through 70, tens through 100).
3. Tap the deck to **draw and flip** a 3D card.
4. Tap the next skip-count number to place it on the sparkle foundation.
5. You can also stack a smaller multiple onto a bigger one (down by the same skip) to reach buried cards.

## Cards

Faces follow Joe’s paper draft: corner values, a center **N’s** label, and cute theme icons. Every multiplier has its own rainbow deck.

## Develop

```bash
npm install
npm run dev
```

Production build for GitHub Pages uses Vite `base: '/skip-count-solitaire/'`.

```bash
npm run build
```

No Play Store listing — this is a browser game only.
