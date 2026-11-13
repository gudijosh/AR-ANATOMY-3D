import "./style.css";
import { t, translatePage, setLang, onLangChange } from "./i18n.js";
import anatomyMeta from "./anatomy/anatomy.json";
import { icon } from "./icons.js";
// Controls, settings and start-up. The 3D overlay and tracking load only when the camera starts.
const $ = id => document.getElementById(id);
const statusEl = $("status"), video = $("video"), stage = $("stage");
// the status is kept as a message key, so it can be shown again in the other language
let statusNow = { key: "st.idle", vars: null, cls: "" };
// it only shows while something is loading or needs the person's attention; while all is well it stays out of the way
const drawStatus = () => {
  statusEl.textContent = t(statusNow.key, statusNow.vars); statusEl.className = statusNow.cls || "";
  $("toast").hidden = statusNow.cls === "ok" || statusNow.key === "st.idle";
};
const setStatus = (key, cls, vars) => { statusNow = { key, vars: vars || null, cls }; drawStatus(); };

const VISION_VERSION = "0.10.14";
const VISION_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/";
const FACE_MODEL = MODEL_BASE + "face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = MODEL_BASE + "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL = MODEL_BASE + "pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";   // steadier than the lite one
const DEMO = location.hash === "#demo";   // a pretend head and hand, no camera needed
// test mode: ?photo=<same-site image>&crop=x,y,w,h feeds a still picture to the trackers instead of the camera
// only pictures from this same site are accepted, so a shared link cannot make the page load someone else's image
const PHOTO = (() => {
  const raw = new URLSearchParams(location.search).get("photo");
  if (!raw) return null;
  try { const u = new URL(raw, location.href); return u.origin === location.origin ? u.href : null; } catch { return null; }
})();

async function photoStream(url, crop) {
  const img = new Image(); img.src = url; await img.decode();
  const [cx, cy, cw, ch] = crop && crop.length === 4 ? crop : [0, 0, img.naturalWidth, img.naturalHeight];
  const c = document.createElement("canvas"); c.width = 960; c.height = Math.round(960 * ch / cw);
  const g = c.getContext("2d"), draw = () => g.drawImage(img, cx, cy, cw, ch, 0, 0, c.width, c.height);
  draw(); setInterval(draw, 40);
  return c.captureStream(25);
}

// ------------------------------------------------------------ settings
// every switchable layer, grouped into the categories of the side panel ([key, dot colour])
const CATEGORIES = [
  { id: "bones", dot: "#bfe3ff", icon: "skull", items: [["skull", "#bfe3ff"], ["spine", "#bfe3ff"], ["ribs", "#bfe3ff"], ["shoulders", "#bfe3ff"], ["arms", "#bfe3ff"],
    ["hands", "#b9c6d2"], ["pelvis", "#bfe3ff"], ["legs", "#bfe3ff"], ["feet", "#bfe3ff"]] },
  { id: "organs", dot: "#ff9fc0", icon: "heart", items: [["brain", "#ff9fc0"], ["eyes", "#f3d65a"], ["heart", "#ff5d73"], ["lungs", "#ff9fc0"], ["liver", "#ffa25e"],
    ["stomach", "#ffd27a"], ["intestines", "#ffbf9c"], ["kidneys", "#ff7f6b"], ["pancreas", "#fff08a"], ["diaphragm", "#d59bff"]] },
  { id: "vessels", dot: "#ff4d5e", icon: "arteries", items: [["arteries", "#ff4d5e"], ["veins", "#6f8dff"],
    ["vHead", "#e7b7c8"], ["vTorso", "#e7b7c8"], ["vArms", "#e7b7c8"], ["vLegs", "#e7b7c8"]] },   // the last four choose where the vessels show
  { id: "nerves", dot: "#ffe066", icon: "nerves", items: [["nerves", "#ffe066"], ["tendons", "#e8e4d4"]] },
  { id: "muscles", dot: "#ff6b5e", icon: "armMuscles", items: [["muscles", "#ff6b5e"], ["trunkMuscles", "#ff6b5e"], ["armMuscles", "#ff6b5e"], ["legMuscles", "#ff6b5e"]] },
  { id: "skin", dot: "#6fb6ff", icon: "bodyOutline", items: [["outline", "#6fb6ff"], ["bodyOutline", "#6fb6ff"]] },
];
const VESSEL_KINDS = ["arteries", "veins"], VESSEL_ZONES = ["vHead", "vTorso", "vArms", "vLegs"];
const BODY_KEYS = ["spine", "ribs", "shoulders", "arms", "pelvis", "legs", "feet", "heart", "lungs", "liver", "stomach", "intestines",
  "kidneys", "pancreas", "diaphragm", "arteries", "veins", "nerves", "tendons", "trunkMuscles", "armMuscles", "legMuscles", "bodyOutline"];
