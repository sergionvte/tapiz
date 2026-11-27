"use strict";
// ---------- color helpers ----------
const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function palette(st) {
  const [h, s, l] = rgbToHsl(hexToRgb(st.base));
  const g = st.grad / 100;
  let top, bottomAuto, dot;
  if (st.theme === "dark") {
    top = hslToRgb(h, s, l);
    bottomAuto = hslToRgb(h, s, l * (1 - 0.63 * g));
    dot = hslToRgb(h, Math.min(1, s * 1.65), l * 0.18);
  } else {
    top = hslToRgb(h, s * 0.5, 0.95);
    bottomAuto = hslToRgb(h, s * 0.55, 0.95 - 0.15 * g);
    dot = hslToRgb(h, Math.min(1, s * 0.75), 0.66);
  }
  const bottom = st.bottomAuto ? bottomAuto : mix(top, hexToRgb(st.bottom), g);
  if (!st.dotAuto) dot = hexToRgb(st.dot);
  // Contrast pulls the pattern colour towards the plate colour.
  const plateMid = mix(top, bottom, 0.5);
  dot = mix(plateMid, dot, st.contrast / 100);
  return { top, mid: mix(top, bottom, 0.6), bottom, dot, autoDot: st.dotAuto, bottomAutoColor: bottomAuto };
}

// ---------- renderer ----------
// The wallpaper lives in its own W×H pixel space; `k` scales it onto the canvas and (ox, oy)
// is the wallpaper point drawn at the canvas origin. Pattern sizes are in "design pixels" of a
// 1080-px-wide phone, scaled by the short side, so the look is the same on every screen.
function render(canvas, st, view) {
  if (st.style === "material") return renderMaterial(canvas, st, view);
  if (st.style === "abstract" || st.style === "gradient") return renderArt(canvas, st, view);
  const { W, H } = view, k = view.k ?? 1, ox = view.ox ?? 0, oy = view.oy ?? 0;
  const ctx = canvas.getContext("2d");
  const pal = palette(st);
  const css = (c) => `rgb(${c.map((v) => v.toFixed(1)).join(",")})`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none"; ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, css(pal.top));
  grad.addColorStop(0.5, css(pal.mid));
  grad.addColorStop(1, css(pal.bottom));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const u = Math.min(W, H) / 1080;
  const c = st.size * u, r = c * st.dotSize / 200;
  const vis = { x0: Math.max(0, ox), y0: Math.max(0, oy),
                x1: Math.min(W, ox + canvas.width / k), y1: Math.min(H, oy + canvas.height / k) };
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.fillStyle = css(pal.dot); ctx.strokeStyle = css(pal.dot);
  if (st.soft > 0 && "filter" in ctx) ctx.filter = `blur(${(st.soft / 100) * r * 0.9 * k}px)`;
  drawPattern(ctx, st.pattern, { W, H, c, r, ox: (4.61 * u) % c, vis });
  ctx.restore();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  addGrain(ctx, canvas.width, canvas.height, st.grain, view.grainScale ?? 1);
}

// Iterate lattice positions covering the visible rect (plus one cell of margin).
function* lattice(vis, step, origin, m) {
  const s = (v, o) => o + Math.floor((v - o) / step) * step - step * (m || 1);
  for (let y = s(vis.y0, origin.y); y < vis.y1 + step * (m || 1); y += step)
    for (let x = s(vis.x0, origin.x); x < vis.x1 + step * (m || 1); x += step) yield [x, y];
}

