const sum = (a, b) => a + b;
const mean = (array) => array.reduce(sum, 0) / array.length;
const stdDev = (array) =>
  Math.sqrt(array.map((x) => Math.pow(x - mean(array), 2)).reduce(sum, 0) / array.length);

async function bench(fn) {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, diff: end - start };
}

module.exports = {
  sum,
  mean,
  stdDev,
  bench,
};
