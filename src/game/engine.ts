import * as THREE from "three";
import { Sfx } from "./audio";
import { ConfettiParty } from "./confetti";
import {
  SUIT_GLYPH,
  SUITS,
  canAutoHome,
  canPlaceOnCard,
  canPlayToFoundation,
  canStackOnTableau,
  autoHomeAll,
  autoHomeableIds,
  drawFromStock,
  emptyColumnHint,
  findCard,
  foundationCount,
  isDoubleTap,
  isFinaleReady,
  isWon,
  klondikeDealOrder,
  multiplesUpTo,
  playToFoundation,
  playableFoundationIds,
  playableWasteId,
  removeRun,
  runFrom,
  suitIndex,
  type CardModel,
  type GameState,
} from "./rules";
import { restoreState, snapshotState, type GameSnap } from "./history";
import { dealSolvable } from "./solver";
import { themeFor, type DeckTheme } from "./themes";
import { edgeMaterial, makeBackTexture, makeFaceTexture, makeHaloTexture, makePadTexture, makeTableTexture } from "./textures";
import {
  CARD_D,
  CARD_FACE_SPIN,
  CARD_H,
  CARD_LEAN,
  CARD_W,
  CARD_Y,
  cameraDirection,
  columnX,
  layoutForAspect,
  ndcSideMargin,
  orthoHalfExtents,
  type LayoutMetrics,
} from "./layout";

function faceTowardPlayer(obj: THREE.Object3D, lean = CARD_LEAN): void {
  obj.rotation.order = "ZXY";
  obj.rotation.z = CARD_FACE_SPIN;
  obj.rotation.x = lean;
}

type CardView = {
  model: CardModel;
  group: THREE.Group;
  flipper: THREE.Group;
  mesh: THREE.Mesh;
};

