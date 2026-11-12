// The body below the head: skeleton, organs, muscles and skin from BodyParts3D, each piece stored in the frame of
// the segment that carries it (see tools/build-body.mjs) and pinned to the body tracker's points every frame.
// Everything is drawn in picture pixels with the flat camera, like the hand bones.
import * as THREE from "three";
import meta from "./anatomy/body.json";
import binUrl from "./anatomy/body.bin?url";
import { OneEuro, OneEuro3 } from "./filter.js";

export const BODY_META = meta;
// layer -> [x-ray colour, solid colour, x-ray glow]
export const BODY_LAYERS = {
  spine: [0xbfe3ff, 0xe9e2cf, 0.7], pelvis: [0xbfe3ff, 0xe9e2cf, 0.7], ribs: [0xbfe3ff, 0xe9e2cf, 0.6], shoulders: [0xbfe3ff, 0xe9e2cf, 0.7],
  arms: [0xbfe3ff, 0xe9e2cf, 0.8], legs: [0xbfe3ff, 0xe9e2cf, 0.8], feet: [0xbfe3ff, 0xe9e2cf, 0.7],
  heart: [0xff5d73, 0xb3303d, 0.7], lungs: [0xff9fc0, 0xd8909b, 0.45], liver: [0xffa25e, 0x8f3b26, 0.7], stomach: [0xffd27a, 0xd6a07c, 0.7],
  intestines: [0xffbf9c, 0xcf8f76, 0.5], kidneys: [0xff7f6b, 0x9a3a2b, 0.8], pancreas: [0xfff08a, 0xe0c27a, 0.8], diaphragm: [0xd59bff, 0xa86c7a, 0.5],
  trunkMuscles: [0xff6b5e, 0xa8382f, 0.4], armMuscles: [0xff6b5e, 0xa8382f, 0.45], legMuscles: [0xff6b5e, 0xa8382f, 0.4],
  bodyOutline: [0x6fb6ff, 0x6fb6ff, 0.55],
};
export const BODY_LAYER_KEYS = Object.keys(BODY_LAYERS);
const LABEL_INK = { bone: "#d9f0ff", organ: "#ffd0dc", muscle: "#ffb3aa" };
const inkOf = layer => /Muscles$/.test(layer) ? LABEL_INK.muscle : BODY_LAYERS[layer] && BODY_LAYERS[layer][0] === 0xbfe3ff ? LABEL_INK.bone : LABEL_INK.organ;
const POSE_IDS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

