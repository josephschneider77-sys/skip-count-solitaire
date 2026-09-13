import * as THREE from "three";
import { SUIT_COLOR, SUIT_GLYPH, type Suit } from "./rules";
import type { DeckTheme, IconKind } from "./themes";

const FACE_W = 512;
const FACE_H = 768;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

const RAINBOW = ["#ff2d6a", "#ff7a1a", "#ffe14a", "#3dff8a", "#3ad4ff", "#7a5cff", "#ff4ad8"];

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-16, -8, -18, 10, 0, 20);
  ctx.bezierCurveTo(18, 10, 16, -8, 0, 6);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  const spikes = 5;
  const outer = size / 2;
  const inner = size / 5;
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i += 1) {
    const angle = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * size * 0.28, Math.sin(angle) * size * 0.28, size * 0.22, size * 0.16, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffe14a";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-size * 0.22, -size * 0.08, size * 0.28, size * 0.2, -0.4, 0, Math.PI * 2);
  ctx.ellipse(size * 0.22, -size * 0.08, size * 0.28, size * 0.2, 0.4, 0, Math.PI * 2);
  ctx.ellipse(-size * 0.18, size * 0.16, size * 0.18, size * 0.14, 0.3, 0, Math.PI * 2);
  ctx.ellipse(size * 0.18, size * 0.16, size * 0.18, size * 0.14, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a2d7a";
  ctx.fillRect(-size * 0.03, -size * 0.28, size * 0.06, size * 0.56);
  ctx.restore();
}

function drawDolphin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.2, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.28, -size * 0.08);
  ctx.quadraticCurveTo(size * 0.5, -size * 0.32, size * 0.12, -size * 0.22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size * 0.36, 0.04 * size);
  ctx.quadraticCurveTo(-size * 0.55, -size * 0.18, -size * 0.22, -size * 0.02);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(size * 0.16, -size * 0.04, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKitty(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  drawRainbowKitty(ctx, x, y, size, color, false);
}

function drawRainbowKitty(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  withRainbow = true,
): void {
  ctx.save();
  ctx.translate(x, y);
  if (withRainbow) {
    ctx.save();
    ctx.translate(0, -size * 0.08);
    RAINBOW.forEach((stripe, i) => {
      ctx.strokeStyle = stripe;
      ctx.lineWidth = size * 0.055;
      ctx.beginPath();
      ctx.arc(0, size * 0.02, size * 0.42 - i * size * 0.055, Math.PI, 0);
      ctx.stroke();
    });
    ctx.restore();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.2, size * 0.3, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -size * 0.06, size * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size * 0.18, -size * 0.18);
  ctx.lineTo(-size * 0.3, -size * 0.46);
  ctx.lineTo(-size * 0.02, -size * 0.26);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.18, -size * 0.18);
  ctx.lineTo(size * 0.3, -size * 0.46);
  ctx.lineTo(size * 0.02, -size * 0.26);
  ctx.fill();
  ctx.fillStyle = "#ffb3ec";
  ctx.beginPath();
  ctx.moveTo(-size * 0.16, -size * 0.2);
  ctx.lineTo(-size * 0.24, -size * 0.36);
  ctx.lineTo(-size * 0.08, -size * 0.24);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.16, -size * 0.2);
  ctx.lineTo(size * 0.24, -size * 0.36);
  ctx.lineTo(size * 0.08, -size * 0.24);
  ctx.fill();
  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.arc(-size * 0.08, -size * 0.08, size * 0.055, 0, Math.PI * 2);
  ctx.arc(size * 0.08, -size * 0.08, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1040";
  ctx.beginPath();
  ctx.arc(-size * 0.08, -size * 0.08, size * 0.028, 0, Math.PI * 2);
  ctx.arc(size * 0.08, -size * 0.08, size * 0.028, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff4ad8";
  ctx.beginPath();
  ctx.moveTo(0, size * 0.01);
  ctx.lineTo(-size * 0.04, size * 0.07);
  ctx.lineTo(size * 0.04, size * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2a1040";
  ctx.lineWidth = Math.max(1.2, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(-size * 0.06, size * 0.05);
  ctx.lineTo(-size * 0.28, size * 0.02);
  ctx.moveTo(-size * 0.06, size * 0.07);
  ctx.lineTo(-size * 0.26, size * 0.1);
  ctx.moveTo(size * 0.06, size * 0.05);
  ctx.lineTo(size * 0.28, size * 0.02);
  ctx.moveTo(size * 0.06, size * 0.07);
  ctx.lineTo(size * 0.26, size * 0.1);
  ctx.stroke();
  ctx.restore();
}

function drawUnicorn(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  drawHeart(ctx, 0, size * 0.04, size * 0.72, color);
  ctx.fillStyle = "#ffe14a";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.42);
  ctx.lineTo(size * 0.08, -size * 0.08);
  ctx.lineTo(-size * 0.08, -size * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRainbow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  RAINBOW.forEach((color, i) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.075;
    ctx.beginPath();
    ctx.arc(0, size * 0.18, size * 0.46 - i * size * 0.075, Math.PI, 0);
    ctx.stroke();
  });
  ctx.restore();
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.quadraticCurveTo(size * 0.08, 0, 0, size / 2);
  ctx.quadraticCurveTo(-size * 0.08, 0, 0, -size / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size / 2, 0);
  ctx.quadraticCurveTo(0, size * 0.08, size / 2, 0);
  ctx.quadraticCurveTo(0, -size * 0.08, -size / 2, 0);
  ctx.fill();
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, x: number, y: number, size: number, color: string): void {
  switch (kind) {
    case "heart":
      drawHeart(ctx, x, y, size, color);
      break;
    case "star":
      drawStar(ctx, x, y, size, color);
      break;
    case "flower":
      drawFlower(ctx, x, y, size, color);
      break;
    case "butterfly":
      drawButterfly(ctx, x, y, size, color);
      break;
    case "dolphin":
      drawDolphin(ctx, x, y, size, color);
      break;
    case "kitty":
      drawKitty(ctx, x, y, size, color);
      break;
    case "unicorn":
      drawUnicorn(ctx, x, y, size, color);
      break;
    case "rainbow":
      drawRainbow(ctx, x, y, size);
      break;
    case "sparkle":
      drawSparkle(ctx, x, y, size, color);
      break;
    default:
      drawStar(ctx, x, y, size, color);
  }
}

function rainbowRibbon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const stripe = h / RAINBOW.length;
  RAINBOW.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y + i * stripe, w, stripe + 1);
  });
}

