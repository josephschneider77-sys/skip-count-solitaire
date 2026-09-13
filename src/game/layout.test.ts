import assert from "node:assert/strict";
import { cameraDirection, columnX, layoutForAspect, ndcSideMargin } from "./layout.ts";

const phone = layoutForAspect(390 / 844);
const tablet = layoutForAspect(768 / 1024);
const desktop = layoutForAspect(1280 / 800);

assert.ok(phone.colGap < tablet.colGap);
assert.ok(tablet.colGap <= desktop.colGap);
assert.ok(phone.colGap < 1.42, "portrait columns should overlap slightly");
assert.equal(columnX(3, phone.colGap), 0);
assert.ok(ndcSideMargin(390 / 844) < ndcSideMargin(1280 / 800));

const phoneCam = cameraDirection(390 / 844);
const tabletCam = cameraDirection(768 / 1024);
const desktopCam = cameraDirection(1280 / 800);
assert.ok(phoneCam.y > phoneCam.z, "phone camera should look down onto faces");
assert.ok(tabletCam.y > tabletCam.z, "tablet camera should look down onto faces");
assert.ok(desktopCam.y > desktopCam.z, "desktop camera should look down onto faces");

console.log("layout tests passed");
