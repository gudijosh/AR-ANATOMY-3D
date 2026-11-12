// English and Spanish text for the whole page, the status messages, the anatomy labels and the data read-out.
const UI = {
  en: {
    "doc.title": "AR ANATOMY 3D",
    "title": "AR ANATOMY 3D",
    "lang.group": "Language",
    "intro.h": "See inside.",
    "intro.p": "Watch the skull, brain and muscles move inside your own head, live through your camera. Hold up a hand to see its bones.",
    "start": "Start camera",
    "note": "Processed on this device, never uploaded. A real 3D dataset of one adult, fitted to your head: not a scan of you and not a medical tool.",
    "menu.view": "What to see", "menu.settings": "Settings", "menu.group": "Menu", "close": "Close",
    "h.quick": "Quick picks", "all": "All",
    "h.layers": "Layers", "h.look": "Look", "h.mixed": "Mixed reality", "h.fit": "Fit to my head",
    "p.head": "Head", "p.skeleton": "Skeleton", "p.organs": "Organs", "p.skull": "Skull", "p.brain": "Brain", "p.muscles": "Muscles", "p.all": "Everything",
    "cat.bones": "Bones", "cat.organs": "Organs", "cat.muscles": "Muscles", "cat.skin": "Skin outline",
    "cat.all.bones": "All bones", "cat.all.organs": "All organs", "cat.all.muscles": "All muscles", "cat.all.skin": "Whole skin outline",
    "l.skull": "Skull", "l.spine": "Spine", "l.ribs": "Ribs & sternum", "l.shoulders": "Shoulder blades", "l.arms": "Arms",
    "l.hands": "Hands", "l.pelvis": "Pelvis", "l.legs": "Legs", "l.feet": "Feet",
    "l.brain": "Brain", "l.eyes": "Eyes", "l.heart": "Heart", "l.lungs": "Lungs", "l.liver": "Liver", "l.stomach": "Stomach",
    "l.intestines": "Intestines", "l.kidneys": "Kidneys & bladder", "l.pancreas": "Pancreas & spleen", "l.diaphragm": "Diaphragm",
    "l.muscles": "Face", "l.trunkMuscles": "Neck & trunk", "l.armMuscles": "Arms", "l.legMuscles": "Legs",
    "l.outline": "Head", "l.bodyOutline": "Body",
    "st.bodyHint": "Step back so the camera sees your body.",
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
    "credit": "Anatomy models: BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan. Simplified and re-aligned; face muscles modelled on its skull.",
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
    "note": "Se procesa en este dispositivo y nunca se sube. Es un modelo 3D real de un adulto ajustado a tu cabeza: no es un escaneo tuyo ni una herramienta médica.",
    "menu.view": "Qué ver", "menu.settings": "Ajustes", "menu.group": "Menú", "close": "Cerrar",
    "h.quick": "Rápido", "all": "Todo",
    "h.layers": "Capas", "h.look": "Aspecto", "h.mixed": "Realidad mixta", "h.fit": "Ajustar a mi cabeza",
    "p.head": "Cabeza", "p.skeleton": "Esqueleto", "p.organs": "Órganos", "p.skull": "Cráneo", "p.brain": "Cerebro", "p.muscles": "Músculos", "p.all": "Todo",
    "cat.bones": "Huesos", "cat.organs": "Órganos", "cat.muscles": "Músculos", "cat.skin": "Contorno de la piel",
    "cat.all.bones": "Todos los huesos", "cat.all.organs": "Todos los órganos", "cat.all.muscles": "Todos los músculos", "cat.all.skin": "Todo el contorno",
    "l.skull": "Cráneo", "l.spine": "Columna", "l.ribs": "Costillas y esternón", "l.shoulders": "Clavículas y escápulas", "l.arms": "Brazos",
    "l.hands": "Manos", "l.pelvis": "Pelvis", "l.legs": "Piernas", "l.feet": "Pies",
    "l.brain": "Cerebro", "l.eyes": "Ojos", "l.heart": "Corazón", "l.lungs": "Pulmones", "l.liver": "Hígado", "l.stomach": "Estómago",
    "l.intestines": "Intestinos", "l.kidneys": "Riñones y vejiga", "l.pancreas": "Páncreas y bazo", "l.diaphragm": "Diafragma",
    "l.muscles": "Cara", "l.trunkMuscles": "Cuello y tronco", "l.armMuscles": "Brazos", "l.legMuscles": "Piernas",
    "l.outline": "Cabeza", "l.bodyOutline": "Cuerpo",
    "st.bodyHint": "Aléjate para que la cámara vea tu cuerpo.",
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
    "credit": "Modelos anatómicos: BodyParts3D, © The Database Center for Life Science, con licencia CC Atribución-CompartirIgual 2.1 Japón. Simplificados y realineados; músculos de la cara modelados sobre su cráneo.",
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
  "Levator labii superioris": "Elevador del labio superior", "Buccinator": "Buccinador", "Sternocleidomastoid": "Esternocleidomastoideo",
  "Procerus": "Prócer", "Occipitalis": "Músculo occipital",
  // body
  "Cervical vertebrae": "Vértebras cervicales", "Thoracic vertebrae": "Vértebras torácicas", "Lumbar vertebrae": "Vértebras lumbares",
  "Hip bone": "Hueso de la cadera (coxal)", "Sacrum": "Sacro", "Rib cage": "Caja torácica (costillas y esternón)", "Clavicle": "Clavícula",
  "Scapula": "Escápula (omóplato)", "Humerus": "Húmero", "Radius": "Radio", "Ulna": "Cúbito", "Femur": "Fémur", "Patella": "Rótula",
  "Tibia": "Tibia", "Fibula": "Peroné", "Foot bones": "Huesos del pie", "Heart": "Corazón", "Lung": "Pulmón", "Trachea": "Tráquea",
  "Liver": "Hígado", "Gallbladder": "Vesícula biliar", "Esophagus": "Esófago", "Stomach": "Estómago", "Duodenum": "Duodeno",
  "Small intestine": "Intestino delgado", "Large intestine": "Intestino grueso", "Kidney": "Riñón", "Adrenal gland": "Glándula suprarrenal",
  "Urinary bladder": "Vejiga urinaria", "Pancreas": "Páncreas", "Spleen": "Bazo", "Diaphragm": "Diafragma",
  "Deltoid": "Deltoides", "Pectoralis major": "Pectoral mayor", "Pectoralis minor": "Pectoral menor", "Biceps brachii": "Bíceps braquial",
  "Triceps brachii": "Tríceps braquial", "Brachialis": "Braquial", "Brachioradialis": "Braquiorradial", "Rectus abdominis": "Recto del abdomen",
  "External oblique": "Oblicuo externo", "Internal oblique": "Oblicuo interno", "Serratus anterior": "Serrato anterior", "Trapezius": "Trapecio",
  "Latissimus dorsi": "Dorsal ancho", "Gluteus maximus": "Glúteo mayor", "Gluteus medius": "Glúteo medio", "Rectus femoris": "Recto femoral",
  "Vastus lateralis": "Vasto lateral", "Vastus medialis": "Vasto medial", "Sartorius": "Sartorio", "Gracilis": "Grácil",
  "Adductor longus": "Aductor largo", "Adductor magnus": "Aductor mayor", "Biceps femoris": "Bíceps femoral", "Semitendinosus": "Semitendinoso",
  "Tensor fasciae latae": "Tensor de la fascia lata", "Gastrocnemius": "Gastrocnemio (gemelos)", "Soleus": "Sóleo",
  "Tibialis anterior": "Tibial anterior", "Fibularis longus": "Peroneo largo", "Iliopsoas": "Iliopsoas", "Infraspinatus": "Infraespinoso",
  "Teres major": "Redondo mayor", "Rhomboid major": "Romboides mayor", "Erector spinae": "Erector de la columna",
  "Flexor carpi radialis": "Flexor radial del carpo", "Extensor digitorum": "Extensor de los dedos", "Pronator teres": "Pronador redondo",
};
// nicer English for some dataset names
const NAMES_EN = {
  "Cervical vertebral column": "Cervical vertebrae", "Thoracic vertebral column": "Thoracic vertebrae", "Lumbar vertebral column": "Lumbar vertebrae",
  "Foot": "Foot bones",
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
export const anatomyName = name => { const en = NAMES_EN[name] || name; return (lang === "es" && NAMES_ES[en]) || en; };
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