const DEFAULTS = {
  skull: true, brain: false, muscles: false, eyes: true, outline: true, hands: true,
  ...Object.fromEntries(BODY_KEYS.map(k => [k, false])),
  vHead: true, vTorso: true, vArms: true, vLegs: true,
  style: "xray", bright: 1, real: 1, feather: 0, reveal: "whole", cut: 0.5, showdata: false,
  fs: 1, fw: 1, fh: 1, fd: 1, fx: 0, fy: 0, fz: 0, labels: false,
  openCats: [],   // which sections of the "what to see" menu are expanded
};
const STORE = "ar-anatomy-3d-settings";
const LAYERS = CATEGORIES.flatMap(c => c.items.map(i => i[0]));
const bodyActive = () => BODY_KEYS.some(k => S[k]);

// the "what to see" menu: one section per category that expands and collapses, with a switch for the whole section
// and a big tile with its own icon for every part
(function buildCategories() {
  const host = $("cats");
  for (const c of CATEGORIES) {
    const wrap = document.createElement("div");
    wrap.className = "cat"; wrap.dataset.cat = c.id;
    wrap.innerHTML = `<div class="cat-head">
        <button type="button" class="cat-toggle" aria-expanded="false" aria-controls="cat-${c.id}">
          <span class="ic" style="--c:${c.dot}">${icon(c.icon)}</span>
          <span class="cat-name" data-i18n="cat.${c.id}"></span><span class="cat-count" id="cnt-${c.id}"></span>
          <span class="chev">${icon("chevron")}</span>
        </button>
      </div>
      <div class="cat-body" id="cat-${c.id}"><div class="cat-inner">
        <label class="cat-all"><input type="checkbox" id="all-${c.id}" data-i18n-aria="cat.all.${c.id}"><span data-i18n="all"></span></label>
        <div class="tiles">${c.items.map(([k, col]) =>
        `<label class="tile"><input type="checkbox" id="L_${k}"><span class="ic" style="--c:${col}">${icon(k)}</span><span data-i18n="l.${k}"></span></label>`).join("")}</div></div></div>`;
    host.appendChild(wrap);
    wrap.querySelector(".cat-toggle").addEventListener("click", () => {
      const open = new Set(Array.isArray(S.openCats) ? S.openCats : []);
      open.has(c.id) ? open.delete(c.id) : open.add(c.id);
      S.openCats = [...open]; save(); showCategories();
    });
    $("all-" + c.id).addEventListener("change", e => {
      for (const [k] of c.items) S[k] = e.target.checked;
      save(); showSettings();
    });
  }
  // the other menu pieces that carry an icon (labels)
  for (const el of document.querySelectorAll("[data-icon]")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
})();

// pop-up menus: one open at a time; the dock button, the close button, Escape or a tap outside closes it
const sheets = [...document.querySelectorAll(".sheet")], dockBtns = [...document.querySelectorAll("[data-sheet]")];
function openSheet(id, focus) {
  for (const sh of sheets) sh.hidden = sh.id !== id;
  for (const b of dockBtns) b.setAttribute("aria-expanded", String(b.dataset.sheet === id));
  if (id && focus) $(id).querySelector(".sheet-close").focus({ preventScroll: true });
}
const openId = () => (sheets.find(sh => !sh.hidden) || {}).id || null;
for (const b of dockBtns) b.addEventListener("click", e => openSheet(openId() === b.dataset.sheet ? null : b.dataset.sheet, e.detail === 0));
for (const sh of sheets) sh.querySelector(".sheet-close").addEventListener("click", () => {
  openSheet(null); dockBtns.find(b => b.dataset.sheet === sh.id)?.focus({ preventScroll: true });
});
document.addEventListener("keydown", e => {
  const id = openId();
  if (e.key === "Escape" && id) { openSheet(null); dockBtns.find(b => b.dataset.sheet === id)?.focus({ preventScroll: true }); }
});
document.addEventListener("pointerdown", e => { if (openId() && !e.target.closest(".sheet, .dock, .top")) openSheet(null); });
function showCategories() {
  for (const c of CATEGORIES) {
    const on = c.items.filter(([k]) => S[k]).length, all = $("all-" + c.id);
    const open = Array.isArray(S.openCats) && S.openCats.includes(c.id), wrap = document.querySelector(`.cat[data-cat="${c.id}"]`);
    wrap.classList.toggle("open", open); wrap.querySelector(".cat-toggle").setAttribute("aria-expanded", String(open));
    $("cat-" + c.id).inert = !open;   // a closed section's tiles can't be reached with the keyboard
    $("cnt-" + c.id).textContent = on + "/" + c.items.length;
    all.checked = on === c.items.length; all.indeterminate = on > 0 && on < c.items.length;
  }
}
const SLIDERS = ["bright", "real", "feather", "cut", "fs", "fw", "fh", "fd", "fx", "fy", "fz"];
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch { /* ignore */ }
// settings saved before the starting values changed (fully see-through, sharp edges) take the new ones once
if (S.v !== 3) { if (S.v !== 2) S.real = DEFAULTS.real; S.feather = DEFAULTS.feather; S.v = 3; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* ignore */ } };

