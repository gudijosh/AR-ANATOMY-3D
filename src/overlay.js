// The 3D overlay: anatomy pinned to the tracked head, bones on tracked hands, labels and the data read-out.
import * as THREE from "three";
import { loadAnatomy, LABELS, JAW_PIVOT, HEAD_MIDDLE } from "./anatomy.js";
import { t, anatomyName } from "./i18n.js";

// Points of the face tracker's own reference face (cm) used to pin the model to the picture.
export const FIT_POINTS = {
  33: [-4.446, 2.664, 3.173], 263: [4.446, 2.664, 3.173], 133: [-1.856, 2.585, 3.758], 362: [1.856, 2.585, 3.758],
  1: [0, -1.127, 7.476], 2: [0, -2.089, 6.058], 168: [0, 3.271, 5.236], 10: [0, 8.262, 4.482], 152: [0, -9.403, 4.264],
  234: [-7.664, 0.673, -2.436], 454: [7.664, 0.673, -2.436], 61: [-2.456, -4.343, 4.284], 291: [2.456, -4.343, 4.284],
};
const FIT_IDS = Object.keys(FIT_POINTS).map(Number);
const FINGER = [[1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [17, 18], [18, 19], [19, 20]];
export const LAYERS = ["skull", "brain", "muscles", "eyes", "outline", "hands"];

const VERT = /* glsl */`
uniform mat4 uLocal; uniform float uFlatView;
varying vec3 vNormal; varying vec3 vToEye; varying vec3 vHead;
void main() {
  vHead = (uLocal * vec4(position, 1.0)).xyz;
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vToEye = uFlatView > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(-eye.xyz);
  gl_Position = projectionMatrix * eye;
}`;
const FRAG = /* glsl */`
uniform vec3 uTint; uniform vec3 uBody;
uniform float uKind, uAlpha, uGain, uNeck, uEdge, uCutOn, uCutSoft;
uniform vec4 uPlane;
varying vec3 vNormal; varying vec3 vToEye; varying vec3 vHead;
void main() {
  float keep = 1.0;
  if (uCutOn > 0.5) {
    float d = dot(uPlane.xyz, vHead) - uPlane.w;
    if (d < 0.0) discard;
    if (uCutSoft > 0.001) keep *= smoothstep(0.0, uCutSoft, d);
  }
  vec3 n = normalize(vNormal);
  float facing = abs(dot(n, normalize(vToEye)));
  if (uEdge > 0.001) keep *= smoothstep(0.0, uEdge, facing);
  float neck = uNeck > 0.5 ? smoothstep(-12.4, -9.2, vHead.y) : 1.0;
  if (uKind > 1.5) {
    gl_FragColor = vec4(uTint, uAlpha * neck * keep);
  } else if (uKind > 0.5) {
    vec3 fn = gl_FrontFacing ? n : -n;
    float light = max(dot(fn, normalize(vec3(0.35, 0.55, 0.76))), 0.0);
    float rim = pow(1.0 - facing, 2.5);
    gl_FragColor = vec4(uBody * (0.28 + 0.78 * light) * uGain + vec3(0.25) * rim, uAlpha * keep);
  } else {
    float rim = pow(1.0 - facing, 2.1);
    float a = clamp((0.035 + 0.95 * rim) * uGain * uAlpha * neck, 0.0, 1.0);
    gl_FragColor = vec4(uTint, a * keep);
  }
}`;

const LABEL_INK = { skull: "#d9f0ff", brain: "#ffc2d6", muscles: "#ffb3aa", eyes: "#fff3a8", hands: "#d9f0ff" };
const GLOW = { outline: 0.55, muscles: 0.55, cranium: 0.7, jaw: 0.8, cerebrum: 0.34, hindbrain: 0.55, eyes: 0.8 };

export async function createOverlay({ stage, S }) {
  const shape = await loadAnatomy();
  const $ = id => document.getElementById(id);
  const glCanvas = $("gl"), shade = $("shade"), hud = $("hud");
  let W = 640, H = 480, sized = false;

  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const headScene = new THREE.Scene(), handScene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(63, W / H, 1, 10000);   // the face tracker assumes a 63° tall view
  const flat = new THREE.OrthographicCamera(0, W, H, 0, -5000, 5000);
  let baseProj = cam.projectionMatrix.clone();

  function material(tint, body, kind) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTint: { value: new THREE.Color(tint) }, uBody: { value: new THREE.Color(body) }, uKind: { value: kind },
        uAlpha: { value: 1 }, uGain: { value: 1 }, uNeck: { value: 0 }, uEdge: { value: 0 }, uCutOn: { value: 0 },
        uCutSoft: { value: 0 }, uPlane: { value: new THREE.Vector4(1, 0, 0, 0) }, uLocal: { value: new THREE.Matrix4() },
        uFlatView: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
      depthTest: false, depthWrite: false, blending: kind === 2 ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
  }

  const head = new THREE.Group(); head.matrixAutoUpdate = false; head.visible = false; headScene.add(head);
  const jawHinge = new THREE.Group(); jawHinge.position.fromArray(JAW_PIVOT); head.add(jawHinge);
  const parts = {};
  function part(name, geo, layer, tint, body, order, kind = 0, parent = head, fixed = false) {
    const mesh = new THREE.Mesh(geo, material(tint, body, kind));
    mesh.renderOrder = order; mesh.frustumCulled = false; parent.add(mesh);
    parts[name] = { mesh, layer, fixed };
    return mesh;
  }
  part("veil", shape.skin, "veil", 0x04070d, 0x04070d, -10, 2, head, true).material.uniforms.uNeck.value = 1;
  part("outline", shape.skin, "outline", 0x6fb6ff, 0x6fb6ff, 1, 0, head, true).material.uniforms.uNeck.value = 1;
  part("muscles", shape.muscles, "muscles", 0xff6b5e, 0xb5453c, 2);
  part("cranium", shape.cranium, "skull", 0xbfe3ff, 0xe9e2cf, 3);
  part("jaw", shape.jaw, "skull", 0xbfe3ff, 0xe9e2cf, 3, 0, jawHinge).position.fromArray(JAW_PIVOT).multiplyScalar(-1);
  part("eyes", shape.eyes, "eyes", 0xfff3a8, 0xf4f4ee, 4);
  part("cerebrum", shape.cerebrum, "brain", 0xff9fc0, 0xe2a39d, 5);
  part("hindbrain", shape.hindbrain, "brain", 0xffc37a, 0xd6ad84, 5);

  const hands = [0, 1].map(() => {
    const group = new THREE.Group(); group.visible = false; handScene.add(group);
    const mk = geo => {
      const m = new THREE.Mesh(geo, material(0xd9f0ff, 0xe9e2cf, 0));
      m.material.uniforms.uFlatView.value = 1; m.matrixAutoUpdate = false; m.frustumCulled = false; group.add(m); return m;
    };
    return { group, palm: mk(shape.hand_palm), fingers: FINGER.map(([a, b]) => mk(shape[`hand_b_${a}_${b}`])), pts: null };
  });
  const handMeshes = r => [r.palm, ...r.fingers];

  function forEachMaterial(fn) {
    for (const k in parts) fn(parts[k].mesh.material, parts[k]);
    for (const r of hands) for (const m of handMeshes(r)) fn(m.material, { layer: "hands" });
  }
  function applyStyle() {
    const solid = S.style === "solid";
    forEachMaterial((m, info) => {
      if (info.fixed) return;
      m.uniforms.uKind.value = solid ? 1 : 0;
      m.blending = solid ? THREE.NormalBlending : THREE.AdditiveBlending;
      m.depthTest = solid; m.depthWrite = solid; m.needsUpdate = true;
    });
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
    if (sized && w === W && h === H) return;     // resizing a canvas wipes it, so only when it really changed
    sized = true; W = w; H = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix(); baseProj = cam.projectionMatrix.clone();
    flat.right = W; flat.top = H; flat.updateProjectionMatrix();
    for (const c of [shade, hud]) { c.width = W; c.height = H; }
  }
  new ResizeObserver(resize).observe(stage);
  resize(); applyStyle();

  // ------------------------------------------------------------ head pose
  const pose = { found: false, pos: new THREE.Vector3(), rot: new THREE.Quaternion(), size: new THREE.Vector3(1, 1, 1), k: 1, dx: 0, dy: 0, jaw: 0 };
  const M = new THREE.Matrix4(), P3 = new THREE.Vector3(), Q = new THREE.Quaternion(), Sz = new THREE.Vector3(), T = new THREE.Vector3();
  const fitM = new THREE.Matrix4(), screenFix = new THREE.Matrix4(), jawM = new THREE.Matrix4();

  function setHead(matrix, lms, jawOpen) {
    M.fromArray(matrix);
    const e = M.elements;   // accept a row-major matrix too
    if (Math.abs(e[12]) + Math.abs(e[13]) + Math.abs(e[14]) < 1e-6 && Math.abs(e[3]) + Math.abs(e[7]) + Math.abs(e[11]) > 1e-3) M.transpose();
    M.decompose(P3, Q, Sz);
    if (!pose.found) { pose.pos.copy(P3); pose.rot.copy(Q); pose.size.copy(Sz); pose.k = 1; pose.dx = pose.dy = 0; }
    else { pose.pos.lerp(P3, 0.6); pose.rot.slerp(Q, 0.55); pose.size.lerp(Sz, 0.5); }
    pose.found = true;
    pose.jaw += (jawOpen - pose.jaw) * 0.6;
    M.compose(pose.pos, pose.rot, pose.size);

    // Line the model up with the face in the picture: best scale and shift between projected and seen points.
    const a = [], b = [];
    for (const id of FIT_IDS) {
      const q = lms[id]; if (!q) continue;
      T.fromArray(FIT_POINTS[id]).applyMatrix4(M).applyMatrix4(baseProj);
      a.push(T.x, T.y); b.push(q.x * 2 - 1, 1 - q.y * 2);
    }
    const n = a.length / 2;
    if (n > 1) {
      let ax = 0, ay = 0, bx = 0, by = 0;
      for (let i = 0; i < n; i++) { ax += a[2 * i]; ay += a[2 * i + 1]; bx += b[2 * i]; by += b[2 * i + 1]; }
      ax /= n; ay /= n; bx /= n; by /= n;
      let top = 0, bottom = 0;
      for (let i = 0; i < n; i++) {
        const px = a[2 * i] - ax, py = a[2 * i + 1] - ay;
        top += px * (b[2 * i] - bx) + py * (b[2 * i + 1] - by); bottom += px * px + py * py;
      }
      const k = Math.min(1.6, Math.max(0.6, bottom > 1e-9 ? top / bottom : 1));
      pose.k += (k - pose.k) * 0.5;
      pose.dx += (bx - pose.k * ax - pose.dx) * 0.7;
      pose.dy += (by - pose.k * ay - pose.dy) * 0.7;
    }
    screenFix.set(pose.k, 0, 0, pose.dx, 0, pose.k, 0, pose.dy, 0, 0, 1, 0, 0, 0, 0, 1);
    cam.projectionMatrix.copy(baseProj).premultiply(screenFix);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // the person's own adjustments (their left is +x, so the flipped view reverses it)
    fitM.makeScale(S.fs * S.fw, S.fs * S.fh, S.fs * S.fd).setPosition(-S.fx, S.fy, S.fz);
    head.matrix.copy(M).multiply(fitM);
    head.matrixWorldNeedsUpdate = true;
    head.visible = true;
    jawHinge.rotation.x = Math.min(1, Math.max(0, pose.jaw)) * 0.36;
  }
  function loseHead() { pose.found = false; head.visible = false; }

  const cut = { on: 0, x: 1, y: 0, w: 0 };
  function applyLayers() {
    let on = 0, x = 1, y = 0, w = 0;
    switch (S.reveal) {
      case "left": on = 1; x = 1; w = (S.cut - 0.5) * 16; break;
      case "right": on = 1; x = -1; w = (S.cut - 0.5) * 16; break;
      case "top": on = 1; x = 0; y = 1; w = -9 + (1 - S.cut) * 22; break;
      case "bottom": on = 1; x = 0; y = -1; w = 9 - S.cut * 22; break;
    }
    Object.assign(cut, { on, x, y, w });
    jawHinge.updateMatrix(); parts.jaw.mesh.updateMatrix();
    jawM.copy(jawHinge.matrix).multiply(parts.jaw.mesh.matrix);
    const heavy = (S.skull ? 1 : 0) + (S.brain ? 1 : 0) + (S.muscles ? 1 : 0);
    const share = 1 / (0.4 + 0.6 * Math.max(1, heavy));     // glowing layers add up, so share the light
    const solid = S.style === "solid";
    for (const k in parts) {
      const { mesh, layer } = parts[k], u = mesh.material.uniforms;
      mesh.visible = layer === "veil" ? true : !!S[layer];
      u.uGain.value = solid && k !== "outline" ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * (GLOW[k] || 1) * (layer === "outline" ? 1 : share);
      u.uAlpha.value = layer === "veil" ? 1 - S.real : 1;
      u.uCutOn.value = on; u.uPlane.value.set(x, y, 0, w);
      u.uEdge.value = S.feather * 0.75; u.uCutSoft.value = S.feather * 5;
      if (k === "jaw") u.uLocal.value.copy(jawM); else u.uLocal.value.identity();
    }
  }

  // ------------------------------------------------------------ hands
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), S0 = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), e3 = new THREE.Vector3(), HM = new THREE.Matrix4();
  function placeBone(mesh, from, to, across, sign, shorten) {
    A.subVectors(to, from);
    let len = A.length(); if (len < 1e-6) len = 1e-6;
    A.divideScalar(len);
    B.copy(across).addScaledVector(A, -across.dot(A));
    if (B.lengthSq() < 1e-6) B.set(1, 0, 0);
    B.normalize();
    e3.crossVectors(A, B).multiplyScalar(sign);
    const L = len * shorten;
    HM.makeBasis(e1.copy(A).multiplyScalar(L), e2.copy(B).multiplyScalar(L), e3.multiplyScalar(L)).setPosition(from);
    mesh.matrix.copy(HM); mesh.matrixWorldNeedsUpdate = true;
  }
  function setHand(rig, lms, isRight) {
    if (!rig.pts) rig.pts = lms.map(() => new THREE.Vector3());
    const fresh = !rig.group.visible;
    lms.forEach((p, i) => { T.set(p.x * W, (1 - p.y) * H, -p.z * W); if (fresh) rig.pts[i].copy(T); else rig.pts[i].lerp(T, 0.65); });
    const P = rig.pts, sign = isRight ? 1 : -1;
    e1.subVectors(P[5], P[0]); e2.subVectors(P[17], P[0]);
    e3.crossVectors(e1, e2).normalize().multiplyScalar(sign * Math.sqrt(e1.length() * e2.length()));
    rig.palm.matrix.makeBasis(e1, e2, e3).setPosition(P[0]); rig.palm.matrixWorldNeedsUpdate = true;   // wrist bones and metacarpals
    C.subVectors(P[17], P[5]).normalize();
    FINGER.forEach(([a, b], i) => placeBone(rig.fingers[i], P[a], P[b], C, sign, b % 4 === 0 ? 0.8 : 1));
    rig.group.visible = true;
  }

  // a dark shape over the real hand, so its bones read clearly
  const scratch = document.createElement("canvas");
  function veilHand(g, lms, alpha) {
    const px = i => lms[i].x * W, py = i => lms[i].y * H;
    const span = Math.hypot(px(5) - px(17), py(5) - py(17)) || 1;
    if (scratch.width !== W || scratch.height !== H) { scratch.width = W; scratch.height = H; }
    const s = scratch.getContext("2d");
    s.clearRect(0, 0, W, H); s.fillStyle = s.strokeStyle = "#04070d"; s.lineJoin = s.lineCap = "round";
    s.beginPath(); [0, 1, 2, 5, 9, 13, 17].forEach((i, k) => k ? s.lineTo(px(i), py(i)) : s.moveTo(px(i), py(i))); s.closePath();
    s.lineWidth = span * 0.34; s.fill(); s.stroke();
    s.beginPath();
    for (const f of [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]])
      f.forEach((i, k) => k ? s.lineTo(px(i), py(i)) : s.moveTo(px(i), py(i)));
    s.lineWidth = span * 0.36; s.stroke();
    const blur = S.feather * span * 0.22;
    g.filter = blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : "none";
    g.globalAlpha = alpha; g.drawImage(scratch, 0, 0); g.globalAlpha = 1; g.filter = "none";
  }

  // ------------------------------------------------------------ labels
  const LP = new THREE.Vector3(), LN = new THREE.Vector3(), LC = new THREE.Vector3();
  const remembered = new Map();
  let frame = 0, split = 0;
  function onScreen(v) { LC.copy(v).applyMatrix4(cam.projectionMatrix); return { x: W - (LC.x + 1) / 2 * W, y: (1 - LC.y) / 2 * H }; }
  function headLabels(lens) {
    const out = [], solid = S.style === "solid", HMx = head.matrix;
    for (const L of LABELS) {
      if (!S[L.layer]) continue;
      if (solid && S.muscles && (L.layer === "skull" || L.layer === "brain")) continue;
      if (solid && S.skull && L.layer === "brain") continue;
      let best = null;
      for (const p of L.pts) {
        LP.fromArray(p); if (L.jaw) LP.applyMatrix4(jawM);
        if (cut.on && cut.x * LP.x + cut.y * LP.y < cut.w) continue;
        LN.set(LP.x - HEAD_MIDDLE[0], LP.y - HEAD_MIDDLE[1], LP.z - HEAD_MIDDLE[2]).transformDirection(HMx);
        LP.applyMatrix4(HMx);
        const facing = -LN.dot(LP) / (LP.length() || 1);
        if (solid && facing < 0.12) continue;
        const s = onScreen(LP);
        if (lens && Math.hypot(s.x - lens.x, s.y - lens.y) > lens.r) continue;
        if (!best || facing > best.facing) best = { text: anatomyName(L.t), color: LABEL_INK[L.layer], ax: s.x, ay: s.y, facing };
      }
      if (best) out.push(best);
    }
    return out;
  }
  function drawColumns(g, items, cx, half, key, splitX = cx) {
    const sides = { left: [], right: [] };
    for (const it of items) {
      let st = remembered.get(key + it.text);
      if (!st) { st = { side: it.ax < splitX ? "left" : "right", y: it.ay, seen: frame }; remembered.set(key + it.text, st); }
      if (st.side === "left" && it.ax > splitX + half * 0.15) st.side = "right";
      else if (st.side === "right" && it.ax < splitX - half * 0.15) st.side = "left";
      if (frame - st.seen > 3) st.y = it.ay; else st.y += (it.ay - st.y) * 0.5;
      st.seen = frame; it.st = st; sides[st.side].push(it);
    }
    g.font = "600 12.5px system-ui,-apple-system,Segoe UI,Roboto,sans-serif"; g.textBaseline = "middle"; g.lineJoin = "round";
    for (const side of ["left", "right"]) {
      const list = sides[side].sort((p, q) => p.st.y - q.st.y);
      let prev = -1e9;
      for (const it of list) { it.ty = Math.max(it.st.y, prev + 18); prev = it.ty; }
      const over = prev - (H - 12); if (over > 0) for (const it of list) it.ty -= over;
      const widest = list.reduce((m, it) => Math.max(m, g.measureText(it.text).width), 0);   // keep text inside the picture
      const tx = side === "left" ? Math.max(8 + widest, cx - half - 22) : Math.min(W - 8 - widest, cx + half + 22);
      for (const it of list) {
        g.strokeStyle = it.color; g.globalAlpha = 0.75; g.lineWidth = 1;
        g.beginPath(); g.moveTo(it.ax, it.ay); g.lineTo(tx + (side === "left" ? 5 : -5), it.ty); g.stroke();
        g.globalAlpha = 1; g.fillStyle = it.color; g.beginPath(); g.arc(it.ax, it.ay, 2.6, 0, 6.3); g.fill();
        g.textAlign = side === "left" ? "right" : "left";
        g.strokeStyle = "rgba(4,7,13,.9)"; g.lineWidth = 3.5; g.strokeText(it.text, tx, it.ty);
        g.fillText(it.text, tx, it.ty);
      }
    }
  }
  function drawLabels(g, lens) {
    frame++;
    let hx = W / 2;
    if (pose.found && head.visible) {
      LP.fromArray(HEAD_MIDDLE).applyMatrix4(head.matrix);
      const c = onScreen(LP); LP.x += 10.5 * S.fs * S.fw; const e = onScreen(LP);
      hx = c.x;
      const items = headLabels(lens);
      const xs = items.map(i => i.ax).sort((p, q) => p - q), mid = xs.length ? xs[xs.length >> 1] : hx;
      split = split ? split + ((hx + mid) / 2 - split) * 0.2 : (hx + mid) / 2;
      drawColumns(g, items, hx, Math.abs(e.x - c.x), "h:", split);
    }
    if (!S.hands) return;
    hands.forEach((rig, i) => {
      if (!rig.group.visible || !rig.pts) return;
      const P = rig.pts, at = (a, b, k) => ({ ax: W - (P[a].x + (P[b].x - P[a].x) * k), ay: H - (P[a].y + (P[b].y - P[a].y) * k) });
      const items = [["Distal phalanx", 11, 12, 0.5], ["Middle phalanx", 10, 11, 0.5], ["Proximal phalanx", 9, 10, 0.5],
        ["Metacarpal", 0, 9, 0.62], ["Carpal bones (wrist)", 0, 9, 0.12]]
        .map(([text, a, b, k]) => ({ text: anatomyName(text), color: LABEL_INK.hands, ...at(a, b, k) }))
        .filter(it => !lens || Math.hypot(it.ax - lens.x, it.ay - lens.y) <= lens.r);
      let lo = 1e9, hi = -1e9; for (const p of P) { lo = Math.min(lo, W - p.x); hi = Math.max(hi, W - p.x); }
      const outerRight = (lo + hi) / 2 > hx, far = outerRight ? lo - 1e4 : hi + 1e4;
      drawColumns(g, items, far, outerRight ? hi - far : far - lo, "hand" + i + ":");
    });
  }

  // ------------------------------------------------------------ one frame
  let ticks = 0, fps = 0, fpsAt = 0, dataAt = 0;
  function render(now, face, handList, rightSides, pointer) {
    const sg = shade.getContext("2d"); sg.clearRect(0, 0, W, H);
    hands.forEach((rig, i) => {
      const lms = handList[i];
      if (lms && S.hands) {
        setHand(rig, lms, rightSides[i]);
        veilHand(sg, lms, (1 - S.real) * 0.92);
        for (const m of handMeshes(rig)) {
          m.material.uniforms.uGain.value = S.style === "solid" ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * 1.15;
          m.material.uniforms.uEdge.value = S.feather * 0.75;
        }
      } else rig.group.visible = false;
    });
    if (!pose.found) head.visible = false;
    applyLayers();

    let mask = "none", lens = null;
    if (S.reveal === "lens") {
      const r = (0.07 + 0.38 * S.cut) * W;
      let cx = W / 2, cy = H / 2;    // in the unflipped picture
      if (handList[0]) { cx = handList[0][8].x * W; cy = handList[0][8].y * H; }
      else if (pointer) { cx = W - pointer.x; cy = pointer.y; }
      else if (face && face[1]) { cx = face[1].x * W; cy = face[1].y * H; }
      mask = `radial-gradient(circle ${r.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, #000 ${(98 - 78 * S.feather).toFixed(0)}%, transparent 100%)`;
      lens = { x: W - cx, y: cy, r };
    }
    for (const c of [glCanvas, shade]) { c.style.maskImage = mask; c.style.webkitMaskImage = mask; }

    renderer.clear();
    renderer.render(headScene, cam);
    renderer.clearDepth();
    renderer.render(handScene, flat);

    const g = hud.getContext("2d"); g.clearRect(0, 0, W, H);
    if (lens) { g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 2; g.beginPath(); g.arc(lens.x, lens.y, lens.r, 0, 6.3); g.stroke(); }
    if (S.labels) drawLabels(g, lens);
    if (S.showdata) {
      if (face) { g.fillStyle = "rgba(127,255,170,.85)"; for (const p of face) if (p) g.fillRect((1 - p.x) * W - 1, p.y * H - 1, 2, 2); }
      g.strokeStyle = "rgba(255,183,3,.9)"; g.fillStyle = "#ffb703"; g.lineWidth = 1.5;
      for (const lms of handList) {
        for (const chain of [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]]) {
          g.beginPath(); chain.forEach((i, k) => { const x = (1 - lms[i].x) * W, y = lms[i].y * H; k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        }
        for (const p of lms) { g.beginPath(); g.arc((1 - p.x) * W, p.y * H, 3, 0, 6.3); g.fill(); }
      }
      if (now - dataAt > 120) { dataAt = now; document.getElementById("data").textContent = readout(face, handList, rightSides); }
    }
    ticks++;
    if (now - fpsAt >= 1000) { fps = Math.round(ticks * 1000 / (now - fpsAt)); ticks = 0; fpsAt = now; }
  }
  function readout(face, handList, rightSides) {
    const rows = [];
    if (pose.found) {
      const eu = new THREE.Euler().setFromQuaternion(pose.rot, "YXZ"), deg = r => Math.round(r * 57.2958) + "°";
      rows.push([t("d.face"), t("d.tracked", { n: face ? face.filter(Boolean).length : 0 })],
        [t("d.distance"), t("d.cm", { n: (-pose.pos.z).toFixed(0) })],
        [t("d.angles"), `${deg(eu.y)} / ${deg(eu.x)} / ${deg(eu.z)}`],
        [t("d.jaw"), pose.jaw.toFixed(2)],
        [t("d.fit"), t("d.fitValue", { k: pose.k.toFixed(3), x: pose.dx.toFixed(3), y: pose.dy.toFixed(3) })]);
    } else rows.push([t("d.face"), t("d.notFound")]);
    rows.push([t("d.hands"), handList.length ? handList.map((h, i) => t(rightSides[i] ? "d.right" : "d.left")).join(" + ") : t("d.none")]);
    if (handList[0]) rows.push([t("d.tip"), `${(1 - handList[0][8].x).toFixed(2)}, ${handList[0][8].y.toFixed(2)}`]);
    rows.push([t("d.layers"), LAYERS.filter(k => S[k]).map(k => t("l." + k).toLowerCase()).join(", ") || t("d.none")],
      [t("d.speed"), t("d.fps", { n: fps })]);
    const pad = Math.max(...rows.map(r => r[0].length)) + 2;
    return rows.map(([k, v]) => k.padEnd(pad) + v).join("\n");
  }

  // a pretend head pose and its landmarks, for the built-in demo
  function demoFace(t) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.06 + 0.05 * Math.sin(t * 0.7), 0.42 * Math.sin(t * 0.5 + 0.9), 0.04, "YXZ"));
    m.setPosition(-5 + 2 * Math.sin(t * 0.4), 1.5, -46);
    const lms = [];
    for (const id of FIT_IDS) { const v = new THREE.Vector3().fromArray(FIT_POINTS[id]).applyMatrix4(m).applyMatrix4(baseProj); lms[id] = { x: (v.x + 1) / 2, y: (1 - v.y) / 2, z: 0 }; }
    return { matrix: m.elements, lms };
  }

  return { setHead, loseHead, render, applyStyle, resize, demoFace, get size() { return { W, H }; }, get headFound() { return pose.found; } };
}