function glitter(ctx: CanvasRenderingContext2D, w: number, h: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const x = 24 + Math.random() * (w - 48);
    const y = 24 + Math.random() * (h - 48);
    ctx.fillStyle = `hsla(${Math.random() * 360}, 100%, ${72 + Math.random() * 22}%, ${0.22 + Math.random() * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + Math.random() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function fitRankFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferred: number,
  min: number,
): number {
  let size = preferred;
  ctx.font = `900 ${size}px 'Baloo 2', 'Trebuchet MS', sans-serif`;
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `900 ${size}px 'Baloo 2', 'Trebuchet MS', sans-serif`;
  }
  return size;
}

function drawRankBadge(
  ctx: CanvasRenderingContext2D,
  valueText: string,
  glyph: string,
  suitInk: string,
  rim: string,
  originX: number,
  originY: number,
  rotate: boolean,
): void {
  const preferred = valueText.length >= 3 ? 78 : valueText.length === 2 ? 92 : 104;
  const size = fitRankFont(ctx, valueText, 196, preferred, 48);
  ctx.font = `900 ${size}px 'Baloo 2', 'Trebuchet MS', sans-serif`;
  const tw = ctx.measureText(valueText).width;
  const badgeW = Math.min(240, Math.max(96, tw + 32));
  const badgeH = size + 52;

  ctx.save();
  if (rotate) {
    ctx.translate(originX, originY);
    ctx.rotate(Math.PI);
  } else {
    ctx.translate(originX, originY);
  }

  ctx.fillStyle = "rgba(255,253,250,0.98)";
  roundRect(ctx, 0, 0, badgeW, badgeH, 18);
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 5;
  roundRect(ctx, 0, 0, badgeW, badgeH, 18);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${size}px 'Baloo 2', 'Trebuchet MS', sans-serif`;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "#fffdf8";
  ctx.lineWidth = 6;
  ctx.strokeText(valueText, 14, size + 8);
  ctx.fillStyle = suitInk;
  ctx.fillText(valueText, 14, size + 8);
  ctx.font = "800 32px serif";
  ctx.strokeStyle = "#fffdf8";
  ctx.lineWidth = 4;
  ctx.strokeText(glyph, 14, size + 40);
  ctx.fillStyle = suitInk;
  ctx.fillText(glyph, 14, size + 40);
  ctx.restore();
}