let overlay = null;
function showSettings() {
  for (const k of LAYERS) $("L_" + k).checked = S[k];
  showCategories();
  for (const b of $("style").children) b.classList.toggle("on", b.dataset.style === S.style);
  for (const k of SLIDERS) {
    const el = $(k); el.value = S[k];
    el.style.setProperty("--p", ((S[k] - el.min) / (el.max - el.min) * 100).toFixed(1) + "%");
  }
  for (const k of ["fs", "fw", "fh", "fd"]) $(k + "v").textContent = Math.round(S[k] * 100) + "%";
  for (const k of ["fx", "fy", "fz"]) $(k + "v").textContent = (S[k] > 0 ? "+" : "") + S[k].toFixed(1) + " cm";
  $("featherv").textContent = Math.round(S.feather * 100) + "%";
  $("labels").checked = S.labels;
  $("reveal").value = S.reveal;
  $("showdata").checked = S.showdata;
  $("data").hidden = !S.showdata;
  $("cutrow").hidden = S.reveal === "whole";
  $("cutlabel").textContent = t(S.reveal === "lens" ? "lens" : "cut");
}
for (const k of LAYERS) $("L_" + k).addEventListener("change", e => {
  S[k] = e.target.checked;
  // vessels need a kind (arteries, veins) and a zone: switching one on with none of the other chosen turns the others on
  if (S[k] && VESSEL_KINDS.includes(k) && !VESSEL_ZONES.some(z => S[z])) for (const z of VESSEL_ZONES) S[z] = true;
  if (S[k] && VESSEL_ZONES.includes(k) && !VESSEL_KINDS.some(z => S[z])) for (const z of VESSEL_KINDS) S[z] = true;
  save(); showSettings();
});
for (const b of $("style").children) b.addEventListener("click", () => { S.style = b.dataset.style; save(); showSettings(); overlay && overlay.applyStyle(); });
for (const k of SLIDERS) $(k).addEventListener("input", e => { S[k] = parseFloat(e.target.value); save(); showSettings(); });
$("labels").addEventListener("change", e => { S.labels = e.target.checked; save(); });
$("reveal").addEventListener("change", e => { S.reveal = e.target.value; S.cut = 0.5; lensAt = { x: 0, y: 0 }; save(); showSettings(); });
$("showdata").addEventListener("change", e => { S.showdata = e.target.checked; save(); showSettings(); });
$("fitreset").addEventListener("click", () => { S.fs = S.fw = S.fh = S.fd = 1; S.fx = S.fy = S.fz = 0; save(); showSettings(); });
// ready-made sets of layers, for the test links only (?preset=organs)
function applyPreset(p) {
  const cat = id => CATEGORIES.find(c => c.id === id).items.map(i => i[0]);
  const on = new Set({
    head: ["skull", "brain", "eyes", "outline"],
    skull: ["skull", "eyes", "outline", "hands"], brain: ["brain", "outline"],
    skeleton: [...cat("bones"), "outline", "bodyOutline"],
    organs: [...cat("organs"), "outline", "bodyOutline"],
    muscles: [...cat("muscles"), "eyes", "outline", "bodyOutline"],
    vessels: [...cat("vessels"), "heart", "outline", "bodyOutline"],
    nerves: ["nerves", "outline", "bodyOutline"], tendons: ["tendons", "legs", "arms", "outline", "bodyOutline"],
    all: LAYERS,
  }[p] || []);
  for (const k of LAYERS) S[k] = on.has(k) || VESSEL_ZONES.includes(k);   // the zones only matter once a kind of vessel is on
  save(); showSettings();
}
translatePage(); showSettings(); drawStatus();
for (const b of document.querySelectorAll("[data-lang]")) b.addEventListener("click", () => setLang(b.dataset.lang));
onLangChange(() => { showSettings(); drawStatus(); });

