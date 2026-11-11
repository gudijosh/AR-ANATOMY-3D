// Hand-made, simplified anatomy built from primitive shapes.
// Coordinates are centimetres in the face tracker's head space:
// +x is the person's left, +y is up, +z points out of the face (nose tip ≈ z 7.5).
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (d, w) => Math.exp(-(d / w) * (d / w));

// keep only positions, weld duplicate seam vertices so normals stay smooth
function tidy(g) {
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  return mergeVertices(g, 1e-4);
}
function keepTriangles(g, keep) {
  const idx = g.index.array, p = g.attributes.position, c = new THREE.Vector3(), out = [];
  for (let i = 0; i < idx.length; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.x += p.getX(idx[i + k]) / 3, c.y += p.getY(idx[i + k]) / 3, c.z += p.getZ(idx[i + k]) / 3;
    if (keep(c)) out.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(out);
  return g;
}
function combine(list) {
  const g = mergeGeometries(list, false);
  g.computeVertexNormals();
  return g;
}

// an ellipsoid; `shape(v, n)` can bend the local shape before it is turned and placed
function blob(center, radii, o = {}) {
  let g = tidy(new THREE.SphereGeometry(1, o.w || 40, o.h || 28));
  const p = g.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3();
  const rot = o.rot ? new THREE.Euler(...o.rot) : null;
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i);
    v.set(n.x * radii[0], n.y * radii[1], n.z * radii[2]);
    if (o.shape) o.shape(v, n);
    if (rot) v.applyEuler(rot);
    v.x += center[0]; v.y += center[1]; v.z += center[2];
    if (o.after) o.after(v, n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  if (o.keep) g = keepTriangles(g, o.keep);
  return g;
}

// a tube along a smooth curve; `radius(t)` may taper it (0 closes the end)
function tube(points, radius, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(q => new THREE.Vector3(...q)));
  const seg = o.seg || 48, rad = o.radial || 12;
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const flat = o.flatten || 1;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = typeof radius === "function" ? radius(t) : radius;
    curve.getPointAt(t, c);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r);
      v.y *= flat;
      p.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
    }
  }
  return tidy(g);
}
const capped = (r, e = 0.08) => t => r * Math.sqrt(smooth(0, e, t) * smooth(1, 1 - e, t));

function ring(center, R, r, o = {}) {
  const g = tidy(new THREE.TorusGeometry(R, r, o.radial || 10, o.seg || 48));
  if (o.scale) g.scale(...o.scale);
  if (o.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...o.rot)));
  g.translate(...center);
  return g;
}

// smooth 1-D interpolation through table rows [y, ...values]
function curveAt(rows, y, col) {
  let i = 0;
  while (i < rows.length - 2 && y > rows[i + 1][0]) i++;
  const y0 = rows[i][0], y1 = rows[i + 1][0], h = y1 - y0;
  const t = clamp((y - y0) / h, 0, 1), p0 = rows[i][col], p1 = rows[i + 1][col];
  const m0 = i > 0 ? (p1 - rows[i - 1][col]) / (y1 - rows[i - 1][0]) * h : p1 - p0;
  const m1 = i < rows.length - 2 ? (rows[i + 2][col] - p0) / (rows[i + 2][0] - y0) * h : p1 - p0;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}

// ------------------------------------------------------------------ skin
// height, half width, front, back, how much the front narrows
const HEAD_ROWS = [
  [-12.8, 5.3, 0.8, -9.0, 0.0],
  [-10.8, 5.4, 1.4, -9.2, 0.1],
  [-9.7, 5.6, 3.5, -9.3, 0.55],
  [-8.2, 6.0, 4.4, -9.1, 0.5],
  [-5.8, 6.6, 5.0, -9.4, 0.4],
  [-3.4, 7.1, 5.6, -10.4, 0.32],
  [-1.2, 7.5, 5.5, -11.8, 0.28],
  [0.8, 7.75, 5.0, -13.2, 0.24],
  [3.0, 7.9, 5.2, -14.6, 0.2],
  [6.0, 8.0, 5.0, -15.7, 0.18],
  [8.3, 7.7, 4.5, -15.8, 0.16],
  [10.6, 6.9, 3.1, -15.0, 0.12],
  [12.4, 5.3, 0.6, -13.0, 0.1],
  [13.7, 3.2, -2.5, -10.0, 0.08],
  [14.5, 0.05, -5.6, -7.2, 0.0],
];
const NOSE_ROWS = [[-2.9, 0, 1.4], [-2.2, 0.5, 1.5], [-1.2, 2.0, 1.35], [1.0, 1.0, 1.0], [3.3, 0.25, 0.9], [4.6, 0, 0.9]];