function fillSheet(ctx: CanvasRenderingContext2D, style: string | CanvasGradient): void {
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not make card art");
  // BoxGeometry UVs include the four corners; leave no transparent/black pixels there.
  fillSheet(ctx, "#fffdf8");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function makeFaceTexture(theme: DeckTheme, value: number, suit: Suit): THREE.CanvasTexture {
  const suitInk = SUIT_COLOR[suit] === "red" ? "#d10f3a" : "#2a1040";
  const glyph = SUIT_GLYPH[suit];
  return makeTexture((ctx) => {
    const cream = ctx.createLinearGradient(0, 0, FACE_W, FACE_H);
    cream.addColorStop(0, "#fffdf8");
    cream.addColorStop(0.5, theme.face);
    cream.addColorStop(1, "#f6e9ff");
    fillSheet(ctx, cream);
    ctx.fillStyle = cream;
    roundRect(ctx, 0, 0, FACE_W, FACE_H, 56);
    ctx.fill();

    rainbowRibbon(ctx, 28, 22, FACE_W - 56, 16);
    rainbowRibbon(ctx, 28, FACE_H - 38, FACE_W - 56, 16);

    const rim = ctx.createLinearGradient(0, 0, FACE_W, FACE_H);
    rim.addColorStop(0, theme.accent);
    rim.addColorStop(0.35, "#ffe14a");
    rim.addColorStop(0.65, theme.accent2);
    rim.addColorStop(1, theme.accent);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 14;
    roundRect(ctx, 14, 14, FACE_W - 28, FACE_H - 28, 44);
    ctx.stroke();
    ctx.strokeStyle = theme.faceEdge;
    ctx.lineWidth = 4;
    roundRect(ctx, 28, 28, FACE_W - 56, FACE_H - 56, 34);
    ctx.stroke();

    glitter(ctx, FACE_W, FACE_H, 70);
    ctx.save();
    ctx.globalAlpha = 0.28;
    drawRainbow(ctx, FACE_W * 0.5, FACE_H * 0.7, 210);
    ctx.restore();

    const iconSpots: Array<[number, number, number]> = [
      [168, 268, 44],
      [344, 268, 44],
      [120, 410, 40],
      [392, 410, 40],
      [176, 548, 44],
      [336, 548, 44],
    ];
    iconSpots.forEach(([x, y, size], i) => {
      const color = i % 2 === 0 ? theme.accent : theme.accent2;
      drawIcon(ctx, theme.icon, x, y, size, color);
    });
    drawStar(ctx, 250, 200, 22, "#ffe14a");
    drawSparkle(ctx, 90, 300, 18, "rgba(255,255,255,0.85)");
    drawSparkle(ctx, 422, 320, 16, "rgba(58,212,255,0.85)");

    ctx.font = "800 72px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = suitInk;
    ctx.fillText(theme.label, FACE_W / 2, FACE_H / 2 - 10);
    ctx.font = "800 78px serif";
    ctx.fillText(glyph, FACE_W / 2, FACE_H / 2 + 62);

    const valueText = String(value);
    drawRankBadge(ctx, valueText, glyph, suitInk, theme.accent, 34, 44, false);
    drawRankBadge(ctx, valueText, glyph, suitInk, theme.accent, FACE_W - 34, FACE_H - 44, true);
  });
}

export function makeBackTexture(theme: DeckTheme): THREE.CanvasTexture {
  return makeTexture((ctx) => {
    const bg = ctx.createLinearGradient(0, 0, FACE_W, FACE_H);
    bg.addColorStop(0, "#5b12b8");
    bg.addColorStop(0.35, theme.back);
    bg.addColorStop(0.7, "#7a5cff");
    bg.addColorStop(1, theme.accent2);
    fillSheet(ctx, bg);
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, FACE_W, FACE_H, 56);
    ctx.fill();

    rainbowRibbon(ctx, 28, 24, FACE_W - 56, 18);
    rainbowRibbon(ctx, 28, FACE_H - 42, FACE_W - 56, 18);
    glitter(ctx, FACE_W, FACE_H, 120);
    drawRainbow(ctx, FACE_W * 0.5, FACE_H * 0.3, 220);
    drawRainbow(ctx, FACE_W * 0.5, FACE_H * 0.78, 200);

    const kittens: Array<[number, number, number, boolean]> = [
      [118, 168, 78, true],
      [392, 176, 72, true],
      [256, 210, 92, true],
      [96, 340, 70, true],
      [416, 348, 74, true],
      [190, 400, 64, false],
      [330, 408, 64, false],
      [128, 560, 76, true],
      [384, 552, 80, true],
      [256, 600, 70, true],
    ];
    kittens.forEach(([x, y, size, bowed], i) => {
      drawRainbowKitty(ctx, x, y, size, RAINBOW[i % RAINBOW.length], bowed);
    });

    ctx.fillStyle = "rgba(42, 16, 72, 0.42)";
    roundRect(ctx, 86, 300, FACE_W - 172, 150, 28);
    ctx.fill();
    ctx.fillStyle = "#fff7ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 48px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.fillText("SKIP", FACE_W / 2, FACE_H / 2 - 18);
    ctx.fillText("COUNT", FACE_W / 2, FACE_H / 2 + 28);

    ctx.strokeStyle = "#ffe14a";
    ctx.lineWidth = 10;
    roundRect(ctx, 16, 16, FACE_W - 32, FACE_H - 32, 46);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 5;
    roundRect(ctx, 30, 30, FACE_W - 60, FACE_H - 60, 38);
    ctx.stroke();
  });
}

