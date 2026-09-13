import assert from "node:assert/strict";
import {
  CARD_LEAN,
  cameraDirection,
  columnX,
  layoutForAspect,
  ndcSideMargin,
  orthoHalfExtents,
} from "./layout.ts";

const phone = layoutForAspect(390 / 844);
const tablet = layoutForAspect(768 / 1024);
const desktop = layoutForAspect(1280 / 800);

assert.ok(phone.colGap < tablet.colGap);
assert.ok(tablet.colGap <= desktop.colGap);
assert.ok(phone.colGap < 1.42, "portrait columns should overlap slightly");
assert.equal(columnX(3, phone.colGap), 0);
assert.ok(ndcSideMargin(390 / 844) < ndcSideMargin(1280 / 800));

assert.ok(Math.abs(CARD_LEAN + Math.PI / 2) < 0.25, "cards should lie almost flat");

const phoneCam = cameraDirection(390 / 844);
const desktopCam = cameraDirection(1280 / 800);
assert.ok(phoneCam.y > 0.95, "phone camera should be nearly straight down");
assert.ok(desktopCam.y > 0.95, "desktop camera should be nearly straight down");
assert.ok(phoneCam.y > phoneCam.z * 8);
assert.ok(desktopCam.y > desktopCam.z * 8);

const phoneView = orthoHalfExtents(10, 8, 390 / 844, 0.04, 0.2, 0.15);
assert.ok(phoneView.halfW / phoneView.halfH - 390 / 844 < 0.01);

console.log("layout tests passed");
