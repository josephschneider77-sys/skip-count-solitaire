import { multiplesUpTo } from "./rules";

export type IconKind =
  | "heart"
  | "star"
  | "butterfly"
  | "flower"
  | "rainbow"
  | "dolphin"
  | "unicorn"
  | "kitty"
  | "sparkle";

export type DeckTheme = {
  multiplier: number;
  name: string;
  label: string;
  ink: string;
  face: string;
  faceEdge: string;
  back: string;
  backInk: string;
  accent: string;
  accent2: string;
  glow: string;
  icon: IconKind;
};

export const DECK_THEMES: Record<number, DeckTheme> = {
  2: {
    multiplier: 2,
    name: "Heart Twos",
    label: "2's",
    ink: "#c2186a",
    face: "#fff4fb",
    faceEdge: "#ff8ad8",
    back: "#ff4fd8",
    backInk: "#fff7fd",
    accent: "#ff8ad8",
    accent2: "#ffe36a",
    glow: "#ff7ad6",
    icon: "heart",
  },
  3: {
    multiplier: 3,
    name: "Sunny Threes",
    label: "3's",
    ink: "#c26b00",
    face: "#fff8e8",
    faceEdge: "#ffd36a",
    back: "#ffbf1a",
    backInk: "#5a2d00",
    accent: "#ffe36a",
    accent2: "#ff8ad8",
    glow: "#ffd24a",
    icon: "star",
  },
  4: {
    multiplier: 4,
    name: "Butterfly Fours",
    label: "4's",
    ink: "#7a2ad1",
    face: "#f7f0ff",
    faceEdge: "#c9a0ff",
    back: "#b56bff",
    backInk: "#fff7ff",
    accent: "#c9a0ff",
    accent2: "#7dffd8",
    glow: "#c086ff",
    icon: "butterfly",
  },
  5: {
    multiplier: 5,
    name: "Flower Fives",
    label: "5's",
    ink: "#c43a00",
    face: "#fff3ec",
    faceEdge: "#ff9d6a",
    back: "#ff6b3d",
    backInk: "#fff7f2",
    accent: "#ff9d6a",
    accent2: "#ffe36a",
    glow: "#ff8a5a",
    icon: "flower",
  },
  6: {
    multiplier: 6,
    name: "Mermaid Sixes",
    label: "6's",
    ink: "#087a6a",
    face: "#ecfffb",
    faceEdge: "#6ef0d6",
    back: "#19d4b0",
    backInk: "#02382f",
    accent: "#6ef0d6",
    accent2: "#89d4ff",
    glow: "#4ae8c8",
    icon: "dolphin",
  },
  7: {
    multiplier: 7,
    name: "Unicorn Sevens",
    label: "7's",
    ink: "#6b1aa8",
    face: "#fbf4ff",
    faceEdge: "#d9a8ff",
    back: "#8a4dff",
    backInk: "#fff8ff",
    accent: "#d9a8ff",
    accent2: "#ff8ad8",
    glow: "#c86bff",
    icon: "unicorn",
  },
  8: {
    multiplier: 8,
    name: "Dolphin Eights",
    label: "8's",
    ink: "#0a4f9c",
    face: "#eef8ff",
    faceEdge: "#7ec8ff",
    back: "#2ea7ff",
    backInk: "#f4fbff",
    accent: "#7ec8ff",
    accent2: "#7dffd8",
    glow: "#4db6ff",
    icon: "dolphin",
  },
  9: {
    multiplier: 9,
    name: "Kitty Nines",
    label: "9's",
    ink: "#9b2d6b",
    face: "#fff0f7",
    faceEdge: "#ff9ecb",
    back: "#ff6bab",
    backInk: "#fff7fb",
    accent: "#ff9ecb",
    accent2: "#c9a0ff",
    glow: "#ff7eb6",
    icon: "kitty",
  },
  10: {
    multiplier: 10,
    name: "Rainbow Tens",
    label: "10's",
    ink: "#6b2ad1",
    face: "#fff7ff",
    faceEdge: "#ffb3ec",
    back: "#ff4fd8",
    backInk: "#fffdf7",
    accent: "#ffb3ec",
    accent2: "#7ec8ff",
    glow: "#ff86e0",
    icon: "rainbow",
  },
};

export function themeFor(multiplier: number): DeckTheme {
  return DECK_THEMES[multiplier] ?? DECK_THEMES[2];
}

/** Every level is 13 skip-count ranks × 4 suits (52 cards). */
export function deckValues(multiplier: number): number[] {
  return multiplesUpTo(multiplier);
}
