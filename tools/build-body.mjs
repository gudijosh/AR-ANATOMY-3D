// Builds src/anatomy/body.bin + body.json: the skeleton, organs, body muscles and body skin from BodyParts3D,
// each piece stored in the frame of the body segment that carries it (torso, upper arms, forearms, thighs,
// shins, feet), so the page can pin it to the body tracker's points.
//
//   node tools/build-body.mjs <parts.json> <obj folder> [<muscles.json> <obj folder of the isa set>]
//
// parts.json / muscles.json: { layer: [{ concept, elements: ["FJ…"] }] } (made from the BodyParts3D part lists).
// Data: BodyParts3D, (c) The Database Center for Life Science, CC Attribution-Share Alike 2.1 Japan.
// The output is a derivative of BodyParts3D and is shared under the same licence.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MeshoptSimplifier } from "meshoptimizer";

const [PARTS, OBJ, MUSCLES, OBJ2] = process.argv.slice(2);
if (!PARTS || !OBJ) { console.error("usage: node tools/build-body.mjs <parts.json> <obj folder> [<muscles.json> <obj folder>]"); process.exit(1); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../src/anatomy");
await MeshoptSimplifier.ready;

// ------------------------------------------------------------------ helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => mul(a, 1 / (len(a) || 1));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const vert = (m, i) => [m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]];
const cache = new Map();
function readObj(dir, id) {   // cm, +x person's left, +y up, +z front
  const key = dir + id; if (cache.has(key)) return cache.get(key);
  const file = path.join(dir, id + ".obj");
  if (!fs.existsSync(file)) return null;
  const pos = [], idx = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith("v ")) { const p = line.split(/\s+/); pos.push(+p[1] * 0.1, +p[3] * 0.1, -p[2] * 0.1); }
    else if (line.startsWith("f ")) {
      const p = line.trim().split(/\s+/).slice(1).map(s => parseInt(s, 10) - 1);
      for (let k = 1; k + 1 < p.length; k++) idx.push(p[0], p[k], p[k + 1]);
    }
  }
  const m = { pos: Float64Array.from(pos), idx: Uint32Array.from(idx) };
  cache.set(key, m); return m;
}
function merge(list) {
  let nv = 0, ni = 0; for (const m of list) { nv += m.pos.length; ni += m.idx.length; }
  const pos = new Float64Array(nv), idx = new Uint32Array(ni); let ov = 0, oi = 0;
  for (const m of list) { pos.set(m.pos, ov); for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov / 3; ov += m.pos.length; oi += m.idx.length; }
  return { pos, idx };
}
function compact(m) {
  const map = new Int32Array(m.pos.length / 3).fill(-1), pos = [], idx = new Uint32Array(m.idx.length);
  for (let i = 0; i < m.idx.length; i++) { const v = m.idx[i]; if (map[v] < 0) { map[v] = pos.length / 3; pos.push(m.pos[3 * v], m.pos[3 * v + 1], m.pos[3 * v + 2]); } idx[i] = map[v]; }
  return { pos: Float64Array.from(pos), idx };
}
function weld(m, eps = 1e-4) {
  const key = new Map(), map = new Uint32Array(m.pos.length / 3), pos = [];
  for (let i = 0; i < map.length; i++) {
    const k = Math.round(m.pos[3 * i] / eps) + "," + Math.round(m.pos[3 * i + 1] / eps) + "," + Math.round(m.pos[3 * i + 2] / eps);
    let j = key.get(k); if (j === undefined) { j = pos.length / 3; key.set(k, j); pos.push(m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]); }
    map[i] = j;
  }
  const idx = [];
  for (let i = 0; i < m.idx.length; i += 3) { const a = map[m.idx[i]], b = map[m.idx[i + 1]], c = map[m.idx[i + 2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  return { pos: Float64Array.from(pos), idx: Uint32Array.from(idx) };
}
function simplify(m, triangles) {
  m = weld(m);
  if (m.idx.length / 3 <= triangles) return m;
  const p32 = Float32Array.from(m.pos);
  let [dst] = MeshoptSimplifier.simplify(m.idx, p32, 3, triangles * 3, 0.03, []);
  if (dst.length / 3 > triangles * 1.3) [dst] = MeshoptSimplifier.simplifySloppy(m.idx, p32, 3, null, triangles * 3, 0.08);
  return compact({ pos: m.pos, idx: dst });
}
function centroid(m) { const c = [0, 0, 0], n = m.pos.length / 3; for (let i = 0; i < n; i++) { c[0] += m.pos[3 * i]; c[1] += m.pos[3 * i + 1]; c[2] += m.pos[3 * i + 2]; } return mul(c, 1 / n); }
function pick(m, keep) { const out = []; for (let i = 0; i < m.pos.length / 3; i++) { const v = vert(m, i); if (keep(v)) out.push(v); } return out; }
const mean = pts => mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);
function bounds(m) { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < m.pos.length; i++) { lo[i % 3] = Math.min(lo[i % 3], m.pos[i]); hi[i % 3] = Math.max(hi[i % 3], m.pos[i]); } return { lo, hi }; }
function invBasis(ex, ey, ez) {
  const M = [[ex[0], ey[0], ez[0]], [ex[1], ey[1], ez[1]], [ex[2], ey[2], ez[2]]];
  const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  return [
    [(M[1][1] * M[2][2] - M[1][2] * M[2][1]) / det, (M[0][2] * M[2][1] - M[0][1] * M[2][2]) / det, (M[0][1] * M[1][2] - M[0][2] * M[1][1]) / det],
    [(M[1][2] * M[2][0] - M[1][0] * M[2][2]) / det, (M[0][0] * M[2][2] - M[0][2] * M[2][0]) / det, (M[0][2] * M[1][0] - M[0][0] * M[1][2]) / det],
    [(M[1][0] * M[2][1] - M[1][1] * M[2][0]) / det, (M[0][1] * M[2][0] - M[0][0] * M[2][1]) / det, (M[0][0] * M[1][1] - M[0][1] * M[1][0]) / det]];
}
const toLocal = (F, p) => { const d = sub(p, F.o); return [dot(F.inv[0], d), dot(F.inv[1], d), dot(F.inv[2], d)]; };
function inFrame(m, F) { const out = new Float64Array(m.pos.length); for (let i = 0; i < m.pos.length; i += 3) { const q = toLocal(F, [m.pos[i], m.pos[i + 1], m.pos[i + 2]]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; } return { pos: out, idx: m.idx }; }

// ------------------------------------------------------------------ inputs
const parts = JSON.parse(fs.readFileSync(PARTS, "utf8"));
const muscleParts = MUSCLES && fs.existsSync(MUSCLES) ? JSON.parse(fs.readFileSync(MUSCLES, "utf8")) : null;
const load = (els, dir = OBJ) => merge(els.map(e => readObj(dir, e)).filter(Boolean));
const concept = (layer, name) => (parts[layer] || []).find(g => g.concept === name);
const bone = name => { for (const l in parts) { const g = concept(l, name); if (g) return load(g.elements); } throw new Error("no " + name); };

// ------------------------------------------------------------------ joints, measured on the bones (tracker landmark numbers)
const J = {};
for (const [s, side] of [[1, "left"], [-1, "right"]]) {
  const L = s > 0;
  const hum = bone(side + " humerus"), hb = bounds(hum);
  J[L ? 11 : 12] = mean(pick(hum, v => v[1] > hb.hi[1] - 3.5));                   // shoulder: humeral head
  J[L ? 13 : 14] = mean(pick(hum, v => v[1] < hb.lo[1] + 2.5));                   // elbow
  const fore = merge([bone(side + " radius"), bone(side + " ulna")]), fb = bounds(fore);
  J[L ? 15 : 16] = mean(pick(fore, v => v[1] < fb.lo[1] + 2));                    // wrist
  const fem = bone(side + " femur"), mb = bounds(fem);
  const top = pick(fem, v => v[1] > mb.hi[1] - 6), minAx = Math.min(...top.map(v => Math.abs(v[0])));
  J[L ? 23 : 24] = mean(top.filter(v => Math.abs(v[0]) < minAx + 4));            // hip: femoral head
  J[L ? 25 : 26] = mean(pick(fem, v => v[1] < mb.lo[1] + 3));                     // knee
  const tib = bone(side + " tibia"), tb = bounds(tib);
  J[L ? 27 : 28] = mean(pick(tib, v => v[1] < tb.lo[1] + 2.5));                   // ankle
  const foot = load(parts.feet.find(g => g.concept === side + " foot").elements), ftb = bounds(foot);
  J[L ? 29 : 30] = mean(pick(foot, v => v[2] < ftb.lo[2] + 1.5));                 // heel
  J[L ? 31 : 32] = mean(pick(foot, v => v[2] > ftb.hi[2] - 2.5));                 // toes
}
const mid = (a, b) => mul(add(J[a], J[b]), 0.5);
const shW = len(sub(J[11], J[12])), hipW = len(sub(J[23], J[24]));

// ------------------------------------------------------------------ segment frames
const FRONT = [0, 0, 1], UP = [0, 1, 0];
const torsoE1 = sub(J[11], J[12]), torsoE2 = sub(mid(11, 12), mid(23, 24));
const torsoE3 = mul(norm(cross(torsoE1, torsoE2)), Math.sqrt(len(torsoE1) * len(torsoE2)));
const SEG = {
  torso: { o: mid(23, 24), ex: torsoE1, ey: torsoE2, ez: torsoE3 },
};
function limb(a, b, ref) {
  const X = sub(J[b], J[a]), L = len(X), xh = norm(X);
  let y = sub(ref, mul(xh, dot(ref, xh))); if (len(y) < 1e-3) y = sub([1, 0, 0], mul(xh, xh[0]));
  const yh = norm(y), zh = cross(xh, yh);
  return { o: J[a], ex: X, ey: mul(yh, L), ez: mul(zh, L), a, b, ref: ref === UP ? "up" : "front" };
}
Object.assign(SEG, {
  uarmL: limb(11, 13, FRONT), uarmR: limb(12, 14, FRONT), farmL: limb(13, 15, FRONT), farmR: limb(14, 16, FRONT),
  thighL: limb(23, 25, FRONT), thighR: limb(24, 26, FRONT), shankL: limb(25, 27, FRONT), shankR: limb(26, 28, FRONT),
  footL: limb(27, 31, UP), footR: limb(28, 32, UP),
});
for (const F of Object.values(SEG)) F.inv = invBasis(F.ex, F.ey, F.ez);

// which segment carries a point: inside the trunk, or the nearest limb bone line
const shX = Math.abs(J[11][0]), hipX = Math.abs(J[23][0]), hipY = J[23][1], shY = J[11][1];
function segDist(p, F) { const ab = F.ex, t = clamp(dot(sub(p, F.o), ab) / dot(ab, ab), 0, 1); return len(sub(p, add(F.o, mul(ab, t)))); }
function segmentOf(p) {
  const inTrunk = p[1] > hipY - 14 && p[1] < shY + 14 && (Math.abs(p[0]) < (p[1] > hipY + 10 ? shX - 2.5 : hipX + 3));
  if (inTrunk) return "torso";
  let best = "torso", bd = 1e9;
  for (const [k, F] of Object.entries(SEG)) if (k !== "torso") { const d = segDist(p, F); if (d < bd) { bd = d; best = k; } }
  return best;
}

// ------------------------------------------------------------------ build meshes per (segment, layer)
const groups = new Map();   // "seg|layer" -> [meshes]
const put = (seg, layer, m) => { const k = seg + "|" + layer; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); };
const labels = [];
const TORSO_ONLY = new Set(["spine", "pelvis", "ribs", "shoulders", "heart", "lungs", "liver", "stomach", "intestines", "kidneys", "pancreas", "diaphragm"]);
const cleanName = c => { const t = c.replace(/^(right|left) /, ""); return t[0].toUpperCase() + t.slice(1); };
function frontPoint(m) {   // a point on the front surface near the middle of the piece
  const c = centroid(m); let best = null, bs = -1e9;
  for (let i = 0; i < m.pos.length / 3; i++) { const v = vert(m, i), s = v[2] - 0.6 * Math.hypot(v[0] - c[0], v[1] - c[1]); if (s > bs) { bs = s; best = v; } }
  return best;
}
const labelAt = new Map();   // label text -> entry
function addLabel(text, layer, seg, p) {
  const pt = toLocal(SEG[seg], p).map(v => +v.toFixed(4));
  let e = labelAt.get(text);
  if (!e) { e = { t: text, layer, at: [] }; labelAt.set(text, e); labels.push(e); }
  e.at.push({ seg, pt });
}
console.log("bones and organs…");
for (const [layer, list] of Object.entries(parts)) {
  if (layer === "_skin") continue;
  for (const g of list) {
    const m = load(g.elements); if (!m.pos.length) continue;
    const seg = TORSO_ONLY.has(layer) ? "torso" : segmentOf(centroid(m));
    put(seg, layer, m);
    addLabel(cleanName(g.concept), layer, seg, layer === "feet" || TORSO_ONLY.has(layer) && !/bone|clavicle|scapula|sacrum|column|cage/.test(g.concept) ? centroid(m) : frontPoint(m));
  }
}
if (muscleParts) {
  console.log("muscles…");
  for (const [name, list] of Object.entries(muscleParts)) for (const g of list) {
    const m = load(g.elements, OBJ2); if (!m.pos.length) continue;
    const c = centroid(m);
    if (c[1] > shY + 5 || /sternocleidomastoid|platysma/.test(g.concept)) continue;   // the head draws its own face and neck muscles
    if (c[1] < J[27][1] - 1 && /flexor|extensor|interosse|lumbrical|abductor hallucis|quadratus plantae/.test(g.concept)) { /* foot muscles: keep */ }
    const seg = segmentOf(c);
    if (seg.startsWith("farm") && dot(sub(c, SEG[seg].o), SEG[seg].ex) / dot(SEG[seg].ex, SEG[seg].ex) > 1.0) continue;   // hand muscles: the hand tracker draws the hand
    put(seg, seg === "torso" ? "trunkMuscles" : /farm|uarm/.test(seg) ? "armMuscles" : "legMuscles", m);
    if (g.label) addLabel(g.label, seg === "torso" ? "trunkMuscles" : /farm|uarm/.test(seg) ? "armMuscles" : "legMuscles", seg, frontPoint(m));
  }
}
{   // the skin below the head, split by segment (hands left out: the hand tracker draws those)
  console.log("skin…");
  const skin = readObj(OBJ, parts._skin[0].elements[0]);
  const neckCut = shY + 7, per = new Map();
  for (let i = 0; i < skin.idx.length; i += 3) {
    const a = vert(skin, skin.idx[i]), b = vert(skin, skin.idx[i + 1]), c = vert(skin, skin.idx[i + 2]);
    const cc = mul(add(add(a, b), c), 1 / 3);
    if (cc[1] > neckCut) continue;
    const seg = segmentOf(cc);
    if (seg.startsWith("farm")) { const F = SEG[seg]; if (dot(sub(cc, F.o), F.ex) / dot(F.ex, F.ex) > 1.02) continue; }   // the hand
    if (!per.has(seg)) per.set(seg, []);
    per.get(seg).push(skin.idx[i], skin.idx[i + 1], skin.idx[i + 2]);
  }
  for (const [seg, idx] of per) put(seg, "bodyOutline", compact({ pos: skin.pos, idx: Uint32Array.from(idx) }));
}

