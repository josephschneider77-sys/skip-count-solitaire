import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CARD_D,
  CARD_FACE_SPIN,
  CARD_H,
  CARD_LEAN,
  CARD_W,
  CARD_Y,
  cameraDirection,
} from "./layout.ts";

/**
 * Recreates the in-game card/pad transform + gentle top-down camera so we
 * can assert which canvas edge lands at the top of the player's view.
 */
function playCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 80);
  camera.up.set(0, 0, -1);
  const look = new THREE.Vector3(0, CARD_Y, 0);
  const aim = cameraDirection(1);
  const direction = new THREE.Vector3(aim.x, aim.y, aim.z);
  camera.position.copy(look).addScaledVector(direction, 12);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function tilt(obj: THREE.Object3D): void {
  obj.rotation.order = "ZXY";
  obj.rotation.z = CARD_FACE_SPIN;
  obj.rotation.x = CARD_LEAN;
}

type Corner = { u: number; v: number; ndcY: number; ndcX: number };

function uniqueCorners(geo: THREE.BufferGeometry, groupIndex?: number): Corner[] {
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  const index = geo.getIndex();
  const camera = playCamera();
  const ndc = new THREE.Vector3();
  const world = new THREE.Vector3();
  const seen = new Set<number>();
  const corners: Corner[] = [];

  const visit = (vi: number): void => {
    if (seen.has(vi)) return;
    seen.add(vi);
    world.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi)).applyMatrix4(geo.userData.world as THREE.Matrix4);
    ndc.copy(world).project(camera);
    corners.push({ u: uv.getX(vi), v: uv.getY(vi), ndcX: ndc.x, ndcY: ndc.y });
  };

  if (groupIndex !== undefined && index) {
    const group = geo.groups[groupIndex];
    assert.ok(group, `missing geometry group ${groupIndex}`);
    for (let i = group.start; i < group.start + group.count; i += 1) visit(index.getX(i));
  } else if (index) {
    for (let i = 0; i < index.count; i += 1) visit(index.getX(i));
  } else {
    for (let i = 0; i < pos.count; i += 1) visit(i);
  }
  return corners;
}

function worldOf(root: THREE.Object3D, obj: THREE.Object3D): THREE.Matrix4 {
  root.updateMatrixWorld(true);
  return obj.matrixWorld.clone();
}

function meanY(corners: Corner[], pred: (c: Corner) => boolean): number {
  const hits = corners.filter(pred);
  assert.ok(hits.length > 0, "no matching corners");
  return hits.reduce((sum, c) => sum + c.ndcY, 0) / hits.length;
}

const box = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);

function cardCorners(faceUp: boolean, materialIndex: number): Corner[] {
  const mesh = new THREE.Mesh(box);
  const flipper = new THREE.Group();
  flipper.add(mesh);
  flipper.rotation.x = faceUp ? 0 : Math.PI;
  const card = new THREE.Group();
  tilt(card);
  card.add(flipper);
  box.userData.world = worldOf(card, mesh);
  return uniqueCorners(box, materialIndex);
}

const faceUpFront = cardCorners(true, 4);
const faceDownBack = cardCorners(false, 5);

assert.ok(
  meanY(faceUpFront, (c) => c.v > 0.5) > meanY(faceUpFront, (c) => c.v < 0.5),
  "face-up: canvas-top (v=1) must be the top of the player's view so ranks stay upright",
);

assert.ok(
  meanY(faceDownBack, (c) => c.v > 0.5) < meanY(faceDownBack, (c) => c.v < 0.5),
  "face-down: canvas-top of the back lands at screen-bottom — makeBackTexture must paint inverted",
);

const pad = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H));
tilt(pad);
pad.geometry.userData.world = worldOf(pad, pad);
const padCorners = uniqueCorners(pad.geometry);
assert.ok(
  meanY(padCorners, (c) => c.v > 0.5) > meanY(padCorners, (c) => c.v < 0.5),
  "DRAW/HOME pads: canvas-top must stay screen-top",
);

assert.equal(CARD_FACE_SPIN, 0, "do not yaw cards to fix art — paint backs inverted instead");

console.log("orientation tests passed");
