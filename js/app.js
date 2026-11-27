"use strict";
(() => {
  const $ = (id) => document.getElementById(id);

  // Everything that defines a design (shared by favourites and links).
  const DESIGN_KEYS = ["style", "theme", "base", "bottomAuto", "bottom", "dotAuto", "dot", "pattern", "shape", "abstract",
    "gradient", "palette", "layers", "seed", "custom", "size", "dotSize", "contrast", "grad", "grain", "soft"];

  // ---------- state ----------
  let state = Object.assign({
    preset: "auto", rotated: false, cw: 1320, ch: 2868, view: "full", tab: "design", mock: false,
    style: "pattern", shape: "feston", abstract: "liquido", gradient: "malla",
    palette: "costa", lastPalette: "costa", layers: 10, seed: 7, custom: DEFAULT_CUSTOM.slice(),
  }, ORIGINAL);
  try {
    const saved = JSON.parse(localStorage.getItem("tapiz-state") || localStorage.getItem("perforado-state") || "null");
    if (saved && typeof saved === "object") state = Object.assign(state, saved);
  } catch (e) { /* storage unavailable */ }
  const fromHash = readHash();
  if (fromHash) Object.assign(state, fromHash, { tab: "design" });
  sanitize();
  const persist = () => { try { localStorage.setItem("tapiz-state", JSON.stringify(state)); } catch (e) {} };
  const pan = { x: 0.5, y: 0.35 };

  function sanitize() {
    const has = (list, id) => list.some(([x]) => x === id);
    if (!has(STYLES, state.style)) state.style = "pattern";
    if (!has(PATTERNS, state.pattern)) state.pattern = "perforado";
    if (!has(SHAPES, state.shape)) state.shape = "feston";
    if (!has(ABSTRACTS, state.abstract)) state.abstract = "liquido";
    if (!has(GRADIENTS, state.gradient)) state.gradient = "malla";
    if (!has(PALETTES, state.palette)) state.palette = "costa";
    if (!Array.isArray(state.custom) || state.custom.length < 2 || !state.custom.every((c) => /^#[0-9a-f]{6}$/i.test(c))) state.custom = DEFAULT_CUSTOM.slice();
    state.layers = Math.max(3, Math.min(10, +state.layers || 6));
  }

  const designState = (st = state) => Object.fromEntries(DESIGN_KEYS.map((k) => [k, st[k]]));
  const currentDesign = () => state.style === "material" ? state.shape : state.style === "abstract" ? state.abstract : state.style === "gradient" ? state.gradient : state.pattern;
  const paletteLength = (id) => { const p = PALETTES.find(([x]) => x === id); return id === "custom" ? state.custom.length : p && p[2] ? p[2].length : 7; };

  // ---------- screen ----------
  function detectScreen() {
    const dpr = window.devicePixelRatio || 1;
    let cw = screen.width, ch = screen.height;
    const touch = (navigator.maxTouchPoints || 0) > 0 && Math.min(cw, ch) < 1100;
    if (touch && cw > ch) [cw, ch] = [ch, cw];
    return { w: Math.round(cw * dpr), h: Math.round(ch * dpr), cw, ch, dpr };
  }
  const detected = detectScreen();

  function dims() {
    let w, h;
    const p = PRESETS.find((x) => x.id === state.preset) || PRESETS[0];
    if (p.id === "auto") { w = detected.w; h = detected.h; }
    else if (p.id === "custom") { w = state.cw; h = state.ch; }
    else { w = p.w; h = p.h; }
    w = Math.max(200, Math.min(MAX_SIDE, Math.round(w) || 1080));
    h = Math.max(200, Math.min(MAX_SIDE, Math.round(h) || 1920));
    if (state.rotated && p.id !== "custom") [w, h] = [h, w];
    return { w, h, name: p.id === "auto" ? "Esta pantalla" : p.id === "custom" ? "Personalizado" : p.name };
  }

  // ---------- preview ----------
  const preview = $("preview"), device = $("device"), viewport = $("viewport");
  // Per-pixel styles are costly, so their live preview uses fewer canvas pixels.
  const previewDpr = () => Math.min(window.devicePixelRatio || 1, state.style === "pattern" ? 2 : 1.25);

  function fitPreview() {
    const { w, h } = dims();
    const pad = 16;
    const narrow = matchMedia("(max-width: 900px)").matches;
    const maxH = narrow ? Math.max(260, innerHeight * 0.58) : Math.min(innerHeight * 0.72, 780);
    viewport.style.height = Math.round(Math.min(maxH, viewport.clientWidth * h / w + pad)) + "px";
    const box = viewport.getBoundingClientRect();
    const scale = Math.min((box.width - pad) / w, (box.height - pad) / h);
    const cssW = Math.max(60, Math.floor(w * scale)), cssH = Math.max(60, Math.floor(h * scale));
    const dpr = previewDpr();
    preview.style.width = cssW + "px"; preview.style.height = cssH + "px";
    preview.width = Math.round(cssW * dpr); preview.height = Math.round(cssH * dpr);
    const wide = w > h;
    device.classList.toggle("is-wide", wide);
    device.classList.toggle("is-detail", state.view === "detail");
    device.style.setProperty("--mw", cssW + "px");
    if (!wide) {
      device.style.borderRadius = Math.round(cssW * 0.14) + "px";
      preview.style.borderRadius = Math.round(cssW * 0.12) + "px";
    } else { device.style.borderRadius = ""; preview.style.borderRadius = ""; }
    const showMock = state.mock && state.view === "full";
    $("mockLock").hidden = !showMock || wide;
    $("mockDesk").hidden = !showMock || !wide;
    return { w, h };
  }

  function previewView(w, h) {
    if (state.view === "detail") {
      const k = previewDpr() / (window.devicePixelRatio || 1); // 1 wallpaper px per device px
      const vw = preview.width / k, vh = preview.height / k;
      const ox = Math.max(0, Math.min(w - vw, pan.x * w - vw / 2));
      const oy = Math.max(0, Math.min(h - vh, pan.y * h - vh / 2));
      return { W: w, H: h, k, ox, oy, grainScale: 1 };
    }
    const k = preview.width / w;
    return { W: w, H: h, k, grainScale: Math.min(1, Math.sqrt(k) * 1.2) };
  }

  function updateClock() {
    const now = new Date();
    const t = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    $("lockTime").textContent = t; $("deskTime").textContent = t;
    $("lockDate").textContent = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  }

  let pending = 0;
  function draw(thumbs = true) {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const { w, h } = fitPreview();
      render(preview, state, previewView(w, h));
      const d = dims();
      $("meta").textContent = `${d.w} × ${d.h} px · ${d.name}`;
      $("badge").hidden = state.view !== "detail";
      if (thumbs) drawThumbs();
      persist();
    });
  }

  function drawThumbs() {
    if (state.style === "pattern") {
      const st = Object.assign({}, state, { grad: 0, bottomAuto: true });
      document.querySelectorAll("#patterns canvas").forEach((cv) => {
        render(cv, Object.assign({}, st, { pattern: cv.dataset.id }), { W: 1080, H: 1080, k: cv.width / 130, ox: 400, oy: 400, grainScale: 0.4 });
      });
    } else {
      const key = { material: "shape", abstract: "abstract", gradient: "gradient" }[state.style];
      document.querySelectorAll(`#grid-${state.style} canvas`).forEach((cv) => {
        render(cv, Object.assign({}, state, { [key]: cv.dataset.id }), { W: 1080, H: 1080, k: cv.width / 1080, grainScale: 0.4 });
      });
    }
    drawStyleCards();
  }

  // Style cards show each family with the current colours.
  function drawStyleCards() {
    const pal = state.palette;
    const looks = {
      pattern: { style: "pattern" },
      material: { style: "material", shape: state.shape, palette: pal },
      abstract: { style: "abstract", abstract: state.abstract, palette: pal },
      gradient: { style: "gradient", gradient: state.gradient, palette: pal },
    };
    document.querySelectorAll("#styles canvas").forEach((cv) => {
      render(cv, Object.assign({}, state, looks[cv.dataset.id]), { W: 1080, H: 1440, k: cv.width / 1080, grainScale: 0.4 });
    });
  }

  // Drag to pan in detail view.
  let drag = null;
  preview.addEventListener("pointerdown", (e) => {
    if (state.view !== "detail") return;
    drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const { w, h } = dims(), dpr = window.devicePixelRatio || 1;
    pan.x = Math.max(0, Math.min(1, drag.px - (e.clientX - drag.x) * dpr / w));
    pan.y = Math.max(0, Math.min(1, drag.py - (e.clientY - drag.y) * dpr / h));
    draw(false);
  });
  const endDrag = () => { drag = null; };
  preview.addEventListener("pointerup", endDrag);
  preview.addEventListener("pointercancel", endDrag);

  // ---------- UI ----------
  function tile(container, cls, name, id, label, w, h, onChange) {
    const lab = document.createElement("label"); lab.className = cls;
    const inp = document.createElement("input"); inp.type = "radio"; inp.name = name; inp.value = id; inp.id = `${name}-${id}`;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.dataset.id = id;
    const sp = document.createElement("span"); sp.textContent = label;
    inp.addEventListener("change", onChange);
    lab.append(inp, cv, sp); container.append(lab);
  }

  function buildUI() {
    const det = $("detected");
    det.append("Detectada: ");
    const b = document.createElement("b"); b.textContent = `${detected.w} × ${detected.h} px`; det.append(b);
    det.append(` (${detected.cw}×${detected.ch} pt @${+detected.dpr.toFixed(2)}x)`);

    const sel = $("preset");
    const groups = { phone: "Teléfonos", tablet: "Tabletas", mac: "Mac", monitor: "Monitores" };
    const kind = (p) => p.id === "auto" || p.id === "custom" ? null : /^ipad/.test(p.id) ? "tablet"
      : /^(mb|imac)/.test(p.id) ? "mac" : /^(fhd|qhd|uw|4k|5k)$/.test(p.id) ? "monitor" : "phone";
    const og = {};
    PRESETS.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.id === "auto" ? `Esta pantalla — ${detected.w} × ${detected.h}` : p.w ? `${p.name} — ${p.w} × ${p.h}` : p.name;
      const kd = kind(p);
      if (kd) {
        if (!og[kd]) { og[kd] = document.createElement("optgroup"); og[kd].label = groups[kd]; sel.append(og[kd]); }
        og[kd].append(o);
      } else sel.append(o);
    });

    STYLES.forEach(([id, name]) => tile($("styles"), "style", "style", id, name, 120, 160, () => {
      state.style = id; syncInputs(); draw();
    }));
    PATTERNS.forEach(([id, name]) => tile($("patterns"), "pat", "pattern", id, name, 168, 168, () => { state.pattern = id; syncInputs(); draw(false); }));
    SHAPES.forEach(([id, name]) => tile($("grid-material"), "pat", "shape", id, name, 168, 168, () => { state.shape = id; draw(false); drawStyleCards(); }));
    ABSTRACTS.forEach(([id, name]) => tile($("grid-abstract"), "pat", "abstract", id, name, 168, 168, () => { state.abstract = id; draw(false); drawStyleCards(); }));
    GRADIENTS.forEach(([id, name]) => tile($("grid-gradient"), "pat", "gradient", id, name, 168, 168, () => { state.gradient = id; draw(false); drawStyleCards(); }));

    const sw = $("swatches");
    SWATCHES.forEach(([name, hex]) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "swatch"; btn.style.background = hex;
      btn.title = name; btn.setAttribute("aria-label", name); btn.dataset.hex = hex;
      btn.addEventListener("click", () => { state.base = hex; syncInputs(); draw(); });
      sw.append(btn);
    });

    const pl = $("palettes");
    PALETTES.forEach(([id, name]) => {
      const lab = document.createElement("label"); lab.className = "pal";
      const inp = document.createElement("input"); inp.type = "radio"; inp.name = "palette"; inp.value = id; inp.id = "pal-" + id;
      const strip = document.createElement("div"); strip.className = "strip"; strip.dataset.palette = id;
      const sp = document.createElement("span"); sp.textContent = name;
      inp.addEventListener("change", () => {
        if (state.palette !== "custom") state.lastPalette = state.palette;
        state.palette = id; state.layers = Math.min(10, paletteLength(id)); syncInputs(); draw();
      });
      lab.append(inp, strip, sp); pl.append(lab);
    });
    buildCustom();
  }

  function buildCustom() {
    const box = $("customCols");
    box.replaceChildren(...state.custom.map((hex, i) => {
      const inp = document.createElement("input");
      inp.type = "color"; inp.value = hex; inp.id = "custom" + i; inp.setAttribute("aria-label", `Color ${i + 1} de tu paleta`);
      inp.addEventListener("input", (e) => { state.custom[i] = e.target.value; paintStrips(); draw(); });
      return inp;
    }));
    $("customAdd").disabled = state.custom.length >= 10;
    $("customRemove").disabled = state.custom.length <= 2;
  }

  function paintStrips() {
    document.querySelectorAll(".pal .strip").forEach((el) => {
      const cols = materialColors(Object.assign({}, state, { palette: el.dataset.palette, layers: 0 }));
      el.replaceChildren(...cols.map((c) => { const i = document.createElement("i"); i.style.background = rgbToHex(c); return i; }));
    });
  }

  const sliders = {
    size: (v) => `${(+v).toFixed(1)} px`, dotSize: (v) => `${v}%`, contrast: (v) => `${v}%`, grad: (v) => `${v}%`,
    layers: (v) => `${v}`, grain: (v) => `${v}%`, soft: (v) => (+v === 0 ? "nítido" : `${v}%`),
  };

  function syncInputs() {
    const d = dims(), pal = palette(Object.assign({}, state, { contrast: 100 }));
    const mat = state.style !== "pattern";
    // Tabs + per-style sections.
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === state.tab)));
    document.querySelectorAll("#panel [data-tab], #panel [data-only]").forEach((el) => {
      const okTab = !el.dataset.tab || el.dataset.tab === state.tab;
      const okStyle = !el.dataset.only || el.dataset.only.split(" ").includes(state.style);
      el.hidden = !(okTab && okStyle);
    });
    $("colorGroup").hidden = state.tab !== "color" || (mat && state.palette !== "mono");
    $("customGroup").hidden = state.tab !== "color" || !mat || state.palette !== "custom";

    $("preset").value = state.preset;
    $("customDims").hidden = state.tab !== "screen" || state.preset !== "custom";
    $("cw").value = d.w; $("ch").value = d.h;
    $("viewFull").checked = state.view !== "detail";
    $("viewDetail").checked = state.view === "detail";
    $("mock").checked = !!state.mock;
    $("themeDark").checked = state.theme === "dark";
    $("themeLight").checked = state.theme === "light";
    $("base").value = state.base;
    $("bottomAuto").checked = state.bottomAuto;
    $("bottom").disabled = state.bottomAuto;
    $("bottom").value = state.bottomAuto ? rgbToHex(pal.bottomAutoColor) : state.bottom;
    $("dotAuto").checked = state.dotAuto;
    $("dot").disabled = state.dotAuto;
    $("dot").value = state.dotAuto ? rgbToHex(pal.dot) : state.dot;
    document.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", String(s.dataset.hex === state.base)));
    const check = (id) => { const el = $(id); if (el) el.checked = true; };
    check("style-" + state.style); check("pattern-" + state.pattern); check("shape-" + state.shape);
    check("abstract-" + state.abstract); check("gradient-" + state.gradient); check("pal-" + state.palette);
    Object.keys(sliders).forEach((k) => { $(k).value = state[k]; $(k + "Out").textContent = sliders[k](state[k]); });
    $("seedOut").textContent = `Variación n.º ${state.seed}`;
    paintStrips();
    renderFavs();
  }

  function setTab(tab) { state.tab = tab; syncInputs(); draw(); }

  function wire() {
    document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    $("preset").addEventListener("change", (e) => {
      const d = dims();
      if (e.target.value === "custom") { state.cw = d.w; state.ch = d.h; }
      state.preset = e.target.value; state.rotated = false; syncInputs(); draw(false);
    });
    ["cw", "ch"].forEach((id) => $(id).addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      if (v >= 200 && v <= MAX_SIDE) { state[id] = v; draw(false); }
    }));
    $("rotate").addEventListener("click", () => {
      if (state.preset === "custom") [state.cw, state.ch] = [state.ch, state.cw];
      else state.rotated = !state.rotated;
      syncInputs(); draw(false);
    });
    document.querySelectorAll('input[name="view"]').forEach((r) => r.addEventListener("change", (e) => { state.view = e.target.value; draw(false); }));
    $("mock").addEventListener("change", (e) => { state.mock = e.target.checked; updateClock(); draw(false); });
    document.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener("change", (e) => { state.theme = e.target.value; syncInputs(); draw(); }));
    $("base").addEventListener("input", (e) => { state.base = e.target.value; syncInputs(); draw(); });
    $("bottomAuto").addEventListener("change", (e) => {
      if (!e.target.checked) state.bottom = rgbToHex(palette(state).bottomAutoColor);
      state.bottomAuto = e.target.checked; syncInputs(); draw();
    });
    $("bottom").addEventListener("input", (e) => { state.bottom = e.target.value; draw(false); });
    $("dotAuto").addEventListener("change", (e) => {
      if (!e.target.checked) state.dot = rgbToHex(palette(Object.assign({}, state, { contrast: 100 })).dot);
      state.dotAuto = e.target.checked; syncInputs(); draw();
    });
    $("dot").addEventListener("input", (e) => { state.dot = e.target.value; draw(); });
    Object.keys(sliders).forEach((k) => $(k).addEventListener("input", (e) => {
      state[k] = +e.target.value; $(k + "Out").textContent = sliders[k](state[k]);
      draw(k !== "grad" && k !== "grain");
    }));
    $("newShape").addEventListener("click", () => { state.seed = (state.seed * 31 + 7) % 100003; syncInputs(); draw(); });
    $("customAdd").addEventListener("click", () => {
      const last = hexToRgb(state.custom[state.custom.length - 1]);
      state.custom.push(rgbToHex(mix(last, [255, 255, 255], 0.35)));
      state.layers = Math.min(10, state.custom.length); buildCustom(); syncInputs(); draw();
    });
    $("customRemove").addEventListener("click", () => {
      state.custom.pop(); state.layers = Math.min(10, Math.max(3, state.custom.length)); buildCustom(); syncInputs(); draw();
    });
    $("customFrom").addEventListener("click", () => {
      const src = materialColors(Object.assign({}, state, { palette: state.lastPalette || "costa", layers: 0, theme: "dark" }));
      state.custom = src.slice(0, 10).map(rgbToHex); state.layers = Math.min(10, state.custom.length);
      buildCustom(); syncInputs(); draw();
    });
    $("reset").addEventListener("click", () => {
      Object.assign(state, ORIGINAL, { style: "pattern", tab: "design" }); syncInputs(); draw();
      setStatus("Diseño original restaurado.");
    });
    $("random").addEventListener("click", randomize);
    $("save").addEventListener("click", save);
    $("favAdd").addEventListener("click", addFav);
    $("share").addEventListener("click", share);
    $("sheetClose").addEventListener("click", closeSheet);
    $("sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });
    $("panel").addEventListener("submit", (e) => e.preventDefault());
    if ("ResizeObserver" in window) new ResizeObserver(() => draw(false)).observe(document.querySelector(".stage"));
    else window.addEventListener("resize", () => draw(false));
    window.addEventListener("hashchange", () => { const h = readHash(); if (h) { Object.assign(state, h); sanitize(); syncInputs(); draw(); } });
    setInterval(() => { if (state.mock) updateClock(); }, 20000);
  }

  function randomize() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const style = pick(["pattern", "material", "material", "abstract", "abstract", "gradient", "gradient"]);
    const pal = pick(PALETTES.filter(([id]) => id !== "custom"))[0];
    Object.assign(state, {
      style, theme: Math.random() < 0.75 ? "dark" : "light", seed: Math.floor(Math.random() * 100000),
      base: pick(SWATCHES)[1], pattern: pick(PATTERNS)[0], shape: pick(SHAPES)[0], abstract: pick(ABSTRACTS)[0], gradient: pick(GRADIENTS)[0],
      palette: pal, layers: Math.min(10, paletteLength(pal)), bottomAuto: true, dotAuto: true,
      size: style === "pattern" ? Math.round(14 + Math.random() * 26) : Math.round(15 + Math.random() * 15),
      dotSize: Math.round(25 + Math.random() * 30), contrast: Math.round(60 + Math.random() * 40),
    });
    syncInputs(); draw();
  }

  const setStatus = (t) => { $("status").textContent = t; };

  // ---------- favourites & links ----------
  function loadFavs() { try { const f = JSON.parse(localStorage.getItem("tapiz-favs") || "[]"); return Array.isArray(f) ? f : []; } catch (e) { return []; } }
  function storeFavs(f) { try { localStorage.setItem("tapiz-favs", JSON.stringify(f)); return true; } catch (e) { return false; } }

  function addFav() {
    const cv = document.createElement("canvas"); cv.width = 120; cv.height = 160;
    render(cv, state, { W: 1080, H: 1440, k: 120 / 1080, grainScale: 0.4 });
    const favs = loadFavs();
    favs.unshift({ s: designState(), t: cv.toDataURL("image/jpeg", 0.82) });
    if (storeFavs(favs.slice(0, 30))) { renderFavs(); setStatus("Diseño guardado en Favoritos."); }
    else setStatus("No se pudo guardar: el almacenamiento del navegador no está disponible.");
  }

  function renderFavs() {
    const favs = loadFavs(), box = $("favs");
    $("favEmpty").hidden = state.tab !== "fav" || favs.length > 0;
    box.replaceChildren(...favs.map((f, i) => {
      const wrap = document.createElement("div"); wrap.className = "fav";
      const open = document.createElement("button"); open.type = "button"; open.className = "open"; open.setAttribute("aria-label", `Abrir favorito ${i + 1}`);
      const img = document.createElement("img"); img.src = typeof f.t === "string" && f.t.startsWith("data:image/") ? f.t : ""; img.alt = "";
      open.append(img);
      open.addEventListener("click", () => { Object.assign(state, f.s); sanitize(); syncInputs(); draw(); setStatus("Favorito aplicado."); });
      const del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = "×"; del.setAttribute("aria-label", `Borrar favorito ${i + 1}`);
      del.addEventListener("click", () => { const all = loadFavs(); all.splice(i, 1); storeFavs(all); renderFavs(); });
      wrap.append(open, del); return wrap;
    }));
  }

  function encode(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function readHash() {
    const m = /^#d=([A-Za-z0-9_-]+)$/.exec(location.hash);
    if (!m) return null;
    try {
      const raw = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, "+").replace(/_/g, "/")))));
      return raw && typeof raw === "object" ? Object.fromEntries(DESIGN_KEYS.filter((k) => k in raw).map((k) => [k, raw[k]])) : null;
    } catch (e) { return null; }
  }
  async function share() {
    const url = location.origin + location.pathname + "#d=" + encode(designState());
    history.replaceState(null, "", url);
    try { await navigator.clipboard.writeText(url); setStatus("Enlace copiado: cualquiera que lo abra verá este diseño."); }
    catch (e) { setStatus("Copia el enlace desde la barra de direcciones."); }
  }

  // ---------- export ----------
  let sheetUrl = null;
  const isTouch = (navigator.maxTouchPoints || 0) > 0 && matchMedia("(pointer: coarse)").matches;

  async function save() {
    const btn = $("save");
    const { w, h } = dims();
    btn.disabled = true; $("busy").hidden = false; setStatus(`Generando ${w} × ${h} px…`);
    await new Promise((r) => setTimeout(r, 40));
    try {
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      render(cv, state, { W: w, H: h });
      const blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
      const tag = state.style === "pattern" ? state.pattern : `${currentDesign()}-${state.palette}`;
      const filename = `tapiz-${tag}-${state.theme === "dark" ? "oscuro" : "claro"}-${w}x${h}.png`;
      if (isTouch && navigator.canShare) {
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
            setStatus("Listo. Elige «Guardar imagen» para llevarla a Fotos.");
            return;
          } catch (err) {
            if (err && err.name === "AbortError") { setStatus("Cancelado."); return; }
          }
        }
        openSheet(blob);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus(`Descargado: ${filename}`);
    } catch (e) {
      setStatus("No se pudo generar la imagen. Prueba con una resolución menor.");
    } finally { btn.disabled = false; $("busy").hidden = true; }
  }

  function openSheet(blob) {
    if (sheetUrl) URL.revokeObjectURL(sheetUrl);
    sheetUrl = URL.createObjectURL(blob);
    $("sheetImg").src = sheetUrl;
    $("sheet").hidden = false;
    setStatus("Imagen lista: guárdala desde la vista ampliada.");
    $("sheetClose").focus();
  }
  function closeSheet() { $("sheet").hidden = true; }

  buildUI();
  syncInputs();
  wire();
  updateClock();
  draw();
  if (fromHash) setStatus("Diseño cargado desde el enlace.");
})();
