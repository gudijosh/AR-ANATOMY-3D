// The body below the head: skeleton, organs, blood vessels, muscles and skin from BodyParts3D, nerves, tendons and ligaments from Z-Anatomy, each piece stored in the frame of
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
  arteries: [0xff4d5e, 0xc2242f, 0.9], veins: [0x6f8dff, 0x3350b8, 0.9], nerves: [0xffe066, 0xe6c43c, 0.9], tendons: [0xe8e4d4, 0xd9d2bd, 0.6],
  bodyOutline: [0x6fb6ff, 0x6fb6ff, 0.55],
};
export const BODY_LAYER_KEYS = Object.keys(BODY_LAYERS);
// blood vessels are also switched by zone of the body (the head's are drawn with the head)
const VESSELS = new Set(["arteries", "veins"]);
const vesselZone = seg => seg === "torso" ? "vTorso" : /arm/.test(seg) ? "vArms" : "vLegs";
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
  const meshes = [], headParts = [];   // headParts: pieces above the neck, which the head tracker carries (the overlay adds them to the head)
  for (const m of meta.meshes) {
    const q = new Uint16Array(buf, m.offV, m.nv * 3), pos = new Float32Array(m.nv * 3);
    for (let i = 0; i < q.length; i++) pos[i] = m.min[i % 3] + q[i] / 65535 * m.size[i % 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, m.offI, m.ni).slice(), 1));
    geo.computeVertexNormals();
    if (m.seg === "head") { headParts.push({ layer: m.layer, geo }); continue; }
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

  // The body's size comes from things that keep their size on screen when the body turns: the face (eye corners)
  // and the torso's height (shoulders to hips). Each one's normal proportion to the shoulder width is learnt while
  // the person faces the camera (the widest shoulders seen). With neither in view (side-on, face lost, hips out of
  // the picture) the last size is kept, so the body no longer shrinks when the person turns.
  // How far the torso is turned then follows from how narrow the shoulders look against that size.
  const ratioF = new OneEuro(0.6, 0), ratioTF = new OneEuro(0.6, 0), sideF = new OneEuro(0.4, 0), rawZ = {};
  const HEAD_RATIO = [2.6, 4.8], TORSO_K = meta.shoulderW / meta.torsoH, TORSO_RATIO = [TORSO_K * 0.75, TORSO_K * 1.3];
  let frontRatio = 0, frontRatioT = 0, haveScale = false, turnSide = 1, turnCos = 1, lastUpdate = 0;
  let shOn = false;
  const LIMB_SPAN = 1;   // a limb segment's joints are one segment length apart
  const J = meta.joints, FOOT_CM = Math.hypot(J[31][0] - J[29][0], J[31][1] - J[29][1], J[31][2] - J[29][2]);   // heel to toes
  const fx3 = new THREE.Vector3(), fu3 = new THREE.Vector3();
  const GAP_MS = 300;
  function update(lms, W, H, now = performance.now(), headRef = 0, world = null) {
    if (!lms) {   // keep the last pose for a moment, so a single missed frame doesn't make it blink
      if (found && now - lostAt > 400) { found = false; for (const s of Object.values(segs)) s.group.visible = false; for (const i of POSE_IDS) { filt[i].reset(); fresh[i] = true; } scaleF.reset(); haveScale = false; deadRef = 0; }
      if (!lostAt) lostAt = now;
      return;
    }
    lostAt = 0;
    // a long pause between frames (the tab was in the background, or the page was busy): start the smoothing afresh
    // from what the tracker sees now, instead of easing for seconds from stale values (which swelled the body)
    if (lastUpdate && now - lastUpdate > GAP_MS) {
      for (const i of POSE_IDS) { filt[i].reset(); fresh[i] = true; }
      scaleF.reset(); ratioF.reset(); ratioTF.reset(); sideF.reset();
    }
    lastUpdate = now;
    for (const i of POSE_IDS) {
      const p = lms[i]; if (!p) continue;
      // a point outside the picture is a guess, however sure the tracker says it is: it counts as not seen
      const inside = p.x > -0.03 && p.x < 1.03 && p.y > -0.03 && p.y < 1.03;
      const v = !inside ? 0 : p.visibility === undefined ? 1 : p.visibility;
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
    // Shoulders in view: the whole body is placed from the torso. Shoulders out of view (the camera is on someone's
    // legs or feet, or on an arm): only the limbs are drawn, sized from the limbs themselves.
    // The size the legs and feet say the body has. When the camera is close on a leg or a foot the tracker still
    // guesses a whole small body squeezed into the picture; a torso far smaller than the legs call for is that guess,
    // not a real torso, and is left out (it used to put a spine and ribs across the foot).
    let legScale = 0;
    for (const s of Object.values(segs)) {
      if (s.kind !== "limb" || s.a < 23 || Math.min(vis[s.a], vis[s.b]) < 0.6) continue;
      legScale = Math.max(legScale, Math.hypot(P[s.b].x - P[s.a].x, P[s.b].y - P[s.a].y) / s.len);
    }
    for (const [heel, toe] of [[29, 31], [30, 32]]) if (Math.min(vis[heel], vis[toe]) >= 0.6)
      legScale = Math.max(legScale, Math.hypot(P[toe].x - P[heel].x, P[toe].y - P[heel].y) / FOOT_CM);
    let torsoScale = Math.hypot(P[11].x - P[12].x, P[11].y - P[12].y) / meta.shoulderW;
    if (Math.min(vis[23], vis[24]) > 0.5) torsoScale = Math.max(torsoScale,
      Math.hypot((P[11].x + P[12].x - P[23].x - P[24].x) / 2, (P[11].y + P[12].y - P[23].y - P[24].y) / 2) / meta.torsoH);
    const torsoReal = !(legScale > 0 && torsoScale < legScale * (shOn ? 0.5 : 0.62));
    shOn = torsoReal && showOrHide(shOn, Math.min(vis[11], vis[12]));
    if (shOn) {
      // one steady body scale (pixels per cm)
      e1.subVectors(P[11], P[12]);
      const flatW = Math.hypot(e1.x, e1.y);
      shMid.addVectors(P[11], P[12]).multiplyScalar(0.5);
      const hipSeen = THREE.MathUtils.clamp((Math.min(vis[23], vis[24]) - 0.6) / 0.25, 0, 1);   // half-hidden hips wander: trust them only when clearly seen
      let sum = 0, n = 0;
      if (headRef > 1) {   // from the face
        const r = ratioF.filter(flatW / headRef, now);
        frontRatio = THREE.MathUtils.clamp(Math.max(r, frontRatio * 0.9997), HEAD_RATIO[0], HEAD_RATIO[1]);   // widest seen = facing the camera (slowly forgotten)
        sum += headRef * frontRatio / meta.shoulderW; n++;
      }
      if (hipSeen > 0.5) {   // from the torso's height
        const torsoLen = Math.hypot(shMid.x - (P[23].x + P[24].x) / 2, shMid.y - (P[23].y + P[24].y) / 2);
        if (torsoLen > 1) {
          const r = ratioTF.filter(flatW / torsoLen, now);
          frontRatioT = THREE.MathUtils.clamp(Math.max(r, frontRatioT * 0.9997), TORSO_RATIO[0], TORSO_RATIO[1]);
          sum += torsoLen * frontRatioT / meta.shoulderW; n++;
        }
      }
      const flatScale = flatW / meta.shoulderW;   // the least it can be: turning only ever narrows the shoulders
      const target = Math.max(flatScale, n ? sum / n : haveScale ? pxPerCm : flatScale);
      pxPerCm = scaleF.filter(target, now); haveScale = true;
      const fullW = pxPerCm * meta.shoulderW;   // the shoulders' real width in pixels
      turnCos = THREE.MathUtils.clamp(flatW / fullW, 0.08, 1);
      // which way: only the averaged sign of the tracker's depth (which shoulder is nearer), never its noisy size;
      // the tracker's metric 3D points are steadier for this than the picture ones
      const dz = world && world[11] && world[12] ? ((world[12].z || 0) - (world[11].z || 0)) * 0.8 : (rawZ[12] || 0) - (rawZ[11] || 0);
      const side = sideF.filter(dz, now);
      if (Math.abs(side) > 0.04) turnSide = Math.sign(side);
      // small differences are measuring noise, not a turn: facing roughly forward the torso stays flat to the camera
      const turned = 1 - THREE.MathUtils.smoothstep(turnCos, 0.84, 0.96);
      e1.z = turnSide * turned * Math.sqrt(Math.max(0, fullW * fullW - flatW * flatW));   // the shoulder line in 3D
      deadRef = fullW;   // shoulder width in pixels: the size of the dead zone scales with the body
      // hips out of view (sitting at a desk): place them below the shoulders from the body's proportions;
      // side-on the shoulder line is too short to give a direction, so "below" leans on straight down instead
      down.set(e1.y, -e1.x, 0); if (down.y > 0) down.negate();
      down.setLength(turnCos).y -= 1 - turnCos; down.normalize();
      hipGuess.copy(shMid).addScaledVector(down, meta.torsoH * pxPerCm);
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
      T.on = true;
      torsoCenterX = mid.x; torsoHalf = Math.max(e1.length(), fullW * 0.5) / 2;
    } else {
      // a limb only ever looks shorter than it is (pointing at the camera), so the longest-looking one gives the size
      let limbScale = legScale, sx = 0, cnt = 0;
      for (const s of Object.values(segs)) {
        if (s.kind !== "limb" || Math.min(vis[s.a], vis[s.b]) < 0.6) continue;
        if (s.ref !== "up") limbScale = Math.max(limbScale, Math.hypot(P[s.b].x - P[s.a].x, P[s.b].y - P[s.a].y) / (s.len * LIMB_SPAN));
        sx += P[s.a].x + P[s.b].x; cnt += 2;
      }
      // with the torso left out, the arms the tracker guessed along with it go too
      if (!torsoReal) for (const i of [11, 12, 13, 14, 15, 16]) vis[i] = 0;
      if (limbScale > 0) { pxPerCm = scaleF.filter(haveScale ? Math.max(limbScale, pxPerCm * 0.995) : limbScale, now); haveScale = true; }
      else if (!haveScale) { for (const s of Object.values(segs)) s.on = false; return; }   // nothing to size the body from yet
      deadRef = pxPerCm * meta.shoulderW; turnCos = 1;
      front.set(0, 0, 1); up.set(0, 1, 0);
      segs.torso.on = false;
      if (cnt) torsoCenterX = sx / cnt; torsoHalf = deadRef / 2;
    }
    for (const s of Object.values(segs)) {
      if (s.kind !== "limb") continue;
      const a = P[s.a], b = P[s.b];
      X.subVectors(b, a);
      let ref = s.ref === "up" ? up : front;
      // A foot is rigid and is seen from any side (from the front standing, from above looking down at your own):
      // its real direction in space comes from the tracker's 3D points (ankle, heel, toes), so the toes fan out the
      // right way instead of being drawn side-on over each other.
      const heel = s.a + 2, wa = world && world[s.a], wb = world && world[s.b], wh = world && world[heel];
      if (s.ref === "up" && wa && wb && wh && Math.min(vis[s.a], vis[s.b], vis[heel]) > 0.5) {
        const f = s.foot || (s.foot = { x: new THREE.Vector3(), up: new THREE.Vector3(), set: false });
        fx3.set(wb.x - wa.x, -(wb.y - wa.y), -(wb.z - wa.z)).normalize();      // ankle to toes (picture axes: y up, z to the camera)
        fu3.set(wa.x - wh.x, -(wa.y - wh.y), -(wa.z - wh.z)).normalize();      // heel to ankle: the foot's own "up"
        if (!f.set || now - (f.t || 0) > GAP_MS) { f.x.copy(fx3); f.up.copy(fu3); f.set = true; }
        else { f.x.lerp(fx3, 0.2).normalize(); f.up.lerp(fu3, 0.2).normalize(); }
        f.t = now;
        X.copy(f.x).multiplyScalar(s.len * pxPerCm);   // its true length; pointing at the camera it simply looks shorter
        ref = f.up;
      }
      const xh = X.clone().normalize();
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

  // A hand seen by the hand tracker brings its forearm along when the body tracker isn't drawing that arm (the
  // camera is close on a hand and wrist): the forearm runs on from the wrist, along the line of the hand.
  const armFromHand = { farmR: null, farmL: null }, hx = new THREE.Vector3(), hy = new THREE.Vector3(), hz = new THREE.Vector3(), he = new THREE.Vector3();
  function clearHandArms() { armFromHand.farmR = armFromHand.farmL = null; }
  function setHandArm(isRight, wrist, dir, handPxPerCm) {
    const key = isRight ? "farmR" : "farmL", s = segs[key];
    if (!s || !(handPxPerCm > 0)) return;
    const m = armFromHand[key] = armFromHand[key + "M"] || (armFromHand[key + "M"] = new THREE.Matrix4());
    he.copy(wrist).addScaledVector(dir, s.len * handPxPerCm);   // the elbow
    hx.subVectors(wrist, he);
    const xh = hz.copy(hx).normalize();
    hy.set(0, 0, 1).addScaledVector(xh, -xh.z); if (hy.lengthSq() < 1e-6) hy.set(1, 0, 0); hy.normalize();
    const zz = new THREE.Vector3().crossVectors(xh, hy), thick = s.len * handPxPerCm;
    m.makeBasis(hx, hy.multiplyScalar(thick), zz.multiplyScalar(thick)).setPosition(he);
  }

  function apply(S, gainFor) {
    const solid = S.style === "solid";
    let any = false;
    for (const s of Object.values(segs)) {
      const own = found && s.on, lent = !own && armFromHand[s.key];
      s.group.visible = own || !!lent;
      for (const mesh of s.meshes) {
        mesh.matrix.copy(lent || s.matrix); mesh.matrixWorldNeedsUpdate = true;
        if (s.kind === "torso") { mesh.material.uniforms.uTorsoA.value.copy(s.matrix); mesh.material.uniforms.uTorsoB.value.copy(s.hip); }
      }
    }
    for (const m of meshes) {
      const on = !!S[m.layer] && (!VESSELS.has(m.layer) || !!S[vesselZone(m.seg)]);
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
        const s = segs[at.seg]; if (!s.on || VESSELS.has(l.layer) && !S[vesselZone(at.seg)]) continue;
        L3.fromArray(at.pt);
        if (s.kind === "torso") {
          const t = THREE.MathUtils.smoothstep(at.pt[1], 0, 0.85);
          A4.copy(L3).applyMatrix4(s.matrix); B4.copy(L3).applyMatrix4(s.hip); L3.lerpVectors(B4, A4, t);
        } else L3.applyMatrix4(s.matrix);
        const x = X_(L3.x), y = H_() - L3.y;
        if (lens && Math.hypot(x - lens.x, y - lens.y) > lens.r) continue;
        items.push({ text: translate(l.t), color: inkOf(l.layer), ax: x, ay: y });
        break;   // one anchor per structure
      }
    }
    return { items, cx: X_(torsoCenterX), half: torsoHalf * 1.15 };
  }
  let W_ = () => 640, H_ = () => 480, X_ = x => W_() - x;   // X_: picture x to heads-up x (turned when the view is flipped)
  function setSize(getW, getH, toScreenX) { W_ = getW; H_ = getH; if (toScreenX) X_ = toScreenX; }
  // forget the person: the next one in view is measured afresh (another camera, another body)
  function reset() {
    found = false; shOn = false; lostAt = 0; lastUpdate = 0; haveScale = false; frontRatio = 0; frontRatioT = 0; turnCos = 1; deadRef = 0; steady = null;
    for (const s of Object.values(segs)) { s.group.visible = false; s.on = false; }
    for (const i of POSE_IDS) { filt[i].reset(); fresh[i] = true; vis[i] = 0; }
    scaleF.reset(); ratioF.reset(); ratioTF.reset(); sideF.reset();
  }

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

  return { update, apply, eachMaterial, labelItems, setSize, reset, clearHandArms, setHandArm, drawVeil, headParts, get found() { return found; } };
}
