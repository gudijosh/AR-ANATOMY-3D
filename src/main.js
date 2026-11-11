import "./style.css";
import { t, translatePage, setLang, onLangChange } from "./i18n.js";
import anatomyMeta from "./anatomy/anatomy.json";
// Controls, settings and start-up. The 3D overlay and tracking load only when the camera starts.
const $ = id => document.getElementById(id);
const statusEl = $("status"), video = $("video"), stage = $("stage");
// the status is kept as a message key, so it can be shown again in the other language
let statusNow = { key: "st.idle", vars: null, cls: "" };
const drawStatus = () => { statusEl.textContent = t(statusNow.key, statusNow.vars); statusEl.className = statusNow.cls || ""; };
const setStatus = (key, cls, vars) => { statusNow = { key, vars: vars || null, cls }; drawStatus(); };

const VISION_VERSION = "0.10.14";
const VISION_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/";
const FACE_MODEL = MODEL_BASE + "face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = MODEL_BASE + "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
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
const DEFAULTS = {
  skull: true, brain: false, muscles: false, eyes: true, outline: true, hands: true,
  style: "xray", bright: 1, real: 0.12, feather: 0.2, reveal: "whole", cut: 0.5, showdata: false,
  fs: 1, fw: 1, fh: 1, fd: 1, fx: 0, fy: 0, fz: 0, labels: false,
};
const STORE = "ar-anatomy-3d-settings";
const LAYERS = ["skull", "brain", "muscles", "eyes", "outline", "hands"];
const SLIDERS = ["bright", "real", "feather", "cut", "fs", "fw", "fh", "fd", "fx", "fy", "fz"];
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch { /* ignore */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* ignore */ } };

