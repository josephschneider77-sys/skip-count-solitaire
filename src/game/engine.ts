import * as THREE from "three";
import { Sfx } from "./audio";
import {
  SUIT_GLYPH,
  SUITS,
  canPlayToFoundation,
  canStackOnTableau,
  dealKlondike,
  drawFromStock,
  findCard,
  foundationCount,
  isTopWasteOrTableau,
  isWon,
  playableFoundationIds,
  removeRun,
  runFrom,
  suitIndex,
  type CardModel,
  type GameState,
} from "./rules";
import { themeFor, type DeckTheme } from "./themes";
import { edgeMaterial, makeBackTexture, makeFaceTexture, makePadTexture, makeTableTexture } from "./textures";

const CARD_W = 1.48;
const CARD_H = 2.1;
const CARD_D = 0.05;
const CARD_LEAN = -0.28;
const COL_GAP = 1.72;
const TABLEAU_Z0 = 0.15;
const CASCADE = 0.48;

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
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly sfx = new Sfx();
  private readonly cards = new Map<string, CardView>();
  private readonly tweens: Tween[] = [];
  private readonly sharedGeo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  private stockPad: THREE.Mesh | null = null;
  private foundationPads: THREE.Mesh[] = [];
  private tableauPads: THREE.Mesh[] = [];

  private state: GameState | null = null;
  private theme: DeckTheme = themeFor(2);
  private selectedId: string | null = null;
  private busy = false;
  private particles: THREE.Points | null = null;
  private hintUntil = 0;

  mount(): void {
    this.setupRenderer();
    this.setupLights();
    this.setupTable();
    this.setupParticles();
    this.bindUi();
    this.fitCamera();
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointerdown", (event) => this.onPointer(event));
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private setupRenderer(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color("#5b1f86");
    this.scene.fog = new THREE.Fog("#5b1f86", 20, 40);
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffd6f8, 0.72));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(-4, 14, 8);
    this.scene.add(key);
    const pink = new THREE.PointLight(0xff4fd8, 18, 28);
    pink.position.set(-6, 4, 2);
    this.scene.add(pink);
    const cyan = new THREE.PointLight(0x7dffd8, 14, 26);
    cyan.position.set(7, 4, 1);
    this.scene.add(cyan);
  }

  private setupTable(): void {
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({
        map: makeTableTexture(),
        roughness: 0.55,
        metalness: 0.12,
      }),
    );
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
    this.stockPad.rotation.x = CARD_LEAN;
    this.stockPad.userData.pad = "stock";
    this.scene.add(this.stockPad);

    for (let i = 0; i < 4; i += 1) {
      const pad = new THREE.Mesh(padGeo.clone(), padMat.clone());
      pad.rotation.x = CARD_LEAN;
      pad.userData.pad = "foundation";
      pad.userData.column = i;
      this.scene.add(pad);
      this.foundationPads.push(pad);
    }
    for (let i = 0; i < 7; i += 1) {
      const pad = new THREE.Mesh(padGeo.clone(), padMat.clone());
      pad.rotation.x = CARD_LEAN;
      pad.userData.pad = "tableau";
      pad.userData.column = i;
      pad.material = new THREE.MeshStandardMaterial({
        color: 0xff8ad8,
        transparent: true,
        opacity: 0.18,
        roughness: 0.6,
      });
      this.scene.add(pad);
      this.tableauPads.push(pad);
    }
    this.placePads();
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
      new THREE.PointsMaterial({ color: 0xffe36a, size: 0.09, transparent: true, opacity: 0.8 }),
    );
    this.scene.add(this.particles);
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
  }

  private showTitle(): void {
    this.clearCards();
    this.state = null;
    setHidden("#title-screen", false);
    setHidden("#win-screen", true);
    setHidden("#hud", true);
    setHidden("#hint-line", true);
  }

  private startLevel(multiplier: number): void {
    this.sfx.select();
    setHidden("#title-screen", true);
    setHidden("#win-screen", true);
    setHidden("#hud", false);
    setHidden("#hint-line", false);
    this.theme = themeFor(multiplier);
    this.selectedId = null;
    this.clearCards();
    this.state = dealKlondike(multiplier);
    this.fitCamera();
    this.refreshPads();
    this.syncHud();
    this.buildCards();
    this.dealIntro();
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
        new THREE.MeshStandardMaterial({ map: face, roughness: 0.35, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ map: back, roughness: 0.4, metalness: 0.08 }),
      ];
      const mesh = new THREE.Mesh(this.sharedGeo, materials);
      const flipper = new THREE.Group();
      flipper.add(mesh);
      const tilt = new THREE.Group();
      tilt.rotation.x = CARD_LEAN;
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
      view.flipper.rotation.y = Math.PI;
    });
    this.busy = true;
    let delay = 0;
    const queue = this.state.tableau.flat();
    queue.forEach((card, index) => {
      const view = this.cards.get(card.id);
      if (!view) return;
      view.group.position.copy(this.stockOrigin());
      view.flipper.rotation.y = Math.PI;
      this.animateTo(view, this.poseFor(card.id), card.faceUp ? 0 : Math.PI, 0.32, delay, () => {
        if (index === queue.length - 1) {
          this.busy = false;
          this.syncHighlights();
        }
      });
      delay += 0.028;
    });
    if (queue.length === 0) this.busy = false;
  }

  private stockOrigin(): THREE.Vector3 {
    return new THREE.Vector3(-5.15, 1.05, -3.35);
  }

  private wasteOrigin(): THREE.Vector3 {
    return new THREE.Vector3(-3.35, 1.05, -3.35);
  }

  private foundationOrigin(column: number): THREE.Vector3 {
    return new THREE.Vector3(-0.15 + column * COL_GAP, 1.05, -3.35);
  }

  private tableauOrigin(column: number, index: number): THREE.Vector3 {
    const x = -3 * COL_GAP + column * COL_GAP;
    return new THREE.Vector3(x, 1.05 + index * 0.01, TABLEAU_Z0 + index * CASCADE);
  }

  private placePads(): void {
    const stock = this.stockOrigin();
    if (this.stockPad) this.stockPad.position.copy(stock);
    this.foundationPads.forEach((pad, i) => pad.position.copy(this.foundationOrigin(i)));
    this.tableauPads.forEach((pad, i) => pad.position.copy(this.tableauOrigin(i, 0)));
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
      return this.wasteOrigin().add(new THREE.Vector3(fan * 0.18, loc.index * 0.01, 0));
    }
    if (loc.pile === "foundation" && loc.column !== undefined) {
      return this.foundationOrigin(loc.column).add(new THREE.Vector3(0, loc.index * 0.012, 0));
    }
    return this.tableauOrigin(loc.column ?? 0, loc.index);
  }

  private fitCamera(): void {
    this.camera.position.set(0, 7.4, 14.2);
    this.camera.lookAt(0, 0.7, 0.4);
    this.camera.updateProjectionMatrix();
  }

  private animateTo(
    view: CardView,
    to: THREE.Vector3,
    toFlip: number,
    duration: number,
    delay: number,
    onDone?: () => void,
  ): void {
    this.tweens.push({
      group: view.group,
      from: view.group.position.clone(),
      to: to.clone(),
      fromFlip: view.flipper.rotation.y,
      toFlip,
      hop: 0.9,
      delay,
      duration,
      elapsed: 0,
      onDone,
    });
  }

  private onPointer(event: PointerEvent): void {
    if (!this.state || this.busy) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [...this.cards.values()].map((view) => view.mesh);
    const pads = [this.stockPad, ...this.foundationPads, ...this.tableauPads].filter((mesh): mesh is THREE.Mesh =>
      Boolean(mesh),
    );
    const hits = this.raycaster.intersectObjects([...meshes, ...pads], false);
    const first = hits[0]?.object;
    if (!first) {
      this.selectedId = null;
      this.syncHighlights();
      return;
    }
    if (first.userData.pad === "stock") {
      this.drawCard();
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

    if (this.selectedId && this.selectedId !== id && loc.pile === "tableau" && loc.column !== undefined) {
      if (this.tryTableauMove(loc.column)) return;
    }

    if (isTopWasteOrTableau(this.state, id) && canPlayToFoundation(this.state, card)) {
      this.moveToFoundation(id);
      return;
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

  private tryFoundation(column?: number): void {
    if (!this.state) return;
    const id = this.selectedId ?? this.state.waste[this.state.waste.length - 1]?.id;
    if (!id) return;
    const run = runFrom(this.state, id);
    if (!run || run.length !== 1) return;
    const card = run[0];
    if (!card || !canPlayToFoundation(this.state, card)) return;
    if (column !== undefined && suitIndex(card.suit) !== column) return;
    this.moveToFoundation(id);
  }

  private tryTableauMove(column: number): boolean {
    if (!this.state || !this.selectedId) return false;
    const run = runFrom(this.state, this.selectedId);
    if (!run || !run[0] || !canStackOnTableau(this.state, run[0], column)) return false;
    this.moveRunToTableau(this.selectedId, column);
    return true;
  }

  private drawCard(): void {
    if (!this.state || this.busy) return;
    const result = drawFromStock(this.state);
    if (result === "empty") return;
    this.sfx.draw();
    this.selectedId = null;
    if (result === "recycle") {
      this.state.stock.forEach((card) => {
        const view = this.cards.get(card.id);
        if (!view) return;
        view.group.position.copy(this.poseFor(card.id));
        view.flipper.rotation.y = Math.PI;
      });
      this.syncHud();
      this.syncHighlights();
      return;
    }
    const card = this.state.waste[this.state.waste.length - 1];
    const view = card ? this.cards.get(card.id) : undefined;
    if (!card || !view) return;
    this.busy = true;
    this.animateTo(view, this.poseFor(card.id), 0, 0.36, 0, () => {
      this.busy = false;
      this.syncHud();
      this.syncHighlights();
    });
    this.syncHud();
  }

  private moveToFoundation(id: string): void {
    if (!this.state) return;
    const run = removeRun(this.state, id);
    const card = run[0];
    if (!card || run.length !== 1) return;
    this.state.foundations[suitIndex(card.suit)]?.push(card);
    const view = this.cards.get(card.id);
    if (!view) return;
    this.busy = true;
    this.selectedId = null;
    this.sfx.place();
    this.relayoutExposed();
    this.animateTo(view, this.poseFor(card.id), 0, 0.34, 0, () => {
      this.busy = false;
      this.refreshPads();
      this.syncHud();
      this.syncHighlights();
      this.checkWin();
    });
    this.refreshPads();
    this.syncHud();
  }

  private moveRunToTableau(id: string, column: number): void {
    if (!this.state) return;
    const run = removeRun(this.state, id);
    if (run.length === 0) return;
    this.state.tableau[column]?.push(...run);
    this.busy = true;
    this.selectedId = null;
    this.sfx.place();
    this.relayoutExposed();
    let left = run.length;
    run.forEach((card, i) => {
      const view = this.cards.get(card.id);
      if (!view) {
        left -= 1;
        return;
      }
      this.animateTo(view, this.poseFor(card.id), 0, 0.3, i * 0.03, () => {
        left -= 1;
        if (left <= 0) {
          this.busy = false;
          this.syncHighlights();
        }
      });
    });
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

  private checkWin(): void {
    if (!this.state || !isWon(this.state)) return;
    this.sfx.win();
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
    setHidden("#win-screen", false);
  }

  private syncHud(): void {
    if (!this.state) return;
    const home = foundationCount(this.state);
    setText("#hud-level", String(this.state.multiplier));
    setText("#hud-next", String(home));
    setText("#hud-theme", this.theme.label);
    const hint = document.querySelector("#hint-line");
    if (hint) {
      hint.textContent = `Klondike: draw, build each suit ${this.state.lowest}→${this.state.highest} by ${this.state.multiplier}s. Stack down and switch colors. Empty columns want ${this.state.highest}. Stock ${this.state.stock.length}.`;
    }
  }

  private syncHighlights(): void {
    if (!this.state) return;
    const playable = new Set(playableFoundationIds(this.state));
    const selectedRun = this.selectedId ? new Set((runFrom(this.state, this.selectedId) ?? []).map((card) => card.id)) : new Set<string>();
    const boost = performance.now() < this.hintUntil;
    this.cards.forEach((view, id) => {
      const mats = view.mesh.material as THREE.MeshStandardMaterial[];
      const face = mats[4];
      if (!face) return;
      const selected = selectedRun.has(id);
      const ready = playable.has(id);
      face.emissive = new THREE.Color(selected ? this.theme.glow : ready ? this.theme.accent2 : "#000000");
      face.emissiveIntensity = selected ? 0.7 : ready ? (boost ? 0.85 : 0.42) : 0;
    });
  }

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 46 : 38;
    this.fitCamera();
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
        flipper.rotation.y = THREE.MathUtils.lerp(tween.fromFlip, tween.toFlip, easeInOut(t));
      }
      if (t >= 1) {
        tween.group.position.copy(tween.to);
        if (flipper) flipper.rotation.y = tween.toFlip;
        tween.onDone?.();
        this.tweens.splice(i, 1);
      }
    }

    if (this.hintUntil && performance.now() > this.hintUntil) {
      this.hintUntil = 0;
      this.syncHighlights();
    }

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
