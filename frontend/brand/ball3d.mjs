// Bola de futebol vetorial gerada da geometria real (icosaedro truncado projetado
// numa esfera). Gomos com costuras curvas, como numa bola de verdade.
const PHI = (1 + Math.sqrt(5)) / 2;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));

// 12 vértices do icosaedro = centros dos 12 pentágonos
const ICO = [];
for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
  ICO.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]);
}
const neighbors = ICO.map((v, i) =>
  ICO.map((w, j) => [j, Math.hypot(...sub(v, w))]).filter(([j, d]) => j !== i && Math.abs(d - 2) < 1e-6).map(([j]) => j),
);

// Pentágono i: pontos a 1/3 do caminho até cada vizinho, ordenados em volta do centro
const pentagons = ICO.map((v, i) => {
  const n = norm(v);
  const t1 = norm(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const t2 = cross(n, t1);
  return neighbors[i]
    .map((j) => ({ j, p: add(v, mul(sub(ICO[j], v), 1 / 3)) }))
    .sort((a, b) => Math.atan2(dot(a.p, t2), dot(a.p, t1)) - Math.atan2(dot(b.p, t2), dot(b.p, t1)));
});

// Arestas: lados dos pentágonos + ligações entre pentágonos vizinhos (lados dos hexágonos)
const edges = [];
pentagons.forEach((pts, i) => {
  pts.forEach((a, k) => edges.push([a.p, pts[(k + 1) % 5].p]));
  pts.forEach(({ j, p }) => {
    if (j > i) {
      const back = pentagons[j].find((q) => q.j === i);
      edges.push([p, back.p]);
    }
  });
});

function slerp(a, b, t) {
  const A = norm(a);
  const B = norm(b);
  const w = Math.acos(Math.min(1, Math.max(-1, dot(A, B))));
  if (w < 1e-9) return A;
  return add(mul(A, Math.sin((1 - t) * w) / Math.sin(w)), mul(B, Math.sin(t * w) / Math.sin(w)));
}

function rotationAligning(from, to) {
  const f = norm(from);
  const t = norm(to);
  const v = cross(f, t);
  const c = dot(f, t);
  const k = 1 / (1 + c);
  return [
    [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1]],
    [v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0]],
    [v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c],
  ];
}
const apply = (M, p) => [dot(M[0], p), dot(M[1], p), dot(M[2], p)];
function rotZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));

// Orientação como na referência: pentágono principal um pouco acima e à esquerda do centro
const FACING = norm([-0.2, 0.16, 1]);
const M = mm(rotZ((14 * Math.PI) / 180), rotationAligning(ICO[0], FACING));

const SAMPLES = 10;

function clipFront(poly) {
  // Sutherland–Hodgman contra o plano z = 0; pontos de corte vão para a borda da esfera
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = a[2] >= 0;
    const ib = b[2] >= 0;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = a[2] / (a[2] - b[2]);
      out.push(norm(add(a, mul(sub(b, a), t))));
    }
  }
  return out;
}

const f = (n) => Number(n.toFixed(2));

/**
 * @param {number} cx centro x
 * @param {number} cy centro y
 * @param {number} R raio externo (inclui o contorno)
 * @param {{ ink?: string, paper?: string, halo?: string|null }} opts
 */
let seq = 0;
export function ball(cx, cy, R, { ink = "#0a0a0a", paper = "#ffffff", halo = null } = {}) {
  const clip = `efb${seq++}`;
  const rim = R * 0.095; // contorno grosso, como na referência
  const r = R - rim / 2 - (halo ? R * 0.035 : 0); // raio da esfera desenhada
  const seam = R * 0.042;
  const P = (p) => [cx + p[0] * r, cy - p[1] * r];
  const toPath = (pts, close) => pts.map((p, k) => `${k ? "L" : "M"}${f(P(p)[0])} ${f(P(p)[1])}`).join("") + (close ? "Z" : "");

  const parts = [];
  if (halo) parts.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${halo}"/>`);
  parts.push(`<clipPath id="${clip}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/></clipPath>`);
  parts.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${paper}"/>`);
  parts.push(`<g clip-path="url(#${clip})">`);

  // gomos pretos (pentágonos), recortados na metade visível
  const pentPaths = [];
  for (const pts of pentagons) {
    const ring = [];
    for (let k = 0; k < 5; k++) {
      const a = apply(M, norm(pts[k].p));
      const b = apply(M, norm(pts[(k + 1) % 5].p));
      for (let s = 0; s < SAMPLES; s++) ring.push(slerp(a, b, s / SAMPLES));
    }
    const vis = clipFront(ring);
    if (vis.length > 2) pentPaths.push(toPath(vis, true));
  }
  parts.push(`<path d="${pentPaths.join("")}" fill="${ink}" stroke="${ink}" stroke-width="${f(seam)}" stroke-linejoin="round"/>`);

  // costuras (curvas na esfera), só a parte da frente
  const seamPaths = [];
  for (const [a0, b0] of edges) {
    const a = apply(M, norm(a0));
    const b = apply(M, norm(b0));
    let run = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const p = slerp(a, b, s / SAMPLES);
      if (p[2] > -0.05) run.push(p);
      else {
        if (run.length > 1) seamPaths.push(toPath(run, false));
        run = [];
      }
    }
    if (run.length > 1) seamPaths.push(toPath(run, false));
  }
  parts.push(`<path d="${seamPaths.join("")}" fill="none" stroke="${ink}" stroke-width="${f(seam)}" stroke-linecap="round" stroke-linejoin="round"/>`);

  parts.push(`</g>`);
  // contorno
  parts.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${ink}" stroke-width="${f(rim)}"/>`);
  return parts.join("");
}