let overlay = null;
function showSettings() {
  for (const k of LAYERS) $("L_" + k).checked = S[k];
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
for (const k of LAYERS) $("L_" + k).addEventListener("change", e => { S[k] = e.target.checked; save(); });
for (const b of $("style").children) b.addEventListener("click", () => { S.style = b.dataset.style; save(); showSettings(); overlay && overlay.applyStyle(); });
for (const k of SLIDERS) $(k).addEventListener("input", e => { S[k] = parseFloat(e.target.value); save(); showSettings(); });
$("labels").addEventListener("change", e => { S.labels = e.target.checked; save(); });
$("reveal").addEventListener("change", e => { S.reveal = e.target.value; S.cut = 0.5; save(); showSettings(); });
$("showdata").addEventListener("change", e => { S.showdata = e.target.checked; save(); showSettings(); });
$("fitreset").addEventListener("click", () => { S.fs = S.fw = S.fh = S.fd = 1; S.fx = S.fy = S.fz = 0; save(); showSettings(); });
for (const b of document.querySelectorAll("[data-preset]")) b.addEventListener("click", () => {
  const p = b.dataset.preset;
  S.skull = p === "skull" || p === "all";
  S.brain = p === "brain" || p === "all";
  S.muscles = p === "muscles" || p === "all";
  S.eyes = p !== "brain";
  S.outline = true;
  save(); showSettings();
});
translatePage(); showSettings(); drawStatus();
for (const b of document.querySelectorAll("[data-lang]")) b.addEventListener("click", () => setLang(b.dataset.lang));
onLangChange(() => { showSettings(); drawStatus(); });

let pointer = null;
stage.addEventListener("pointermove", e => { const r = stage.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; });
stage.addEventListener("pointerleave", () => { pointer = null; });

async function loadOverlay() {
  const { createOverlay } = await import("./overlay.js");
  overlay = await createOverlay({ stage, S });
}

// ------------------------------------------------------------ tracking
let face = null, hand = null;
async function loadTrackers() {
  const { FilesetResolver, FaceLandmarker, HandLandmarker } = await import("@mediapipe/tasks-vision");
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
}

function runLive() {
  let lastFrame = -1, lostSince = 0, said = "";
  const say = (key, c, vars) => { const id = key + JSON.stringify(vars || ""); if (said !== id) { said = id; setStatus(key, c, vars); } };
  const tick = () => {
    requestAnimationFrame(tick);
    if (video.readyState < 2 || video.currentTime === lastFrame) return;
    lastFrame = video.currentTime;
    const now = performance.now();
    let faceLms = null, handList = [], rightSides = [];
    try {
      const fr = face.detectForVideo(video, now);
      faceLms = fr.faceLandmarks && fr.faceLandmarks[0];
      const mat = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
      if (faceLms && mat) {
        let jaw = 0;
        const shapes = fr.faceBlendshapes && fr.faceBlendshapes[0];
        if (shapes) for (const c of shapes.categories) if (c.categoryName === "jawOpen") jaw = c.score;
        overlay.setHead(mat.data, faceLms, jaw); lostSince = 0;
      } else {
        faceLms = null;
        if (!lostSince) lostSince = now;
        if (now - lostSince > 250) overlay.loseHead();
      }
      if (hand && (S.hands || S.reveal === "lens" || S.showdata)) {
        const hr = hand.detectForVideo(video, now);
        handList = hr.landmarks || [];
        const sides = hr.handedness || hr.handednesses || [];
        // the tracker names hands as if the picture were flipped; ours isn't, so swap them
        rightSides = handList.map((h, i) => !!(sides[i] && sides[i][0] && sides[i][0].categoryName === "Left"));
      }
    } catch (e) { say("st.trackerError", "bad", { msg: e.message }); return; }
    const found = overlay.headFound;
    say(found ? (handList.length ? "st.trackingHands" : "st.tracking") : handList.length ? "st.handOnly" : "st.noFace",
      found || handList.length ? "ok" : "bad");
    overlay.render(now, faceLms, handList, rightSides, pointer);
  };
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
  if (preset) document.querySelector(`[data-preset="${preset}"]`)?.click();
  if (params.get("style")) { S.style = params.get("style"); showSettings(); overlay.applyStyle(); }
  if (params.has("labels")) { S.labels = true; showSettings(); }
  if (params.get("lang")) setLang(params.get("lang"));
  const tick = () => {
    requestAnimationFrame(tick);   // a still scene keeps redrawing the same moment
    const now = performance.now(), time = still ? 1.2 : now / 1000;
    const { W, H } = overlay.size;
    const f = overlay.demoFace(time);
    overlay.setHead(f.matrix, f.lms, 0.5 + 0.5 * Math.sin(time * 1.3));
    const ky = 0.021, kx = ky * H / W, curl = 0.5 + 0.5 * Math.sin(time * 0.9);
    const pts = DEMO_HAND.map(([x, y, z], i) => {
      const joint = i % 4 === 0 && i ? 2 : i % 4 === 3 ? 1.2 : i % 4 === 2 ? 0.6 : 0;   // fingertips bend most
      return { x: 0.82 - x * kx, y: 0.86 - (y - joint * curl * 0.5) * ky, z: -(z + joint * curl * 0.6) * ky * 0.5 };
    });
    overlay.render(now, f.lms, [pts], [true], pointer);
  };
  tick();
}

// ------------------------------------------------------------ start
$("start").addEventListener("click", async () => {
  $("start").disabled = true;
  let step = "step.camera";
  try {
    if (!PHOTO && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia))
      throw new Error(t("err.noCamera"));
    setStatus("st.asking");
    const params = new URLSearchParams(location.search);
    const stream = PHOTO ? await photoStream(PHOTO, (params.get("crop") || "").split(",").filter(Boolean).map(Number))
      : await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
    video.srcObject = stream;
    await Promise.race([video.play(), new Promise(r => setTimeout(r, 2500))]);   // some browsers never settle play() for a still stream
    if (video.videoWidth && video.videoHeight) stage.style.setProperty("--ar", (video.videoWidth / video.videoHeight).toFixed(4));
    $("intro").hidden = true;
    step = "step.engine";
    setStatus("st.loading3d");
    if (!overlay) await loadOverlay();
    step = "step.trackers";
    setStatus("st.loadingTrackers");
    await loadTrackers();
    if (!hand) $("L_hands").disabled = true;
    overlay.resize();
    runLive();
  } catch (err) {
    $("start").disabled = false;
    $("intro").hidden = false;
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    if (denied) setStatus("st.blocked", "bad");
    else setStatus("st.loadFailed", "bad", { step: t(step), msg: err && err.message ? err.message : String(err) });
  }
});

if (PHOTO) {   // optional preview settings, as in the demo
  const params = new URLSearchParams(location.search), preset = params.get("preset");
  if (preset) document.querySelector(`[data-preset="${preset}"]`)?.click();
  if (params.get("style")) { S.style = params.get("style"); showSettings(); }
  if (params.has("labels")) { S.labels = true; showSettings(); }
  if (params.get("real")) { S.real = +params.get("real"); showSettings(); }
  if (params.has("data")) { S.showdata = true; showSettings(); }
  $("start").click();
}
if (DEMO) loadOverlay().then(runDemo).catch(e => setStatus("st.demoFailed", "bad", { msg: e.message }));
