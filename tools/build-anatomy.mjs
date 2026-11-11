// Builds src/anatomy/anatomy.bin + anatomy.json from BodyParts3D OBJ files.
//
//   node tools/build-anatomy.mjs <folder with the FJ*.obj files>
//
// Data: BodyParts3D, (c) The Database Center for Life Science, licensed under
// CC Attribution-Share Alike 2.1 Japan (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/).
// Download partof_BP3D_4.0_obj_99.zip from that page and unzip it; the file ids used are listed below.
// The meshes are simplified, re-aligned to the face tracker's reference face, and the face/jaw
// muscles (which the dataset doesn't have) are modelled on top of the real skull and skin.
// The output is a derivative of BodyParts3D and is shared under the same licence.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MeshoptSimplifier } from "meshoptimizer";

const SRC = process.argv[2];
if (!SRC) { console.error("usage: node tools/build-anatomy.mjs <obj folder>"); process.exit(1); }
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/anatomy");
await MeshoptSimplifier.ready;

// ------------------------------------------------------------------ files
const CRANIUM = ["FJ3199", "FJ3200", "FJ3263", "FJ3369", "FJ3265", "FJ3371", "FJ3269", "FJ3375", "FJ3272", "FJ3378", "FJ3273", "FJ3379",
  "FJ3274", "FJ3380", "FJ3281", "FJ3386", "FJ3287", "FJ3392", "FJ3309", "FJ3394", "FJ3395"];
const MANDIBLE = ["FJ3289"];
const EYES = ["FJ1317", "FJ1368", "FJ1289", "FJ1340", "FJ1297", "FJ1348"];
const LOBES = {   // for the brain labels
  frontal: ["FJ1744", "FJ1745", "FJ1787", "FJ1788", "FJ1833", "FJ1834", "FJ1800", "FJ1801"],
  parietal: ["FJ1797", "FJ1798", "FJ1835", "FJ1836", "FJ1841", "FJ1842", "FJ1732", "FJ1733"],
  temporal: ["FJ1746", "FJ1747", "FJ1789", "FJ1790", "FJ1783", "FJ1784", "FJ1785", "FJ1786"],
  occipital: ["FJ1791", "FJ1792"],
  inner: ["FJ1739", "FJ1740", "FJ1748", "FJ1749", "FJ1758", "FJ1806"],
};
const CEREBRUM = Object.values(LOBES).flat();
const HINDBRAIN = { cerebellum: ["FJ1781", "FJ1830"], pons: ["FJ1775", "FJ1822"], medulla: ["FJ1769", "FJ1831"], midbrain: ["FJ1770", "FJ1817"] };
const SKIN = "FJ2810";
const HAND = {   // right hand
  meta: { 1: "FJ3350", 2: "FJ3352", 3: "FJ3354", 4: "FJ3356", 5: "FJ3358" },
  prox: { 1: "FJ3327", 2: "FJ3322", 3: "FJ3325", 4: "FJ3326", 5: "FJ3323" },
  mid: { 2: "FJ3303", 3: "FJ3306", 4: "FJ3292", 5: "FJ3304" },
  dist: { 1: "FJ3198", 2: "FJ3193", 3: "FJ3196", 4: "FJ3197", 5: "FJ3194" },
  carpals: ["FJ3383", "FJ3374", "FJ3390", "FJ3382", "FJ3388", "FJ3389", "FJ3361", "FJ3367"],
};

function readObj(id) {
  const text = fs.readFileSync(path.join(SRC, id + ".obj"), "utf8");
  const pos = [], idx = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) { const p = line.split(/\s+/); pos.push(+p[1], +p[2], +p[3]); }
    else if (line.startsWith("f ")) {
      const p = line.trim().split(/\s+/).slice(1).map(s => parseInt(s, 10) - 1);
      for (let k = 1; k + 1 < p.length; k++) idx.push(p[0], p[k], p[k + 1]);
    }
  }
  return { pos: Float64Array.from(pos), idx: Uint32Array.from(idx) };
}
function merge(list) {
  let nv = 0, ni = 0;
  for (const m of list) { nv += m.pos.length; ni += m.idx.length; }
  const pos = new Float64Array(nv), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const m of list) {
    pos.set(m.pos, ov);
    for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov / 3;
    ov += m.pos.length; oi += m.idx.length;
  }
  return { pos, idx };
}
const load = ids => merge(ids.map(readObj));

