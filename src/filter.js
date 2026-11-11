// One Euro filter (Casiez, Roussel & Vogel, 2012): smooths hard while a value is still, follows quickly
// when it moves fast. minCutoff (Hz) sets the calm smoothing, beta how much speed loosens it.
const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };

export class OneEuro {
  constructor(minCutoff = 1, beta = 0.01, dCutoff = 1) { Object.assign(this, { minCutoff, beta, dCutoff }); this.reset(); }
  reset() { this.x = null; this.dx = 0; this.t = 0; }
  filter(x, tMs) {
    if (this.x === null || !(tMs > this.t)) { if (this.x === null) { this.x = x; this.t = tMs; } return this.x; }
    const dt = Math.min(0.5, (tMs - this.t) / 1000); this.t = tMs;
    this.dx += alpha(this.dCutoff, dt) * ((x - this.x) / dt - this.dx);
    this.x += alpha(this.minCutoff + this.beta * Math.abs(this.dx), dt) * (x - this.x);
    return this.x;
  }
}

// three filters for a point
export class OneEuro3 {
  constructor(minCutoff, beta, zCutoff = minCutoff, zBeta = beta) { this.f = [new OneEuro(minCutoff, beta), new OneEuro(minCutoff, beta), new OneEuro(zCutoff, zBeta)]; }
  reset() { for (const f of this.f) f.reset(); }
  filter(v, tMs) { v.set(this.f[0].filter(v.x, tMs), this.f[1].filter(v.y, tMs), this.f[2].filter(v.z, tMs)); return v; }
}