// triangle budgets
const BUDGET = {
  spine: 9000, pelvis: 5000, ribs: 10000, shoulders: 3500, arms: 1600, legs: 2400, feet: 3500,
  heart: 6000, lungs: 9000, liver: 4000, stomach: 2500, intestines: 9000, kidneys: 3000, pancreas: 1200, diaphragm: 2000,
  trunkMuscles: 22000, armMuscles: 4500, legMuscles: 7000, bodyOutline: 2500,
};
const SKIN_TORSO = 7000;
const meta = { source: "BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 JP; simplified and split into body segments",
  segments: {}, meshes: [], labels, torsoK: +(shW / hipW).toFixed(5), joints: {} };
for (const [k, F] of Object.entries(SEG)) meta.segments[k] = k === "torso" ? { kind: "torso" } : { kind: "limb", a: F.a, b: F.b, ref: F.ref, len: +len(F.ex).toFixed(3) };
// real sizes (cm), so the page can keep bone thickness and depth steady from one stable body scale
Object.assign(meta, { shoulderW: +shW.toFixed(3), hipW: +hipW.toFixed(3), torsoH: +len(torsoE2).toFixed(3) });
// joints in the head-tracker space (for the demo scene): the head file's fit maps the dataset onto the face
const head = JSON.parse(fs.readFileSync(path.join(OUT, "anatomy.json"), "utf8"));
const T = head.fit, applyT = p => add(mul([dot(T.R[0], p), dot(T.R[1], p), dot(T.R[2], p)], T.s), T.t);
for (const [k, p] of Object.entries(J)) meta.joints[k] = applyT(p).map(v => +v.toFixed(3));