// the lens starts in the middle of the window and is dragged from anywhere on the picture: it moves by as much as the
// finger moves instead of jumping under it, so the finger never covers what is being looked at
let lensAt = { x: 0, y: 0 }, lensDrag = null;     // lensAt: how far the lens is from the middle of the window, in px
const lensPoint = () => {
  const r = stage.getBoundingClientRect();
  return { x: innerWidth / 2 + lensAt.x - r.left, y: innerHeight / 2 + lensAt.y - r.top };
};
stage.addEventListener("pointerdown", e => {
  if (S.reveal !== "lens") return;
  lensDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: lensAt.x, oy: lensAt.y };
  try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
});
stage.addEventListener("pointermove", e => {
  if (!lensDrag || e.pointerId !== lensDrag.id) return;
  const hw = innerWidth / 2, hh = innerHeight / 2;
  lensAt = { x: Math.max(-hw, Math.min(hw, lensDrag.ox + e.clientX - lensDrag.x)),
             y: Math.max(-hh, Math.min(hh, lensDrag.oy + e.clientY - lensDrag.y)) };
});
for (const ev of ["pointerup", "pointercancel"]) stage.addEventListener(ev, e => { if (lensDrag && e.pointerId === lensDrag.id) lensDrag = null; });

async function loadOverlay() {
  const { createOverlay } = await import("./overlay.js");
  overlay = await createOverlay({ stage, S });
}

// ------------------------------------------------------------ tracking
let face = null, hand = null, body = null;
async function loadTrackers() {
  const { FilesetResolver, FaceLandmarker, HandLandmarker, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks(VISION_WASM);
  const makeFace = delegate => FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate }, runningMode: "VIDEO", numFaces: 1,
    outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true,
  });
  const makeHand = delegate => HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: "VIDEO", numHands: 2,
  });
  try { face = await makeFace("GPU"); } catch { face = await makeFace("CPU"); }
  try { try { hand = await makeHand("GPU"); } catch { hand = await makeHand("CPU"); } }
  catch { hand = null; }   // the head still works without hands
  const makeBody = delegate => PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: true,
    minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6, minTrackingConfidence: 0.7,
  });
  try { try { body = await makeBody("GPU"); } catch { body = await makeBody("CPU"); } }
  catch { body = null; }   // the head and hands still work without the body
}