// ------------------------------------------------------------------ small vector helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => mul(a, 1 / (len(a) || 1));
const vert = (m, i) => [m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]];
function centroid(m) { const c = [0, 0, 0], n = m.pos.length / 3; for (let i = 0; i < n; i++) { c[0] += m.pos[3 * i]; c[1] += m.pos[3 * i + 1]; c[2] += m.pos[3 * i + 2]; } return mul(c, 1 / n); }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 3x3 helpers for the similarity fit
function jacobiSVD3(A) {   // A = U S V^T via eigen-decomposition of A^T A (fine for well-conditioned 3x3)
  const AtA = [0, 1, 2].map(i => [0, 1, 2].map(j => A[0][i] * A[0][j] + A[1][i] * A[1][j] + A[2][i] * A[2][j]));
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], M = AtA.map(r => r.slice());
  for (let sweep = 0; sweep < 50; sweep++) for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(M[p][q]) < 1e-15) continue;
    const th = (M[q][q] - M[p][p]) / (2 * M[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const a = M[k][p], b = M[k][q]; M[k][p] = c * a - s * b; M[k][q] = s * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = M[p][k], b = M[q][k]; M[p][k] = c * a - s * b; M[q][k] = s * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
  }
  const S = [0, 1, 2].map(i => Math.sqrt(Math.max(0, M[i][i])));
  const U = [0, 1, 2].map(i => [0, 1, 2].map(j => (A[i][0] * V[0][j] + A[i][1] * V[1][j] + A[i][2] * V[2][j]) / (S[j] || 1)));
  return { U, S, V };
}
function umeyama(P, Q) {   // best s, R, t with Q ≈ s R P + t
  const n = P.length, mp = mul(P.reduce(add), 1 / n), mq = mul(Q.reduce(add), 1 / n);
  let varP = 0; const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const a = sub(P[i], mp), b = sub(Q[i], mq); varP += dot(a, a);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r][c] += b[r] * a[c] / n;
  }
  varP /= n;
  const { U, S, V } = jacobiSVD3(C);
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = [1, 1, det3(U) * det3(V) < 0 ? -1 : 1];
  const R = [0, 1, 2].map(i => [0, 1, 2].map(j => U[i][0] * D[0] * V[j][0] + U[i][1] * D[1] * V[j][1] + U[i][2] * D[2] * V[j][2]));
  const s = (S[0] * D[0] + S[1] * D[1] + S[2] * D[2]) / varP;
  const Rmp = [0, 1, 2].map(i => dot(R[i], mp));
  return { s, R, t: sub(mq, mul(Rmp, s)) };
}
const applyT = (T, p) => add(mul([dot(T.R[0], p), dot(T.R[1], p), dot(T.R[2], p)], T.s), T.t);

// ------------------------------------------------------------------ into the tracker's head space
// dataset: mm, +x = person's left, -y = front, +z = up  ->  cm, +x left, +y up, +z front
function toHeadAxes(m) { const p = m.pos; for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1], z = p[i + 2]; p[i] = x * 0.1; p[i + 1] = z * 0.1; p[i + 2] = -y * 0.1; } return m; }
function transform(m, T) { const p = m.pos; for (let i = 0; i < p.length; i += 3) { const q = applyT(T, [p[i], p[i + 1], p[i + 2]]); p[i] = q[0]; p[i + 1] = q[1]; p[i + 2] = q[2]; } return m; }

const FIT = {   // the tracker's reference face (cm), points on the skin
  33: [-4.446, 2.664, 3.173], 263: [4.446, 2.664, 3.173], 133: [-1.856, 2.585, 3.758], 362: [1.856, 2.585, 3.758],
  1: [0, -1.127, 7.476], 2: [0, -2.089, 6.058], 168: [0, 3.271, 5.236], 10: [0, 8.262, 4.482], 152: [0, -9.403, 4.264],
  234: [-7.664, 0.673, -2.436], 454: [7.664, 0.673, -2.436], 61: [-2.456, -4.343, 4.284], 291: [2.456, -4.343, 4.284],
};

