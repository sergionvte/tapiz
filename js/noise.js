"use strict";
// Shared maths for the generative styles: seeded simplex noise, fBm, and Oklab colour.

// 2D simplex noise (after Stefan Gustavson), seeded. Returns roughly [-1, 1].
function makeSimplex(rng) {
  const p = new Uint8Array(256), perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const GX = [1, -1, 1, -1, 1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071];
  const GY = [1, 1, -1, -1, 0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (xin, yin) => {
    const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = perm[ii + perm[jj]] % 12; t0 *= t0; n += t0 * t0 * (GX[g] * x0 + GY[g] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = perm[ii + i1 + perm[jj + j1]] % 12; t1 *= t1; n += t1 * t1 * (GX[g] * x1 + GY[g] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = perm[ii + 1 + perm[jj + 1]] % 12; t2 *= t2; n += t2 * t2 * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  };
}

// Fractal Brownian motion over simplex noise. Returns roughly [-0.9, 0.9].
function makeFbm(rng, octaves = 4) {
  const n = makeSimplex(rng);
  return (x, y) => {
    let f = 0, a = 0.5, fr = 1;
    for (let o = 0; o < octaves; o++) { f += a * n(x * fr + o * 17.31, y * fr - o * 9.13); fr *= 2.02; a *= 0.5; }
    return f;
  };
}

// ---- Oklab ----
const srgbToLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const LIN2SRGB = (() => {
  const t = new Uint8ClampedArray(4096);
  for (let i = 0; i < 4096; i++) { const v = i / 4095; t[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
  return t;
})();
const linToSrgb = (v) => LIN2SRGB[v <= 0 ? 0 : v >= 1 ? 4095 : (v * 4095 + 0.5) | 0];

function rgbToOklab(c) {
  const r = srgbToLin(c[0]), g = srgbToLin(c[1]), b = srgbToLin(c[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabInto(L, A, B, out) {
  let l = L + 0.3963377774 * A + 0.2158037573 * B, m = L - 0.1055613458 * A - 0.0638541728 * B, s = L - 0.0894841775 * A - 1.2914855480 * B;
  l = l * l * l; m = m * m * m; s = s * s * s;
  out[0] = linToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  out[1] = linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  out[2] = linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

// Palette lookup table interpolated in Oklab, eased between stops so no seams or kinks show.
function makeLut(cols, size = 1024, ease = true) {
  const labs = cols.map(rgbToOklab), n = labs.length - 1, lut = new Uint8ClampedArray(size * 3), tmp = [0, 0, 0];
  for (let i = 0; i < size; i++) {
    const x = i / (size - 1) * n, k = Math.min(n - 1, Math.floor(x));
    let f = x - k; if (ease) f = f * f * (3 - 2 * f);
    const a = labs[k], b = labs[k + 1];
    oklabInto(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, tmp);
    lut[i * 3] = tmp[0]; lut[i * 3 + 1] = tmp[1]; lut[i * 3 + 2] = tmp[2];
  }
  const last = size - 1;
  return (t, out) => {
    const i = (t <= 0 ? 0 : t >= 1 ? last : (t * last + 0.5) | 0) * 3;
    out[0] = lut[i]; out[1] = lut[i + 1]; out[2] = lut[i + 2];
  };
}