function skinGeometry() {
  const NY = 120, NA = 80, pos = [], idx = [];
  const y0 = HEAD_ROWS[0][0], y1 = HEAD_ROWS[HEAD_ROWS.length - 1][0];
  for (let j = 0; j <= NY; j++) {
    const s = j / NY, y = y0 + (y1 - y0) * (1 - Math.pow(1 - s, 1.15));
    const a = Math.max(0.02, curveAt(HEAD_ROWS, y, 1)), zf = curveAt(HEAD_ROWS, y, 2), zb = curveAt(HEAD_ROWS, y, 3);
    const taper = clamp(curveAt(HEAD_ROWS, y, 4), 0, 0.8), zm = zf - (zf - zb) * 0.45;
    const nh = y > -2.9 && y < 4.6 ? Math.max(0, curveAt(NOSE_ROWS, y, 1)) : 0, nw = curveAt(NOSE_ROWS, y, 2);
    for (let i = 0; i < NA; i++) {
      const ang = i / NA * Math.PI * 2, u = Math.cos(ang), v = Math.sin(ang);
      const front = v > 0, ex = front ? 1 : 1 / 1.15;
      let x = Math.sign(u) * Math.pow(Math.abs(u), ex) * a;
      const vv = Math.sign(v) * Math.pow(Math.abs(v), ex);
      let z = front ? zm + vv * (zf - zm) : zm + vv * (zm - zb);
      if (front) {
        x *= 1 - taper * Math.pow(vv, 1.5);
        z += nh * gauss(x, nw * 0.75);                                        // nose
        z -= 0.9 * gauss(Math.abs(x) - 3.0, 1.6) * gauss(y - 2.7, 1.1);       // eye sockets
        z += 0.35 * gauss(x, 1.8) * gauss(y + 4.4, 0.8);                      // lips
      }
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) {
    const a = j * NA + i, b = j * NA + (i + 1) % NA, c = a + NA, d = b + NA;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ears = [1, -1].map(s => blob([s * 7.55, 0.9, -4.3], [0.7, 2.9, 1.7], { rot: [0.15, 0, -s * 0.12], w: 24, h: 18 }));
  return combine([g, ...ears]);
}

// ------------------------------------------------------------------ skull
function craniumGeometry() {
  const parts = [];
  // the vault: an egg-shaped shell, opened where the face and the skull base are
  parts.push(blob([0, 4.5, -5.0], [7.4, 9.4, 10.3], {
    w: 64, h: 44,
    shape: (v, n) => { v.x *= 1 - 0.08 * smooth(0, -1, n.y); v.z += 0.6 * smooth(0.2, 1, n.z) * smooth(0.4, -0.2, n.y); },
    keep: c => c.z > -1.5 ? (Math.abs(c.x) > 5.4 ? c.y > -1.0 : c.y > 4.1) : c.y > -3.6,
  }));
  // brow ridge
  parts.push(tube([[-6.3, 4.6, 0.6], [-4.4, 4.5, 3.6], [-1.6, 4.6, 4.7], [0, 4.4, 4.9], [1.6, 4.6, 4.7], [4.4, 4.5, 3.6], [6.3, 4.6, 0.6]], capped(0.55), { flatten: 0.7 }));
  for (const s of [1, -1]) {
    parts.push(ring([s * 2.95, 2.45, 3.3], 1.95, 0.34, { scale: [1, 0.88, 1], rot: [0, s * 0.28, 0] }));        // eye socket rim
    parts.push(tube([[s * 3.9, 1.0, 3.3], [s * 5.3, 0.25, 2.1], [s * 6.35, 0.35, -1.3], [s * 6.3, 0.7, -4.3]], capped(0.48), { flatten: 0.75 })); // cheekbone arch
    parts.push(tube([[s * 4.6, 2.3, 2.6], [s * 5.4, 0.3, 1.8], [s * 4.8, -1.6, 1.4]], capped(0.6)));             // cheekbone body
    parts.push(tube([[s * 1.4, 4.0, 4.4], [s * 1.1, 2.2, 4.8], [s * 1.2, 0.4, 4.9]], capped(0.35)));             // inner orbit wall
  }
  // upper jaw and the nose opening
  parts.push(blob([0, -0.7, 2.4], [4.0, 1.9, 2.9], { keep: c => c.z > 1.0 }));
  parts.push(ring([0, 0.7, 5.05], 0.95, 0.22, { scale: [1, 1.55, 1] }));
  parts.push(blob([0, 2.5, 5.35], [0.55, 1.05, 0.32], { w: 20, h: 14 }));                                     // nasal bone
  // upper teeth
  for (let k = 0; k < 14; k++) {
    const t = -1.25 + 2.5 * k / 13, x = 2.6 * Math.sin(t), z = 4.6 - 3.4 * (1 - Math.cos(t));
    parts.push(blob([x, -2.3, z], [0.34, 0.55, 0.3], { w: 12, h: 10, rot: [0, t, 0] }));
  }
  // skull base and the mastoid bumps
  parts.push(blob([0, -1.6, -7.0], [5.2, 1.2, 6.2], { w: 36, h: 18 }));
  for (const s of [1, -1]) parts.push(blob([s * 5.6, -1.6, -6.3], [0.8, 1.3, 1.0], { w: 16, h: 12 }));
  return combine(parts);
}

function jawGeometry() {
  const parts = [];
  const arc = [];
  for (const s of [1, -1]) {
    // body and ramus of the lower jaw, condyle to chin
    const side = [[s * 4.95, 0.5, -3.7], [s * 4.85, -2.0, -3.4], [s * 4.6, -5.4, -2.6], [s * 3.6, -6.7, 0.6], [s * 1.9, -7.4, 3.0]];
    if (s === 1) arc.push(...side); else arc.unshift(...side.reverse());
    parts.push(tube([[s * 4.7, -2.4, -2.6], [s * 4.5, -1.0, -1.9], [s * 4.25, 0.1, -1.4]], capped(0.4, 0.15)));   // coronoid
    parts.push(blob([s * 4.95, 0.65, -3.75], [0.75, 0.5, 0.6], { w: 14, h: 10 }));                                // condyle
  }
  arc.splice(5, 0, [0, -7.7, 3.7]);
  parts.push(tube(arc, t => 0.62 * (0.75 + 0.35 * smooth(0.3, 0.5, t) * smooth(0.7, 0.5, t)) * Math.sqrt(smooth(0, 0.03, t) * smooth(1, 0.97, t)), { seg: 120, flatten: 1.35 }));
  for (let k = 0; k < 14; k++) {
    const t = -1.2 + 2.4 * k / 13, x = 2.4 * Math.sin(t), z = 4.3 - 3.3 * (1 - Math.cos(t));
    parts.push(blob([x, -3.1, z], [0.3, 0.5, 0.28], { w: 12, h: 10, rot: [0, t, 0] }));
  }
  return combine(parts);
}

function eyesGeometry() {
  const parts = [];
  for (const s of [1, -1]) {
    parts.push(blob([s * 2.93, 2.38, 2.2], [1.7, 1.7, 1.7], { w: 32, h: 24 }));
    parts.push(ring([s * 2.93, 2.38, 3.78], 0.6, 0.09, { radial: 6, seg: 28 }));                      // iris
    parts.push(blob([s * 2.93, 2.38, 3.55], [0.75, 0.75, 0.42], { w: 20, h: 14 }));                    // cornea
  }
  return combine(parts);
}

// ------------------------------------------------------------------ brain
function folds(v, amount) {
  return amount * (Math.sin(v.x * 2.1 + v.y * 1.3) * Math.sin(v.y * 1.9 - v.z * 0.7) +
                   0.6 * Math.sin(v.z * 2.6 + v.x * 0.8) * Math.sin(v.y * 2.4 + 1.3) +
                   0.35 * Math.sin((v.x + v.y + v.z) * 3.7));
}
function cerebrumGeometry() {
  const parts = [];
  for (const s of [1, -1]) {
    parts.push(blob([s * 3.55, 6.4, -5.6], [3.65, 7.2, 9.2], {
      w: 72, h: 52,
      shape: (v, n) => { if (s * n.x < 0) v.x *= 0.35; v.y *= 1 - 0.18 * smooth(0, -1, n.y); },
      after: (v, n) => { const k = 1 + folds(v, 0.045); v.x = s * 3.55 + (v.x - s * 3.55) * k; v.y = 6.4 + (v.y - 6.4) * k; v.z = -5.6 + (v.z + 5.6) * k; },
    }));
    parts.push(blob([s * 5.3, 2.6, -6.0], [2.0, 2.4, 4.3], {                                            // temporal lobe
      w: 40, h: 28, rot: [0.25, 0, 0],
      after: (v) => { const d = folds(v, 0.08); v.x += s * d; v.y += d * 0.5; },
    }));
  }
  return combine(parts);
}
function hindbrainGeometry() {
  const parts = [];
  for (const s of [1, -1]) parts.push(blob([s * 2.4, 0.4, -10.6], [2.8, 2.5, 3.0], {               // cerebellum halves
    w: 44, h: 36, after: (v, n) => { const d = 0.09 * Math.sin(v.y * 7.0 + v.z * 1.5); v.x += n.x * d; v.y += n.y * d; v.z += n.z * d; },
  }));
  parts.push(tube([[0, 4.6, -5.8], [0, 2.2, -4.6], [0, -0.4, -5.0], [0, -3.5, -5.6]],               // brainstem
    t => 0.75 + 0.55 * gauss(t - 0.42, 0.18) * Math.sqrt(smooth(0, 0.05, t)), { seg: 40 }));
  return combine(parts);
}

// ------------------------------------------------------------------ muscles
function musclesGeometry() {
  const parts = [];
  // forehead and back-of-head sheets, lifted just off the skull
  parts.push(blob([0, 4.5, -5.0], [7.75, 9.8, 10.75], { w: 64, h: 44, keep: c => (c.z > 0.6 && c.y > 4.9 && c.y < 12.6) || (c.z < -12.4 && c.y > 1.8 && c.y < 9.5 && Math.abs(c.x) < 5.5) }));
  for (const s of [1, -1]) {
    parts.push(blob([s * 6.95, 5.4, -4.2], [1.0, 4.8, 5.4], { rot: [0.15, 0, s * 0.12], keep: c => s * c.x > 6.4 }));   // temporalis
    parts.push(blob([s * 5.1, -3.4, -1.3], [1.1, 2.9, 1.9], { rot: [0.35, 0, s * 0.06] }));                             // masseter
    parts.push(ring([s * 3.15, 2.6, 3.95], 2.1, 0.42, { scale: [1, 0.85, 1], rot: [0, s * 0.3, 0] }));                   // around the eye
    parts.push(tube([[s * 4.9, 0.1, 2.3], [s * 4.0, -2.3, 3.6], [s * 2.65, -4.3, 4.7]], capped(0.42)));                 // zygomaticus major
    parts.push(blob([s * 0.8, 1.35, 5.75], [0.45, 0.95, 0.28], { w: 16, h: 12, rot: [0.35, 0, 0] }));                  // nasalis
    parts.push(tube([[s * 2.6, -4.9, 4.6], [s * 2.6, -6.0, 4.1], [s * 2.4, -7.1, 3.4]], capped(0.42)));                // depressor
  }
  parts.push(ring([0, -4.55, 5.0], 2.05, 0.55, { scale: [1, 0.62, 0.8] }));                                               // around the mouth
  parts.push(blob([0, -7.1, 4.5], [1.2, 0.9, 0.5], { w: 20, h: 14 }));                                                    // chin
  return combine(parts);
}

// ------------------------------------------------------------------ hands
// one bone along +x from 0 to 1, knobby at both ends, sized relative to its length
function boneGeometry() {
  const prof = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = -0.03 + 1.06 * t;
    const r = (0.1 + 0.08 * gauss(x - 0.05, 0.1) + 0.06 * gauss(x - 0.95, 0.09)) * Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));
    prof.push(new THREE.Vector2(Math.max(r, 1e-4), x));
  }
  const g = tidy(new THREE.LatheGeometry(prof, 14));
  g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));    // lathe axis y -> x
  g.scale(1, 1, 0.8);
  g.computeVertexNormals();
  return g;
}
// wrist bones, laid out in a frame where (1,0) is the index knuckle and (0,1) the little-finger knuckle
function carpalGeometry() {
  const spots = [[0.13, 0.02], [0.11, 0.13], [0.07, 0.24], [0.02, 0.33], [0.24, 0.03], [0.22, 0.15], [0.19, 0.26], [0.15, 0.36]];
  return combine(spots.map(([u, v], i) => blob([u, v, 0.02], [0.06, 0.058, 0.07], { w: 12, h: 10, rot: [0, 0, i * 0.7] })));
}

