"use strict";
// Abstract and gradient styles. `view` maps the W×H wallpaper onto the canvas with scale k and
// origin (ox, oy). S is the design scale in wallpaper px. Colours always come from the palette
// (interpolated in Oklab), so nothing clips or burns.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Per-pixel renderer: fn(X, Y, out) receives wallpaper coordinates and writes RGB.
function pixels(ctx, canvas, view, fn) {
  const w = canvas.width, h = canvas.height, k = view.k ?? 1, ox = view.ox ?? 0, oy = view.oy ?? 0;
  const img = ctx.createImageData(w, h), d = img.data, out = [0, 0, 0];
  for (let py = 0, o = 0; py < h; py++) {
    const Y = oy + (py + 0.5) / k;
    for (let px = 0; px < w; px++, o += 4) {
      fn(ox + (px + 0.5) / k, Y, out);
      d[o] = out[0]; d[o + 1] = out[1]; d[o + 2] = out[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function hash3(i, j, n) {
  let h = (i * 374761393 + j * 668265263 + n * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Soft mesh gradient: palette colours at well-spread points, blended with Gaussian weights in Oklab.
function makeMesh(rng, cols, W, H, S) {
  const labs = cols.map(rgbToOklab), n = labs.length, g = Math.ceil(Math.sqrt(n));
  const cells = Array.from({ length: g * g }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const pts = labs.map((_, i) => {
    const c = cells[i], cx = c % g, cy = Math.floor(c / g);
    return [((cx + 0.2 + 0.6 * rng()) / g * 1.1 - 0.05) * W, ((cy + 0.2 + 0.6 * rng()) / g * 1.1 - 0.05) * H];
  });
  const sigma = 0.62 * Math.max(W, H) / g, inv = 1 / (2 * sigma * sigma);
  const wa = makeFbm(rng, 3), wb = makeFbm(rng, 3), sc = 1 / (S * 70), A = S * 14;
  return (X, Y, out) => {
    const x = X + A * wa(X * sc, Y * sc), y = Y + A * wb(X * sc + 4.1, Y * sc - 2.3);
    let L = 0, a = 0, b = 0, ws = 1e-12;
    for (let i = 0; i < n; i++) {
      const dx = x - pts[i][0], dy = y - pts[i][1], w = Math.exp(-(dx * dx + dy * dy) * inv);
      L += w * labs[i][0]; a += w * labs[i][1]; b += w * labs[i][2]; ws += w;
    }
    oklabInto(L / ws, a / ws, b / ws, out);
  };
}

function renderArt(canvas, st, view) {
  const { W, H } = view, k = view.k ?? 1, ox = view.ox ?? 0, oy = view.oy ?? 0;
  const ctx = canvas.getContext("2d");
  const cols = materialColors(st), N = cols.length;
  const css = (c, a = 1) => `rgba(${c.map((v) => v.toFixed(1)).join(",")},${a})`;
  const u = Math.min(W, H) / 1080, S = st.size * u;
  const rng = mulberry32(st.seed * 7919 + 101);
  const dark = st.theme !== "light";
  const id = st.style === "abstract" ? st.abstract : st.gradient;
  const inks = N > 2 ? cols.slice(1) : cols;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  const toWall = () => ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);

  switch (id) {
    // ---------------- gradients ----------------
    case "malla": pixels(ctx, canvas, view, makeMesh(rng, cols, W, H, S)); break;

    case "aurora": {
      // Light ribbons with a sharp lower hem fading upwards, over a deep sky. Light is added
      // with a soft roll-off so bright colours never clip.
      const skyTop = (dark ? mix(cols[0], [0, 0, 0], 0.7) : mix(cols[0], [255, 255, 255], 0.2)).map(srgbToLin);
      const skyBot = (dark ? mix(cols[0], [0, 0, 0], 0.35) : cols[0]).map(srgbToLin);
      const nC = Math.max(1, Math.min(3, N - 2)), curt = [];
      for (let i = 0; i < nC; i++) {
        curt.push({ col: cols[Math.max(1, N - 2 - i)].map(srgbToLin), base: H * (0.36 + 0.14 * i + rng() * 0.06),
          amp: H * (0.1 + rng() * 0.05), w: S * (2.6 + rng() * 2), gain: 0.9 - i * 0.2,
          shape: makeFbm(rng, 3), fade: makeFbm(rng, 2), ph: rng() * 50 });
      }
      const lam = 1 / (S * 55);
      pixels(ctx, canvas, view, (X, Y, out) => {
        const t = Y / H;
        let r = 0, g = 0, b = 0;
        for (const c of curt) {
          const dy = Y - (c.base + c.amp * c.shape(X * lam + c.ph, c.ph));
          let I = dy > 0 ? Math.exp(-(dy * dy) / (c.w * c.w * 0.25)) : Math.exp(dy / (c.w * 3.2));
          I *= c.gain * clamp01(0.3 + 1.3 * c.fade(X / (S * 90), c.ph)) * (0.86 + 0.14 * c.shape(X / (S * 7), c.ph + 9));
          r += c.col[0] * I; g += c.col[1] * I; b += c.col[2] * I;
        }
        const sr = skyTop[0] + (skyBot[0] - skyTop[0]) * t, sg = skyTop[1] + (skyBot[1] - skyTop[1]) * t, sb = skyTop[2] + (skyBot[2] - skyTop[2]) * t;
        out[0] = linToSrgb(sr + (1 - sr) * (1 - Math.exp(-r * 1.6)));
        out[1] = linToSrgb(sg + (1 - sg) * (1 - Math.exp(-g * 1.6)));
        out[2] = linToSrgb(sb + (1 - sb) * (1 - Math.exp(-b * 1.6)));
      });
      break;
    }

    case "orbes": {
      // Soft out-of-focus orbs blended normally (no additive burn).
      toWall();
      const bg = dark ? mix(cols[0], [0, 0, 0], 0.25) : mix(cols[N - 1], [255, 255, 255], 0.4);
      ctx.fillStyle = css(bg); ctx.fillRect(0, 0, W, H);
      const count = 8 + Math.floor(rng() * 5);
      for (let i = 0; i < count; i++) {
        const x = (rng() * 1.2 - 0.1) * W, y = (rng() * 1.2 - 0.1) * H, r = S * (14 + rng() * 26);
        const c = inks[Math.floor(rng() * inks.length)], grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        for (let q = 0; q <= 8; q++) { const t = q / 8; grd.addColorStop(t, css(c, 0.82 * Math.exp(-3 * t * t) * (1 - t * t))); }
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }

    case "seda": {
      // Silk: smooth folds from a warped field, banded softly across the palette.
      const fa = makeFbm(rng, 3), fb = makeFbm(rng, 3), lut = makeLut(cols), sc = 1 / (S * 58);
      pixels(ctx, canvas, view, (X, Y, out) => {
        const x = X * sc, y = Y * sc, qx = fa(x, y), qy = fb(x + 3.1, y - 1.7);
        const v = fa(x + 1.7 * qx + 7.2, y + 1.7 * qy + 1.3);
        lut(0.5 + 0.5 * Math.sin(v * 4 + y * 0.9 + qx * 1.4), out);
      });
      break;
    }

    case "horizonte": {
      // Sky gradient with a sun glow, and layered hills in silhouette.
      const lut = makeLut(dark ? cols : cols.slice().reverse()), sx = W * (0.2 + rng() * 0.6), sy = H * (0.56 + rng() * 0.08), R = S * 26;
      pixels(ctx, canvas, view, (X, Y, out) => {
        const d2 = ((X - sx) ** 2 + (Y - sy) ** 2) / (R * R);
        lut(clamp01(Math.pow(Y / H, 0.85) * 0.78 + 0.32 * Math.exp(-d2) + 0.12 * Math.exp(-d2 / 9)), out);
      });
      toWall();
      const sun = [0, 0, 0]; lut(1, sun);
      ctx.beginPath(); ctx.arc(sx, sy, R * 0.42, 0, Math.PI * 2); ctx.fillStyle = css(sun, 0.9); ctx.fill();
      const hf = makeFbm(rng, 3), base = dark ? mix(cols[0], [0, 0, 0], 0.3) : mix(cols[0], [0, 0, 0], 0.15);
      for (let i = 0; i < 3; i++) {
        const y0 = H * (0.66 + i * 0.1), amp = H * (0.07 - i * 0.012), step = Math.max(2, W / 300);
        ctx.beginPath(); ctx.moveTo(-10, H + 10);
        for (let x = -10; x <= W + 10; x += step) ctx.lineTo(x, y0 - amp * (0.6 + hf(x / (S * 40), i * 5.3)));
        ctx.lineTo(W + 10, H + 10); ctx.closePath();
        ctx.fillStyle = css(mix(base, cols[Math.min(N - 1, 1)], 0.45 - i * 0.2)); ctx.fill();
      }
      break;
    }

    case "lineal": {
      // Multi-stop gradient with eased stops and a whisper of warp.
      const a = rng() * Math.PI, ca = Math.cos(a), sa = Math.sin(a), L = Math.abs(W * ca) + Math.abs(H * sa);
      const lut = makeLut(cols), f = makeFbm(rng, 2), sc = 1 / (S * 80);
      pixels(ctx, canvas, view, (X, Y, out) => {
        lut(clamp01(((X - W / 2) * ca + (Y - H / 2) * sa) / L + 0.5 + 0.06 * f(X * sc, Y * sc)), out);
      });
      break;
    }

    // ---------------- abstract ----------------
    case "liquido": {
      // Marbled ink from nested domain warping.
      const f = makeFbm(rng, 4), lut = makeLut(cols), sc = 1 / (S * 40), w = 3.2;
      pixels(ctx, canvas, view, (X, Y, out) => {
        const x = X * sc, y = Y * sc;
        const qx = f(x, y), qy = f(x + 5.2, y + 1.3);
        const rx = f(x + w * qx + 1.7, y + w * qy + 9.2), ry = f(x + w * qx + 8.3, y + w * qy + 2.8);
        const v = f(x + w * rx, y + w * ry);
        lut(clamp01(0.5 + 1.25 * v + 0.35 * qx), out);
      });
      break;
    }

    case "papel": {
      // Paper-cut layers: wavy sheets stacked with soft shadows.
      toWall();
      ctx.fillStyle = css(cols[0]); ctx.fillRect(0, 0, W, H);
      const nf = makeSimplex(rng), layers = N - 1, step = Math.max(2, W / 260);
      const lam = S * (40 + rng() * 25), tilt = (rng() - 0.5) * 0.3;
      for (let i = 1; i <= layers; i++) {
        const y0 = H * (0.1 + 0.85 * i / (layers + 0.6)), amp = H * 0.05 + S * 2;
        ctx.save();
        ctx.shadowColor = dark ? "rgba(0,0,0,0.45)" : "rgba(40,30,60,0.22)";
        ctx.shadowBlur = S * 1.6 * k; ctx.shadowOffsetY = -S * 0.35 * k;
        ctx.beginPath(); ctx.moveTo(-20, H + 20);
        for (let x = -20; x <= W + 20; x += step) {
          ctx.lineTo(x, y0 + (x - W / 2) * tilt + amp * (nf(x / lam, i * 3.7) * 0.8 + nf(x / (lam * 0.35), i * 7.1) * 0.2));
        }
        ctx.lineTo(W + 20, H + 20); ctx.closePath();
        ctx.fillStyle = css(cols[i]); ctx.fill();
        ctx.restore();
      }
      break;
    }

    case "trazos": {
      // Flow-field strokes, like a generative pen plotter.
      toWall();
      ctx.fillStyle = css(cols[0]); ctx.fillRect(0, 0, W, H);
      const f = makeFbm(rng, 3), sc = 1 / (S * 48), count = Math.round(W * H / (S * S * 10)), step = S * 0.6;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = 0.88;
      for (let i = 0; i < count; i++) {
        let x = rng() * W, y = rng() * H;
        const len = 50 + Math.floor(rng() * 110);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < len; s++) {
          const a = f(x * sc, y * sc) * Math.PI * 3.2;
          x += Math.cos(a) * step; y += Math.sin(a) * step; ctx.lineTo(x, y);
        }
        ctx.lineWidth = S * (0.3 + rng() * 0.9);
        ctx.strokeStyle = css(inks[Math.floor(rng() * inks.length)]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "vitral": {
      // Stained glass: Voronoi cells with lead lines and a glow towards each cell's centre.
      const g = S * 7.5, lead = S * 0.55, px = 1 / k, lc = dark ? mix(cols[0], [0, 0, 0], 0.4) : cols[0];
      const seed = st.seed;
      const site = (i, j) => [(i + 0.15 + 0.7 * hash3(i, j, seed)) * g, (j + 0.15 + 0.7 * hash3(j, i, seed + 7)) * g];
      pixels(ctx, canvas, view, (X, Y, out) => {
        const ci = Math.floor(X / g), cj = Math.floor(Y / g);
        let d1 = 1e18, d2 = 1e18, s1 = null, s2 = null, id1 = 0;
        for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
          const s = site(i, j), dx = X - s[0], dy = Y - s[1], d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; s2 = s1; d1 = d; s1 = s; id1 = i * 92821 + j; }
          else if (d < d2) { d2 = d; s2 = s; }
        }
        const e = (d2 - d1) / (2 * Math.hypot(s1[0] - s2[0], s1[1] - s2[1]));
        const c = inks[Math.floor(hash3(id1, 3, seed) * inks.length)];
        const glow = 1.08 - 0.22 * Math.sqrt(d1) / g, sh = 0.92 + 0.14 * hash3(id1, 5, seed);
        const t = clamp01((e - lead / 2) / px + 0.5);
        for (let q = 0; q < 3; q++) out[q] = lc[q] + (Math.min(255, c[q] * glow * sh) - lc[q]) * t;
      });
      break;
    }

    case "memphis": {
      // 80s Memphis confetti: squiggles, rings, dots and triangles on a calm ground.
      toWall();
      const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const order = cols.slice().sort((a, b) => lum(a) - lum(b));
      const ground = dark ? order[0] : order[order.length - 1], memInks = order.filter((c) => c !== ground);
      ctx.fillStyle = css(ground); ctx.fillRect(0, 0, W, H);
      const g = S * 8;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let j = -1; j * g < H + g; j++) for (let i = -1; i * g < W + g; i++) {
        const r = mulberry32(st.seed * 31 + i * 7919 + j * 104729);
        if (r() < 0.12) continue;
        const x = (i + 0.2 + r() * 0.6) * g, y = (j + 0.2 + r() * 0.6) * g, s = g * (0.3 + r() * 0.2);
        const c = css(memInks[Math.floor(r() * memInks.length)]), type = Math.floor(r() * 7);
        ctx.save(); ctx.translate(x, y); ctx.rotate(r() * Math.PI * 2);
        ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = s * 0.2; ctx.beginPath();
        if (type === 0) { ctx.moveTo(-s, 0); for (let q = 1; q <= 4; q++) ctx.lineTo(-s + q * s / 2, q % 2 ? -s * 0.45 : 0); ctx.stroke(); }
        else if (type === 1) { ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2); ctx.stroke(); }
        else if (type === 2) { ctx.moveTo(0, -s * 0.7); ctx.lineTo(s * 0.65, s * 0.5); ctx.lineTo(-s * 0.65, s * 0.5); ctx.closePath(); ctx.fill(); }
        else if (type === 3) { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { ctx.moveTo(a * s * 0.45 + s * 0.09, b * s * 0.45); ctx.arc(a * s * 0.45, b * s * 0.45, s * 0.09, 0, Math.PI * 2); } ctx.fill(); }
        else if (type === 4) { ctx.arc(0, 0, s * 0.65, 0, Math.PI); ctx.closePath(); ctx.fill(); }
        else if (type === 5) { ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.5, 0); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.5); ctx.stroke(); }
        else { ctx.moveTo(-s, 0); for (let q = 0; q <= 20; q++) ctx.lineTo(-s + q * s / 10, Math.sin(q / 20 * Math.PI * 3) * s * 0.25); ctx.stroke(); }
        ctx.restore();
      }
      break;
    }

    case "pulsar": {
      // Stacked ridge lines rising in the middle, each hiding the ones behind it.
      toWall();
      ctx.fillStyle = css(cols[0]); ctx.fillRect(0, 0, W, H);
      const lut = makeLut(inks.length > 1 ? inks : cols), f = makeFbm(rng, 3);
      const sp = S * 2.4, stepX = Math.max(1, S * 0.5), y0 = H * 0.1, rows = Math.ceil((H * 0.98 - y0) / sp);
      ctx.lineWidth = Math.max(1 / k, S * 0.38); ctx.lineJoin = "round";
      const lc = [0, 0, 0];
      for (let row = 0; row < rows; row++) {
        const y = y0 + row * sp;
        ctx.beginPath(); ctx.moveTo(-10, y);
        for (let x = -10; x <= W + 10; x += stepX) {
          const env = Math.exp(-Math.pow((x - W / 2) / (W * 0.27), 2));
          const n = f(x / (S * 9), y / (S * 22)) * 1.7;
          ctx.lineTo(x, y - env * (0.12 + Math.max(0, n)) * S * 14);
        }
        ctx.lineTo(W + 10, y); ctx.lineTo(W + 10, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath();
        ctx.fillStyle = css(cols[0]); ctx.fill();
        lut(row / Math.max(1, rows - 1), lc);
        ctx.strokeStyle = css(lc); ctx.stroke();
      }
      break;
    }

    default: pixels(ctx, canvas, view, makeMesh(rng, cols, W, H, S));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.shadowColor = "transparent";
  // Smooth styles get a finer grain than the textured ones.
  addGrain(ctx, canvas.width, canvas.height, st.grain * 0.5, view.grainScale ?? 1);
}
