/** Mulberry32, with open-interval midpoint mapping for safe Box–Muller sampling. */
export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    if (!Number.isSafeInteger(seed)) throw new Error("Seed must be a safe integer");
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296;
  }
}
export function randomNormalFrom(rng: { next(): number }, mean: number, stdDev: number): number {
  if (!Number.isFinite(mean) || !Number.isFinite(stdDev) || stdDev < 0) throw new Error("Invalid normal parameters");
  const u1 = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, rng.next()));
  const u2 = rng.next();
  if (!Number.isFinite(u1) || !Number.isFinite(u2)) throw new Error("Invalid RNG output");
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev;
}
