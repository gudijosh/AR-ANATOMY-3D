// English and Spanish text for the whole page, the status messages, the anatomy labels and the data read-out.
const UI = {
  en: {
    "doc.title": "AR ANATOMY 3D",
    "title": "AR ANATOMY 3D",
    "lang.group": "Language",
    "intro.h": "See inside.",
    "intro.p": "Watch the skull, brain and muscles move inside your own head, live through your camera. Hold up a hand to see its bones.",
    "start": "Start camera",
    "note": "Processed on this device, never uploaded. A simplified model of a typical head, not a scan and not a medical tool.",
    "h.layers": "Layers", "h.look": "Look", "h.mixed": "Mixed reality", "h.fit": "Fit to my head",
    "p.skull": "Skull", "p.brain": "Brain", "p.muscles": "Muscles", "p.all": "Everything",
    "l.skull": "Skull", "l.brain": "Brain", "l.muscles": "Muscles", "l.eyes": "Eyes", "l.outline": "Head outline", "l.hands": "Hand bones",
    "labels": "Show labels",
    "s.xray": "X-ray", "s.solid": "Solid", "bright": "Brightness",
    "real": "See-through", "feather": "Edge feather", "reveal": "Reveal",
    "r.whole": "Whole head", "r.left": "Left half only", "r.right": "Right half only", "r.top": "Top of the head only",
    "r.bottom": "Lower face only", "r.lens": "X-ray lens (follows your fingertip)",
    "cut": "Cut position", "lens": "Lens size",
    "showdata": "Tracking data",
    "f.size": "Size", "f.width": "Width", "f.height": "Height", "f.depth": "Depth",
    "f.x": "Left / right", "f.y": "Up / down", "f.z": "Forward / back",
    "tip": "Tip: choose Solid, set See-through to about half, then line the skull up with your face.",
    "reset": "Reset fit",
    "credit": "Anatomy shapes are simplified approximations made for this page.",
    // status
    "st.idle": "Click Start camera, then allow the camera.",
    "st.asking": "Asking for the camera…",
    "st.loading3d": "Loading the 3D anatomy…",
    "st.loadingTrackers": "Loading the face and hand trackers (first time takes a few seconds)…",
    "st.tracking": "Tracking your head.",
    "st.trackingHands": "Tracking your head. Hand bones on.",
    "st.handOnly": "Hand found. Face the camera to see inside your head.",
    "st.noFace": "No face found. Face the camera, with light on your face.",
    "st.trackerError": "The tracker hit an error: {msg}",
    "st.demo": "Demo scene (no camera).",
    "st.demoFailed": "Demo failed: {msg}",
    "st.blocked": "Camera blocked. Allow camera access for this page and click Start again.",
    "st.loadFailed": "Could not load the {step}: {msg}",
    "step.camera": "camera", "step.engine": "3D engine", "step.trackers": "trackers",
    "err.noCamera": "this browser will not give this page a camera. Try Chrome or Edge.",
    // data read-out
    "d.face": "face", "d.tracked": "tracked, {n} points", "d.notFound": "not found",
    "d.distance": "distance", "d.cm": "{n} cm (estimate)",
    "d.angles": "turn / nod / tilt", "d.jaw": "jaw open",
    "d.fit": "screen fit", "d.fitValue": "scale {k}, shift {x}, {y}",
    "d.hands": "hands", "d.right": "right", "d.left": "left", "d.none": "none",
    "d.tip": "index fingertip", "d.layers": "layers", "d.speed": "speed", "d.fps": "{n} frames/s",
  },
  es: {
    "doc.title": "AR ANATOMY 3D",
    "title": "AR ANATOMY 3D",
    "lang.group": "Idioma",
    "intro.h": "Mira por dentro.",
    "intro.p": "Mira cómo se mueven el cráneo, el cerebro y los músculos dentro de tu cabeza, en vivo con tu cámara. Levanta una mano para ver sus huesos.",
    "start": "Iniciar cámara",
    "note": "Se procesa en este dispositivo y nunca se sube. Es un modelo simplificado de una cabeza típica, no un escaneo ni una herramienta médica.",
    "h.layers": "Capas", "h.look": "Aspecto", "h.mixed": "Realidad mixta", "h.fit": "Ajustar a mi cabeza",
    "p.skull": "Cráneo", "p.brain": "Cerebro", "p.muscles": "Músculos", "p.all": "Todo",
    "l.skull": "Cráneo", "l.brain": "Cerebro", "l.muscles": "Músculos", "l.eyes": "Ojos", "l.outline": "Contorno", "l.hands": "Huesos de la mano",
    "labels": "Mostrar nombres",
    "s.xray": "Rayos X", "s.solid": "Sólido", "bright": "Brillo",
    "real": "Transparencia", "feather": "Bordes suaves", "reveal": "Mostrar",
    "r.whole": "Toda la cabeza", "r.left": "Solo mitad izquierda", "r.right": "Solo mitad derecha", "r.top": "Solo la parte de arriba",
    "r.bottom": "Solo la parte baja de la cara", "r.lens": "Lupa de rayos X (sigue tu dedo)",
    "cut": "Posición del corte", "lens": "Tamaño de la lupa",
    "showdata": "Datos de seguimiento",
    "f.size": "Tamaño", "f.width": "Ancho", "f.height": "Alto", "f.depth": "Profundidad",
    "f.x": "Izquierda / derecha", "f.y": "Arriba / abajo", "f.z": "Adelante / atrás",
    "tip": "Consejo: elige Sólido, pon la Transparencia a la mitad y alinea el cráneo con tu cara.",
    "reset": "Restablecer ajuste",
    "credit": "Las formas anatómicas son aproximaciones simplificadas hechas para esta página.",
    "st.idle": "Pulsa Iniciar cámara y luego permite el acceso a la cámara.",
    "st.asking": "Pidiendo acceso a la cámara…",
    "st.loading3d": "Cargando la anatomía 3D…",
    "st.loadingTrackers": "Cargando el seguimiento de cara y manos (la primera vez tarda unos segundos)…",
    "st.tracking": "Siguiendo tu cabeza.",
    "st.trackingHands": "Siguiendo tu cabeza. Huesos de la mano activos.",
    "st.handOnly": "Mano detectada. Mira a la cámara para ver dentro de tu cabeza.",
    "st.noFace": "No se ve ninguna cara. Mira a la cámara, con luz en la cara.",
    "st.trackerError": "El seguimiento tuvo un error: {msg}",
    "st.demo": "Escena de demostración (sin cámara).",
    "st.demoFailed": "La demostración falló: {msg}",
    "st.blocked": "Cámara bloqueada. Permite el acceso a la cámara en esta página y vuelve a pulsar Iniciar.",
    "st.loadFailed": "No se pudo cargar {step}: {msg}",
    "step.camera": "la cámara", "step.engine": "el motor 3D", "step.trackers": "el seguimiento",
    "err.noCamera": "este navegador no da acceso a la cámara. Prueba con Chrome o Edge.",
    "d.face": "cara", "d.tracked": "detectada, {n} puntos", "d.notFound": "no encontrada",
    "d.distance": "distancia", "d.cm": "{n} cm (aprox.)",
    "d.angles": "giro / cabeceo / ladeo", "d.jaw": "boca abierta",
    "d.fit": "ajuste en pantalla", "d.fitValue": "escala {k}, desplazamiento {x}, {y}",
    "d.hands": "manos", "d.right": "derecha", "d.left": "izquierda", "d.none": "ninguna",
    "d.tip": "punta del índice", "d.layers": "capas", "d.speed": "velocidad", "d.fps": "{n} imágenes/s",
  },
};