function drawPattern(ctx, id, p) {
  const { W, H, c, r, ox, vis } = p;
  const TAU = Math.PI * 2;
  const circle = (x, y, rr) => { ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU); };
  const diag = (fn) => { for (const [x, y] of lattice(vis, c, { x: ox, y: 0 })) { fn(x, y, 0); fn(x + c / 2, y + c / 2, 1); } };
  const hex = (s, fn) => { // hexagonal lattice with spacing s
    const dy = s * Math.sqrt(3) / 2;
    const j0 = Math.floor(vis.y0 / dy) - 2;
    for (let j = j0; j * dy < vis.y1 + dy * 2; j++) {
      const off = (j & 1) ? s / 2 : 0, y = j * dy;
      for (let x = ox % s + off + Math.floor((vis.x0 - s * 2) / s) * s; x < vis.x1 + s * 2; x += s) fn(x, y, j);
    }
  };
  ctx.beginPath();
  switch (id) {
    case "rejilla": { const s = c / Math.SQRT2; for (const [x, y] of lattice(vis, s, { x: ox, y: s / 2 })) circle(x, y, r); ctx.fill(); break; }
    case "panal": { hex(c / Math.pow(3, 0.25), (x, y) => circle(x, y, r)); ctx.fill(); break; }
    case "semitono": {
      const s = c / Math.SQRT2;
      for (const [x, y] of lattice(vis, s, { x: ox, y: s / 2 })) {
        const t = Math.max(0, Math.min(1, y / H));
        const rr = Math.min(s * 0.62, r * (0.15 + 1.75 * t * t));
        if (rr > 0.2) circle(x, y, rr);
      }
      ctx.fill(); break;
    }
    case "anillos": {
      ctx.lineWidth = Math.max(0.6, r * 0.42);
      diag((x, y) => circle(x, y, r * 1.15)); ctx.stroke(); break;
    }
    case "rombos": {
      const d = r * 1.3;
      diag((x, y) => { ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); });
      ctx.fill(); break;
    }
    case "placa": { // diamond tread plate: alternating slanted lozenges
      diag((x, y, alt) => { ctx.moveTo(x, y); ctx.ellipse(x, y, r * 1.9, r * 0.5, alt ? Math.PI / 4 : -Math.PI / 4, 0, TAU); });
      ctx.fill(); break;
    }
    case "cruces": {
      const a = r * 1.4, t = r * 0.62;
      diag((x, y) => { ctx.rect(x - a, y - t / 2, 2 * a, t); ctx.rect(x - t / 2, y - a, t, 2 * a); });
      ctx.fill("nonzero"); break;
    }
    case "triangulos": {
      const s = c / Math.pow(3, 0.25), t = r * 1.55;
      hex(s, (x, y, j) => {
        const up = (j & 1) ? -1 : 1;
        ctx.moveTo(x, y - t * up); ctx.lineTo(x + t * 0.866, y + t * 0.5 * up); ctx.lineTo(x - t * 0.866, y + t * 0.5 * up); ctx.closePath();
      });
      ctx.fill(); break;
    }
    case "escamas": {
      const s = c * 0.9, rr = s / 2;
      ctx.lineWidth = Math.max(0.6, r * 0.38);
      const dy = s * 0.5;
      for (let j = Math.floor(vis.y0 / dy) - 2; j * dy < vis.y1 + s; j++) {
        const y = j * dy, off = (j & 1) ? rr : 0;
        for (let x = ox % s + off + Math.floor((vis.x0 - s * 2) / s) * s; x < vis.x1 + s; x += s) {
          ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI);
        }
      }
      ctx.stroke(); break;
    }
    case "ondas": {
      const pY = c * 0.75, amp = c * 0.2, lam = c * 1.6;
      ctx.lineWidth = Math.max(0.6, r * 0.7); ctx.lineJoin = "round";
      const step = Math.max(1, c / 10);
      for (let y = Math.floor(vis.y0 / pY) * pY - pY; y < vis.y1 + pY; y += pY) {
        ctx.moveTo(vis.x0 - step, y + Math.sin((vis.x0 - step) / lam * TAU) * amp);
        for (let x = vis.x0; x <= vis.x1 + step; x += step) ctx.lineTo(x, y + Math.sin(x / lam * TAU) * amp);
      }
      ctx.stroke(); break;
    }
    case "chevron": {
      const pY = c * 0.7, w = c * 0.7, a = c * 0.3;
      ctx.lineWidth = Math.max(0.6, r * 0.7); ctx.lineJoin = "miter";
      const x0 = ox % w + Math.floor((vis.x0 - w * 2) / w) * w;
      for (let y = Math.floor(vis.y0 / pY) * pY - pY; y < vis.y1 + pY; y += pY) {
        ctx.moveTo(x0, y);
        for (let x = x0, i = 0; x < vis.x1 + w; x += w / 2, i++) ctx.lineTo(x + w / 2, y + ((i & 1) ? 0 : a));
      }
      ctx.stroke(); break;
    }
    case "rayas": {
      const pp = c / Math.SQRT2;
      ctx.lineWidth = r * 0.9;
      const k0 = Math.floor((vis.x0 - vis.y1) / pp) - 2, k1 = Math.ceil((vis.x1 - vis.y0) / pp) + 2;
      for (let kk = k0; kk <= k1; kk++) { const x0 = kk * pp + (ox % pp); ctx.moveTo(x0 + vis.y0 - pp, vis.y0 - pp); ctx.lineTo(x0 + vis.y1 + pp, vis.y1 + pp); }
      ctx.stroke(); break;
    }
    case "cuadricula": {
      const pp = c / Math.SQRT2, t = Math.max(0.8, r * 0.35);
      for (let x = ox % pp + Math.floor((vis.x0 - pp) / pp) * pp; x < vis.x1 + pp; x += pp) ctx.rect(x - t / 2, vis.y0, t, vis.y1 - vis.y0);
      for (let y = pp / 2 + Math.floor((vis.y0 - pp) / pp) * pp; y < vis.y1 + pp; y += pp) ctx.rect(vis.x0, y - t / 2, vis.x1 - vis.x0, t);
      ctx.fill("nonzero"); break;
    }
    case "ladrillo": {
      const bw = c * 1.4, bh = c * 0.7, t = Math.max(0.8, r * 0.38);
      for (let j = Math.floor(vis.y0 / bh) - 1; j * bh < vis.y1 + bh; j++) {
        const y = j * bh;
        ctx.rect(vis.x0, y - t / 2, vis.x1 - vis.x0, t);
        const off = (j & 1) ? bw / 2 : 0;
        for (let x = ox % bw + off + Math.floor((vis.x0 - bw * 2) / bw) * bw; x < vis.x1 + bw; x += bw) ctx.rect(x - t / 2, y, t, bh);
      }
      ctx.fill("nonzero"); break;
    }
    case "fibra": {
      const half = c / 2, t = half * Math.min(0.46, 0.12 + r / c), gap = (half - 2 * t) / 3;
      ctx.globalAlpha = 0.85;
      for (const [x, y] of lattice(vis, half, { x: ox % half, y: 0 })) {
        const i = Math.round((x - ox % half) / half), j = Math.round(y / half);
        if ((i + j) & 1) { ctx.rect(x + 0.5, y + gap, half - 1, t); ctx.rect(x + 0.5, y + 2 * gap + t, half - 1, t); }
        else { ctx.rect(x + gap, y + 0.5, t, half - 1); ctx.rect(x + 2 * gap + t, y + 0.5, t, half - 1); }
      }
      ctx.fill("nonzero"); ctx.globalAlpha = 1; break;
    }
    case "hexagonos": {
      const s = c * 1.1, R = s / Math.sqrt(3);
      ctx.lineWidth = Math.max(0.6, r * 0.38); ctx.lineJoin = "round";
      hex(s, (x, y) => {
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + i * Math.PI / 3, px = x + R * Math.cos(a), py = y + R * Math.sin(a);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
      });
      ctx.stroke(); break;
    }
    case "damero": { const a = r * 0.95; diag((x, y) => ctx.rect(x - a, y - a, 2 * a, 2 * a)); ctx.fill(); break; }
    case "lunares": { diag((x, y, alt) => circle(x, y, alt ? r * 0.5 : r * 1.25)); ctx.fill(); break; }
    case "confeti": { // deterministic scatter: one dot per cell, position/size from a hash
      const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const s = c * 0.8;
      for (const [x, y] of lattice(vis, s, { x: 0, y: 0 })) {
        const i = Math.round(x / s), j = Math.round(y / s);
        const h1 = hash(i, j), h2 = hash(j + 7919, i), h3 = hash(i + 104729, j + 31);
        circle(x + h1 * s, y + h2 * s, r * (0.35 + 0.9 * h3));
      }
      ctx.fill(); break;
    }
    default: diag((x, y) => circle(x, y, r)); ctx.fill();
  }
}