function runLive() {
  let lastFrame = -1, lostSince = 0, said = "";
  const say = (key, c, vars) => { const id = key + JSON.stringify(vars || ""); if (said !== id || statusNow.key !== key) { said = id; setStatus(key, c, vars); } };
  const tick = () => {
    requestAnimationFrame(tick);
    if (video.readyState < 2 || video.currentTime === lastFrame) return;
    lastFrame = video.currentTime;
    const now = performance.now();
    let faceLms = null, handList = [], rightSides = [], headSet = false, failed = null;
    // each tracker on its own: if one of them fails on a frame, the others still draw
    const run = fn => { try { fn(); } catch (e) { failed = e; } };
    run(() => {
      const fr = face.detectForVideo(video, now);
      const lms = fr.faceLandmarks && fr.faceLandmarks[0];
      const mat = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
      if (lms && mat) {
        let jaw = 0;
        const shapes = fr.faceBlendshapes && fr.faceBlendshapes[0];
        if (shapes) for (const c of shapes.categories) if (c.categoryName === "jawOpen") jaw = c.score;
        overlay.setHead(mat.data, lms, jaw); faceLms = lms; headSet = true; lostSince = 0;
      }
    });
    if (!headSet) {
      faceLms = null;
      if (!lostSince) lostSince = now;
      if (now - lostSince > 250) overlay.loseHead();
    }
    if (hand && (S.hands || S.arms || S.armMuscles || S.showdata)) run(() => {
      const hr = hand.detectForVideo(video, now);
      const list = hr.landmarks || [], sides = hr.handedness || hr.handednesses || [];
      // the tracker names hands as if the picture were flipped; ours isn't, so swap them
      rightSides = list.map((h, i) => !!(sides[i] && sides[i][0] && sides[i][0].categoryName === "Left"));
      handList = list;
    });
    bodyPose = null;
    if (body && bodyActive()) run(() => {
      const pr = body.detectForVideo(video, now);
      if (pr.landmarks && pr.landmarks[0]) {
        const mk = pr.segmentationMasks && pr.segmentationMasks[0];
        const mask = mk ? { data: Float32Array.from(mk.getAsFloat32Array()), width: mk.width, height: mk.height } : null;
        if (mk && mk.close) mk.close();
        bodyPose = { lms: pr.landmarks[0], world: pr.worldLandmarks && pr.worldLandmarks[0], mask };
        if (PHOTO) window.__bodyPose = bodyPose.lms;   // test mode only: lets a test read the raw points
      }
    });
    const found = overlay.headFound;
    if (failed && !found && !handList.length && !bodyPose) { say("st.trackerError", "bad", { msg: failed.message }); return; }
    if (!flipBusy) say(found ? (handList.length ? "st.trackingHands" : "st.tracking") : handList.length ? "st.handOnly" : bodyPose ? "st.bodyOnly" : "st.noFace",
      found || handList.length || bodyPose ? "ok" : "bad");
    overlay.render(now, faceLms, handList, rightSides, lensPoint(), bodyPose);
  };
  let bodyPose = null;
  tick();
}

