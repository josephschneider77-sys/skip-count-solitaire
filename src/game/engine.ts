import * as THREE from "three";
import { Sfx } from "./audio";
import {
  canPlayToFoundation,
  canStackOnTableau,
  dealState,
  findCard,
  isTopPlayable,
  nextNeeded,
  playableCardIds,
  removeCard,
  type CardModel,
  type GameState,
} from "./rules";
import { deckValues, tableauColumnCount, themeFor, type DeckTheme } from "./themes";
import { edgeMaterial, makeBackTexture, makeFaceTexture, makeTableTexture } from "./textures";

const CARD_W = 1.28;
const CARD_H = 1.82;
const CARD_D = 0.045;

type CardView = {
  model: CardModel;
  group: THREE.Group;
  flipper: THREE.Group;
  mesh: THREE.Mesh;
  faceUp: boolean;
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
  private foundationPad: THREE.Mesh | null = null;

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
    this.camera.position.set(0, 15.4, 11.2);
    this.camera.lookAt(0, 0, 1.2);
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
    this.scene.fog = new THREE.Fog("#5b1f86", 18, 36);
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
    const lemon = new THREE.PointLight(0xffe36a, 10, 20);
    lemon.position.set(0, 6, 6);
    this.scene.add(lemon);
  }

  private setupTable(): void {
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(16, 64),
      new THREE.MeshStandardMaterial({
        map: makeTableTexture(),
        roughness: 0.55,
        metalness: 0.12,
      }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.04;
    table.receiveShadow = true;
    this.scene.add(table);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(11.4, 12.1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffe36a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);

    const padMat = new THREE.MeshStandardMaterial({
      color: 0xff8ad8,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.42,
    });
    this.stockPad = new THREE.Mesh(new THREE.CircleGeometry(0.95, 36), padMat);
    this.stockPad.rotation.x = -Math.PI / 2;
    this.stockPad.userData.pad = "stock";
    this.scene.add(this.stockPad);
    this.foundationPad = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 36),
      padMat.clone(),
    );
    this.foundationPad.rotation.x = -Math.PI / 2;
    this.foundationPad.userData.pad = "foundation";
    this.scene.add(this.foundationPad);
    this.placePads();
  }

  private setupParticles(): void {
    const count = 160;
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
      new THREE.PointsMaterial({ color: 0xffe36a, size: 0.09, transparent: true, opacity: 0.85 }),
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
    const values = deckValues(multiplier);
    this.state = dealState(multiplier, values, tableauColumnCount(values.length));
    this.syncHud();
    this.buildCards();
    this.dealIntro();
  }

  private clearCards(): void {
    this.tweens.length = 0;
    this.cards.forEach((view) => {
      this.scene.remove(view.group);
      view.mesh.material && disposeMaterials(view.mesh);
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

  private buildCards(): void {
    if (!this.state) return;
    const back = this.tex(`back-${this.theme.multiplier}`, () => makeBackTexture(this.theme));
    const edge = edgeMaterial(this.theme.accent);
    const all = [...this.state.stock, ...this.state.waste, ...this.state.foundation, ...this.state.tableau.flat()];
    all.forEach((model) => {
      const face = this.tex(`face-${model.multiplier}-${model.value}`, () => makeFaceTexture(this.theme, model.value));
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
      tilt.rotation.x = -Math.PI / 2;
      tilt.add(flipper);
      const group = new THREE.Group();
      group.add(tilt);
      group.userData.cardId = model.id;
      mesh.userData.cardId = model.id;
      this.scene.add(group);
      this.cards.set(model.id, { model, group, flipper, mesh, faceUp: false });
    });
  }

  private dealIntro(): void {
    if (!this.state) return;
    this.placePads();
    this.busy = true;
    this.state.stock.forEach((card) => {
      const view = this.cards.get(card.id);
      if (!view) return;
      view.faceUp = false;
      view.group.position.copy(this.poseFor(card.id).position);
      view.flipper.rotation.y = Math.PI;
    });
    let delay = 0;
    const queue: CardModel[] = [];
    this.state.tableau.forEach((col) => queue.push(...col));
    queue.forEach((card, index) => {
      const view = this.cards.get(card.id);
      if (!view) return;
      view.faceUp = true;
      view.group.position.copy(this.stockPose(0).position);
      view.flipper.rotation.y = Math.PI;
      this.animateTo(view, this.poseFor(card.id).position, 0, 0.44, delay, () => {
        if (index === queue.length - 1) this.busy = false;
      });
      delay += 0.045;
    });
    if (queue.length === 0) this.busy = false;
  }

  private placePads(): void {
    const origin = this.stockOrigin();
    if (this.stockPad) this.stockPad.position.set(origin.x, 0.02, origin.z);
    if (this.foundationPad) {
      const right = origin.x + Math.max(9.2, ((this.state?.tableau.length ?? 4) + 1) * 1.55);
      this.foundationPad.position.set(right, 0.02, origin.z);
    }
  }

  private stockOrigin(): THREE.Vector3 {
    const columns = this.state?.tableau.length ?? 4;
    return new THREE.Vector3(-Math.max(4.2, columns * 0.82), 0, -3.15);
  }

  private stockPose(indexFromTop: number): { position: THREE.Vector3 } {
    const origin = this.stockOrigin();
    return { position: new THREE.Vector3(origin.x, 0.03 + indexFromTop * 0.012, origin.z) };
  }

  private poseFor(id: string): { position: THREE.Vector3 } {
    if (!this.state) return { position: new THREE.Vector3() };
    const loc = findCard(this.state, id);
    const origin = this.stockOrigin();
    if (!loc) return { position: origin.clone() };
    if (loc.pile === "stock") {
      const fromBottom = loc.index;
      return { position: new THREE.Vector3(origin.x, 0.03 + fromBottom * 0.012, origin.z) };
    }
    if (loc.pile === "waste") {
      return { position: new THREE.Vector3(origin.x + 1.7, 0.04 + loc.index * 0.012, origin.z + 0.08 * Math.min(loc.index, 3)) };
    }
    if (loc.pile === "foundation") {
      const right = origin.x + Math.max(9.2, (this.state.tableau.length + 1) * 1.55);
      return { position: new THREE.Vector3(right, 0.05 + loc.index * 0.014, origin.z) };
    }
    const columns = this.state.tableau.length;
    const span = (columns - 1) * 1.58;
    const x = -span / 2 + (loc.column ?? 0) * 1.58;
    const z = -0.35 + loc.index * 0.46;
    return { position: new THREE.Vector3(x, 0.04 + loc.index * 0.01, z) };
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
      hop: 0.55,
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
    const pads = [this.stockPad, this.foundationPad].filter((mesh): mesh is THREE.Mesh => Boolean(mesh));
    const hits = this.raycaster.intersectObjects([...meshes, ...pads], false);
    const first = hits[0]?.object;
    if (first?.userData.pad === "stock") {
      this.drawCard();
      return;
    }
    if (first?.userData.pad === "foundation") {
      this.tryMoveSelectedToFoundation();
      return;
    }
    const id = first?.userData.cardId as string | undefined;
    if (!id) {
      this.tryEmptyTableauClick();
      return;
    }
    const loc = findCard(this.state, id);
    if (!loc) return;
    if (loc.pile === "stock") {
      this.drawCard();
      return;
    }
    if (loc.pile === "foundation") {
      if (this.selectedId) this.tryMoveSelectedToFoundation();
      return;
    }
    this.onCardTapped(id);
  }

  private tryEmptyTableauClick(): void {
    if (!this.state || !this.selectedId) return;
    const selected = this.cards.get(this.selectedId);
    if (!selected) return;
    for (let column = 0; column < this.state.tableau.length; column += 1) {
      if (this.state.tableau[column]?.length) continue;
      if (canStackOnTableau(this.state, selected.model, column)) {
        this.moveToTableau(this.selectedId, column);
        return;
      }
    }
  }

  private onCardTapped(id: string): void {
    if (!this.state) return;
    const loc = findCard(this.state, id);
    if (!loc) return;
    if (loc.pile === "tableau" && this.selectedId && this.selectedId !== id) {
      const selected = this.cards.get(this.selectedId)?.model;
      if (selected && loc.column !== undefined && canStackOnTableau(this.state, selected, loc.column)) {
        this.moveToTableau(this.selectedId, loc.column);
        return;
      }
    }
    if (!isTopPlayable(this.state, id)) {
      this.selectedId = null;
      this.syncHighlights();
      return;
    }
    const model = this.cards.get(id)?.model;
    if (model && canPlayToFoundation(this.state, model)) {
      this.moveToFoundation(id);
      return;
    }
    this.selectedId = this.selectedId === id ? null : id;
    this.sfx.select();
    this.syncHighlights();
  }

  private tryMoveSelectedToFoundation(): void {
    if (!this.state || !this.selectedId) return;
    const model = this.cards.get(this.selectedId)?.model;
    if (model && canPlayToFoundation(this.state, model)) this.moveToFoundation(this.selectedId);
  }

  private drawCard(): void {
    if (!this.state || this.busy) return;
    if (this.state.stock.length === 0) {
      if (this.state.waste.length === 0) return;
      this.state.stock = this.state.waste.reverse();
      this.state.waste = [];
      this.state.stock.forEach((card) => {
        const view = this.cards.get(card.id);
        if (!view) return;
        view.faceUp = false;
        this.animateTo(view, this.poseFor(card.id).position, Math.PI, 0.28, 0);
      });
      this.sfx.draw();
      this.selectedId = null;
      this.syncHighlights();
      return;
    }
    const card = this.state.stock.pop();
    if (!card) return;
    this.state.waste.push(card);
    const view = this.cards.get(card.id);
    if (!view) return;
    this.busy = true;
    view.faceUp = true;
    this.sfx.draw();
    this.animateTo(view, this.poseFor(card.id).position, 0, 0.38, 0, () => {
      this.busy = false;
      this.syncHighlights();
    });
    this.selectedId = null;
  }

  private moveToFoundation(id: string): void {
    if (!this.state) return;
    const card = removeCard(this.state, id);
    if (!card) return;
    this.state.foundation.push(card);
    const view = this.cards.get(id);
    if (!view) return;
    this.busy = true;
    this.selectedId = null;
    this.sfx.place();
    this.animateTo(view, this.poseFor(id).position, 0, 0.36, 0, () => {
      this.busy = false;
      this.syncHud();
      this.syncHighlights();
      this.checkWin();
    });
    this.syncHud();
  }

  private moveToTableau(id: string, column: number): void {
    if (!this.state) return;
    const card = removeCard(this.state, id);
    if (!card) return;
    this.state.tableau[column]?.push(card);
    const view = this.cards.get(id);
    if (!view) return;
    this.busy = true;
    this.selectedId = null;
    this.sfx.place();
    this.animateTo(view, this.poseFor(id).position, 0, 0.32, 0, () => {
      this.busy = false;
      this.syncHighlights();
    });
  }

  private showHint(): void {
    if (!this.state) return;
    this.hintUntil = performance.now() + 2200;
    this.syncHighlights();
    this.sfx.select();
  }

  private checkWin(): void {
    if (!this.state) return;
    const total = deckValues(this.state.multiplier).length;
    if (this.state.foundation.length < total) return;
    this.sfx.win();
    const last = this.state.multiplier >= 10;
    const winTitle = document.querySelector("#win-title");
    const winBlurb = document.querySelector("#win-blurb");
    const nextBtn = document.querySelector("#btn-next");
    if (winTitle) winTitle.textContent = last ? "Rainbow champion!" : "Sparkle clear!";
    if (winBlurb) {
      winBlurb.textContent = last
        ? "You skip-counted every deck from 2's through 10's!"
        : `The ${this.theme.label} deck is complete. Ready for the next multiples?`;
    }
    if (nextBtn) nextBtn.textContent = last ? "Play again" : "Next level";
    setHidden("#win-screen", false);
  }

  private syncHud(): void {
    if (!this.state) return;
    setText("#hud-level", String(this.state.multiplier));
    setText("#hud-next", String(nextNeeded(this.state)));
    setText("#hud-theme", this.theme.label);
    const hint = document.querySelector("#hint-line");
    if (hint) {
      hint.textContent = `Tap the deck to draw. Build ${this.theme.label} : ${this.state.multiplier}, ${this.state.multiplier * 2}, ${this.state.multiplier * 3}…`;
    }
  }

  private syncHighlights(): void {
    if (!this.state) return;
    const playable = new Set(playableCardIds(this.state));
    const showHint = performance.now() < this.hintUntil;
    this.cards.forEach((view, id) => {
      const mats = view.mesh.material as THREE.MeshStandardMaterial[];
      const face = mats[4];
      if (!face) return;
      const selected = this.selectedId === id;
      const hinted = showHint && playable.has(id);
      face.emissive = new THREE.Color(selected ? this.theme.glow : hinted ? this.theme.accent2 : "#000000");
      face.emissiveIntensity = selected ? 0.55 : hinted ? 0.4 : 0;
    });
  }

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 50 : 42;
    this.camera.updateProjectionMatrix();
  }

  private tick(): void {
    const dt = this.clock.getDelta();
    if (this.particles) {
      this.particles.rotation.y += dt * 0.04;
      const positions = this.particles.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i += 1) {
        const y = positions.getY(i) + dt * 0.18;
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