console.log("reading skin…");
let skinFull = toHeadAxes(readObj(SKIN));
// keep the head and neck
function cropTriangles(m, keep) {
  const out = [];
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = vert(m, m.idx[i]), b = vert(m, m.idx[i + 1]), c = vert(m, m.idx[i + 2]);
    if (keep(a) && keep(b) && keep(c)) out.push(m.idx[i], m.idx[i + 1], m.idx[i + 2]);
  }
  return compact({ pos: m.pos, idx: Uint32Array.from(out) });
}
function compact(m) {
  const map = new Int32Array(m.pos.length / 3).fill(-1), pos = [];
  const idx = new Uint32Array(m.idx.length);
  for (let i = 0; i < m.idx.length; i++) {
    const v = m.idx[i];
    if (map[v] < 0) { map[v] = pos.length / 3; pos.push(m.pos[3 * v], m.pos[3 * v + 1], m.pos[3 * v + 2]); }
    idx[i] = map[v];
  }
  return { pos: Float64Array.from(pos), idx };
}
let top = -1e9; for (let i = 1; i < skinFull.pos.length; i += 3) top = Math.max(top, skinFull.pos[i]);
let skin = cropTriangles(skinFull, p => p[1] > top - 35 && Math.abs(p[0]) < 13);
skinFull = null;

const eyeL = toHeadAxes(readObj("FJ1317")), eyeR = toHeadAxes(readObj("FJ1368"));
const cL = centroid(eyeL), cR = centroid(eyeR);
// nose tip: the most forward skin point near the middle, below the eyes
let nose = null;
for (let i = 0; i < skin.pos.length / 3; i++) { const v = vert(skin, i); if (Math.abs(v[0]) < 1.5 && v[1] < cL[1] && v[1] > cL[1] - 6 && (!nose || v[2] > nose[2])) nose = v; }
let T = { s: 5.94 / len(sub(cL, cR)), R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };
T.t = sub(FIT[1], mul(nose, T.s));
// refine: nearest skin point to each reference point, then the best similarity, a few times
const ids = Object.keys(FIT);
for (let it = 0; it < 25; it++) {
  const P = [], Q = [];
  for (const id of ids) {
    let best = null, bd = 1e9;
    for (let i = 0; i < skin.pos.length / 3; i++) {
      const v = vert(skin, i), w = applyT(T, v), d = len(sub(w, FIT[id]));
      if (d < bd) { bd = d; best = v; }
    }
    P.push(best); Q.push(FIT[id]);
  }
  P.push(cL, cR); Q.push([2.95, 2.45, 2.2], [-2.95, 2.45, 2.2]);   // eyeball centres sit behind the eye corners
  T = umeyama(P, Q);
}
{
  let err = 0; for (const id of ids) { let bd = 1e9; for (let i = 0; i < skin.pos.length / 3; i++) bd = Math.min(bd, len(sub(applyT(T, vert(skin, i)), FIT[id]))); err += bd; }
  console.log("fit scale", T.s.toFixed(3), "mean distance to reference points (cm)", (err / ids.length).toFixed(2));
}
transform(skin, T);
skin = cropTriangles(skin, p => p[1] > -13.8);

const prep = ids => transform(toHeadAxes(load(ids)), T);
console.log("reading skull, brain, eyes…");
const cranium = prep(CRANIUM), mandible = prep(MANDIBLE), eyes = prep(EYES);
const lobes = Object.fromEntries(Object.entries(LOBES).map(([k, v]) => [k, prep(v)]));
const cerebrum = merge(Object.values(lobes));
const hind = Object.fromEntries(Object.entries(HINDBRAIN).map(([k, v]) => [k, prep(v)]));
const hindbrain = merge(Object.values(hind));