// ------------------------------------------------------------ demo scene
// a right hand, palm to the camera, fingers up (cm, x right, y up)
// the dataset's own right hand, turned fingers-up, palm to the camera (cm from the wrist)
const DEMO_HAND = anatomyMeta.hand.map(([x, y, z]) => [-x, -y, z]);
function runDemo() {
  $("intro").hidden = true;
  setStatus("st.demo", "ok");
  const params = new URLSearchParams(location.search), still = params.has("still");
  // optional preview settings for the demo only (not saved): ?preset=all&style=solid&labels
  const preset = params.get("preset");
  if (preset) applyPreset(preset);
  if (params.get("style")) { S.style = params.get("style"); showSettings(); overlay.applyStyle(); }
  if (params.has("labels")) { S.labels = true; showSettings(); }
  if (params.get("lang")) setLang(params.get("lang"));
  // test settings: ?turn=1.5 makes the pretend body turn further (radians), ?noface hides the face from the body's sizing
  const turn = parseFloat(params.get("turn")) || undefined, noface = params.has("noface");
  if (params.has("rear")) { viewFlipped = false; stage.classList.add("unflipped"); overlay.setView(false); }   // ?rear: the un-flipped view of a rear camera
  const tick = () => {
    requestAnimationFrame(tick);   // a still scene keeps redrawing the same moment
    const now = performance.now(), time = still ? 1.2 : now / 1000;
    const { W, H } = overlay.size;
    const far = bodyActive();   // with body layers on, the pretend camera steps back to show the whole body
    const f = overlay.demoFace(time, far, turn);
    overlay.setHead(f.matrix, f.lms, 0.5 + 0.5 * Math.sin(time * 1.3));
    if (far) {
      // ?legs: the shoulders and arms are out of the picture; ?nobody: the body tracker sees nothing (hands only)
      if (params.has("legs")) for (const i of [11, 12, 13, 14, 15, 16]) f.body[i].visibility = 0;
      overlay.render(now, noface ? null : f.lms, f.hands, f.sides, lensPoint(), params.has("nobody") ? null : { lms: f.body, world: params.has("noworld") ? null : f.world });
      return;
    }
    const ky = 0.021, kx = ky * H / W, curl = 0.5 + 0.5 * Math.sin(time * 0.9);
    const pts = DEMO_HAND.map(([x, y, z], i) => {
      const joint = i % 4 === 0 && i ? 2 : i % 4 === 3 ? 1.2 : i % 4 === 2 ? 0.6 : 0;   // fingertips bend most
      return { x: 0.82 - x * kx, y: 0.86 - (y - joint * curl * 0.5) * ky, z: -(z + joint * curl * 0.6) * ky * 0.5 };
    });
    overlay.render(now, f.lms, [pts], [true], lensPoint());
  };
  tick();
}