// ------------------------------------------------------------------ labels
export const LABELS = [
  { t: "Frontal bone", layer: "skull", pts: [[0, 8.1, 4.3]] },
  { t: "Parietal bone", layer: "skull", pts: [[5.5, 10.6, -9.6], [-5.5, 10.6, -9.6]] },
  { t: "Temporal bone", layer: "skull", pts: [[6.45, 0.2, -6.2], [-6.45, 0.2, -6.2]] },
  { t: "Occipital bone", layer: "skull", pts: [[0, 3.5, -15.25]] },
  { t: "Nasal bone", layer: "skull", pts: [[0, 2.5, 5.65]] },
  { t: "Zygomatic bone (cheekbone)", layer: "skull", pts: [[5.3, 0.3, 2.0], [-5.3, 0.3, 2.0]] },
  { t: "Maxilla (upper jaw)", layer: "skull", pts: [[3.7, -0.8, 3.0], [-3.7, -0.8, 3.0]] },
  { t: "Teeth", layer: "skull", pts: [[0, -2.3, 4.85]] },
  { t: "Mandible (lower jaw)", layer: "skull", jaw: true, pts: [[0, -7.7, 4.3]] },
  { t: "Eyeball", layer: "eyes", pts: [[2.93, 2.38, 3.9], [-2.93, 2.38, 3.9]] },
  { t: "Frontal lobe", layer: "brain", pts: [[2.4, 12.4, -2.6], [-2.4, 12.4, -2.6]] },
  { t: "Parietal lobe", layer: "brain", pts: [[3.4, 11.0, -11.4], [-3.4, 11.0, -11.4]] },
  { t: "Temporal lobe", layer: "brain", pts: [[7.2, 3.0, -6.2], [-7.2, 3.0, -6.2]] },
  { t: "Occipital lobe", layer: "brain", pts: [[2.1, 4.6, -14.5], [-2.1, 4.6, -14.5]] },
  { t: "Cerebellum", layer: "brain", pts: [[0, 0.4, -12.6]] },
  { t: "Pons (brainstem)", layer: "brain", pts: [[0, 2.0, -3.6]] },
  { t: "Medulla oblongata", layer: "brain", pts: [[0, -0.6, -4.3]] },
  { t: "Frontalis", layer: "muscles", pts: [[3.0, 9.0, 3.8], [-3.0, 9.0, 3.8]] },
  { t: "Temporalis", layer: "muscles", pts: [[7.8, 6.3, -2.4], [-7.8, 6.3, -2.4]] },
  { t: "Orbicularis oculi", layer: "muscles", pts: [[3.6, 3.1, 4.2], [-3.6, 3.1, 4.2]] },
  { t: "Nasalis", layer: "muscles", pts: [[0.85, 1.4, 6.0], [-0.85, 1.4, 6.0]] },
  { t: "Zygomaticus major", layer: "muscles", pts: [[4.0, -2.3, 3.95], [-4.0, -2.3, 3.95]] },
  { t: "Masseter", layer: "muscles", pts: [[6.1, -3.4, -1.0], [-6.1, -3.4, -1.0]] },
  { t: "Orbicularis oris", layer: "muscles", pts: [[0, -5.3, 5.5]] },
  { t: "Depressor anguli oris", layer: "muscles", pts: [[2.6, -6.6, 4.25], [-2.6, -6.6, 4.25]] },
  { t: "Mentalis", layer: "muscles", pts: [[0, -7.4, 4.95]] },
];

export const JAW_PIVOT = [0, 0.75, -3.8];

export function buildAnatomy() {
  return {
    skin: skinGeometry(),
    cranium: craniumGeometry(),
    jaw: jawGeometry(),
    eyes: eyesGeometry(),
    cerebrum: cerebrumGeometry(),
    hindbrain: hindbrainGeometry(),
    muscles: musclesGeometry(),
    bone: boneGeometry(),
    carpals: carpalGeometry(),
  };
}