const chunks = []; let offset = 0;
for (const [key, list] of groups) {
  const [seg, layer] = key.split("|");
  const budget = layer === "bodyOutline" && seg === "torso" ? SKIN_TORSO : BUDGET[layer] || 3000;
  const m = inFrame(simplify(merge(list), budget), SEG[seg]);
  const nv = m.pos.length / 3; if (nv > 65535) throw new Error(key + " has too many vertices: " + nv);
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m.pos.length; i++) { min[i % 3] = Math.min(min[i % 3], m.pos[i]); max[i % 3] = Math.max(max[i % 3], m.pos[i]); }
  const size = max.map((v, i) => Math.max(1e-6, v - min[i]));
  const q = new Uint16Array(m.pos.length);
  for (let i = 0; i < m.pos.length; i++) q[i] = Math.round((m.pos[i] - min[i % 3]) / size[i % 3] * 65535);
  const ix = Uint16Array.from(m.idx);
  meta.meshes.push({ seg, layer, nv, ni: ix.length, offV: offset, offI: offset + q.byteLength, min: min.map(v => +v.toFixed(5)), size: size.map(v => +v.toFixed(5)) });
  chunks.push(Buffer.from(q.buffer), Buffer.from(ix.buffer)); offset += q.byteLength + ix.byteLength;
  if (ix.length % 2) { chunks.push(Buffer.alloc(2)); offset += 2; }
  console.log(key.padEnd(26), "triangles", ix.length / 3);
}
fs.writeFileSync(path.join(OUT, "body.bin"), Buffer.concat(chunks));
fs.writeFileSync(path.join(OUT, "body.json"), JSON.stringify(meta));
console.log("joints", Object.keys(J).length, "labels", labels.length, "wrote", (offset / 1e6).toFixed(2), "MB");