// ------------------------------------------------------------ camera
// The front camera is shown flipped, like a looking-glass; a rear camera (to look at someone else, or at your own arm
// or feet) is shown as it is. The page's styles and the overlay both follow `viewFlipped`.
let camStream = null, viewFlipped = true, flipBusy = false;
const camFacing = () => { const tr = camStream && camStream.getVideoTracks()[0]; return (tr && tr.getSettings && tr.getSettings().facingMode) || ""; };
const camDevice = () => { const tr = camStream && camStream.getVideoTracks()[0]; return (tr && tr.getSettings && tr.getSettings().deviceId) || ""; };
const openCamera = which => navigator.mediaDevices.getUserMedia({ video: { ...which, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
const stopCamera = () => { if (camStream) for (const tr of camStream.getTracks()) tr.stop(); camStream = null; };
async function showStream(stream) {
  camStream = stream; camWanted = true;
  viewFlipped = camFacing() !== "environment";
  stage.classList.toggle("unflipped", !viewFlipped);
  video.srcObject = stream; video.hidden = false;
  await Promise.race([video.play(), new Promise(r => setTimeout(r, 2500))]);   // some browsers never settle play() for a still stream
  syncShape();
  const tr = stream.getVideoTracks()[0];
  if (tr) tr.addEventListener("ended", reviveCamera);   // the system took the camera away (another app, a locked phone)
  if (overlay) { overlay.resize(); overlay.setView(viewFlipped); }
}
// the picture's own shape: it changes when a phone is turned on its side, and the anatomy only lines up if the stage follows
function syncShape() {
  if (!video.videoWidth || !video.videoHeight) return;
  const ar = (video.videoWidth / video.videoHeight).toFixed(4);
  if (stage.style.getPropertyValue("--ar") === ar) return;
  stage.style.setProperty("--ar", ar);
  if (overlay) { overlay.resize(); overlay.setView(viewFlipped); }
}
video.addEventListener("resize", syncShape);
// coming back to the app after the camera was stopped behind its back: open the same camera again
let camWhich = { facingMode: "user" }, camWanted = false;   // camWanted: a camera has been opened once, so it should be kept alive
async function reviveCamera() {
  if (DEMO || PHOTO || flipBusy || !camWanted || document.hidden) return;
  const tr = camStream && camStream.getVideoTracks()[0];
  if (tr && tr.readyState === "live") { if (video.paused) video.play().catch(() => { /* ignore */ }); return; }
  flipBusy = true;
  try { stopCamera(); await showStream(await openCamera(camWhich)); setStatus("st.tracking", "ok"); }
  catch { setStatus("st.cameraLost", "bad"); }
  flipBusy = false;
}
document.addEventListener("visibilitychange", reviveCamera);
// the flip button only appears when the device really has another camera
async function offerFlip() {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
    $("flip").hidden = cams.length < 2;
  } catch { $("flip").hidden = true; }
}
$("flip").addEventListener("click", async () => {
  if (flipBusy || !camStream) return;
  flipBusy = true; $("flip").disabled = true;
  const facing = camFacing(), device = camDevice();
  // phones say which way a camera faces; computers with two cameras don't, so there the next camera in the list is taken
  let next, back;
  if (facing === "user" || facing === "environment") {
    next = { facingMode: { exact: facing === "user" ? "environment" : "user" } }; back = { facingMode: facing };
  } else {
    const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter(d => d.kind === "videoinput" && d.deviceId);
    const i = cams.findIndex(d => d.deviceId === device), other = cams.length > 1 ? cams[(i + 1) % cams.length] : null;
    next = other ? { deviceId: { exact: other.deviceId } } : null; back = device ? { deviceId: { exact: device } } : { facingMode: "user" };
  }
  try {
    if (!next) throw new Error("no other camera");
    setStatus("st.switching");
    stopCamera();   // phones only lend one camera at a time: the first must be released before the other opens
    await showStream(await openCamera(next)); camWhich = next;
    setStatus("st.tracking", "ok");
  } catch {
    try { stopCamera(); await showStream(await openCamera(back)); camWhich = back; setStatus("st.flipFailed", "bad"); }
    catch { setStatus("st.cameraLost", "bad"); }
  }
  flipBusy = false; $("flip").disabled = false;
});

// ------------------------------------------------------------ start
$("start").addEventListener("click", async () => {
  $("start").disabled = true;
  let step = "step.camera";
  try {
    if (!PHOTO && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia))
      throw new Error(t("err.noCamera"));
    setStatus("st.asking");
    const params = new URLSearchParams(location.search);
    if (PHOTO) await showStream(await photoStream(PHOTO, (params.get("crop") || "").split(",").filter(Boolean).map(Number)));
    else await showStream(await openCamera({ facingMode: "user" }));
    $("intro").hidden = true;
    step = "step.engine";
    setStatus("st.loading3d");
    if (!overlay) await loadOverlay();
    step = "step.trackers";
    setStatus("st.loadingTrackers");
    await loadTrackers();
    if (!hand) $("L_hands").disabled = true;
    overlay.resize(); overlay.setView(viewFlipped);
    runLive();
    if (!PHOTO) offerFlip();
  } catch (err) {
    $("start").disabled = false;
    $("intro").hidden = false; video.hidden = true;
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    if (denied) setStatus("st.blocked", "bad");
    else setStatus("st.loadFailed", "bad", { step: t(step), msg: err && err.message ? err.message : String(err) });
  }
});

if (PHOTO) {   // optional preview settings, as in the demo
  const params = new URLSearchParams(location.search), preset = params.get("preset");
  if (preset) applyPreset(preset);
  if (params.get("style")) { S.style = params.get("style"); showSettings(); }
  if (params.has("labels")) { S.labels = true; showSettings(); }
  if (params.get("real")) { S.real = +params.get("real"); showSettings(); }
  if (params.has("data")) { S.showdata = true; showSettings(); }
  $("start").click();
}
if (DEMO) loadOverlay().then(runDemo).catch(e => setStatus("st.demoFailed", "bad", { msg: e.message }));
