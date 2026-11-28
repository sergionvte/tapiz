"use strict";
// ---------- language ----------
// Spanish when the visitor's system is in Spanish, English otherwise; the header button overrides it.
const LANG = (() => {
  try { const l = localStorage.getItem("tapiz-lang"); if (l === "es" || l === "en") return l; } catch (e) {}
  const pref = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
  return /^es\b/i.test(pref) ? "es" : "en";
})();
document.documentElement.lang = LANG;
const EN = LANG === "en";

// UI strings used from JS. Each entry is [es, en]; functions take arguments.
const STR = {
  detected: ["Detectada: ", "Detected: "],
  brave: [" Brave oculta el tamaño real de la pantalla: si no coincide, elige tu modelo abajo o usa «Personalizado».",
          " Brave hides your real screen size: if it doesn't match, pick your model below or use “Custom”."],
  groups: [{ phone: "Teléfonos", tablet: "Tabletas", mac: "Mac", monitor: "Monitores" },
           { phone: "Phones", tablet: "Tablets", mac: "Mac", monitor: "Monitors" }],
  thisScreen: ["Esta pantalla", "This screen"],
  custom: ["Personalizado", "Custom"],
  tiles: [(a, cut) => `${a} baldosas${cut ? " · bordes cortados" : ""}`, (a, cut) => `${a} tiles${cut ? " · cropped edges" : ""}`],
  sharp: ["nítido", "sharp"],
  flat: ["plano", "flat"],
  plain: ["liso", "plain"],
  variation: [(n) => `Variación n.º ${n}`, (n) => `Variation #${n}`],
  other: ["Otro", "Another"],
  vary: ["Variar", "Vary"],
  otherTitle: ["Combinación aleatoria de patrón", "Random pattern combination"],
  varyTitle: ["Genera otra versión del mismo diseño", "Generate another version of this design"],
  menuManual: ["px (a mano)", "px (manual)"],
  menuAuto: ["px (automático)", "px (auto)"],
  paletteColor: [(i) => `Color ${i} de tu paleta`, (i) => `Your palette colour ${i}`],
  restored: ["Diseño original restaurado.", "Original design restored."],
  favSaved: ["Diseño guardado en Favoritos.", "Design saved to Favourites."],
  favFail: ["No se pudo guardar: el almacenamiento del navegador no está disponible.", "Couldn't save: browser storage isn't available."],
  favOpen: [(i) => `Abrir favorito ${i}`, (i) => `Open favourite ${i}`],
  favDel: [(i) => `Borrar favorito ${i}`, (i) => `Delete favourite ${i}`],
  favApplied: ["Favorito aplicado.", "Favourite applied."],
  linkCopied: ["Enlace copiado: cualquiera que lo abra verá este diseño.", "Link copied: anyone who opens it will see this design."],
  linkManual: ["Copia el enlace desde la barra de direcciones.", "Copy the link from the address bar."],
  generating: [(w, h) => `Generando ${w} × ${h} px…`, (w, h) => `Generating ${w} × ${h} px…`],
  shared: ["Listo. Elige «Guardar imagen» para llevarla a Fotos.", "Done. Choose “Save Image” to add it to Photos."],
  cancelled: ["Cancelado.", "Cancelled."],
  downloaded: [(f) => `Descargado: ${f}`, (f) => `Downloaded: ${f}`],
  failed: ["No se pudo generar la imagen. Prueba con una resolución menor.", "Couldn't generate the image. Try a smaller resolution."],
  sheetReady: ["Imagen lista: guárdala desde la vista ampliada.", "Image ready: save it from the enlarged view."],
  fromLink: ["Diseño cargado desde el enlace.", "Design loaded from the link."],
  dark: ["oscuro", "dark"],
  light: ["claro", "light"],
  locale: ["es-ES", "en-US"],
};
const t = (key, ...args) => { const v = STR[key][EN ? 1 : 0]; return typeof v === "function" ? v(...args) : v; };

// English names for data entries, by id (Spanish names live in data.js).
const NAMES_EN = {
  // styles
  pattern: "Pattern", material: "Material", abstract: "Abstract", gradient: "Gradient",
  // patterns
  perforado: "Perforated", rejilla: "Lattice", panal: "Honeycomb", semitono: "Halftone", anillos: "Rings", rombos: "Diamonds",
  placa: "Tread plate", cruces: "Crosses", triangulos: "Triangles", escamas: "Scales", ondas: "Waves", chevron: "Zigzag",
  rayas: "Stripes", cuadricula: "Grid", ladrillo: "Brick", fibra: "Fibre", hexagonos: "Hexagons", damero: "Checker",
  lunares: "Polka dots", confeti: "Confetti", destellos: "Sparkles", laberinto: "Maze", meandro: "Meander", terrazo: "Terrazzo",
  // shapes
  bauhaus: "Bauhaus", pastillas: "Pills", bloques: "Blocks", truchet: "Truchet", dianas: "Targets", tejido: "Weave",
  colcha: "Quilt", abanicos: "Fans",
  // abstract & gradients
  liquido: "Liquid", papel: "Paper", trazos: "Strokes", vitral: "Stained glass", memphis: "Memphis", pulsar: "Pulsar", topografia: "Topographic",
  malla: "Mesh", aurora: "Aurora", orbes: "Orbs", seda: "Silk", horizonte: "Horizon", lineal: "Linear",
  // palettes
  costa: "Coast", atardecer: "Sunset", retro: "Retro", oceano: "Ocean", bosque: "Forest", lavanda: "Lavender", neon: "Neon",
  menta: "Mint", arena: "Sand", sorbete: "Sorbet", mediterraneo: "Mediterranean", miel: "Honey", granada: "Pomegranate",
  tropical: "Tropical", grafito: "Graphite", brisa: "Breeze", melocoton: "Peach", ultravioleta: "Ultraviolet",
  citrico: "Citrus", nordico: "Nordic", vino: "Wine", lima: "Lime", cereza: "Cherry", arcilla: "Clay", hielo: "Ice",
  vaporwave: "Vaporwave", selva: "Jungle", mono: "Monochrome", custom: "Custom",
  // presets
  auto: "This screen", mba13x: "MacBook Air 13″ · more space", fhd: "Full HD monitor",
  qhd: "QHD monitor", uw: "Ultrawide 21:9", "4k": "4K monitor", "5k": "Studio Display 5K",
};
const SWATCH_EN = {
  Marino: "Navy", Medianoche: "Midnight", "Índigo": "Indigo", Cobalto: "Cobalt", "Océano": "Ocean", Turquesa: "Teal",
  Bosque: "Forest", Esmeralda: "Emerald", Oliva: "Olive", Bronce: "Bronze", "Ámbar": "Amber", Terracota: "Terracotta",
  Vino: "Wine", Frambuesa: "Raspberry", Ciruela: "Plum", Lavanda: "Lavender", Pizarra: "Slate", Grafito: "Graphite",
  "Carbón": "Charcoal", Arena: "Sand",
};
const tn = (id, es) => (EN && NAMES_EN[id]) || es;
const tsw = (es) => (EN && SWATCH_EN[es]) || es;

