const path = require('node:path');
const fs = require('node:fs');
const { themeCheckRun } = require('@shopify/theme-check-node');
const { mean, stdDev, bench } = require('../utils');

async function test() {
  // Perform the necessary setup here
  return await themeCheckRun(
    path.join(__dirname, '..', 'dawn'),
    path.join(__dirname, '..', 'benchmark-theme-check.yml'),
  );
}

module.exports = async function cli(count = 30) {
  const results = [];
  console.error(`Suite: themeCheckAndRun`);

  for (let i = 0; i < count; i++) {
    const result = await bench(test);
    results.push(result.diff);
    console.error(`[${i}] ${result.diff} `);
  }

  console.error(`Mean ${mean(results)}`);
  console.error(`StdDev ${stdDev(results)}`);

  return {
    count,
    mean: mean(results),
    stdDev: stdDev(results),
  };
};
