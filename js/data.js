"use strict";
// ---------- data ----------
const PRESETS = [
  { id: "auto", name: "Esta pantalla" },
  { id: "ip16pm", name: "iPhone 16 Pro Max", w: 1320, h: 2868 },
  { id: "ip16p", name: "iPhone 16 Pro", w: 1206, h: 2622 },
  { id: "ip16plus", name: "iPhone 16 Plus / 15 Pro Max", w: 1290, h: 2796 },
  { id: "ip16", name: "iPhone 16 / 15 / 15 Pro", w: 1179, h: 2556 },
  { id: "ip13", name: "iPhone 14 / 13 / 12", w: 1170, h: 2532 },
  { id: "ipse", name: "iPhone SE", w: 750, h: 1334 },
  { id: "ipadpro13", name: "iPad Pro 13″", w: 2064, h: 2752 },
  { id: "ipadair11", name: "iPad Air 11″", w: 1640, h: 2360 },
  { id: "s24u", name: "Galaxy S24 Ultra", w: 1440, h: 3120 },
  { id: "pixel9", name: "Pixel 9", w: 1080, h: 2424 },
  { id: "android", name: "Android FHD+", w: 1080, h: 2400 },
  { id: "mba13", name: "MacBook Air 13″", w: 2560, h: 1664 },
  { id: "mba15", name: "MacBook Air 15″", w: 2880, h: 1864 },
  { id: "mbp14", name: "MacBook Pro 14″", w: 3024, h: 1964 },
  { id: "mbp16", name: "MacBook Pro 16″", w: 3456, h: 2234 },
  { id: "imac24", name: "iMac 24″", w: 4480, h: 2520 },
  { id: "fhd", name: "Monitor Full HD", w: 1920, h: 1080 },
  { id: "qhd", name: "Monitor QHD", w: 2560, h: 1440 },
  { id: "uw", name: "Ultrapanorámico 21:9", w: 3440, h: 1440 },
  { id: "4k", name: "Monitor 4K", w: 3840, h: 2160 },
  { id: "5k", name: "Studio Display 5K", w: 5120, h: 2880 },
  { id: "custom", name: "Personalizado…" },
];
const PATTERNS = [
  ["perforado", "Perforado"], ["rejilla", "Rejilla"], ["panal", "Panal"], ["semitono", "Semitono"],
  ["anillos", "Anillos"], ["rombos", "Rombos"], ["placa", "Chapa"], ["cruces", "Cruces"],
  ["triangulos", "Triángulos"], ["escamas", "Escamas"], ["ondas", "Ondas"], ["chevron", "Zigzag"],
  ["rayas", "Rayas"], ["cuadricula", "Cuadrícula"], ["ladrillo", "Ladrillo"], ["fibra", "Fibra"],
  ["hexagonos", "Hexágonos"], ["damero", "Damero"], ["lunares", "Lunares"], ["confeti", "Confeti"],
];
const SWATCHES = [
  ["Marino", "#1c1b3c"], ["Medianoche", "#0e1530"], ["Índigo", "#2a2470"], ["Cobalto", "#123a7a"],
  ["Océano", "#0f2c40"], ["Turquesa", "#0d4a4a"], ["Bosque", "#172b21"], ["Esmeralda", "#0f4a33"],
  ["Oliva", "#3a3d1c"], ["Bronce", "#3a2a17"], ["Ámbar", "#6b4310"], ["Terracota", "#5c2a1c"],
  ["Vino", "#36151f"], ["Frambuesa", "#5e1638"], ["Ciruela", "#2b1738"], ["Lavanda", "#4a3a78"],
  ["Pizarra", "#1f2a33"], ["Grafito", "#24262c"], ["Carbón", "#121214"], ["Arena", "#6e6450"],
];
const SHAPES = [
  ["manchas", "Topografía"], ["feston", "Festón"], ["bauhaus", "Bauhaus"], ["arcoiris", "Arcoíris"],
  ["pastillas", "Pastillas"], ["escalones", "Escalones"], ["cintas", "Cintas"], ["origami", "Origami"],
  ["burbujas", "Burbujas"], ["sol", "Sol"], ["colinas", "Colinas"], ["arcos", "Arcos"],
];
const PALETTES = [
  ["costa", "Costa", ["#14233f", "#29385f", "#e8632c", "#f49560", "#f5d3b1", "#dab284", "#93b1cc", "#6096c2", "#115e9b", "#023060"]],
  ["atardecer", "Atardecer", ["#10232f", "#1e3c44", "#365f62", "#d6ae7f", "#d6843a", "#c9642a", "#b33a1a", "#7a1e0d"]],
  ["retro", "Retro", ["#264653", "#2a9d8f", "#8ab17d", "#e9c46a", "#f4a261", "#e76f51"]],
  ["oceano", "Océano", ["#04192b", "#0b3352", "#145a80", "#2a8aaa", "#6fc2c9", "#c9e8df", "#f4efdc"]],
  ["bosque", "Bosque", ["#0f2018", "#1f3b2b", "#3d6347", "#8aa66f", "#d8d3a1", "#e9b770", "#c8743a"]],
  ["lavanda", "Lavanda", ["#1b1533", "#2e2557", "#51438a", "#8a7cc7", "#c7b9ec", "#f0c9d6", "#e58fa6"]],
  ["neon", "Neón", ["#0d0221", "#261447", "#541388", "#d90368", "#f75c03", "#f1c40f"]],
  ["menta", "Menta", ["#0b2b26", "#163832", "#235347", "#8eb69b", "#daf1de", "#f6fbf4"]],
  ["arena", "Arena", ["#3b2f2f", "#6b4f3f", "#a47551", "#d0b49f", "#e4d4c8", "#f6efe8"]],
  ["bauhaus", "Bauhaus", ["#f1e9da", "#1f1f1f", "#2b4c7e", "#e9c46a", "#e85d3a"]],
  ["aurora", "Aurora", ["#0b1026", "#1b2a4a", "#1f5f6b", "#2fa38a", "#7be0a8", "#d4f5c9"]],
  ["sorbete", "Sorbete", ["#2d2a4a", "#6c5b9e", "#c9a7eb", "#ffb3c6", "#ffd6a5", "#fdffb6"]],
  ["mediterraneo", "Mediterráneo", ["#0a2540", "#124e78", "#1f8fb5", "#f2e8cf", "#f4a259", "#bc4b51"]],
  ["miel", "Miel", ["#2b1d0e", "#5c3a12", "#a8641c", "#e09f3e", "#f3c969", "#fff1cf"]],
  ["granada", "Granada", ["#1a0a12", "#3d0f22", "#7a1b3a", "#c0394f", "#f28c7d", "#fcd5c9"]],
  ["tropical", "Tropical", ["#062925", "#044a42", "#3a9188", "#b8e1dd", "#f9e0ae", "#fc8b5e", "#ea5455"]],
  ["grafito", "Grafito", ["#111418", "#232a31", "#3a4652", "#6b7a87", "#aab6bf", "#e3e8ec"]],
  ["brisa", "Brisa", ["#0f172a", "#1e3a8a", "#3b82f6", "#22d3ee", "#a7f3d0", "#f0fdfa"]],
  ["melocoton", "Melocotón", ["#2a1a2e", "#7a2e4f", "#ff6f61", "#ff9a8b", "#ffc3a0", "#ffe5d9"]],
  ["ultravioleta", "Ultravioleta", ["#10002b", "#3c096c", "#7b2cbf", "#c77dff", "#ff6ad5", "#ffd6ff"]],
  ["citrico", "Cítrico", ["#14213d", "#1d4e5f", "#2a9d8f", "#b5e48c", "#ffd60a", "#ff9f1c"]],
  ["nordico", "Nórdico", ["#2e3440", "#3b4252", "#5e81ac", "#88c0d0", "#a3be8c", "#eceff4"]],
  ["vino", "Vino", ["#1b0a10", "#4a0e23", "#8c1c3a", "#d1495b", "#edae49", "#f9e0b7"]],
  ["lima", "Lima", ["#0b1d13", "#1b4332", "#2d6a4f", "#52b788", "#b7e4c7", "#f7fee7"]],
  ["cereza", "Cereza", ["#22031f", "#5c0b3a", "#b31a4c", "#ff4d6d", "#ffb3c1", "#fff0f3"]],
  ["arcilla", "Arcilla", ["#2f1e1a", "#6d3b2a", "#b5651d", "#d9a066", "#efd3b5", "#f8efe6"]],
  ["hielo", "Hielo", ["#0a1128", "#1c3d5a", "#3e7cb1", "#81a4cd", "#dbe4ee", "#ffffff"]],
  ["vaporwave", "Vaporwave", ["#1a1040", "#3d2c8d", "#916bbf", "#ff71ce", "#01cdfe", "#fffb96"]],
  ["selva", "Selva", ["#081c15", "#1b4332", "#40916c", "#e9c46a", "#e76f51", "#9d0208"]],
  ["mono", "Monocromo", null],
  ["custom", "Personalizada", null],
];
const STYLES = [["pattern", "Patrón"], ["material", "Material"], ["abstract", "Abstracto"], ["gradient", "Degradado"]];
const ABSTRACTS = [
  ["liquido", "Líquido"], ["cristal", "Cristal"], ["trazos", "Trazos"],
  ["vitral", "Vitral"], ["memphis", "Memphis"], ["pulsar", "Pulsar"],
];
const GRADIENTS = [
  ["malla", "Malla"], ["aurora", "Aurora"], ["orbes", "Orbes"],
  ["holo", "Holográfico"], ["lineal", "Lineal"], ["conico", "Cónico"],
];
const DESIGNS = { material: SHAPES, abstract: ABSTRACTS, gradient: GRADIENTS };
const DEFAULT_CUSTOM = ["#1b1f3b", "#53489a", "#e85d75", "#f6a96c", "#f8e1b8", "#fdf6ec"];

// Values measured from the original wallpaper (1080 px wide): cell 20.12, hole radius 3.9.
const ORIGINAL = { theme: "dark", base: "#1c1b3c", bottomAuto: true, bottom: "#0a0a16", dotAuto: true, dot: "#03040d",
                   pattern: "perforado", size: 20.1, dotSize: 39, contrast: 100, grad: 100, grain: 45, soft: 0 };
const MAX_SIDE = 8192;

