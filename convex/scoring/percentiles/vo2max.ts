/**
 * Age- and sex-adjusted VO2max percentile lookup.
 *
 * Source: FRIEND registry (Kaminsky 2015, Mayo Clin Proc) abbreviated
 * percentile table. Values are mL/kg/min cut-points for the corresponding
 * percentile in each age band.
 *
 * The table is intentionally compact (5 percentile bins, 5 age bands per sex)
 * so it can be embedded without external deps. Higher resolution can be
 * added later without changing the call signature.
 */

type Band = {
  ageMin: number;
  ageMax: number;
  p10: number; p25: number; p50: number; p75: number; p90: number;
};

const MALE_BANDS: Band[] = [
  { ageMin: 20, ageMax: 29, p10: 32, p25: 38, p50: 45, p75: 52, p90: 58 },
  { ageMin: 30, ageMax: 39, p10: 29, p25: 35, p50: 41, p75: 48, p90: 54 },
  { ageMin: 40, ageMax: 49, p10: 26, p25: 32, p50: 38, p75: 44, p90: 50 },
  { ageMin: 50, ageMax: 59, p10: 23, p25: 28, p50: 34, p75: 40, p90: 46 },
  { ageMin: 60, ageMax: 200, p10: 20, p25: 25, p50: 30, p75: 36, p90: 42 },
];

const FEMALE_BANDS: Band[] = [
  { ageMin: 20, ageMax: 29, p10: 27, p25: 32, p50: 38, p75: 44, p90: 50 },
  { ageMin: 30, ageMax: 39, p10: 25, p25: 30, p50: 35, p75: 41, p90: 47 },
  { ageMin: 40, ageMax: 49, p10: 22, p25: 27, p50: 32, p75: 38, p90: 44 },
  { ageMin: 50, ageMax: 59, p10: 19, p25: 24, p50: 29, p75: 35, p90: 40 },
  { ageMin: 60, ageMax: 200, p10: 17, p25: 21, p50: 26, p75: 31, p90: 36 },
];

function bandFor(age: number, sex: string): Band {
  const table = sex.toLowerCase() === "female" ? FEMALE_BANDS : MALE_BANDS;
  return table.find((b) => age >= b.ageMin && age <= b.ageMax) ?? table[table.length - 1]!;
}

/**
 * Linear-interpolate the VO2max value to its percentile (0..100). Below p10
 * we extrapolate down to 0; above p90 we cap at 99.
 */
export function vo2MaxPercentile(vo2: number, age: number, sex: string): number {
  if (!Number.isFinite(vo2) || vo2 <= 0) return 0;
  const b = bandFor(age, sex);
  const knots: [number, number][] = [
    [b.p10, 10], [b.p25, 25], [b.p50, 50], [b.p75, 75], [b.p90, 90],
  ];
  if (vo2 <= knots[0]![0]) {
    const ratio = vo2 / knots[0]![0];
    return Math.max(0, Math.min(10, ratio * 10));
  }
  if (vo2 >= knots[knots.length - 1]![0]) return 99;
  for (let i = 0; i < knots.length - 1; i++) {
    const [x0, y0] = knots[i]!;
    const [x1, y1] = knots[i + 1]!;
    if (vo2 >= x0 && vo2 <= x1) {
      const t = (vo2 - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 50;
}