// anatomy names drawn on the picture
const NAMES_ES = {
  "Frontal bone": "Hueso frontal", "Parietal bone": "Hueso parietal", "Temporal bone": "Hueso temporal",
  "Occipital bone": "Hueso occipital", "Nasal bone": "Hueso nasal", "Zygomatic bone (cheekbone)": "Hueso cigomático (pómulo)",
  "Maxilla (upper jaw)": "Maxilar (mandíbula superior)", "Teeth": "Dientes", "Mandible (lower jaw)": "Mandíbula (inferior)",
  "Eyeball": "Globo ocular", "Frontal lobe": "Lóbulo frontal", "Parietal lobe": "Lóbulo parietal", "Temporal lobe": "Lóbulo temporal",
  "Occipital lobe": "Lóbulo occipital", "Cerebellum": "Cerebelo", "Pons (brainstem)": "Protuberancia (tronco encefálico)",
  "Medulla oblongata": "Bulbo raquídeo", "Frontalis": "Músculo frontal", "Temporalis": "Músculo temporal",
  "Orbicularis oculi": "Orbicular de los ojos", "Nasalis": "Músculo nasal", "Zygomaticus major": "Cigomático mayor",
  "Masseter": "Masetero", "Orbicularis oris": "Orbicular de la boca", "Depressor anguli oris": "Depresor del ángulo de la boca",
  "Mentalis": "Músculo mentoniano", "Distal phalanx": "Falange distal", "Middle phalanx": "Falange media",
  "Proximal phalanx": "Falange proximal", "Metacarpal": "Metacarpiano", "Carpal bones (wrist)": "Huesos del carpo (muñeca)",
};

const KEY = "ar-anatomy-3d-lang";
const listeners = [];
let lang = (() => {
  try { const saved = localStorage.getItem(KEY); if (saved === "en" || saved === "es") return saved; } catch { /* ignore */ }
  return (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
})();

export const getLang = () => lang;
export function t(key, vars) {
  let s = UI[lang][key] ?? UI.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
  return s;
}
export const anatomyName = name => (lang === "es" && NAMES_ES[name]) || name;
export function onLangChange(fn) { listeners.push(fn); }

// fill every element marked data-i18n (its text) or data-i18n-aria (its accessible name)
export function translatePage() {
  document.documentElement.lang = lang;
  document.title = t("doc.title");
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  for (const b of document.querySelectorAll("[data-lang]")) {
    const on = b.dataset.lang === lang;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
  }
}
export function setLang(next) {
  if (next !== "en" && next !== "es" || next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  translatePage();
  for (const fn of listeners) fn(lang);
}
