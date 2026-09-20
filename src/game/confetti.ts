import { drawIcon } from "./textures";
import { confettiThemeFor, type ConfettiTheme, type IconKind } from "./themes";

type PieceKind = "icon" | "candy" | "dot";

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  kind: PieceKind;
  icon: IconKind;
  wobble: number;
};

const FADE_MS = 800;
const PARTY_MS = 8200;

export class ConfettiParty {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private pieces: Piece[] = [];
  private raf = 0;
  private running = false;
  private fading = false;
  private fade = 1;
  private startedAt = 0;
  private lastT = 0;
  private stopTimer = 0;
  private theme: ConfettiTheme = confettiThemeFor(2);
  private onDone: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  get active(): boolean {
    return this.running;
  }

  start(multiplier: number, onDone?: () => void): void {
    this.stop(true);
    this.theme = confettiThemeFor(multiplier);
    this.onDone = onDone ?? null;
    this.running = true;
    this.fading = false;
    this.fade = 1;
    this.startedAt = performance.now();
    this.lastT = this.startedAt;
    this.canvas.hidden = false;
    this.canvas.classList.add("is-on");
    this.fit();
    this.pieces = this.spawn(this.theme.density);
    this.raf = requestAnimationFrame((time) => this.tick(time));
    this.stopTimer = window.setTimeout(() => this.stop(), PARTY_MS);
  }

  stop(immediate = false): void {
    if (this.stopTimer) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = 0;
    }
    if (immediate || !this.running) {
      this.finish();
      return;
    }
    this.fading = true;
  }

  resize(): void {
    if (!this.running) return;
    this.fit();
  }

  private finish(): void {
    this.running = false;
    this.fading = false;
    this.pieces = [];
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    const ctx = this.ctx;
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.canvas.hidden = true;
    this.canvas.classList.remove("is-on");
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private viewSize(): { width: number; height: number } {
    const width = Math.max(this.canvas.clientWidth, window.innerWidth || 1, 1);
    const height = Math.max(this.canvas.clientHeight, window.innerHeight || 1, 1);
    return { width, height };
  }

  private fit(): void {
    const { width, height } = this.viewSize();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(width * ratio);
    this.canvas.height = Math.floor(height * ratio);
    this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private spawn(count: number): Piece[] {
    const { width, height } = this.viewSize();
    const colors = this.theme.colors;
    const icons = this.theme.icons;
    const pieces: Piece[] = [];
    for (let i = 0; i < count; i += 1) {
      const color = colors[i % colors.length] ?? "#ffe14a";
      const icon = icons[i % icons.length] ?? "sparkle";
      const roll = i % 5;
      const kind: PieceKind = roll <= 1 ? "icon" : roll === 2 ? "dot" : "candy";
      const onScreen = i % 3 !== 0;
      pieces.push({
        x: Math.random() * width,
        y: onScreen ? Math.random() * height * 0.55 : -30 - Math.random() * height * 0.4,
        vx: (Math.random() - 0.5) * 90,
        vy: 70 + Math.random() * 120,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 3.4,
        size: kind === "icon" ? 34 + Math.random() * 28 : 12 + Math.random() * 14,
        color,
        kind,
        icon,
        wobble: 1.2 + Math.random() * 2.4,
      });
    }
    return pieces;
  }

  private tick(now: number): void {
    if (!this.running) return;
    const ctx = this.ctx;
    const { width, height } = this.viewSize();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.fading) {
      this.fade = Math.max(0, this.fade - dt * (1000 / FADE_MS));
      if (this.fade <= 0) {
        this.finish();
        return;
      }
    }

    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = this.fade;
    }

    const recycle = !this.fading && now - this.startedAt < PARTY_MS - 1100;
    this.pieces.forEach((piece) => {
      piece.vy += 42 * dt;
      piece.x += piece.vx * dt + Math.sin(now / 260 + piece.wobble) * 22 * dt;
      piece.y += piece.vy * dt;
      piece.rot += piece.vr * dt;
      if (recycle && piece.y > height + 36) {
        piece.y = -28 - Math.random() * 90;
        piece.x = Math.random() * width;
        piece.vy = 70 + Math.random() * 100;
      }
      if (ctx) this.paint(ctx, piece);
    });

    if (ctx) ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame((time) => this.tick(time));
  }

  private paint(ctx: CanvasRenderingContext2D, piece: Piece): void {
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rot);
    ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
    ctx.shadowBlur = 10;
    if (piece.kind === "icon") {
      drawIcon(ctx, piece.icon, 0, 0, piece.size, piece.color);
    } else if (piece.kind === "dot") {
      ctx.fillStyle = piece.color;
      ctx.beginPath();
      ctx.arc(0, 0, piece.size * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      const w = piece.size * 1.15;
      const h = piece.size * 0.48;
      ctx.fillStyle = piece.color;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(-w / 2, -h / 2, w, h, 4);
      } else {
        ctx.rect(-w / 2, -h / 2, w, h);
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}
