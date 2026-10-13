// Golden outputs of the corrected RNG with unchanged legacy assumptions.
// These detect accidental numerical drift; they are NOT physical benchmarks.
export const expected = {
  points: [
    { year: 2024, emissions: 68.93763014770998, cumulative: 68.93763014770998 },
    { year: 2030, emissions: 61.813551522343516, cumulative: 459.4195626860989 },
    { year: 2050, emissions: 43.75429415403034, cumulative: 1446.558233187749 },
    { year: 2100, emissions: 33.740461409347695, cumulative: 3358.5539068953453 },
  ],
  temperature: { median: 2.590124664435722, mean: 2.607724124691338, p10: 2.189280510502352, p90: 3.0482614686474196 },
  gapScores: [[1, -1], [2, 0], [3, 1]],
};
