import * as THREE from "three";
import { SUIT_COLOR, SUIT_GLYPH, type Suit } from "./rules";
import type { DeckTheme, IconKind } from "./themes";

const FACE_W = 256;
const FACE_H = 384;

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
  ctx.fillStyle = "#ffe36a";
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
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, size * 0.04, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size * 0.22, -size * 0.12);
  ctx.lineTo(-size * 0.34, -size * 0.38);
  ctx.lineTo(-size * 0.04, -size * 0.22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.22, -size * 0.12);
  ctx.lineTo(size * 0.34, -size * 0.38);
  ctx.lineTo(size * 0.04, -size * 0.22);
  ctx.fill();
  ctx.fillStyle = "#3a2030";
  ctx.beginPath();
  ctx.arc(-size * 0.1, 0, size * 0.045, 0, Math.PI * 2);
  ctx.arc(size * 0.1, 0, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8ad8";
  ctx.beginPath();
  ctx.arc(0, size * 0.08, size * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawUnicorn(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  drawHeart(ctx, 0, size * 0.04, size * 0.72, color);
  ctx.fillStyle = "#ffe36a";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.42);
  ctx.lineTo(size * 0.08, -size * 0.08);
  ctx.lineTo(-size * 0.08, -size * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRainbow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const colors = ["#ff4d6d", "#ff9f1c", "#ffe36a", "#7dffd8", "#7ec8ff", "#c9a0ff"];
  ctx.save();
  ctx.translate(x, y);
  colors.forEach((color, i) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.arc(0, size * 0.18, size * 0.42 - i * size * 0.08, Math.PI, 0);
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

function makeTexture(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not make card art");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function makeFaceTexture(theme: DeckTheme, value: number, suit: Suit): THREE.CanvasTexture {
  const suitInk = SUIT_COLOR[suit] === "red" ? "#e11d74" : "#3a1848";
  const glyph = SUIT_GLYPH[suit];
  return makeTexture((ctx) => {
    ctx.fillStyle = theme.face;
    roundRect(ctx, 0, 0, FACE_W, FACE_H, 28);
    ctx.fill();
    const rim = ctx.createLinearGradient(0, 0, FACE_W, FACE_H);
    rim.addColorStop(0, theme.accent);
    rim.addColorStop(0.5, theme.accent2);
    rim.addColorStop(1, theme.accent);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 10;
    roundRect(ctx, 8, 8, FACE_W - 16, FACE_H - 16, 22);
    ctx.stroke();
    ctx.strokeStyle = theme.faceEdge;
    ctx.lineWidth = 3;
    roundRect(ctx, 16, 16, FACE_W - 32, FACE_H - 32, 16);
    ctx.stroke();

    const iconSpots: Array<[number, number, number]> = [
      [78, 118, 28],
      [178, 118, 28],
      [58, 196, 24],
      [198, 196, 24],
      [84, 268, 26],
      [172, 268, 26],
    ];
    iconSpots.forEach(([x, y, size], i) => {
      const color = i % 2 === 0 ? theme.accent : theme.accent2;
      drawIcon(ctx, theme.icon, x, y, size, color);
    });

    ctx.fillStyle = suitInk;
    ctx.font = "800 42px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(String(value), 22, 18);
    ctx.font = "800 28px serif";
    ctx.fillText(glyph, 22, 58);

    ctx.save();
    ctx.translate(FACE_W - 22, FACE_H - 18);
    ctx.rotate(Math.PI);
    ctx.font = "800 42px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(value), 0, 0);
    ctx.font = "800 28px serif";
    ctx.fillText(glyph, 0, 40);
    ctx.restore();

    ctx.font = "800 44px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = suitInk;
    ctx.fillText(theme.label, FACE_W / 2, FACE_H / 2 - 6);
    ctx.font = "800 46px serif";
    ctx.fillText(glyph, FACE_W / 2, FACE_H / 2 + 38);
  });
}

export function makeBackTexture(theme: DeckTheme): THREE.CanvasTexture {
  return makeTexture((ctx) => {
    const bg = ctx.createLinearGradient(0, 0, FACE_W, FACE_H);
    bg.addColorStop(0, theme.back);
    bg.addColorStop(0.5, theme.accent);
    bg.addColorStop(1, theme.accent2);
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, FACE_W, FACE_H, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 8;
    roundRect(ctx, 10, 10, FACE_W - 20, FACE_H - 20, 20);
    ctx.stroke();

    for (let i = 0; i < 12; i += 1) {
      const x = 36 + (i % 4) * 56;
      const y = 40 + Math.floor(i / 4) * 44;
      drawSparkle(ctx, x, y + (i % 2) * 8, 12, "rgba(255,255,255,0.55)");
    }

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(ctx, 40, 130, FACE_W - 80, 130, 18);
    ctx.fill();
    ctx.fillStyle = theme.backInk;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 36px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.fillText(theme.label, FACE_W / 2, FACE_H / 2 - 10);
    ctx.font = "700 16px 'Baloo 2', 'Trebuchet MS', sans-serif";
    ctx.fillText(theme.name, FACE_W / 2, FACE_H / 2 + 24);
    drawIcon(ctx, theme.icon, FACE_W / 2, 80, 40, theme.backInk);
    drawIcon(ctx, theme.icon, FACE_W / 2, FACE_H - 72, 32, theme.backInk);
  });
}

export function makeTableTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not make table art");
  const g = ctx.createRadialGradient(512, 420, 40, 512, 512, 620);
  g.addColorStop(0, "#ffd1f2");
  g.addColorStop(0.45, "#c086ff");
  g.addColorStop(1, "#3d1b6e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = i % 2 ? "#ffe36a" : "#ffffff";
    drawStar(ctx, Math.random() * 1024, Math.random() * 1024, 18 + Math.random() * 22, ctx.fillStyle);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function edgeMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.08 });
}

export function makePadTexture(title: string, subtitle: string, theme: DeckTheme): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not make pad art");
  const bg = ctx.createLinearGradient(0, 0, 512, 768);
  bg.addColorStop(0, theme.accent);
  bg.addColorStop(1, theme.accent2);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 768, 48);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.roundRect(22, 22, 468, 724, 40);
  ctx.stroke();
  ctx.fillStyle = "rgba(58, 24, 72, 0.78)";
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