// ------------------------------------------------------------------ normals and simplifying
function normals(m) {
  const n = new Float64Array(m.pos.length);
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = m.idx[i], b = m.idx[i + 1], c = m.idx[i + 2];
    const f = cross(sub(vert(m, b), vert(m, a)), sub(vert(m, c), vert(m, a)));
    for (const v of [a, b, c]) { n[3 * v] += f[0]; n[3 * v + 1] += f[1]; n[3 * v + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
function weld(m, eps = 1e-4) {
  const key = new Map(), map = new Uint32Array(m.pos.length / 3), pos = [];
  for (let i = 0; i < map.length; i++) {
    const k = Math.round(m.pos[3 * i] / eps) + "," + Math.round(m.pos[3 * i + 1] / eps) + "," + Math.round(m.pos[3 * i + 2] / eps);
    let j = key.get(k);
    if (j === undefined) { j = pos.length / 3; key.set(k, j); pos.push(m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]); }
    map[i] = j;
  }
  const idx = [];
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = map[m.idx[i]], b = map[m.idx[i + 1]], c = map[m.idx[i + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { pos: Float64Array.from(pos), idx: Uint32Array.from(idx) };
}
function simplify(m, triangles) {
  m = weld(m);
  if (m.idx.length / 3 <= triangles) return m;
  const pos32 = Float32Array.from(m.pos);
  let [dst] = MeshoptSimplifier.simplify(m.idx, pos32, 3, triangles * 3, 0.02, []);
  if (dst.length / 3 > triangles * 1.25) [dst] = MeshoptSimplifier.simplifySloppy(m.idx, pos32, 3, null, triangles * 3, 0.05);
  return compact({ pos: m.pos, idx: dst });
}

// ------------------------------------------------------------------ muscles, modelled on the real skull and skin
// A muscle is a lens-shaped slab over part of a surface: weight w(p) in 0..1 says how much of it is there.
function slab(m, weight, { lift = 0, thick = 0.5, inward = false, facing = null }) {
  const n = normals(m), nv = m.pos.length / 3, w = new Float64Array(nv);
  let side = 0; for (let i = 0; i < nv; i++) side += dot([n[3 * i], n[3 * i + 1], n[3 * i + 2]], sub(vert(m, i), HC));
  if (side < 0) for (let i = 0; i < n.length; i++) n[i] = -n[i];   // make normals point out of the head
  for (let i = 0; i < nv; i++) {
    const p = vert(m, i), nn = [n[3 * i], n[3 * i + 1], n[3 * i + 2]];
    w[i] = clamp(weight(p, nn), 0, 1) * (facing ? clamp(facing(p, nn), 0, 1) : 1);
  }
  // soften the outline: average each weight with its neighbours a few times
  for (let pass = 0; pass < 3; pass++) {
    const sum = new Float64Array(nv), cnt = new Float64Array(nv);
    for (let i = 0; i < m.idx.length; i += 3) for (let k = 0; k < 3; k++) {
      const v = m.idx[i + k], a = m.idx[i + (k + 1) % 3], b = m.idx[i + (k + 2) % 3];
      sum[v] += w[a] + w[b]; cnt[v] += 2;
    }
    for (let i = 0; i < nv; i++) if (cnt[i]) w[i] = 0.5 * w[i] + 0.5 * sum[i] / cnt[i];
    for (let i = 0; i < nv; i++) if (w[i] < 0.02) w[i] = 0;
  }
  const tris = [];
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = m.idx[i], b = m.idx[i + 1], c = m.idx[i + 2];
    if (w[a] > 0.01 || w[b] > 0.01 || w[c] > 0.01) tris.push(a, b, c);   // rim corners have weight 0, which closes the slab
  }
  const used = new Map(), pos = [], idx = [];
  const sgn = inward ? -1 : 1;
  const put = (v, side) => {
    const key = v * 2 + side;
    if (used.has(key)) return used.get(key);
    const p = vert(m, v), nn = [n[3 * v], n[3 * v + 1], n[3 * v + 2]];
    const base = add(p, mul(nn, sgn * lift));
    const off = side ? thick * w[v] : -thick * w[v] * (inward ? 1 : 0.15);
    const q = add(base, mul(nn, off));
    const k = pos.length / 3; pos.push(q[0], q[1], q[2]); used.set(key, k); return k;
  };
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    idx.push(put(a, 1), put(b, 1), put(c, 1));
    idx.push(put(a, 0), put(c, 0), put(b, 0));
  }
  return { mesh: { pos: Float64Array.from(pos), idx: Uint32Array.from(idx) }, peak: peakOf(m, w, n, sgn * lift + thick) };
}
function peakOf(m, w, n, out) {
  let bi = -1; for (let i = 0; i < w.length; i++) if (bi < 0 || w[i] > w[bi]) bi = i;
  const p = vert(m, bi); return add(p, mul([n[3 * bi], n[3 * bi + 1], n[3 * bi + 2]], out));
}
const ell = (p, c, rx, ry) => Math.hypot((p[0] - c[0]) / rx, (p[1] - c[1]) / ry);
const segDist = (p, a, b) => { const ab = [b[0] - a[0], b[1] - a[1]], ap = [p[0] - a[0], p[1] - a[1]]; const t = clamp((ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] ** 2 + ab[1] ** 2), 0, 1); return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1]); };
const bump = (d, r) => smooth(1, 0.35, d / r);   // 1 inside, fading to 0 at r