// ---------- material styles: big layered multicolour shapes ----------
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function materialColors(st) {
  const entry = PALETTES.find(([id]) => id === st.palette) || PALETTES[0];
  let base;
  if (st.palette === "custom") base = (st.custom || DEFAULT_CUSTOM).map(hexToRgb);
  else if (entry[2]) base = entry[2].map(hexToRgb);
  else { const [h, s] = rgbToHsl(hexToRgb(st.base)); base = [0, 1, 2, 3, 4, 5, 6].map((i) => hslToRgb(h, Math.max(0.15, s) * (1 - i * 0.06), 0.08 + i * 0.12)); }
  const n = Math.max(2, st.layers || base.length), out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * (base.length - 1), j = Math.min(base.length - 2, Math.floor(t));
    out.push(mix(base[j], base[j + 1], t - j));
  }
  return st.theme === "light" ? out.map((c) => mix(c, [255, 255, 255], 0.35)) : out;
}

function renderMaterial(canvas, st, view) {
  const { W, H } = view, k = view.k ?? 1, ox = view.ox ?? 0, oy = view.oy ?? 0;
  const ctx = canvas.getContext("2d");
  const cols = materialColors(st), N = cols.length;
  const css = (c) => `rgb(${c.map((v) => v.toFixed(1)).join(",")})`;
  const u = Math.min(W, H) / 1080, S = st.size * u; // S: shape scale in wallpaper px
  const rng = mulberry32(st.seed * 9973 + 17);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = "none"; ctx.globalAlpha = 1;

  if (st.shape === "manchas") {
    // Smooth random field, cut into N equal-area bands (topographic look), with anti-aliased edges.
    const waves = [];
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2, lam = S * 26 * (0.6 + rng() * 0.9);
      waves.push([Math.cos(a) * 2 * Math.PI / lam, Math.sin(a) * 2 * Math.PI / lam, rng() * 6.283, 1 / (1 + i * 0.35)]);
    }
    const wl = S * 30, wa = S * 7, p1 = rng() * 6.283, p2 = rng() * 6.283;
    const field = (X, Y) => {
      const x = X + wa * Math.sin(Y / wl + p1), y = Y + wa * Math.sin(X / wl + p2);
      let f = 0; for (const [fx, fy, ph, am] of waves) f += am * Math.sin(x * fx + y * fy + ph);
      return f;
    };
    const samples = [];
    for (let j = 0; j < 72; j++) for (let i = 0; i < 72; i++) samples.push(field((i + 0.5) / 72 * W, (j + 0.5) / 72 * H));
    samples.sort((a, b) => a - b);
    const th = []; for (let i = 1; i < N; i++) th.push(samples[Math.floor(i / N * samples.length)]);
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h), d = img.data;
    const row = (py) => { const r = new Float32Array(w + 1), Y = oy + (py + 0.5) / k; for (let px = 0; px <= w; px++) r[px] = field(ox + (px + 0.5) / k, Y); return r; };
    let cur = row(0);
    for (let py = 0; py < h; py++) {
      const nxt = row(py + 1);
      for (let px = 0; px < w; px++) {
        const f = cur[px], g = Math.hypot(cur[px + 1] - f, nxt[px] - f) + 1e-9;
        let L = 0; while (L < N - 1 && f >= th[L]) L++;
        let c = cols[L];
        if (L > 0) { const dl = (f - th[L - 1]) / g; if (dl < 0.5) c = mix(cols[L - 1], c, dl + 0.5); }
        if (L < N - 1) { const dh = (th[L] - f) / g; if (dh < 0.5) c = mix(cols[L + 1], c, dh + 0.5); }
        const o = (py * w + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
      cur = nxt;
    }
    ctx.putImageData(img, 0, 0);
  } else {
    ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    ctx.fillStyle = css(cols[0]); ctx.fillRect(0, 0, W, H);
    if (st.shape === "escalones") {
      // Diagonal bands that climb to the right and drop at regular steps, with rounded corners.
      const P = S * 22, s = 0.55, dStep = 0.4 * s * P, net = s - dStep / P, e = dStep * 0.08;
      const bh = (H + net * W) * 1.08 / N, rr = Math.min(dStep * 0.3, bh * 0.25);
      const phase = -rng() * P;
      for (let i = 1; i < N; i++) {
        const Y0 = H / 2 + net * (W / 2) - (H + net * W) * 0.54 + i * bh; // boundary height at x = 0
        const kMin = Math.floor((-P - phase) / P) - 1, kMax = Math.ceil((W + P - phase) / P) + 1;
        const yStart = (kk) => Y0 - (kk * P + phase) * s + (kk) * dStep - dStep * (phase / P);
        ctx.beginPath();
        ctx.moveTo(kMin * P + phase, yStart(kMin));
        for (let kk = kMin; kk < kMax; kk++) {
          const bx = (kk + 1) * P + phase, by = yStart(kk) - s * P;
          const cx = bx + e, cy = yStart(kk + 1);
          const nx = (kk + 2) * P + phase, ny = yStart(kk + 1) - s * P;
          ctx.arcTo(bx, by, cx, cy, rr);
          ctx.arcTo(cx, cy, nx, ny, rr);
        }
        ctx.lineTo(W + 2 * P, H + 2 * P + H); ctx.lineTo(-2 * P, H + 2 * P + H); ctx.closePath();
        ctx.fillStyle = css(cols[i]); ctx.fill();
      }
    } else if (st.shape === "bauhaus") {
      // Tile grid: each cell gets a background and one geometric motif, Bauhaus poster style.
      const g = S * 9, acc = cols.length > 2 ? cols.slice(1) : cols, TAU = Math.PI * 2;
      const pick = (r, not) => { let c, t = 0; do { c = acc[Math.floor(r() * acc.length)]; } while (c === not && ++t < 8); return c; };
      for (let j = 0; j * g < H; j++) for (let i = 0; i * g < W; i++) {
        const r = mulberry32(st.seed * 131 + i * 7919 + j * 104729);
        const bg = pick(r), fg = pick(r, bg), m = Math.floor(r() * 6), rot = Math.floor(r() * 4);
        ctx.fillStyle = css(bg); ctx.fillRect(i * g, j * g, g + 0.6, g + 0.6);
        ctx.save(); ctx.translate(i * g + g / 2, j * g + g / 2); ctx.rotate(rot * Math.PI / 2); ctx.translate(-g / 2, -g / 2);
        ctx.beginPath(); ctx.fillStyle = css(fg);
        if (m === 0) { ctx.moveTo(0, 0); ctx.arc(0, 0, g, 0, Math.PI / 2); }
        else if (m === 1) { ctx.arc(g / 2, 0, g / 2, 0, Math.PI); }
        else if (m === 2) { ctx.arc(g / 2, g / 2, g * 0.36, 0, TAU); }
        else if (m === 3) { ctx.moveTo(0, 0); ctx.lineTo(g, 0); ctx.lineTo(0, g); ctx.closePath(); }
        else if (m === 4) { ctx.moveTo(0, 0); ctx.arc(0, 0, g / 2, 0, Math.PI / 2); ctx.moveTo(g, g); ctx.arc(g, g, g / 2, Math.PI, Math.PI * 1.5); }
        else { for (let b = 0; b < 3; b++) ctx.rect(0, b * g / 3 + g / 12, g, g / 6); }
        ctx.fill();
        if (m === 2 && r() < 0.5) { ctx.beginPath(); ctx.fillStyle = css(bg); ctx.arc(g / 2, g / 2, g * 0.15, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    } else if (st.shape === "arcoiris") {
      // Rows of 70s rainbow arches, every other row shifted half a tile.
      const R = S * 5.5, n = Math.max(2, Math.min(N - 1, 6)), bw = R / (n + 0.7);
      for (let j = 0; (j - 1) * R < H; j++) {
        const yb = (j + 1) * R, off = (j & 1) ? R : 0;
        for (let x = -2 * R + off; x < W + 2 * R; x += 2 * R) {
          for (let q = 0; q <= n; q++) {
            ctx.beginPath(); ctx.arc(x + R, yb, R - q * bw, Math.PI, 0); ctx.closePath();
            ctx.fillStyle = css(q === n ? cols[0] : cols[1 + (q % (N - 1))]); ctx.fill();
          }
        }
      }
    } else if (st.shape === "pastillas") {
      // Diagonal lanes of rounded capsules with random lengths.
      const h = S * 4.2, gap = h * 0.38, D = Math.hypot(W, H);
      const capsule = (x, y, len) => { const rr = h / 2; ctx.moveTo(x + rr, y); ctx.lineTo(x + len - rr, y); ctx.arc(x + len - rr, y + rr, rr, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x + rr, y + h); ctx.arc(x + rr, y + rr, rr, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); };
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 6);
      let lane = 0;
      for (let y = -D / 2 - h; y < D / 2 + h; y += h + gap, lane++) {
        const r = mulberry32(st.seed * 977 + lane * 15485863);
        let x = -D / 2 - r() * h * 6;
        while (x < D / 2 + h) {
          const len = h * (1.5 + r() * 6);
          ctx.beginPath(); capsule(x, y, len);
          ctx.fillStyle = css(cols[1 + Math.floor(r() * (N - 1))]); ctx.fill();
          x += len + gap;
        }
      }
      ctx.restore();
    } else if (st.shape === "feston") {
      // Concentric scalloped "cookie" shapes, each layer twisted a little.
      const cx = W * (0.25 + rng() * 0.5), cy = H * (0.25 + rng() * 0.5);
      const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.08, amp = S * 1.8;
      for (let i = 1; i < N; i++) {
        const rad = R * (1 - (i - 1) / N) * 0.97, lobes = Math.max(6, Math.round(rad / (S * 7))), ph = i * 0.9;
        ctx.beginPath();
        const steps = Math.max(360, lobes * 24);
        for (let a = 0; a <= steps; a++) {
          const t = a / steps * Math.PI * 2, rr = rad + amp * Math.cos(t * lobes + ph);
          a ? ctx.lineTo(cx + rr * Math.cos(t), cy + rr * Math.sin(t)) : ctx.moveTo(cx + rr * Math.cos(t), cy + rr * Math.sin(t));
        }
        ctx.closePath(); ctx.fillStyle = css(cols[i]); ctx.fill();
      }
    } else if (st.shape === "sol") {
      // Retro sunburst: alternating rays plus a ringed sun.
      const cx = W * (0.15 + rng() * 0.7), cy = H * (0.7 + rng() * 0.25), R = Math.hypot(W, H) * 1.3;
      const rays = 32, a0 = rng();
      ctx.beginPath(); ctx.fillStyle = css(cols[1]);
      for (let i = 0; i < rays; i += 2) {
        ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, (i + a0) / rays * Math.PI * 2, (i + 1 + a0) / rays * Math.PI * 2); ctx.closePath();
      }
      ctx.fill();
      const rings = Math.max(1, N - 2), R0 = S * 22;
      for (let q = 0; q < rings; q++) {
        ctx.beginPath(); ctx.arc(cx, cy, R0 * (1 - q / (rings + 0.4)), 0, Math.PI * 2);
        ctx.fillStyle = css(cols[2 + q] || cols[N - 1]); ctx.fill();
      }
    } else if (st.shape === "burbujas") {
      // Overlapping ringed discs, big ones underneath.
      const count = Math.max(12, Math.round(W * H / (S * S * 230)));
      const list = [];
      for (let i = 0; i < count; i++) list.push([rng() * W, rng() * H, S * (2 + Math.pow(rng(), 2.2) * 26), Math.floor(rng() * (N - 1))]);
      list.sort((a, b) => b[2] - a[2]);
      for (const [x, y, r0, ci] of list)
        for (let q = 0; q < 3; q++) {
          ctx.beginPath(); ctx.arc(x, y, r0 * (1 - q * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = css(cols[1 + (ci + q) % (N - 1)]); ctx.fill();
        }
    } else if (st.shape === "cintas") {
      // Thick rounded ribbons that ripple in a slow diagonal wave.
      const D = Math.hypot(W, H), sp = S * 7, lam = S * (30 + rng() * 20), amp = S * 3.5;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.35); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = sp * 0.62;
      let i = 0;
      for (let y = -D / 2; y < D / 2 + sp; y += sp, i++) {
        ctx.beginPath();
        let first = true;
        for (let x = -D / 2; x <= D / 2; x += S) {
          const yy = y + amp * Math.sin(x / lam * Math.PI * 2 + i * 0.55);
          if (first) { ctx.moveTo(x, yy); first = false; } else ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = css(cols[1 + (i % (N - 1))]); ctx.stroke();
      }
      ctx.restore();
    } else if (st.shape === "origami") {
      // Low-poly facets coloured along a diagonal sweep of the palette.
      const g = S * 9, nx = Math.ceil(W / g) + 2, ny = Math.ceil(H / g) + 2, pts = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([(i - 0.5 + (rng() - 0.5) * 0.75) * g, (j - 0.5 + (rng() - 0.5) * 0.75) * g]);
      const P = (i, j) => pts[j * nx + i];
      const tri = (a, b, c) => {
        const x = (a[0] + b[0] + c[0]) / 3, y = (a[1] + b[1] + c[1]) / 3;
        let t = (x / W * 0.4 + y / H * 0.6) * (N - 1) + (rng() - 0.5) * 0.9;
        t = Math.max(0, Math.min(N - 1, t)); const f = Math.floor(t);
        const col = css(mix(cols[f], cols[Math.min(N - 1, f + 1)], t - f));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
        ctx.fillStyle = col; ctx.strokeStyle = col; ctx.fill(); ctx.stroke();
      };
      ctx.lineWidth = 1 / k; ctx.lineJoin = "round";
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
        if (rng() < 0.5) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); }
      }
    } else if (st.shape === "colinas") {
      // Layered rolling hills, each with its own pair of sine waves.
      const step = Math.max(2, W / 240);
      for (let i = 1; i < N; i++) {
        const base = H * (0.08 + 0.92 * i / N), amp = H / N * 0.75;
        const l1 = S * (18 + rng() * 20), l2 = S * (7 + rng() * 8), q1 = rng() * 6.283, q2 = rng() * 6.283;
        ctx.beginPath(); ctx.moveTo(-step, H + 10);
        for (let x = -step; x <= W + step; x += step) ctx.lineTo(x, base + amp * (Math.sin(x / l1 + q1) * 0.75 + Math.sin(x / l2 + q2) * 0.25));
        ctx.lineTo(W + step, H + 10); ctx.closePath();
        ctx.fillStyle = css(cols[i]); ctx.fill();
      }
    } else { // arcos: wobbly concentric rings from a corner
      const cx = -W * 0.08, cy = H * 1.08, R = Math.hypot(W * 1.15, H * 1.15);
      const lobes = 3 + Math.floor(rng() * 4), wob = S * 2.2;
      for (let i = 1; i < N; i++) {
        const rad = R * (1 - i / N), ph = rng() * 6.283;
        ctx.beginPath();
        for (let a = 0; a <= 360; a += 2) {
          const t = a * Math.PI / 180, rr = rad + wob * Math.sin(t * lobes + ph);
          const x = cx + rr * Math.cos(t), y = cy + rr * Math.sin(t);
          a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fillStyle = css(cols[i]); ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  addGrain(ctx, canvas.width, canvas.height, st.grain, view.grainScale ?? 1);
}

// Monochrome film grain (std up to ~6.5 levels) plus a ±0.5 dither that prevents gradient banding.
function addGrain(ctx, w, h, amount, scale) {
  const std = (amount / 100) * 6.5 * scale;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const k = std / 0.408;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() + rnd() - 1) * k + (rnd() - 0.5);
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.12;
  }
  ctx.putImageData(img, 0, 0);
}