// Static page text: Spanish source → English.
const PAGE_EN = {
  "Fondos de pantalla con patrones, formas, arte abstracto y degradados, a la resolución exacta de tu pantalla.":
    "Wallpapers with patterns, shapes, abstract art and gradients, at the exact resolution of your screen.",
  "Crea fondos de pantalla con patrones, formas, arte abstracto y degradados a la resolución exacta de tu pantalla.":
    "Create wallpapers with patterns, shapes, abstract art and gradients at the exact resolution of your screen.",
  "Completa": "Full", "Detalle 1:1": "Detail 1:1", "Simular pantalla": "Simulate screen",
  "Arrastra para mover · tamaño real": "Drag to move · actual size",
  "Diseño": "Design", "Color": "Colour", "Ajustes": "Adjust", "Pantalla": "Screen", "Favoritos": "Favourites",
  "Estilo": "Style", "Nueva variación": "New variation", "Restaurar fondo original": "Restore original wallpaper",
  "Patrón": "Pattern", "Forma": "Shape", "Composición": "Composition", "Degradado": "Gradient",
  "Tema": "Theme", "Oscuro": "Dark", "Claro": "Light", "Paleta": "Palette", "Tu paleta": "Your palette",
  "Añadir color": "Add colour", "Quitar color": "Remove colour", "Copiar paleta anterior": "Copy previous palette",
  "Color base": "Base colour", "Color inferior": "Bottom colour", "Color del patrón": "Pattern colour", "Automático": "Auto",
  "Escala": "Scale", "Dejar sitio a la barra de menús": "Leave room for the menu bar", "Grosor del patrón": "Pattern weight",
  "Contraste": "Contrast", "Grosor de línea": "Line weight", "Fluidez": "Fluidity", "Cantidad de curvas": "Number of contours",
  "Relieve del fondo": "Background shading", "Mostrar cotas": "Show elevation labels", "Colores": "Colours", "Grano": "Grain", "Relieve": "Relief", "Desenfoque": "Blur",
  "Girar orientación": "Rotate orientation", "Guardar este diseño": "Save this design", "Copiar enlace": "Copy link",
  "Guarda diseños para volver a ellos más tarde. Se quedan en este navegador.":
    "Save designs to come back to them later. They stay in this browser.",
  "Guardar PNG": "Save PNG", "Variar": "Vary", "Sorpréndeme": "Surprise me", "Cerrar": "Close",
  "Mantén pulsada la imagen y elige «Guardar en Fotos» (o clic derecho › Guardar imagen).":
    "Press and hold the image and choose “Save to Photos” (or right-click › Save Image).",
  // attributes
  "Vista previa": "Preview", "Modo de vista": "View mode", "Vista previa del fondo": "Wallpaper preview",
  "Secciones": "Sections", "Tema del fondo": "Wallpaper theme", "Tamaño de pantalla": "Screen size",
  "Ancho en píxeles": "Width in pixels", "Alto en píxeles": "Height in pixels",
  "Alto de la franja de la barra en píxeles": "Menu bar strip height in pixels",
  "Genera otra versión del mismo diseño": "Generate another version of this design",
  "Combinación aleatoria": "Random combination", "Fondo generado a tamaño completo": "Generated wallpaper at full size",
};
function translatePage() {
  const btn = document.getElementById("lang");
  if (btn) {
    btn.textContent = EN ? "Español" : "English";
    btn.setAttribute("aria-label", EN ? "Cambiar a español" : "Switch to English");
    btn.addEventListener("click", () => {
      try { localStorage.setItem("tapiz-lang", EN ? "es" : "en"); } catch (e) {}
      location.reload();
    });
  }
  if (!EN) return;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    const k = n.nodeValue.trim();
    if (k && PAGE_EN[k]) n.nodeValue = n.nodeValue.replace(k, PAGE_EN[k]);
  }
  document.querySelectorAll("[aria-label],[title],[alt]").forEach((el) => {
    for (const a of ["aria-label", "title", "alt"]) { const v = el.getAttribute(a); if (v && PAGE_EN[v]) el.setAttribute(a, PAGE_EN[v]); }
  });
  const d = document.querySelector('meta[name="description"]');
  if (d && PAGE_EN[d.content]) d.content = PAGE_EN[d.content];
}