console.log("modelling muscles…");
const craniumMid = simplify(cranium, 60000), mandibleMid = simplify(mandible, 8000), skinMid = simplify(skin, 60000);
const HC = [0, 3.0, -4.6];   // middle of the head
const outward = (p, n) => smooth(0.1, 0.4, dot(n, norm(sub(p, HC))));
const front = (p, n) => smooth(0.0, 0.35, n[2]) * smooth(-0.5, 0.8, p[2]);
const muscleParts = [], muscleLabels = {};
const addMuscle = (name, r) => { muscleParts.push(r.mesh); (muscleLabels[name] ||= []).push(r.peak.map(v => +v.toFixed(2))); };
for (const s of [1, -1]) {
  addMuscle("Temporalis", slab(craniumMid, p => s * p[0] > 3.5 ? bump(Math.hypot((p[1] - 4.2) / 4.6, (p[2] + 4.0) / 5.6), 1) * smooth(-1.5, 0.5, p[1]) : 0,
    { lift: 0.05, thick: 0.9, facing: (p, n) => smooth(0.15, 0.45, s * n[0]) * outward(p, n) }));
  addMuscle("Masseter", slab(mandibleMid, p => s * p[0] > 3.0 ? bump(Math.hypot((p[1] + 3.6) / 3.2, (p[2] + 1.6) / 2.4), 1) : 0,
    { lift: 0.05, thick: 0.85, facing: (p, n) => smooth(0.1, 0.4, s * n[0]) }));
  addMuscle("Orbicularis oculi", slab(skinMid, p => { const d = ell(p, [s * 3.05, 2.6], 1.25, 1.0); return smooth(0.75, 1.05, d) * smooth(2.2, 1.6, d); },
    { lift: 0.3, thick: 0.18, inward: true, facing: front }));
  addMuscle("Zygomaticus major", slab(skinMid, p => bump(segDist(p, [s * 4.9, 0.0], [s * 2.6, -4.2]), 0.55) * smooth(-4.8, -3.9, p[1]),
    { lift: 0.55, thick: 0.22, inward: true, facing: front }));
  addMuscle("Depressor anguli oris", slab(skinMid, p => bump(segDist(p, [s * 2.7, -4.8], [s * 3.1, -7.6]), 0.7 - 0.15 * smooth(-4.8, -7.6, p[1])),
    { lift: 0.35, thick: 0.2, inward: true, facing: front }));
  addMuscle("Nasalis", slab(skinMid, p => bump(segDist(p, [s * 0.75, 2.2], [s * 1.05, -0.4]), 0.45),
    { lift: 0.18, thick: 0.12, inward: true, facing: front }));
}
addMuscle("Frontalis", slab(craniumMid, p => p[2] > -3 ? smooth(4.7, 5.8, p[1]) * smooth(10.8, 9.0, p[1]) * smooth(5.8, 4.0, Math.abs(p[0])) : 0,
  { lift: 0.05, thick: 0.28, facing: (p, n) => smooth(0.2, 0.5, n[2]) * outward(p, n) }));
