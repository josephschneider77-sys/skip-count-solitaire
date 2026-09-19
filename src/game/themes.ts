import { multiplesUpTo } from "./rules.ts";

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
    name: "Purple Hearts",
    label: "2's",
    ink: "#6b1aa8",
    face: "#fff4ff",
    faceEdge: "#ff4ad8",
    back: "#8a2be2",
    backInk: "#fff7ff",
    accent: "#c77dff",
    accent2: "#ffe14a",
    glow: "#e56bff",
    icon: "heart",
  },
  3: {
    multiplier: 3,
    name: "Sunny Stars",
    label: "3's",
    ink: "#c26b00",
    face: "#fff8e8",
    faceEdge: "#ffe14a",
    back: "#ffbf1a",
    backInk: "#5a2d00",
    accent: "#ffe14a",
    accent2: "#ff4ad8",
    glow: "#ffd24a",
    icon: "star",
  },
  4: {
    multiplier: 4,
    name: "Butterfly Fours",
    label: "4's",
    ink: "#5b12b8",
    face: "#f7f0ff",
    faceEdge: "#b56bff",
    back: "#7a5cff",
    backInk: "#fff7ff",
    accent: "#c77dff",
    accent2: "#3dff8a",
    glow: "#c086ff",
    icon: "butterfly",
  },
  5: {
    multiplier: 5,
    name: "Flower Fives",
    label: "5's",
    ink: "#c43a00",
    face: "#fff3ec",
    faceEdge: "#ff7a1a",
    back: "#ff6b3d",
    backInk: "#fff7f2",
    accent: "#ff7a1a",
    accent2: "#ffe14a",
    glow: "#ff8a5a",
    icon: "flower",
  },
  6: {
    multiplier: 6,
    name: "Mermaid Sixes",
    label: "6's",
    ink: "#087a6a",
    face: "#ecfffb",
    faceEdge: "#3dff8a",
    back: "#12d4c8",
    backInk: "#02382f",
    accent: "#3dff8a",
    accent2: "#3ad4ff",
    glow: "#4ae8c8",
    icon: "dolphin",
  },
  7: {
    multiplier: 7,
    name: "Unicorn Sevens",
    label: "7's",
    ink: "#6b1aa8",
    face: "#fbf4ff",
    faceEdge: "#e56bff",
    back: "#8a2be2",
    backInk: "#fff8ff",
    accent: "#e56bff",
    accent2: "#ff4ad8",
    glow: "#c86bff",
    icon: "unicorn",
  },
  8: {
    multiplier: 8,
    name: "Dolphin Eights",
    label: "8's",
    ink: "#0a4f9c",
    face: "#eef8ff",
    faceEdge: "#3ad4ff",
    back: "#2ea7ff",
    backInk: "#f4fbff",
    accent: "#3ad4ff",
    accent2: "#3dff8a",
    glow: "#4db6ff",
    icon: "dolphin",
  },
  9: {
    multiplier: 9,
    name: "Kitty Nines",
    label: "9's",
    ink: "#8a1490",
    face: "#fff0f7",
    faceEdge: "#ff4ad8",
    back: "#ff4ad8",
    backInk: "#fff7fb",
    accent: "#ff4ad8",
    accent2: "#c77dff",
    glow: "#ff7eb6",
    icon: "kitty",
  },
  10: {
    multiplier: 10,
    name: "Rainbow Tens",
    label: "10's",
    ink: "#5b12b8",
    face: "#fff7ff",
    faceEdge: "#ff4ad8",
    back: "#7a5cff",
    backInk: "#fffdf7",
    accent: "#ff4ad8",
    accent2: "#3ad4ff",
    glow: "#ffe14a",
    icon: "rainbow",
  },
};

export function themeFor(multiplier: number): DeckTheme {
  return DECK_THEMES[multiplier] ?? DECK_THEMES[2];
}

export type ConfettiTheme = {
  multiplier: number;
  colors: string[];
  icons: IconKind[];
  density: number;
};

const CONFETTI_THEMES: Record<number, ConfettiTheme> = {
  2: {
    multiplier: 2,
    colors: ["#c77dff", "#ff4ad8", "#e56bff", "#ffe14a", "#fff4ff", "#8a2be2"],
    icons: ["heart", "sparkle"],
    density: 88,
  },
  3: {
    multiplier: 3,
    colors: ["#ffe14a", "#ffbf1a", "#ff4ad8", "#fff8e8", "#ffd24a", "#c26b00"],
    icons: ["star", "sparkle"],
    density: 96,
  },
  4: {
    multiplier: 4,
    colors: ["#7a5cff", "#c77dff", "#3dff8a", "#f7f0ff", "#c086ff", "#5b12b8"],
    icons: ["butterfly", "sparkle"],
    density: 104,
  },
  5: {
    multiplier: 5,
    colors: ["#ff7a1a", "#ff6b3d", "#ffe14a", "#fff3ec", "#ff8a5a", "#c43a00"],
    icons: ["flower", "sparkle"],
    density: 112,
  },
  6: {
    multiplier: 6,
    colors: ["#3dff8a", "#12d4c8", "#3ad4ff", "#ecfffb", "#4ae8c8", "#087a6a"],
    icons: ["dolphin", "sparkle"],
    density: 120,
  },
  7: {
    multiplier: 7,
    colors: ["#e56bff", "#ff4ad8", "#c86bff", "#fbf4ff", "#ffe14a", "#8a2be2"],
    icons: ["unicorn", "heart"],
    density: 128,
  },
  8: {
    multiplier: 8,
    colors: ["#3ad4ff", "#2ea7ff", "#3dff8a", "#eef8ff", "#4db6ff", "#0a4f9c"],
    icons: ["dolphin", "star"],
    density: 136,
  },
  9: {
    multiplier: 9,
    colors: ["#ff4ad8", "#ff7eb6", "#c77dff", "#fff0f7", "#ffe14a", "#8a1490"],
    icons: ["kitty", "heart"],
    density: 148,
  },
  10: {
    multiplier: 10,
    colors: ["#ff2d6a", "#ff7a1a", "#ffe14a", "#3dff8a", "#3ad4ff", "#8a2be2", "#ff4ad8"],
    icons: ["rainbow", "star", "heart", "sparkle"],
    density: 168,
  },
};

export function confettiThemeFor(multiplier: number): ConfettiTheme {
  return CONFETTI_THEMES[multiplier] ?? CONFETTI_THEMES[2]!;
}

/** Every level is 13 skip-count ranks × 4 suits (52 cards). */
export function deckValues(multiplier: number): number[] {
  return multiplesUpTo(multiplier);
}
