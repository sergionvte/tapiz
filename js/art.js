"use strict";
// Abstract and gradient styles. Wallpaper coordinates as in render(): `view` maps the W×H
// wallpaper onto the canvas with scale k and origin (ox, oy). S is the design scale in px.

// Smooth pseudo-noise built from rotated sine waves (fast, seedable, tiles nowhere).
function makeField(rng, lam, octaves = 3) {
  const fx = [], fy = [], ph = [], am = [];
  let amp = 1, sum = 0;
  for (let o = 0; o < octaves; o++) {
    for (let r = 0; r < 2; r++) {
      const a = rng() * Math.PI * 2, l = lam / Math.pow(1.9, o) * (0.8 + rng() * 0.4);
      fx.push(Math.cos(a) * 2 * Math.PI / l); fy.push(Math.sin(a) * 2 * Math.PI / l);
      ph.push(rng() * Math.PI * 2); am.push(amp); sum += amp;
    }
    amp *= 0.5;
  }
  const n = fx.length, norm = 1.6 / sum;
  return (x, y) => { let f = 0; for (let i = 0; i < n; i++) f += am[i] * Math.sin(x * fx[i] + y * fy[i] + ph[i]); return f * norm; };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const toLin = (c) => c.map((v) => Math.pow(v / 255, 2.2));
const fromLin = (v) => 255 * Math.pow(clamp01(v), 1 / 2.2);

// Sample the palette continuously at t∈[0,1] into out.
function sampler(cols) {
  const n = cols.length - 1;
  return (t, out) => {
    const x = clamp01(t) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = cols[i], b = cols[i + 1];
    out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f;
  };
}

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

// Soft mesh gradient: palette colours placed at random points, blended by inverse distance in linear light.
function makeMesh(rng, cols, W, H, S) {
  const M = Math.min(W, H), lin = cols.map(toLin);
  const pts = cols.map((_, i) => {
    // Spread points: a shuffled diagonal walk keeps neighbours in the palette apart.
    const t = (i + 0.5) / cols.length;
    return [(0.5 + (rng() - 0.5) * 1.3) * W, ((t + (rng() - 0.5) * 0.5) * 1.2 - 0.1) * H];
  });
  const wx = makeField(rng, S * 45, 2), wy = makeField(rng, S * 45, 2), A = S * 9;
  const n = pts.length;
  return (X, Y, out) => {
    const x = X + wx(X, Y) * A, y = Y + wy(X, Y) * A;
    let r = 0, g = 0, b = 0, ws = 0;
    for (let i = 0; i < n; i++) {
      const dx = (x - pts[i][0]) / M, dy = (y - pts[i][1]) / M;
      const w = 1 / Math.pow(dx * dx + dy * dy + 0.004, 1.35);
      r += w * lin[i][0]; g += w * lin[i][1]; b += w * lin[i][2]; ws += w;
    }
    out[0] = fromLin(r / ws); out[1] = fromLin(g / ws); out[2] = fromLin(b / ws);
  };
}

function renderArt(canvas, st, view) {
  const { W, H } = view, k = view.k ?? 1, ox = view.ox ?? 0, oy = view.oy ?? 0;
  const ctx = canvas.getContext("2d");
  const cols = materialColors(st), N = cols.length;
  const css = (c, a = 1) => `rgba(${c.map((v) => v.toFixed(1)).join(",")},${a})`;
  const u = Math.min(W, H) / 1080, S = st.size * u;
  const rng = mulberry32(st.seed * 7919 + 101);
  const sample = sampler(cols);
  const dark = st.theme !== "light";
  const id = st.style === "abstract" ? st.abstract : st.gradient;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  const toWall = () => ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);

  switch (id) {
    case "malla": pixels(ctx, canvas, view, makeMesh(rng, cols, W, H, S)); break;

    case "aurora": {
      // Luminous curtains over a deep sky, added in linear light.
      const sky = toLin(dark ? mix(cols[0], [0, 0, 0], 0.45) : cols[0]);
      const skyTop = toLin(dark ? mix(cols[0], [0, 0, 0], 0.75) : mix(cols[0], [255, 255, 255], 0.3));
      const nC = Math.min(3, N - 2), curt = [];
      for (let i = 0; i < nC; i++) {
        curt.push({ col: toLin(cols[Math.max(1, N - 2 - i)]), base: H * (0.4 + 0.12 * i + rng() * 0.06), w: S * (2.6 + rng() * 2.2),
          f: makeField(rng, S * 60, 2), g: makeField(rng, S * 14, 2), amp: H * (0.1 + rng() * 0.06),
          gain: (dark ? 0.42 : 0.28) - i * 0.08, fade: makeField(rng, S * 80, 1) });
      }
      pixels(ctx, canvas, view, (X, Y, out) => {
        const t = Y / H;
        let r = skyTop[0] + (sky[0] - skyTop[0]) * t, g = skyTop[1] + (sky[1] - skyTop[1]) * t, b = skyTop[2] + (sky[2] - skyTop[2]) * t;
        for (const c of curt) {
          const dy = Y - (c.base + c.f(X, 0) * c.amp);
          // Sharp lower hem, light fading upwards in rays, and gaps along the band.
          let I = dy > 0 ? Math.exp(-Math.pow(dy / (c.w * 0.45), 2)) : Math.exp(dy / (c.w * 2.6));
          I *= c.gain * (0.72 + 0.28 * Math.sin(X / (S * 1.9) + c.g(X, 0) * 4)) * clamp01(0.2 + 1.1 * c.fade(X, 0));
          r += c.col[0] * I; g += c.col[1] * I; b += c.col[2] * I;
        }
        out[0] = fromLin(r); out[1] = fromLin(g); out[2] = fromLin(b);
      });
      break;
    }

    case "orbes": {
      toWall();
      ctx.fillStyle = css(cols[0]); ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = dark ? "screen" : "multiply";
      const count = 7 + Math.floor(rng() * 5);
      for (let i = 0; i < count; i++) {
        const x = (rng() * 1.2 - 0.1) * W, y = (rng() * 1.2 - 0.1) * H, r = S * (12 + rng() * 28), c = cols[1 + Math.floor(rng() * (N - 1))];
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, css(c, 0.95)); g.addColorStop(0.5, css(c, 0.45)); g.addColorStop(1, css(c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      break;
    }

    case "holo": {
      // Iridescent foil: a warped field folded back and forth across the palette.
      const f1 = makeField(rng, S * 32, 3), f2 = makeField(rng, S * 32, 3), A = S * 10;
      pixels(ctx, canvas, view, (X, Y, out) => {
        const w = f2(X, Y);
        const v = f1(X + A * w, Y - A * w) * 0.9 + Y / H * 0.7;
        const t = v - Math.floor(v), tri = 1 - Math.abs(2 * t - 1);
        sample(tri, out);
        const sheen = Math.pow(Math.max(0, w), 6) * 70;
        out[0] = Math.min(255, out[0] + sheen); out[1] = Math.min(255, out[1] + sheen); out[2] = Math.min(255, out[2] + sheen);
      });
      break;
    }

    case "lineal":
    case "conico": {
      toWall();
      let g;
      if (id === "conico" && ctx.createConicGradient) {
        g = ctx.createConicGradient(rng() * Math.PI * 2, W * (0.2 + rng() * 0.6), H * (0.2 + rng() * 0.6));
        cols.forEach((c, i) => g.addColorStop(i / N, css(c)));
        g.addColorStop(1, css(cols[0]));
      } else {
        const a = rng() * Math.PI, L = Math.hypot(W, H) / 2, cx = W / 2, cy = H / 2;
        g = ctx.createLinearGradient(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        cols.forEach((c, i) => g.addColorStop(i / (N - 1), css(c)));
      }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // A soft light falling across the surface.
      const lx = W * rng(), ly = H * rng() * 0.6, lr = Math.hypot(W, H) * 0.6;
      const light = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      light.addColorStop(0, "rgba(255,255,255,0.16)"); light.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = light; ctx.fillRect(0, 0, W, H);
      break;
    }

    case "liquido": {
      // Domain-warped flow, like marbled ink.
      const fa = makeField(rng, S * 75, 2), fb = makeField(rng, S * 75, 2), fc = makeField(rng, S * 60, 3), A = S * 30;
      pixels(ctx, canvas, view, (X, Y, out) => {
        const qx = fa(X, Y), qy = fb(X + S * 17, Y - S * 9);
        const v = fc(X + A * qx, Y + A * qy);
        sample(0.5 + 0.36 * v + 0.1 * qx, out);
      });
      break;
    }

    case "cristal": {
      // Reeded glass over a mesh gradient: each flute mirrors and shades what is behind it.
      const base = makeMesh(rng, cols, W, H, S), fw = S * 3.2, tmp = [0, 0, 0];
      pixels(ctx, canvas, view, (X, Y, out) => {
        const uu = (((X % fw) + fw) % fw) / fw;
        base(X - (uu - 0.5) * fw * 1.6, Y + (uu - 0.5) * S * 1.5, tmp);
        let shade = 0.84 + 0.24 * Math.sin(uu * Math.PI);
        if (uu < 0.045) shade *= 0.86;
        const hi = 60 * Math.exp(-Math.pow((uu - 0.76) / 0.07, 2));
        out[0] = Math.min(255, tmp[0] * shade + hi); out[1] = Math.min(255, tmp[1] * shade + hi); out[2] = Math.min(255, tmp[2] * shade + hi);
      });
      break;
    }

    case "trazos": {
      // Flow-field strokes, like a generative pen plotter.
      toWall();
      ctx.fillStyle = css(cols[0]); ctx.fillRect(0, 0, W, H);
      const field = makeField(rng, S * 42, 3), count = Math.round(W * H / (S * S * 13)), step = S * 0.7;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = 0.92;
      for (let i = 0; i < count; i++) {
        let x = rng() * W, y = rng() * H;
        const len = 30 + Math.floor(rng() * 90);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < len; s++) {
          const a = field(x, y) * Math.PI * 1.6;
          x += Math.cos(a) * step; y += Math.sin(a) * step; ctx.lineTo(x, y);
        }
        ctx.lineWidth = S * (0.25 + rng() * 0.95);
        ctx.strokeStyle = css(cols[1 + Math.floor(rng() * (N - 1))]); ctx.stroke();
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
        const c = cols[1 + Math.floor(hash3(id1, 3, seed) * (N - 1))];
        const glow = 1.14 - 0.32 * Math.sqrt(d1) / g, sh = 0.88 + 0.24 * hash3(id1, 5, seed);
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
      const ground = dark ? order[0] : order[order.length - 1], inks = order.filter((c) => c !== ground);
      ctx.fillStyle = css(ground); ctx.fillRect(0, 0, W, H);
      const g = S * 8;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let j = -1; j * g < H + g; j++) for (let i = -1; i * g < W + g; i++) {
        const r = mulberry32(st.seed * 31 + i * 7919 + j * 104729);
        if (r() < 0.12) continue;
        const x = (i + 0.2 + r() * 0.6) * g, y = (j + 0.2 + r() * 0.6) * g, s = g * (0.3 + r() * 0.2);
        const c = css(inks[Math.floor(r() * inks.length)]), type = Math.floor(r() * 7);
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
      const sp = S * 2.4, field = makeField(rng, S * 12, 3), stepX = Math.max(1, S * 0.5);
      const y0 = H * 0.1, rows = Math.ceil((H * 0.98 - y0) / sp);
      ctx.lineWidth = Math.max(1 / k, S * 0.38); ctx.lineJoin = "round";
      for (let row = 0; row < rows; row++) {
        const y = y0 + row * sp;
        ctx.beginPath(); ctx.moveTo(-10, y);
        for (let x = -10; x <= W + 10; x += stepX) {
          const env = Math.exp(-Math.pow((x - W / 2) / (W * 0.27), 2));
          const n = field(x, y * 0.4);
          ctx.lineTo(x, y - env * (0.12 + Math.max(0, n)) * S * 14);
        }
        ctx.lineTo(W + 10, y); ctx.lineTo(W + 10, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath();
        ctx.fillStyle = css(cols[0]); ctx.fill();
        const lc = [0, 0, 0]; sample(0.2 + 0.8 * row / Math.max(1, rows - 1), lc);
        ctx.strokeStyle = css(lc); ctx.stroke();
      }
      break;
    }

    default: pixels(ctx, canvas, view, makeMesh(rng, cols, W, H, S));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  addGrain(ctx, canvas.width, canvas.height, st.grain, view.grainScale ?? 1);
}