addMuscle("Occipitalis", slab(craniumMid, p => p[2] < -11 ? bump(Math.hypot(p[0] / 5.0, (p[1] - 5.0) / 2.6), 1) : 0,
  { lift: 0.05, thick: 0.3, facing: (p, n) => smooth(0.3, 0.6, -n[2]) * outward(p, n) }));
addMuscle("Orbicularis oris", slab(skinMid, p => { const d = ell(p, [0, -4.45], 2.3, 1.35); return smooth(0.45, 0.7, d) * smooth(1.15, 0.85, d); },
  { lift: 0.3, thick: 0.25, inward: true, facing: front }));
addMuscle("Mentalis", slab(skinMid, p => bump(ell(p, [0, -7.2], 1.1, 0.8), 1), { lift: 0.35, thick: 0.25, inward: true, facing: front }));
const muscles = merge(muscleParts);

// ------------------------------------------------------------------ labels
function outerPoint(m, dirFrom = HC) {   // the element's point furthest out along its own direction from the head middle
  const c = centroid(m), d = norm(sub(c, dirFrom));
  let best = null, bs = -1e9;
  for (let i = 0; i < m.pos.length / 3; i++) {
    const v = vert(m, i), r = sub(v, dirFrom), along = dot(r, d), off = len(sub(r, mul(d, along)));
    const score = along - 2.5 * off;
    if (score > bs) { bs = score; best = v; }
  }
  return best.map(v => +v.toFixed(2));
}
const bone = ids => prep(ids);
const labels = [];
const L = (t, layer, pts, jaw = 0) => labels.push({ t, layer, jaw, pts });
L("Frontal bone", "skull", [outerPoint(bone(["FJ3200"]))]);
L("Parietal bone", "skull", [outerPoint(bone(["FJ3274"])), outerPoint(bone(["FJ3380"]))]);
L("Temporal bone", "skull", [outerPoint(bone(["FJ3281"])), outerPoint(bone(["FJ3386"]))]);
L("Occipital bone", "skull", [outerPoint(bone(["FJ3309"]))]);
L("Nasal bone", "skull", [outerPoint(bone(["FJ3272", "FJ3378"]))]);
L("Zygomatic bone (cheekbone)", "skull", [outerPoint(bone(["FJ3287"])), outerPoint(bone(["FJ3392"]))]);
L("Maxilla (upper jaw)", "skull", [outerPoint(bone(["FJ3269"])), outerPoint(bone(["FJ3375"]))]);
{   // front teeth: the lowest front point of the upper jaw
  const mx = bone(["FJ3269", "FJ3375"]); let b = null;
  for (let i = 0; i < mx.pos.length / 3; i++) { const v = vert(mx, i); if (Math.abs(v[0]) < 0.6 && (!b || v[1] < b[1])) b = v; }
  L("Teeth", "skull", [b.map(v => +v.toFixed(2))]);
}
{   // chin
  let b = null;
  for (let i = 0; i < mandible.pos.length / 3; i++) { const v = vert(mandible, i); if (Math.abs(v[0]) < 0.8 && (!b || v[2] - 0.4 * v[1] > b[2] - 0.4 * b[1])) b = v; }
  L("Mandible (lower jaw)", "skull", [b.map(v => +v.toFixed(2))], 1);
}
L("Eyeball", "eyes", [outerPoint(prep(["FJ1317"])), outerPoint(prep(["FJ1368"]))]);
const half = (m, s) => cropTriangles(m, p => s * p[0] > 0.3);
for (const [k, name] of [["frontal", "Frontal lobe"], ["parietal", "Parietal lobe"], ["temporal", "Temporal lobe"], ["occipital", "Occipital lobe"]])
  L(name, "brain", [outerPoint(half(lobes[k], 1)), outerPoint(half(lobes[k], -1))]);
