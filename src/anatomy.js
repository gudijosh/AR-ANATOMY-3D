// Real anatomy from the BodyParts3D dataset (simplified and lined up with the face tracker's head space by
// tools/build-anatomy.mjs). Units are centimetres: +x is the person's left, +y up, +z out of the face.
// BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan.
import * as THREE from "three";
import meta from "./anatomy/anatomy.json";
import binUrl from "./anatomy/anatomy.bin?url";

export const LABELS = meta.labels.map(l => ({ t: l.t, layer: l.layer, jaw: !!l.jaw, pts: l.pts }));
export const JAW_PIVOT = meta.jawPivot;
export const HEAD_MIDDLE = meta.headMiddle;
export const HAND_JOINTS = meta.hand;   // the dataset's right hand: 21 tracker joints, cm from the wrist

export async function loadAnatomy() {
  const res = await fetch(binUrl);
  if (!res.ok) throw new Error("anatomy data " + res.status);
  const buf = await res.arrayBuffer();
  const out = {};
  for (const m of meta.meshes) {
    const q = new Uint16Array(buf, m.offV, m.nv * 3), pos = new Float32Array(m.nv * 3);
    for (let i = 0; i < q.length; i++) pos[i] = m.min[i % 3] + q[i] / 65535 * m.size[i % 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, m.offI, m.ni).slice(), 1));
    if (m.offA !== undefined) {   // muscles: [coordinate across the fibres in cm, thickness weight 0..1]
      const qa = new Uint16Array(buf, m.offA, m.nv * 2), a = new Float32Array(m.nv * 2);
      for (let i = 0; i < qa.length; i++) a[i] = m.aMin[i % 2] + qa[i] / 65535 * m.aSize[i % 2];
      geo.setAttribute("aMuscle", new THREE.BufferAttribute(a, 2));
    }
    geo.computeVertexNormals();
    out[m.name] = geo;
  }
  return out;
}