export async function createBody({ scene, material }) {
  const res = await fetch(binUrl);
  if (!res.ok) throw new Error("body data " + res.status);
  const buf = await res.arrayBuffer();
  const segs = {};
  for (const [k, s] of Object.entries(meta.segments)) {
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    segs[k] = { ...s, key: k, group, meshes: [], matrix: new THREE.Matrix4(), hip: new THREE.Matrix4(), on: false };
  }
  const meshes = [];
  for (const m of meta.meshes) {
    const q = new Uint16Array(buf, m.offV, m.nv * 3), pos = new Float32Array(m.nv * 3);
    for (let i = 0; i < q.length; i++) pos[i] = m.min[i % 3] + q[i] / 65535 * m.size[i % 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, m.offI, m.ni).slice(), 1));
    geo.computeVertexNormals();
    const [tint, body] = BODY_LAYERS[m.layer] || [0xffffff, 0xffffff];
    const mat = material(tint, body, 0);
    mat.uniforms.uFlatView.value = 1;
    if (m.seg === "torso") mat.uniforms.uBlend.value = 1;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
    mesh.renderOrder = m.layer === "bodyOutline" ? 1 : /Muscles$/.test(m.layer) ? 2 : 4;
    segs[m.seg].group.add(mesh); segs[m.seg].meshes.push(mesh);
    meshes.push({ mesh, layer: m.layer, seg: m.seg, fixed: m.layer === "bodyOutline" });
  }

  // tracker points in picture pixels (x right, y up, z toward the camera), each with its own adaptive filter
  const P = {}, vis = {}, filt = {};
  for (const i of POSE_IDS) { P[i] = new THREE.Vector3(); vis[i] = 0; filt[i] = i === 23 || i === 24 ? new OneEuro3(0.3, 0.006) : new OneEuro3(0.55, 0.018); }
  const scaleF = new OneEuro(0.4, 0), V = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), e3 = new THREE.Vector3(), h1 = new THREE.Vector3();
  const front = new THREE.Vector3(), up = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), mid = new THREE.Vector3();
  const shMid = new THREE.Vector3(), down = new THREE.Vector3(), hipGuess = new THREE.Vector3();
  let found = false, lostAt = 0, torsoCenterX = 0, torsoHalf = 100, pxPerCm = 1, deadRef = 0;
  const fresh = {}; for (const i of POSE_IDS) fresh[i] = true;
  // The tracker's body depth swings by a third of the picture on a still image, so it is left out: the body is
  // placed facing the camera (turning still narrows it through the shoulder width) and nothing twists by itself.

  // how far the torso is turned: its shoulders look narrower than when it faces the camera, measured against the
  // face's size (which doesn't change when only the body turns); the normal front-on proportion is learnt as it goes
  const ratioF = new OneEuro(0.6, 0), sideF = new OneEuro(0.4, 0), rawZ = {};
  let frontRatio = 0, turnSide = 1, turnCos = 1;
  function update(lms, W, H, now = performance.now(), headRef = 0) {
    if (!lms) {   // keep the last pose for a moment, so a single missed frame doesn't make it blink
      if (found && now - lostAt > 400) { found = false; for (const s of Object.values(segs)) s.group.visible = false; for (const i of POSE_IDS) { filt[i].reset(); fresh[i] = true; } scaleF.reset(); deadRef = 0; }
      if (!lostAt) lostAt = now;
      return;
    }
    lostAt = 0;
    for (const i of POSE_IDS) {
      const p = lms[i]; if (!p) continue;
      const v = p.visibility === undefined ? 1 : p.visibility;
      vis[i] += (v - vis[i]) * 0.3;
      rawZ[i] = p.z || 0;
      if (found && v < 0.3) continue;   // a point the camera can't see keeps its last place instead of jumping
      V.set(p.x * W, (1 - p.y) * H, 0);
      filt[i].filter(V, now);
      // dead zone: a point only moves once the tracker clearly says it moved, then follows smoothly
      const dead = (fresh[i] ? 0 : 0.05) * deadRef, d = V.distanceTo(P[i]);
      if (d > dead) P[i].lerp(V, (d - dead) / d);
      fresh[i] = false;
    }
    found = true;
    if (window.__bodyPose) window.__bodyDrawn = POSE_IDS.map(i => [i, P[i].x, P[i].y]);   // test mode only
    // one steady body scale (pixels per cm) from the shoulder width
    e1.subVectors(P[11], P[12]);
    const flatW = Math.hypot(e1.x, e1.y);
    if (headRef > 1) {
      const r = ratioF.filter(flatW / headRef, now);
      frontRatio = Math.max(r, frontRatio * 0.9999, 3.4);   // widest seen = facing the camera (slowly forgotten)
      turnCos = THREE.MathUtils.clamp(r / frontRatio, 0.22, 1);
    } else turnCos += (1 - turnCos) * 0.05;   // no face to compare with: ease back to facing the camera
    // which way: only the averaged sign of the tracker's depth (which shoulder is nearer), never its noisy size
    const side = sideF.filter((rawZ[12] || 0) - (rawZ[11] || 0), now);
    if (Math.abs(side) > 0.04) turnSide = Math.sign(side);
    e1.z = turnSide * flatW * Math.tan(Math.acos(turnCos));   // the shoulder line in 3D
    pxPerCm = scaleF.filter(e1.length() / meta.shoulderW, now);
    deadRef = pxPerCm * meta.shoulderW;   // shoulder width in pixels: the size of the dead zone scales with the body
    shMid.addVectors(P[11], P[12]).multiplyScalar(0.5);
    // hips out of view (sitting at a desk): place them below the shoulders from the body's proportions
    down.set(e1.y, -e1.x, 0).normalize(); if (down.y > 0) down.negate();
    hipGuess.copy(shMid).addScaledVector(down, meta.torsoH * pxPerCm);
    const hipSeen = THREE.MathUtils.clamp((Math.min(vis[23], vis[24]) - 0.6) / 0.25, 0, 1);   // half-hidden hips wander: trust them only when clearly seen
    mid.addVectors(P[23], P[24]).multiplyScalar(0.5).lerp(hipGuess, 1 - hipSeen);
    // torso: shoulder frame above, hip frame below (same width: the pelvis follows the shoulders' scale), blended in the shader
    const T = segs.torso;
    e2.subVectors(shMid, mid);
    front.crossVectors(e1, e2).normalize(); up.copy(e2).normalize();   // turns with the torso, so organs show their depth from the side
    e3.copy(front).multiplyScalar(pxPerCm * Math.sqrt(meta.shoulderW * meta.torsoH));
    h1.subVectors(P[23], P[24]);
    if (hipSeen < 0.5 || h1.lengthSq() < 1) h1.copy(e1); else { h1.z = 0; h1.setLength(flatW); h1.z = e1.z; }
    T.matrix.makeBasis(e1, e2, e3).setPosition(mid);
    T.hip.makeBasis(h1, e2, e3).setPosition(mid);
    T.on = showOrHide(T.on, Math.min(vis[11], vis[12]));
    torsoCenterX = mid.x; torsoHalf = e1.length() / 2;
    for (const s of Object.values(segs)) {
      if (s.kind !== "limb") continue;
      const a = P[s.a], b = P[s.b];
      X.subVectors(b, a);
      const ref = s.ref === "up" ? up : front, xh = X.clone().normalize();
      Y.copy(ref).addScaledVector(xh, -ref.dot(xh));
      if (Y.lengthSq() < 1e-6) Y.set(1, 0, 0).addScaledVector(xh, -xh.x);
      Y.normalize(); Z.crossVectors(xh, Y);
      const thick = s.len * pxPerCm;   // thickness from the steady body scale, not from the noisy length
      s.matrix.makeBasis(X, Y.multiplyScalar(thick), Z.multiplyScalar(thick)).setPosition(a);
      s.on = showOrHide(s.on, Math.min(vis[s.a], vis[s.b]));
    }
  }
  // show a part once the camera clearly sees it, hide it only once it clearly doesn't (no flicker in between)
  const showOrHide = (on, v) => on ? v > 0.4 : v > 0.65;

  function apply(S, gainFor) {
    const solid = S.style === "solid";
    let any = false;
    for (const s of Object.values(segs)) {
      s.group.visible = found && s.on;
      for (const mesh of s.meshes) {
        mesh.matrix.copy(s.matrix); mesh.matrixWorldNeedsUpdate = true;
        if (s.kind === "torso") { mesh.material.uniforms.uTorsoA.value.copy(s.matrix); mesh.material.uniforms.uTorsoB.value.copy(s.hip); }
      }
    }
    for (const m of meshes) {
      const on = !!S[m.layer];
      m.mesh.visible = on; any = any || on;
      const u = m.mesh.material.uniforms;
      u.uGain.value = solid && !m.fixed ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * BODY_LAYERS[m.layer][2] * gainFor(m.layer);
      u.uEdge.value = S.feather * 0.75;
    }
    return any;
  }
  function eachMaterial(fn) { for (const m of meshes) fn(m.mesh.material, m); }

  const L3 = new THREE.Vector3(), A4 = new THREE.Vector3(), B4 = new THREE.Vector3();
  // label anchors on screen (heads-up layer pixels: flipped like the picture)
  function labelItems(S, lens, translate) {
    if (!found) return null;
    const items = [];
    for (const l of meta.labels) {
      if (!S[l.layer]) continue;
      for (const at of l.at) {
        const s = segs[at.seg]; if (!s.on) continue;
        L3.fromArray(at.pt);
        if (s.kind === "torso") {
          const t = THREE.MathUtils.smoothstep(at.pt[1], 0, 0.85);
          A4.copy(L3).applyMatrix4(s.matrix); B4.copy(L3).applyMatrix4(s.hip); L3.lerpVectors(B4, A4, t);
        } else L3.applyMatrix4(s.matrix);
        const x = W_() - L3.x, y = H_() - L3.y;
        if (lens && Math.hypot(x - lens.x, y - lens.y) > lens.r) continue;
        items.push({ text: translate(l.t), color: inkOf(l.layer), ax: x, ay: y });
        break;   // one anchor per structure
      }
    }
    return { items, cx: W_() - torsoCenterX, half: torsoHalf * 1.15 };
  }
  let W_ = () => 640, H_ = () => 480;
  function setSize(getW, getH) { W_ = getW; H_ = getH; }

  // a dark veil over the real body from the tracker's person mask, so the anatomy reads clearly
  const maskCanvas = document.createElement("canvas");
  let steady = null;   // the mask averaged over the last few frames, so its edge doesn't shimmer
  function drawVeil(g, mask, alpha, blurPx) {
    if (!mask || alpha <= 0.01) return;
    const { data, width, height } = mask;
    if (maskCanvas.width !== width || maskCanvas.height !== height) { maskCanvas.width = width; maskCanvas.height = height; steady = null; }
    if (!steady) steady = Float32Array.from(data); else for (let i = 0; i < data.length; i++) steady[i] += (data[i] - steady[i]) * 0.35;
    const mg = maskCanvas.getContext("2d"), img = mg.createImageData(width, height);
    for (let i = 0; i < steady.length; i++) { const o = 4 * i; img.data[o] = 4; img.data[o + 1] = 7; img.data[o + 2] = 13; img.data[o + 3] = Math.round(Math.min(1, steady[i] * 1.2) * 255); }
    mg.putImageData(img, 0, 0);
    g.save(); g.filter = blurPx > 0.5 ? `blur(${blurPx.toFixed(1)}px)` : "none"; g.globalAlpha = alpha;
    g.drawImage(maskCanvas, 0, 0, g.canvas.width, g.canvas.height);
    g.restore();
  }

  return { update, apply, eachMaterial, labelItems, setSize, drawVeil, get found() { return found; } };
}