L("Cerebellum", "brain", [outerPoint(hind.cerebellum)]);
L("Pons (brainstem)", "brain", [outerPoint(hind.pons, add(centroid(hind.pons), [0, 0, -3]))]);
L("Medulla oblongata", "brain", [outerPoint(hind.medulla, add(centroid(hind.medulla), [0, 0, -3]))]);
for (const [t, pts] of Object.entries(muscleLabels)) L(t, "muscles", pts);

// jaw hinge: the middle of the two condyles (top back of the lower jaw)
let jTop = -1e9; for (let i = 1; i < mandible.pos.length; i += 3) jTop = Math.max(jTop, mandible.pos[i]);
const cond = []; for (let i = 0; i < mandible.pos.length / 3; i++) { const v = vert(mandible, i); if (v[1] > jTop - 0.8 && v[2] < -2) cond.push(v); }
const jawPivot = mul(cond.reduce(add), 1 / cond.length); jawPivot[0] = 0;

// ------------------------------------------------------------------ the hand (right), in per-bone frames
console.log("building the hand…");
const raw = id => toHeadAxes(readObj(id));   // cm, any frame; only shapes and joint positions matter
function axisOf(m) {   // main direction and its two ends
  const c = centroid(m), n = m.pos.length / 3; const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) { const d = sub(vert(m, i), c); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) C[r][k] += d[r] * d[k]; }
  let v = [1, 0.3, 0.2]; for (let it = 0; it < 60; it++) v = norm([dot(C[0], v), dot(C[1], v), dot(C[2], v)]);
  let lo = 1e9, hi = -1e9; for (let i = 0; i < n; i++) { const s = dot(sub(vert(m, i), c), v); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  return { c, v, a: add(c, mul(v, lo + 0.15)), b: add(c, mul(v, hi - 0.15)) };
}
const carp = merge(HAND.carpals.map(raw)), carpC = centroid(carp);
const ends = id => { const ax = axisOf(raw(id)); return len(sub(ax.a, carpC)) < len(sub(ax.b, carpC)) ? [ax.a, ax.b] : [ax.b, ax.a]; };
const J = [];   // the 21 tracker joints, measured on the dataset's bones
{
  const [m1a, m1b] = ends(HAND.meta[1]);
  // wrist point: the near end of the wrist bones, in line with the middle finger
  const [m3a] = ends(HAND.meta[3]); const dir = norm(sub(m3a, carpC));
  let lo = 1e9; for (let i = 0; i < carp.pos.length / 3; i++) lo = Math.min(lo, dot(sub(vert(carp, i), carpC), dir));
  J[0] = add(carpC, mul(dir, lo * 0.75));
  J[1] = m1a; J[2] = m1b; J[3] = ends(HAND.prox[1])[1]; J[4] = ends(HAND.dist[1])[1];
  for (let f = 2; f <= 5; f++) {
    const base = 1 + (f - 1) * 4;
    J[base] = ends(HAND.meta[f])[1]; J[base + 1] = ends(HAND.prox[f])[1]; J[base + 2] = ends(HAND.mid[f])[1]; J[base + 3] = ends(HAND.dist[f])[1];
  }
}
const across = norm(sub(J[17], J[5]));
function inFrame(m, o, ex, ey, ez) {   // express points as a*ex + b*ey + c*ez from o
  const M = [[ex[0], ey[0], ez[0]], [ex[1], ey[1], ez[1]], [ex[2], ey[2], ez[2]]];
  const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const inv = [
    [(M[1][1] * M[2][2] - M[1][2] * M[2][1]) / det, (M[0][2] * M[2][1] - M[0][1] * M[2][2]) / det, (M[0][1] * M[1][2] - M[0][2] * M[1][1]) / det],
    [(M[1][2] * M[2][0] - M[1][0] * M[2][2]) / det, (M[0][0] * M[2][2] - M[0][2] * M[2][0]) / det, (M[0][2] * M[1][0] - M[0][0] * M[1][2]) / det],
    [(M[1][0] * M[2][1] - M[1][1] * M[2][0]) / det, (M[0][1] * M[2][0] - M[0][0] * M[2][1]) / det, (M[0][0] * M[1][1] - M[0][1] * M[1][0]) / det]];
  const p = m.pos;
  for (let i = 0; i < p.length; i += 3) { const d = sub([p[i], p[i + 1], p[i + 2]], o); p[i] = dot(inv[0], d); p[i + 1] = dot(inv[1], d); p[i + 2] = dot(inv[2], d); }
  return m;
}
const handMeshes = {};
{   // palm: wrist bones and the four finger metacarpals, in the wrist / index knuckle / little knuckle frame
  const e1 = sub(J[5], J[0]), e2 = sub(J[17], J[0]), e3 = mul(norm(cross(e1, e2)), Math.sqrt(len(e1) * len(e2)));
  handMeshes.hand_palm = inFrame(merge([carp, ...[2, 3, 4, 5].map(f => raw(HAND.meta[f]))]), J[0], e1, e2, e3);
}
const BONES = [[1, 2, HAND.meta[1]], [2, 3, HAND.prox[1]], [3, 4, HAND.dist[1]]];
for (let f = 2; f <= 5; f++) { const b = 1 + (f - 1) * 4; BONES.push([b, b + 1, HAND.prox[f]], [b + 1, b + 2, HAND.mid[f]], [b + 2, b + 3, HAND.dist[f]]); }
for (const [a, b, id] of BONES) {
  const ax = sub(J[b], J[a]), L0 = len(ax), A = norm(ax);
  let B = sub(across, mul(A, dot(across, A))); B = norm(B);
  const C = cross(A, B);
  handMeshes[`hand_b_${a}_${b}`] = inFrame(raw(id), J[a], mul(A, L0), mul(B, L0), mul(C, L0));
}
const hand = J.map(p => sub(p, J[0]));   // for the demo: joint positions, cm, relative to the wrist