export function makeTableTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not make table art");
  const g = ctx.createRadialGradient(1024, 860, 80, 1024, 1024, 1240);
  g.addColorStop(0, "#d9a8ff");
  g.addColorStop(0.28, "#8a2be2");
  g.addColorStop(0.62, "#5b12b8");
  g.addColorStop(1, "#23064e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2048, 2048);
  ctx.globalAlpha = 0.55;
  drawRainbow(ctx, 560, 1580, 620);
  drawRainbow(ctx, 1560, 420, 520);
  drawRainbow(ctx, 1100, 1780, 400);
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 70; i += 1) {
    const color = ["#ffe14a", "#ff4ad8", "#3ad4ff", "#3dff8a", "#ffffff"][i % 5];
    drawStar(ctx, Math.random() * 2048, Math.random() * 2048, 14 + Math.random() * 28, color);
  }
  glitter(ctx, 2048, 2048, 700);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function edgeMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.22 });
}

export function makePadTexture(title: string, subtitle: string, theme: DeckTheme): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not make pad art");
  const bg = ctx.createLinearGradient(0, 0, 512, 768);
  bg.addColorStop(0, "#7a5cff");
  bg.addColorStop(0.45, theme.accent);
  bg.addColorStop(1, theme.accent2);
  fillSheet(ctx, bg);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 768, 48);
  ctx.fill();
  rainbowRibbon(ctx, 36, 28, 440, 18);
  rainbowRibbon(ctx, 36, 722, 440, 18);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.roundRect(22, 22, 468, 724, 40);
  ctx.stroke();
  ctx.fillStyle = "rgba(42, 16, 72, 0.82)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 54px 'Baloo 2', 'Trebuchet MS', sans-serif";
  ctx.fillText(title, 256, 300);
  ctx.font = "800 96px 'Baloo 2', 'Trebuchet MS', sans-serif";
  ctx.fillText(subtitle, 256, 420);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft rainbow bloom used to hint a playable empty column or homeable waste. */
export function makeHaloTexture(theme: DeckTheme): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not make halo art");
  const glow = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  glow.addColorStop(0, "#fff7c8");
  glow.addColorStop(0.28, theme.accent2);
  glow.addColorStop(0.62, theme.glow);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
