type Point = { date: string; totalReturnIndex: number | null };
export function historicalBeta(own: Point[], peers: Point[][], origin: string) {
  const unavailable = (reason: string) => ({ status: "unavailable" as const, reason });
  const end = new Date(origin);
  if (!Number.isFinite(end.getTime())) return unavailable("Invalid origin");
  const month = (offset: number) => new Date(Date.UTC(end.getUTCFullYear(),
    end.getUTCMonth() - 1 - offset, 1)).toISOString().slice(0, 7);
  const months = Array.from({ length: 61 }, (_, i) => month(60 - i));
  function index(rows: Point[]) {
    const m = new Map<string, number | null>();
    for (const p of rows) {
      const key = p.date.slice(0, 7);
      if (!months.includes(key)) continue;
      if (m.has(key)) throw new Error("Duplicate monthly observation");
      m.set(key, p.totalReturnIndex);
    }
    return m;
  }
  function returns(m: Map<string, number | null>) {
    return months.slice(1).map((key, i) => {
      const a = m.get(months[i]), b = m.get(key);
      return a != null && b != null && a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)
        ? b / a - 1 : null;
    });
  }
  const y = returns(index(own)), ps = peers.map(p => returns(index(p)));
  if (y.some(v => v === null)) return unavailable("Incomplete 60-month return window");
  const counts: number[] = [];
  const x = y.map((_, i) => {
    const values = ps.map(p => p[i]).filter((v): v is number => v !== null);
    counts.push(values.length);
    return values.reduce((a, b) => a + b, 0) / values.length;
  });
  if (counts.some(n => n < 10)) return unavailable("Fewer than ten peer contributors");
  const my = y.reduce<number>((a, b) => a + b!, 0) / 60, mx = x.reduce((a, b) => a + b, 0) / 60;
  const variance = x.reduce((a, b) => a + (b - mx) ** 2, 0);
  if (!(variance > 0)) return unavailable("Zero benchmark variance");
  const beta = x.reduce((a, b, i) => a + (b - mx) * (y[i]! - my), 0) / variance;
  const shrunkBeta = .5 * beta + .5, costOfEquity = .03 + shrunkBeta * .05;
  if (!(costOfEquity > .03 && costOfEquity < 1)) return unavailable("Rate outside declared valuation domain");
  return { status: "available" as const, beta, shrunkBeta, costOfEquity,
    firstMonth: months[1], lastMonth: months[60], months: 60, minimumPeerContributors: Math.min(...counts) };
}