// ------------------------------------------------------------------ write
const TARGET = { skin: 14000, cranium: 36000, jaw: 5000, eyes: 5000, cerebrum: 60000, hindbrain: 12000, muscles: 26000 };
const head = { skin, cranium, jaw: mandible, eyes, cerebrum, hindbrain, muscles };
const out = [];
for (const [name, m] of Object.entries(head)) out.push([name, simplify(m, TARGET[name])]);
for (const [name, m] of Object.entries(handMeshes)) out.push([name, simplify(m, name === "hand_palm" ? 4000 : 450)]);

const chunks = [], meta = { source: "BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 JP; simplified and re-aligned; face muscles modelled on its skull and skin", meshes: [], labels, jawPivot: jawPivot.map(v => +v.toFixed(3)), headMiddle: HC, hand: hand.map(p => p.map(v => +v.toFixed(3))) };
let offset = 0;
for (const [name, m] of out) {
  const nv = m.pos.length / 3;
  if (nv > 65535) throw new Error(name + " has too many vertices: " + nv);
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m.pos.length; i++) { min[i % 3] = Math.min(min[i % 3], m.pos[i]); max[i % 3] = Math.max(max[i % 3], m.pos[i]); }
  const size = max.map((v, i) => Math.max(1e-6, v - min[i]));
  const q = new Uint16Array(m.pos.length);
  for (let i = 0; i < m.pos.length; i++) q[i] = Math.round((m.pos[i] - min[i % 3]) / size[i % 3] * 65535);
  const ix = Uint16Array.from(m.idx);
  meta.meshes.push({ name, nv, ni: ix.length, offV: offset, offI: offset + q.byteLength, min: min.map(v => +v.toFixed(5)), size: size.map(v => +v.toFixed(5)) });
  chunks.push(Buffer.from(q.buffer), Buffer.from(ix.buffer));
  offset += q.byteLength + ix.byteLength;
  console.log(name.padEnd(14), "triangles", ix.length / 3, "vertices", nv);
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "anatomy.bin"), Buffer.concat(chunks));
fs.writeFileSync(path.join(OUT, "anatomy.json"), JSON.stringify(meta));
console.log("wrote", (offset / 1e6).toFixed(2), "MB");