type Tween = {
  group: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  fromFlip: number;
  toFlip: number;
  hop: number;
  delay: number;
  duration: number;
  elapsed: number;
  onDone?: () => void;
};

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export class SkipCountGame {
  private readonly canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
  private readonly renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 80);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly sfx = new Sfx();
  private readonly cards = new Map<string, CardView>();
  private readonly tweens: Tween[] = [];
  private readonly sharedGeo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  private stockPad: THREE.Mesh | null = null;
  private wastePad: THREE.Mesh | null = null;
  private foundationPads: THREE.Mesh[] = [];
  private tableauPads: THREE.Mesh[] = [];
  private emptyHalos: THREE.Mesh[] = [];
  private wasteHalo: THREE.Mesh | null = null;

  private state: GameState | null = null;
  private theme: DeckTheme = themeFor(2);
  private selectedId: string | null = null;
  private busy = false;
  private particles: THREE.Points | null = null;
  private hintUntil = 0;
  private undos: GameSnap[] = [];
  private lastTap: { id: string; time: number } | null = null;
  private party: ConfettiParty | null = null;
  private celebrating = false;
  private finaleActive = false;
  private finaleTimer = 0;
  private finaleLaunched = 0;

  mount(): void {
    this.setupRenderer();
    this.setupLights();
    this.setupTable();
    this.setupParticles();
    this.setupParty();
    this.bindUi();
    this.fitCamera();
    window.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointerdown", (event) => this.onPointer(event));
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
    if (import.meta.env.DEV) {
      const jump = new URLSearchParams(window.location.search);
      const level = Number(jump.get("level") ?? "2");
      const pick = Number.isFinite(level) && level >= 2 && level <= 10 ? level : 2;
      if (jump.get("finale") === "1" || jump.get("won") === "1") {
        void this.startLevel(pick);
      }
      Object.assign(window, {
        __scsTap: (id: string) => this.onCardTapped(id),
        __scsWaste: () => (this.state ? playableWasteId(this.state) : undefined),
        __scsHomeable: () => (this.state ? autoHomeableIds(this.state) : []),
        __scsFlips: () => {
          if (!this.state) return [];
          return this.state.tableau.flatMap((pile, column) =>
            pile.map((card, index) => {
              const view = this.cards.get(card.id);
              return {
                column,
                index,
                faceUp: card.faceUp,
                flip: Number(view?.flipper.rotation.x.toFixed(2)),
                id: card.id,
              };
            }),
          );
        },
        __scsDump: () =>
          this.state
            ? {
                multiplier: this.state.multiplier,
                highest: this.state.highest,
                waste: this.state.waste.map((card) => card.value),
                tableau: this.state.tableau.map((pile) => pile.map((card) => `${card.faceUp ? "" : "d"}${card.value}`)),
                homes: this.state.foundations.map((pile) => pile.map((card) => card.value)),
              }
            : undefined,
        __scsFinaleReady: () => (this.state ? isFinaleReady(this.state) : false),
        __scsCelebrate: () => this.beginCelebration(),
        __scsDebugDouble: (id: string) => {
          if (!this.state) return { error: "no state" };
          const before = {
            last: this.lastTap,
            canHome: canAutoHome(this.state, id),
            busy: this.busy,
            waste: this.state.waste.map((card) => card.id),
          };
          this.onCardTapped(id);
          const mid = { last: this.lastTap, selected: this.selectedId, busy: this.busy };
          this.onCardTapped(id);
          return {
            before,
            mid,
            homes: foundationCount(this.state),
            waste: this.state.waste.map((card) => card.id),
          };
        },
      });
    }
  }

  private setupRenderer(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color("#4a1288");
    this.scene.fog = new THREE.Fog("#4a1288", 22, 42);
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xf0d6ff, 0.78));
    const key = new THREE.DirectionalLight(0xffffff, 1.08);
    key.position.set(-3, 16, 6);
    this.scene.add(key);
    const purple = new THREE.PointLight(0xb56bff, 20, 30);
    purple.position.set(-5, 5, 1);
    this.scene.add(purple);
    const magenta = new THREE.PointLight(0xff4ad8, 14, 26);
    magenta.position.set(2, 4, -2);
    this.scene.add(magenta);
    const teal = new THREE.PointLight(0x3ad4ff, 12, 24);
    teal.position.set(7, 4, 2);
    this.scene.add(teal);
    const lemon = new THREE.PointLight(0xffe14a, 8, 18);
    lemon.position.set(0, 6, 4);
    this.scene.add(lemon);
  }

  private setupTable(): void {
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({
        map: makeTableTexture(),
        roughness: 0.42,
        metalness: 0.22,
      }),
    );
    table.rotation.order = "ZXY";
    table.rotation.z = CARD_FACE_SPIN;
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.04;
    this.scene.add(table);

    const padGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92,
    });
    this.stockPad = new THREE.Mesh(padGeo, padMat);
    faceTowardPlayer(this.stockPad);
    this.stockPad.userData.pad = "stock";
    this.scene.add(this.stockPad);
    this.wastePad = new THREE.Mesh(
      padGeo.clone(),
      new THREE.MeshStandardMaterial({
        color: 0xc77dff,
        transparent: true,
        opacity: 0.22,
        roughness: 0.6,
      }),
    );
    faceTowardPlayer(this.wastePad);
    this.wastePad.userData.pad = "waste";
    this.scene.add(this.wastePad);

    for (let i = 0; i < 4; i += 1) {
      const pad = new THREE.Mesh(padGeo.clone(), padMat.clone());
      faceTowardPlayer(pad);
      pad.userData.pad = "foundation";
      pad.userData.column = i;
      this.scene.add(pad);
      this.foundationPads.push(pad);
    }
    for (let i = 0; i < 7; i += 1) {
      const pad = new THREE.Mesh(padGeo.clone(), padMat.clone());
      faceTowardPlayer(pad);
      pad.userData.pad = "tableau";
      pad.userData.column = i;
      pad.material = new THREE.MeshStandardMaterial({
        color: 0x8a2be2,
        transparent: true,
        opacity: 0.2,
        roughness: 0.6,
      });
      this.scene.add(pad);
      this.tableauPads.push(pad);
      this.emptyHalos.push(this.makeHalo());
    }
    this.wasteHalo = this.makeHalo(1.85);
    this.placePads();
  }

  private makeHalo(scale = 1.55): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * scale, CARD_H * scale),
      new THREE.MeshBasicMaterial({
        map: makeHaloTexture(this.theme),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    faceTowardPlayer(mesh);
    mesh.raycast = () => {};
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  private setupParticles(): void {
    const count = 120;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = 1 + Math.random() * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffe14a, size: 0.1, transparent: true, opacity: 0.88 }),
    );
    this.scene.add(this.particles);
  }

  private setupParty(): void {
    const canvas = document.querySelector<HTMLCanvasElement>("#confetti-layer");
    this.party = canvas ? new ConfettiParty(canvas) : null;
  }

  private bindUi(): void {
    const picks = document.querySelector("#level-picks");
    if (picks) {
      for (let level = 2; level <= 10; level += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "level-pick";
        btn.textContent = String(level);
        btn.addEventListener("click", () => this.startLevel(level));
        picks.append(btn);
      }
    }
    document.querySelector("#btn-play")?.addEventListener("click", () => this.startLevel(2));
    document.querySelector("#btn-undo")?.addEventListener("click", () => this.undoLast());
    document.querySelector("#btn-hint")?.addEventListener("click", () => this.showHint());
    document.querySelector("#btn-restart")?.addEventListener("click", () => {
      if (this.state) this.startLevel(this.state.multiplier);
    });
    document.querySelector("#btn-menu")?.addEventListener("click", () => this.showTitle());
    document.querySelector("#btn-mute")?.addEventListener("click", (event) => {
      const muted = this.sfx.toggleMute();
      (event.currentTarget as HTMLButtonElement).textContent = muted ? "🔇" : "🔊";
    });
    document.querySelector("#btn-next")?.addEventListener("click", () => {
      const current = this.state?.multiplier ?? 2;
      this.startLevel(current >= 10 ? 2 : current + 1);
    });
    document.querySelector("#btn-win-menu")?.addEventListener("click", () => this.showTitle());
    document.querySelector("#win-screen")?.addEventListener("pointerdown", () => this.dismissParty());
  }

  private showTitle(): void {
    this.resetFinale();
    this.clearCards();
    this.state = null;
    this.undos = [];
    this.lastTap = null;
    this.syncUndoButton();
    setHidden("#title-screen", false);
    setHidden("#win-screen", true);
    setHidden("#hud", true);
    setHidden("#hint-line", true);
    document.querySelector("#win-screen")?.classList.remove("party-open");
  }

  private async startLevel(multiplier: number): Promise<void> {
    this.sfx.select();
    this.resetFinale();
    setHidden("#title-screen", true);
    setHidden("#win-screen", true);
    setHidden("#hud", false);
    setHidden("#hint-line", false);
    document.querySelector("#win-screen")?.classList.remove("party-open");
    this.theme = themeFor(multiplier);
    this.selectedId = null;
    this.undos = [];
    this.lastTap = null;
    this.clearCards();
    this.state = dealSolvable(multiplier);
    if (import.meta.env.DEV) {
      const demo = new URLSearchParams(window.location.search);
      if (demo.get("glow") === "1") this.arrangeEmptyWasteDemo();
      if (demo.get("home") === "1") this.arrangeHomeableDemo();
      if (demo.get("starters") === "1") this.arrangeStarterOnlyDemo();
      if (demo.get("lv4") === "1") this.arrangeLevel4Playtest();
      if (demo.get("finale") === "1") this.arrangeFinaleDemo();
      if (demo.get("won") === "1") this.arrangeWonDemo();
    }
    this.refreshPads();
    this.fitCamera();
    requestAnimationFrame(() => {
      this.snapLayout();
      this.fitCamera();
    });
    this.syncHud();
    this.syncUndoButton();
    await this.readyCardFonts();
    this.buildCards();
    this.dealIntro();
  }

  private async readyCardFonts(): Promise<void> {
    const fonts = document.fonts;
    if (!fonts?.load) return;
    try {
      await Promise.race([
        Promise.all([fonts.load("900 64px 'Baloo 2'"), fonts.load("800 48px 'Baloo 2'")]),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 800);
        }),
      ]);
    } catch {
      // Trebuchet fallback still measures and fits inside the rank badge.
    }
  }

  private clearCards(): void {
    this.tweens.length = 0;
    this.cards.forEach((view) => {
      this.scene.remove(view.group);
      disposeMaterials(view.mesh);
    });
    this.cards.clear();
    this.textureCache.forEach((tex) => tex.dispose());
    this.textureCache.clear();
    this.busy = false;
  }

  private tex(key: string, make: () => THREE.CanvasTexture): THREE.CanvasTexture {
    const cached = this.textureCache.get(key);
    if (cached) return cached;
    const texture = make();
    this.textureCache.set(key, texture);
    return texture;
  }

  private allCards(state: GameState): CardModel[] {
    return [...state.stock, ...state.waste, ...state.foundations.flat(), ...state.tableau.flat()];
  }

  private buildCards(): void {
    if (!this.state) return;
    const back = this.tex(`back-${this.theme.multiplier}`, () => makeBackTexture(this.theme));
    const edge = edgeMaterial(this.theme.accent);
    this.allCards(this.state).forEach((model) => {
      const face = this.tex(`face-${model.id}`, () => makeFaceTexture(this.theme, model.value, model.suit));
      const materials = [
        edge,
        edge.clone(),
        edge.clone(),
        edge.clone(),
        new THREE.MeshStandardMaterial({ map: face, roughness: 0.28, metalness: 0.12 }),
        new THREE.MeshStandardMaterial({ map: back, roughness: 0.32, metalness: 0.18 }),
      ];
      const mesh = new THREE.Mesh(this.sharedGeo, materials);
      const flipper = new THREE.Group();
      flipper.add(mesh);
      const tilt = new THREE.Group();
      faceTowardPlayer(tilt);
      tilt.add(flipper);
      const group = new THREE.Group();
      group.add(tilt);
      group.userData.cardId = model.id;
      mesh.userData.cardId = model.id;
      this.scene.add(group);
      this.cards.set(model.id, { model, group, flipper, mesh });
    });
  }

  private dealIntro(): void {
    if (!this.state) return;
    this.placePads();
    this.state.stock.forEach((card) => {
      const view = this.cards.get(card.id);
      if (!view) return;
      view.group.position.copy(this.poseFor(card.id));
      view.flipper.rotation.x = Math.PI;
    });
    this.state.waste.forEach((card) => {
      const view = this.cards.get(card.id);
      if (!view) return;
      view.group.position.copy(this.poseFor(card.id));
      view.flipper.rotation.x = card.faceUp ? 0 : Math.PI;
    });
    this.busy = true;
    let delay = 0;
    const queue = klondikeDealOrder(this.state.tableau);
    const finishDeal = (): void => {
      this.tweens.length = 0;
      this.snapAllCards();
      this.refreshPads();
      this.syncHud();
      // Post-deal only: starters (value N) may fly home. Never mid-deal, never 2N+.
      this.flushAutoHomes();
    };
    queue.forEach((card, index) => {
      const view = this.cards.get(card.id);
      if (!view) return;
      view.group.position.copy(this.stockOrigin());
      view.flipper.rotation.x = Math.PI;
      this.animateTo(view, this.poseFor(card.id), card.faceUp ? 0 : Math.PI, 0.32, delay, () => {
        if (index === queue.length - 1) finishDeal();
      });
      delay += 0.028;
    });
    if (queue.length === 0) finishDeal();
  }

  private layout(): LayoutMetrics {
    const width = this.canvas.clientWidth || window.innerWidth || 1;
    const height = this.canvas.clientHeight || window.innerHeight || 1;
    return layoutForAspect(width / Math.max(1, height));
  }

  private colX(column: number): number {
    return columnX(column, this.layout().colGap);
  }

  private stockOrigin(): THREE.Vector3 {
    return new THREE.Vector3(this.colX(0), CARD_Y, this.layout().topZ);
  }

  private wasteOrigin(): THREE.Vector3 {
    return new THREE.Vector3(this.colX(1), CARD_Y, this.layout().topZ);
  }

  private foundationOrigin(column: number): THREE.Vector3 {
    return new THREE.Vector3(this.colX(3 + column), CARD_Y, this.layout().topZ);
  }

  private tableauOrigin(column: number, index: number): THREE.Vector3 {
    const { tableauZ0, cascade } = this.layout();
    return new THREE.Vector3(this.colX(column), CARD_Y + index * 0.012, tableauZ0 + index * cascade);
  }

  private snapLayout(): void {
    this.placePads();
    if (this.tweens.length > 0) return;
    this.cards.forEach((view, id) => {
      view.group.position.copy(this.poseFor(id));
    });
  }

  private placePads(): void {
    const stock = this.stockOrigin();
    if (this.stockPad) this.stockPad.position.copy(stock);
    if (this.wastePad) this.wastePad.position.copy(this.wasteOrigin());
    this.foundationPads.forEach((pad, i) => pad.position.copy(this.foundationOrigin(i)));
    this.tableauPads.forEach((pad, i) => pad.position.copy(this.tableauOrigin(i, 0)));
    if (this.wasteHalo) {
      this.wasteHalo.position.copy(this.wasteOrigin()).setY(CARD_Y - 0.03);
    }
    this.emptyHalos.forEach((halo, i) => {
      halo.position.copy(this.tableauOrigin(i, 0)).setY(CARD_Y + 0.02);
    });
  }

  private refreshPads(): void {
    this.placePads();
    if (this.stockPad) {
      const draw = makePadTexture("DRAW", this.theme.label, this.theme);
      const mat = this.stockPad.material as THREE.MeshStandardMaterial;
      mat.map?.dispose();
      mat.map = draw;
      mat.needsUpdate = true;
    }
    this.foundationPads.forEach((pad, i) => {
      const suit = SUITS[i];
      const glyph = suit ? SUIT_GLYPH[suit] : "?";
      const pile = this.state?.foundations[i];
      const top = pile?.[pile.length - 1];
      const label = top ? String(top.value) : glyph;
      const tex = makePadTexture("HOME", label, this.theme);
      const mat = pad.material as THREE.MeshStandardMaterial;
      mat.map?.dispose();
      mat.map = tex;
      mat.needsUpdate = true;
    });
    const refreshHalo = (mesh: THREE.Mesh | null): void => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.map = makeHaloTexture(this.theme);
      mat.needsUpdate = true;
    };
    this.emptyHalos.forEach((halo) => refreshHalo(halo));
    refreshHalo(this.wasteHalo);
  }

  private poseFor(id: string): THREE.Vector3 {
    if (!this.state) return new THREE.Vector3();
    const loc = findCard(this.state, id);
    if (!loc) return this.stockOrigin();
    if (loc.pile === "stock") {
      const depth = Math.max(0, loc.index - Math.max(0, this.state.stock.length - 10));
      return this.stockOrigin().add(new THREE.Vector3(0, depth * 0.012, -depth * 0.006));
    }
    if (loc.pile === "waste") {
      const fromEnd = this.state.waste.length - 1 - loc.index;
      const fan = Math.max(0, 2 - fromEnd);
      return this.wasteOrigin().add(new THREE.Vector3(fan * this.layout().wasteFan, 0.06 + loc.index * 0.014, 0));
    }
    if (loc.pile === "foundation" && loc.column !== undefined) {
      return this.foundationOrigin(loc.column).add(new THREE.Vector3(0, loc.index * 0.012, 0));
    }
    return this.tableauOrigin(loc.column ?? 0, loc.index);
  }

  private boardAnchors(): THREE.Vector3[] {
    const maxCascade = this.state
      ? Math.max(1, ...this.state.tableau.map((col) => col.length))
      : 7;
    const wasteFan = this.layout().wasteFan * 2;
    const anchors: THREE.Vector3[] = [
      this.stockOrigin(),
      this.wasteOrigin(),
      this.wasteOrigin().add(new THREE.Vector3(wasteFan, 0, 0)),
      ...[0, 1, 2, 3].map((i) => this.foundationOrigin(i)),
    ];
    for (let column = 0; column < 7; column += 1) {
      anchors.push(this.tableauOrigin(column, 0));
      anchors.push(this.tableauOrigin(column, Math.max(0, maxCascade - 1)));
    }
    return anchors;
  }

  private boardSamplePoints(): THREE.Vector3[] {
    const hx = CARD_W * 0.5;
    const hz = CARD_H * 0.5;
    const points: THREE.Vector3[] = [];
    this.boardAnchors().forEach((point) => {
      points.push(new THREE.Vector3(point.x - hx, CARD_Y, point.z - hz));
      points.push(new THREE.Vector3(point.x + hx, CARD_Y, point.z - hz));
      points.push(new THREE.Vector3(point.x - hx, CARD_Y, point.z + hz));
      points.push(new THREE.Vector3(point.x + hx, CARD_Y, point.z + hz));
    });
    return points;
  }

  private boardBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    this.boardSamplePoints().forEach((point) => box.expandByPoint(point));
    return box;
  }

  private ndcMargins(): { side: number; top: number; bottom: number } {
    const width = this.canvas.clientWidth || window.innerWidth || 1;
    const height = this.canvas.clientHeight || window.innerHeight || 1;
    const aspect = width / Math.max(1, height);
    const hud = document.querySelector("#hud");
    const hint = document.querySelector("#hint-line");
    const hudH = hud instanceof HTMLElement && !hud.hidden ? hud.getBoundingClientRect().height + 8 : 10;
    const hintH = hint instanceof HTMLElement && !hint.hidden ? hint.getBoundingClientRect().height + 10 : 12;
    return {
      side: ndcSideMargin(aspect),
      top: Math.min(0.42, (hudH / height) * 2 + 0.05),
      bottom: Math.min(0.28, (hintH / height) * 2 + 0.05),
    };
  }

  private pointsFitInView(points: THREE.Vector3[], side: number, top: number, bottom: number): boolean {
    const projected = new THREE.Vector3();
    return points.every((point) => {
      projected.copy(point).project(this.camera);
      return (
        projected.x >= -1 + side &&
        projected.x <= 1 - side &&
        projected.y >= -1 + bottom &&
        projected.y <= 1 - top &&
        projected.z >= -1 &&
        projected.z <= 1
      );
    });
  }

  private placeCamera(look: THREE.Vector3, direction: THREE.Vector3, distance: number): void {
    this.camera.up.set(0, 0, -1);
    this.camera.position.copy(look).addScaledVector(direction, distance);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
  }

  private projectedPointsCenter(points: THREE.Vector3[]): { x: number; y: number } {
    let minX = 1;
    let maxX = -1;
    let minY = 1;
    let maxY = -1;
    const projected = new THREE.Vector3();
    points.forEach((point) => {
      projected.copy(point).project(this.camera);
      minX = Math.min(minX, projected.x);
      maxX = Math.max(maxX, projected.x);
      minY = Math.min(minY, projected.y);
      maxY = Math.max(maxY, projected.y);
    });
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  private applyOrtho(halfW: number, halfH: number): void {
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  private fitCamera(): void {
    const width = this.canvas.clientWidth || window.innerWidth || 1;
    const height = this.canvas.clientHeight || window.innerHeight || 1;
    const aspect = width / Math.max(1, height);
    const points = this.boardSamplePoints();
    const box = this.boardBounds();
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const look = new THREE.Vector3(center.x, CARD_Y, center.z);
    const aim = cameraDirection(aspect);
    const direction = new THREE.Vector3(aim.x, aim.y, aim.z);
    const { side, top, bottom } = this.ndcMargins();
    let { halfW, halfH } = orthoHalfExtents(size.x, size.z, aspect || 1, side, top, bottom);
    this.placeCamera(look, direction, 12);
    this.applyOrtho(halfW, halfH);
    if (!this.pointsFitInView(points, side, top, bottom)) {
      for (let i = 0; i < 10 && !this.pointsFitInView(points, side, top, bottom); i += 1) {
        halfW *= 1.04;
        halfH *= 1.04;
        this.applyOrtho(halfW, halfH);
      }
    }
    for (let i = 0; i < 6; i += 1) {
      const ndc = this.projectedPointsCenter(points);
      const targetY = (-1 + bottom + (1 - top)) / 2;
      const errX = ndc.x;
      const errY = ndc.y - targetY;
      if (Math.abs(errX) < 0.012 && Math.abs(errY) < 0.012) break;
      look.x += errX * halfW;
      look.z -= errY * halfH;
      this.placeCamera(look, direction, 12);
      this.applyOrtho(halfW, halfH);
      if (!this.pointsFitInView(points, side, top, bottom)) {
        halfW *= 1.03;
        halfH *= 1.03;
        this.applyOrtho(halfW, halfH);
      }
    }
  }

  private animateTo(
    view: CardView,
    to: THREE.Vector3,
    toFlip: number,
    duration: number,
    delay: number,
    onDone?: () => void,
    hop = 0.35,
  ): void {
    this.tweens.push({
      group: view.group,
      from: view.group.position.clone(),
      to: to.clone(),
      fromFlip: view.flipper.rotation.x,
      toFlip,
      hop,
      delay,
      duration,
      elapsed: 0,
      onDone,
    });
  }

  private pickPointerObject(hits: THREE.Intersection[]): THREE.Object3D | null {
    if (!this.state || hits.length === 0) return null;
    const nearest = hits[0]?.distance ?? 0;
    const selected = this.selectedId;
    const wasteId = playableWasteId(this.state);
    const wasteCard = wasteId ? runFrom(this.state, wasteId)?.[0] : undefined;
    const dropping = Boolean(selected);
    const tableauColumn = (object: THREE.Object3D): number | undefined => {
      const pad = object.userData.pad as string | undefined;
      if (pad === "tableau") return object.userData.column as number;
      const id = object.userData.cardId as string | undefined;
      const loc = id ? findCard(this.state!, id) : null;
      return loc?.pile === "tableau" ? loc.column : undefined;
    };
    const wasteFits = (column: number | undefined): boolean =>
      Boolean(wasteCard && column !== undefined && canStackOnTableau(this.state!, wasteCard, column));
    const scored = hits
      .filter((hit) => {
        const column = tableauColumn(hit.object);
        const isTableau = column !== undefined;
        if (isTableau && (dropping || wasteFits(column))) return hit.distance <= nearest + 2.2;
        return hit.distance <= nearest + 0.55;
      })
      .map((hit) => {
        const object = hit.object;
        const pad = object.userData.pad as string | undefined;
        const id = object.userData.cardId as string | undefined;
        const loc = id ? findCard(this.state!, id) : null;
        const pile = loc?.column !== undefined ? this.state!.tableau[loc.column] : undefined;
        const isColumnTop = Boolean(pile && loc?.pile === "tableau" && loc.index === pile.length - 1);
        const column = tableauColumn(object);
        let score = 0;
        if (dropping) {
          if (loc?.pile === "tableau" || pad === "tableau") score = isColumnTop ? 130 : 110;
          else if (loc?.pile === "foundation" || pad === "foundation") score = 90;
          else if (loc?.pile === "waste" || pad === "waste") score = 30;
          else if (loc?.pile === "stock" || pad === "stock") score = 10;
        } else if (wasteFits(column) && (loc?.pile === "tableau" || pad === "tableau")) {
          score = isColumnTop || pad === "tableau" ? 125 : 105;
        } else if (loc?.pile === "waste" || pad === "waste") score = 100;
        else if (loc?.pile === "tableau") score = 80;
        else if (pad === "tableau") score = 50;
        else if (loc?.pile === "foundation" || pad === "foundation") score = 40;
        else if (loc?.pile === "stock" || pad === "stock") score = 10;
        return { object, score, distance: hit.distance };
      });
    scored.sort((a, b) => b.score - a.score || a.distance - b.distance);
    return scored[0]?.object ?? null;
  }

  private onPointer(event: PointerEvent): void {
    if (!this.state || this.busy) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [...this.cards.values()].map((view) => view.mesh);
    const pads = [this.stockPad, this.wastePad, ...this.foundationPads, ...this.tableauPads].filter(
      (mesh): mesh is THREE.Mesh => Boolean(mesh),
    );
    const hits = this.raycaster.intersectObjects([...meshes, ...pads], false);
    const first = this.pickPointerObject(hits);
    if (!first) {
      this.selectedId = null;
      this.syncHighlights();
      return;
    }
    if (first.userData.pad === "stock") {
      this.drawCard();
      return;
    }
    if (first.userData.pad === "waste") {
      const wasteId = playableWasteId(this.state);
      if (wasteId) this.onCardTapped(wasteId);
      return;
    }
    if (first.userData.pad === "foundation") {
      this.tryFoundation(first.userData.column as number | undefined);
      return;
    }
    if (first.userData.pad === "tableau") {
      this.tryTableauMove(first.userData.column as number);
      return;
    }
    const id = first.userData.cardId as string | undefined;
    if (!id) return;
    const loc = findCard(this.state, id);
    if (!loc) return;
    if (loc.pile === "stock") {
      this.drawCard();
      return;
    }
    if (loc.pile === "waste") {
      const wasteId = playableWasteId(this.state);
      if (wasteId) this.onCardTapped(wasteId);
      return;
    }
    if (loc.pile === "foundation") {
      this.tryFoundation(loc.column);
      return;
    }
    this.onCardTapped(id);
  }

  private onCardTapped(id: string): void {
    if (!this.state) return;
    const loc = findCard(this.state, id);
    if (!loc) return;
    const card = loc.pile === "waste" ? this.state.waste[loc.index] : this.state.tableau[loc.column ?? 0]?.[loc.index];
    if (!card?.faceUp) return;

    const now = performance.now();
    if (isDoubleTap(this.lastTap, id, now)) {
      this.lastTap = { id, time: now };
      if (canAutoHome(this.state, id)) this.moveToFoundation(id);
      return;
    }
    this.lastTap = { id, time: now };

    if (loc.pile === "tableau" && loc.column !== undefined) {
      if (this.selectedId && this.tryTableauMove(loc.column)) return;
      const wasteId = playableWasteId(this.state);
      const waste = wasteId ? runFrom(this.state, wasteId)?.[0] : undefined;
      const dest = this.state.tableau[loc.column]?.[loc.index];
      const isTop = loc.index === (this.state.tableau[loc.column]?.length ?? 0) - 1;
      if (waste && dest && isTop && wasteId && canPlaceOnCard(this.state, waste, dest)) {
        this.moveRunToTableau(wasteId, loc.column);
        return;
      }
    }

    const run = runFrom(this.state, id);
    if (!run) {
      this.selectedId = null;
      this.syncHighlights();
      return;
    }
    this.selectedId = this.selectedId === id ? null : id;
    this.sfx.select();
    this.syncHighlights();
  }

  private movingId(): string | undefined {
    if (!this.state) return undefined;
    return this.selectedId ?? playableWasteId(this.state);
  }

  private tryFoundation(column?: number): void {
    if (!this.state) return;
    const id = this.movingId();
    if (!id) return;
    const run = runFrom(this.state, id);
    if (!run || run.length !== 1) return;
    const card = run[0];
    if (!card || !canPlayToFoundation(this.state, card)) return;
    if (column !== undefined && suitIndex(card.suit) !== column) return;
    this.moveToFoundation(id);
  }

  private tryTableauMove(column: number): boolean {
    if (!this.state) return false;
    const id = this.movingId();
    if (!id) return false;
    const loc = findCard(this.state, id);
    if (loc?.pile === "tableau" && loc.column === column) return false;
    const run = runFrom(this.state, id);
    if (!run || !run[0] || !canStackOnTableau(this.state, run[0], column)) return false;
    this.moveRunToTableau(id, column);
    return true;
  }

  private drawCard(): void {
    if (!this.state || this.busy) return;
    if (this.state.stock.length === 0 && this.state.waste.length === 0) return;
    this.pushUndo();
    const result = drawFromStock(this.state);
    if (result === "empty") {
      this.undos.pop();
      this.syncUndoButton();
      return;
    }
    this.sfx.draw();
    this.selectedId = null;
    if (result === "recycle") {
      this.state.stock.forEach((card) => {
        const view = this.cards.get(card.id);
        if (!view) return;
        view.group.position.copy(this.poseFor(card.id));
        view.flipper.rotation.x = Math.PI;
      });
      this.flushAutoHomes();
      return;
    }
    const card = this.state.waste[this.state.waste.length - 1];
    const view = card ? this.cards.get(card.id) : undefined;
    if (!card || !view) {
      this.flushAutoHomes();
      return;
    }
    this.busy = true;
    this.animateTo(view, this.poseFor(card.id), 0, 0.28, 0, () => {
      this.flushAutoHomes();
    });
    this.syncHud();
  }

  private moveToFoundation(id: string, recordUndo = true, animated = 0): void {
    if (!this.state) return;
    if (!canAutoHome(this.state, id)) {
      if (!recordUndo) this.flushAutoHomes(animated);
      else {
        this.busy = false;
        this.syncHighlights();
      }
      return;
    }
    if (recordUndo) this.pushUndo();
    if (!playToFoundation(this.state, id)) {
      if (recordUndo) {
        this.undos.pop();
        this.syncUndoButton();
      }
      this.flushAutoHomes(animated);
      return;
    }
    const card = findCard(this.state, id)
      ? this.state.foundations.flat().find((item) => item.id === id)
      : undefined;
    if (!card) {
      this.flushAutoHomes(animated);
      return;
    }
    const view = this.cards.get(card.id);
    if (!view) {
      this.flushAutoHomes(animated + 1);
      return;
    }
    this.busy = true;
    this.selectedId = null;
    if (recordUndo || animated === 0) this.sfx.place();
    this.relayoutExposed();
    this.animateTo(view, this.poseFor(card.id), 0, 0.2, 0, () => {
      this.flushAutoHomes(recordUndo ? 0 : animated + 1);
    });
    this.refreshPads();
    this.syncHud();
  }

  private moveRunToTableau(id: string, column: number): void {
    if (!this.state) return;
    this.pushUndo();
    const run = removeRun(this.state, id);
    if (run.length === 0) {
      this.undos.pop();
      this.syncUndoButton();
      return;
    }
    this.state.tableau[column]?.push(...run);
    this.busy = true;
    this.selectedId = null;
    this.sfx.place();
    this.relayoutExposed();
    let left = run.length;
    const finish = (): void => {
      left -= 1;
      if (left <= 0) this.flushAutoHomes();
    };
    run.forEach((card, i) => {
      const view = this.cards.get(card.id);
      if (!view) {
        finish();
        return;
      }
      this.animateTo(view, this.poseFor(card.id), 0, 0.26, i * 0.03, finish);
    });
    if (run.length === 0) this.flushAutoHomes();
  }

  /** Auto-send foundation starters (value N) only. Always home legal Ns; never 2N+. */
  private flushAutoHomes(animated = 0): void {
    if (!this.state) return;
    if (this.finaleActive || this.celebrating) return;
    const next = autoHomeableIds(this.state)[0];
    if (!next) {
      this.busy = false;
      this.fitCamera();
      this.refreshPads();
      this.syncHud();
      this.syncHighlights();
      this.maybeBeginFinale();
      return;
    }
    if (animated >= 8) {
      autoHomeAll(this.state);
      this.snapAllCards();
      this.busy = false;
      this.fitCamera();
      this.refreshPads();
      this.syncHud();
      this.syncHighlights();
      this.maybeBeginFinale();
      return;
    }
    this.moveToFoundation(next, false, animated);
  }

  private maybeBeginFinale(): void {
    if (!this.state || this.celebrating || this.finaleActive) return;
    if (isWon(this.state)) {
      this.beginCelebration();
      return;
    }
    if (isFinaleReady(this.state)) this.beginFinaleStack();
  }

  /** Win-only: fly every remaining legal card home. Never used mid-game. */
  private beginFinaleStack(): void {
    if (!this.state || this.finaleActive) return;
    this.finaleActive = true;
    this.finaleLaunched = 0;
    this.busy = true;
    this.selectedId = null;
    this.syncHighlights();
    this.launchFinaleCard();
  }

  private launchFinaleCard(): void {
    if (!this.state || this.celebrating) return;
    const next = playableFoundationIds(this.state)[0];
    if (!next) {
      if (isWon(this.state)) this.beginCelebration();
      else {
        this.finaleActive = false;
        this.busy = false;
      }
      return;
    }
    if (!playToFoundation(this.state, next)) {
      if (isWon(this.state)) this.beginCelebration();
      else {
        this.finaleActive = false;
        this.busy = false;
      }
      return;
    }
    const view = this.cards.get(next);
    const more = playableFoundationIds(this.state).length > 0;
    this.finaleLaunched += 1;
    if (view) {
      if (this.finaleLaunched === 1 || this.finaleLaunched % 2 === 0) this.sfx.place();
      this.animateTo(
        view,
        this.poseFor(next),
        0,
        0.38,
        0,
        more ? undefined : () => this.beginCelebration(),
        0.72,
      );
    } else if (!more) {
      this.beginCelebration();
      return;
    }
    this.refreshPads();
    this.syncHud();
    if (this.finaleLaunched >= 2 || !more) this.ensureParty();
    if (more) {
      this.finaleTimer = window.setTimeout(() => this.launchFinaleCard(), 100);
    }
  }

  private ensureParty(fresh = false): void {
    if (!this.state) return;
    if (!fresh && this.party?.active) return;
    this.party?.start(this.state.multiplier);
  }

  private dismissParty(): void {
    this.party?.stop();
  }

  private resetFinale(): void {
    if (this.finaleTimer) {
      window.clearTimeout(this.finaleTimer);
      this.finaleTimer = 0;
    }
    this.finaleActive = false;
    this.finaleLaunched = 0;
    this.celebrating = false;
    this.party?.stop(true);
    document.querySelector("#win-screen")?.classList.remove("party-open");
  }

  private beginCelebration(): void {
    if (!this.state || this.celebrating) return;
    this.celebrating = true;
    this.finaleActive = false;
    this.busy = false;
    this.selectedId = null;
    if (this.finaleTimer) {
      window.clearTimeout(this.finaleTimer);
      this.finaleTimer = 0;
    }
    this.fitCamera();
    this.refreshPads();
    this.syncHud();
    this.syncHighlights();
    this.sfx.win();
    this.ensureParty(true);
    const last = this.state.multiplier >= 10;
    const winTitle = document.querySelector("#win-title");
    const winBlurb = document.querySelector("#win-blurb");
    const nextBtn = document.querySelector("#btn-next");
    if (winTitle) winTitle.textContent = last ? "Rainbow champion!" : "Klondike clear!";
    if (winBlurb) {
      winBlurb.textContent = last
        ? "You skip-counted every suited deck from 2's through 10's!"
        : `Every ${this.theme.label} home pile is complete.`;
    }
    if (nextBtn) nextBtn.textContent = last ? "Play again" : "Next level";
    const win = document.querySelector("#win-screen");
    win?.classList.add("party-open");
    setHidden("#win-screen", false);
  }

  private relayoutExposed(): void {
    if (!this.state) return;
    this.state.tableau.forEach((pile) => {
      pile.forEach((card) => {
        const view = this.cards.get(card.id);
        if (!view) return;
        this.animateTo(view, this.poseFor(card.id), card.faceUp ? 0 : Math.PI, 0.22, 0);
      });
    });
  }

  private showHint(): void {
    if (!this.state) return;
    this.hintUntil = performance.now() + 2400;
    this.syncHighlights();
    this.sfx.select();
  }

  private pushUndo(): void {
    if (!this.state) return;
    this.undos.push(snapshotState(this.state));
    this.syncUndoButton();
  }

  private undoLast(): void {
    if (!this.state || this.undos.length === 0) return;
    if (this.finaleActive && !this.celebrating) return;
    const snap = this.undos.pop();
    if (!snap) return;
    this.resetFinale();
    this.tweens.length = 0;
    this.busy = false;
    this.selectedId = null;
    this.lastTap = null;
    restoreState(this.state, snap);
    this.snapAllCards();
    this.refreshPads();
    this.fitCamera();
    this.syncHud();
    this.syncHighlights();
    this.syncUndoButton();
    setHidden("#win-screen", true);
    this.sfx.select();
  }

  private snapAllCards(): void {
    this.placePads();
    this.cards.forEach((view, id) => {
      view.group.position.copy(this.poseFor(id));
      view.flipper.rotation.x = view.model.faceUp ? 0 : Math.PI;
    });
  }

  private syncUndoButton(): void {
    const btn = document.querySelector<HTMLButtonElement>("#btn-undo");
    if (btn) btn.disabled = this.undos.length === 0;
  }

  private syncHud(): void {
    if (!this.state) return;
    const home = foundationCount(this.state);
    setText("#hud-level", String(this.state.multiplier));
    setText("#hud-next", String(home));
    setText("#hud-high", String(this.state.highest));
    const hint = document.querySelector("#hint-line");
    if (hint) {
      hint.textContent = `Draw. Homes ${this.state.lowest}→${this.state.highest} by ${this.state.multiplier}s. Stack down by ${this.state.multiplier}s. Empty spots take any card.`;
    }
  }

  private syncHighlights(): void {
    if (!this.state) return;
    const playable = new Set(playableFoundationIds(this.state));
    const selectedRun = this.selectedId ? new Set((runFrom(this.state, this.selectedId) ?? []).map((card) => card.id)) : new Set<string>();
    const emptyHint = emptyColumnHint(this.state);
    const boost = performance.now() < this.hintUntil;
    const wasteTopId = this.state.waste[this.state.waste.length - 1]?.id;
    this.cards.forEach((view, id) => {
      const mats = view.mesh.material as THREE.MeshStandardMaterial[];
      const face = mats[4];
      if (!face) return;
      const selected = selectedRun.has(id);
      const ready = playable.has(id);
      const wasteTop = wasteTopId === id;
      face.transparent = false;
      face.opacity = 1;
      face.color.set("#ffffff");
      if (wasteTop) {
        face.metalness = 0.04;
        face.roughness = 0.3;
        view.mesh.renderOrder = 4;
      } else {
        view.mesh.renderOrder = 0;
      }
      if (selected) {
        face.emissive = new THREE.Color(this.theme.glow);
        face.emissiveIntensity = 0.35;
      } else if (ready) {
        face.emissive = new THREE.Color(this.theme.accent2);
        face.emissiveIntensity = boost ? 0.45 : 0.18;
      } else {
        face.emissive = new THREE.Color("#000000");
        face.emissiveIntensity = 0;
      }
    });
    this.glowEmptyPads(emptyHint?.columns ?? [], 0.4);
  }

  private glowEmptyPads(columns: number[], pulse: number): void {
    const hinted = new Set(columns);
    this.tableauPads.forEach((pad, index) => {
      const mat = pad.material as THREE.MeshStandardMaterial;
      if (hinted.has(index)) {
        mat.color.set(this.theme.accent2);
        mat.emissive = new THREE.Color(this.theme.glow);
        mat.emissiveIntensity = 0.4 + pulse * 0.35;
        mat.opacity = 0.42 + pulse * 0.22;
      } else {
        mat.color.set(0xff8ad8);
        mat.emissive = new THREE.Color("#000000");
        mat.emissiveIntensity = 0;
        mat.opacity = 0.18;
      }
      this.setHalo(this.emptyHalos[index] ?? null, hinted.has(index), pulse);
    });
    this.setHalo(this.wasteHalo, false, pulse);
  }

  private setHalo(mesh: THREE.Mesh | null, on: boolean, pulse: number): void {
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (on) {
      if (!mat.map) {
        mat.map = makeHaloTexture(this.theme);
        mat.needsUpdate = true;
      }
      mat.color.set("#ffffff");
      mat.opacity = 0.72 + pulse * 0.28;
      mesh.visible = true;
    } else {
      mat.opacity = 0;
      mesh.visible = false;
    }
  }

  private arrangeEmptyWasteDemo(): void {
    if (!this.state) return;
    const spare = this.allCards(this.state).find((card) => card.value !== this.state!.lowest);
    if (!spare) return;
    const loc = findCard(this.state, spare.id);
    if (!loc) return;
    if (loc.pile === "stock") this.state.stock.splice(loc.index, 1);
    else if (loc.pile === "waste") this.state.waste.splice(loc.index, 1);
    else if (loc.pile === "foundation" && loc.column !== undefined) {
      this.state.foundations[loc.column]?.splice(loc.index, 1);
    } else if (loc.pile === "tableau" && loc.column !== undefined) {
      this.state.tableau[loc.column]?.splice(loc.index, 1);
    }
    spare.faceUp = true;
    this.state.waste.push(spare);
    const first = this.state.tableau[0];
    if (!first) return;
    while (first.length > 0) {
      const card = first.pop();
      if (!card) break;
      card.faceUp = false;
      this.state.stock.unshift(card);
    }
  }

  private pullCard(match: (card: CardModel) => boolean): CardModel | undefined {
    if (!this.state) return undefined;
    const piles = [this.state.stock, this.state.waste, ...this.state.foundations, ...this.state.tableau];
    for (const pile of piles) {
      const index = pile.findIndex(match);
      if (index < 0) continue;
      const [card] = pile.splice(index, 1);
      return card;
    }
    return undefined;
  }

  private arrangeHomeableDemo(): void {
    if (!this.state) return;
    const lowest = this.state.lowest;
    const first = this.pullCard((card) => card.value === lowest);
    const second = this.pullCard((card) => card.value === lowest);
    if (first) {
      first.faceUp = true;
      this.state.waste.push(first);
    }
    if (second) {
      second.faceUp = true;
      this.state.tableau[1]?.push(second);
    }
  }

  /** DEV: plant starter N on waste and 2N of the same suit on tableau. */
  private arrangeStarterOnlyDemo(): void {
    if (!this.state) return;
    const lowest = this.state.lowest;
    const next = lowest + this.state.multiplier;
    const starter = this.pullCard((card) => card.value === lowest);
    const follow = starter
      ? this.pullCard((card) => card.value === next && card.suit === starter.suit)
      : undefined;
    if (starter) {
      starter.faceUp = true;
      this.state.waste.push(starter);
    }
    if (follow) {
      follow.faceUp = true;
      this.state.tableau[2]?.push(follow);
    }
  }

  private gatherCards(): CardModel[] {
    return this.state ? this.allCards(this.state) : [];
  }

  private emptyBoard(): void {
    if (!this.state) return;
    this.state.stock = [];
    this.state.waste = [];
    this.state.foundations = Array.from({ length: 4 }, () => []);
    this.state.tableau = Array.from({ length: 7 }, () => []);
  }

  /** DEV: almost-won board so remaining cards can cascade home. */
  private arrangeFinaleDemo(): void {
    if (!this.state) return;
    const cards = this.gatherCards();
    this.emptyBoard();
    const ranks = multiplesUpTo(this.state.multiplier);
    const leftover = ranks.slice(-4);
    const homeRanks = ranks.slice(0, -4);
    SUITS.forEach((suit, column) => {
      homeRanks.forEach((value) => {
        const card = cards.find((item) => item.suit === suit && item.value === value);
        if (!card) return;
        card.faceUp = true;
        this.state!.foundations[column]?.push(card);
      });
      leftover
        .slice()
        .reverse()
        .forEach((value) => {
          const card = cards.find((item) => item.suit === suit && item.value === value);
          if (!card) return;
          card.faceUp = true;
          this.state!.tableau[column]?.push(card);
        });
    });
  }

  /** DEV: every card already home — confetti + win UI only. */
  private arrangeWonDemo(): void {
    if (!this.state) return;
    const cards = this.gatherCards();
    this.emptyBoard();
    const ranks = multiplesUpTo(this.state.multiplier);
    SUITS.forEach((suit, column) => {
      ranks.forEach((value) => {
        const card = cards.find((item) => item.suit === suit && item.value === value);
        if (!card) return;
        card.faceUp = true;
        this.state!.foundations[column]?.push(card);
      });
    });
  }

  /** DEV: plant the level-4 20→24 play and a face-up skip-count run for mid-yank checks. */
  private arrangeLevel4Playtest(): void {
    if (!this.state || this.state.multiplier !== 4) return;
    const take = (value: number, suit: CardModel["suit"]): CardModel | undefined => {
      const card = this.pullCard((item) => item.value === value && item.suit === suit);
      if (card) card.faceUp = true;
      return card;
    };
    const sixteen = take(16, "hearts");
    const twenty = take(20, "hearts");
    const twentyFourA = take(24, "clubs");
    const twentyFourB = take(24, "diamonds");
    const run = [36, 32, 28, 24, 20]
      .map((value) => take(value, "spades"))
      .filter((card): card is CardModel => Boolean(card));
    if (sixteen) this.state.foundations[suitIndex("hearts")] = [sixteen];
    this.state.waste = twenty ? [twenty] : this.state.waste;
    if (twentyFourA) this.state.tableau[1] = [twentyFourA];
    if (twentyFourB) this.state.tableau[5] = [twentyFourB];
    if (run.length === 5) this.state.tableau[3] = run;
  }

  private pulseEmptyKingHint(): void {
    if (!this.state) return;
    const hint = emptyColumnHint(this.state);
    if (!hint) return;
    const pulse = 0.5 + Math.sin(performance.now() / 260) * 0.5;
    this.glowEmptyPads(hint.columns, pulse);
  }

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.snapLayout();
    this.fitCamera();
    this.party?.resize();
  }

  private tick(): void {
    const dt = this.clock.getDelta();
    if (this.particles) {
      this.particles.rotation.y += dt * 0.04;
      const positions = this.particles.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i += 1) {
        const y = positions.getY(i) + dt * 0.16;
        positions.setY(i, y > 9 ? 1 : y);
      }
      positions.needsUpdate = true;
    }

    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      const tween = this.tweens[i];
      if (!tween) continue;
      if (tween.delay > 0) {
        tween.delay -= dt;
        continue;
      }
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration);
      const k = easeOutBack(t);
      tween.group.position.lerpVectors(tween.from, tween.to, k);
      tween.group.position.y += Math.sin(t * Math.PI) * tween.hop;
      const flipper = tween.group.children[0]?.children[0];
      if (flipper) {
        flipper.rotation.x = THREE.MathUtils.lerp(tween.fromFlip, tween.toFlip, easeInOut(t));
      }
      if (t >= 1) {
        tween.group.position.copy(tween.to);
        if (flipper) flipper.rotation.x = tween.toFlip;
        tween.onDone?.();
        this.tweens.splice(i, 1);
      }
    }

    if (this.hintUntil && performance.now() > this.hintUntil) {
      this.hintUntil = 0;
      this.syncHighlights();
    }

    this.pulseEmptyKingHint();
    this.renderer.render(this.scene, this.camera);
  }
}

function setHidden(selector: string, hidden: boolean): void {
  const el = document.querySelector(selector);
  if (el instanceof HTMLElement) el.hidden = hidden;
}

function setText(selector: string, value: string): void {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function disposeMaterials(mesh: THREE.Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((material) => material.dispose());
}
