const path = require('node:path');
const fs = require('node:fs');

const acceptedPath = path.resolve(__dirname, 'accepted.json');

function commitRef() {
  return require('child_process').execSync('git rev-parse HEAD').toString().trim();
}

function pctChange(now, base) {
  return (((now - base) / base) * 100).toFixed(2);
}

const suites = ['cli'];

async function run(args) {
  const [arg1, count] = args;
  const results = {};
  for (const suite of suites) {
    const test = require(`./suites/${suite}`);
    results[suite] = await test(count);
  }

  switch (arg1) {
    case undefined:
      return;

    case 'accept': {
      const commit = commitRef();
      const contents = JSON.stringify({ commit, results }, null, 2);
      await fs.writeFileSync(acceptedPath, contents, 'utf8');
      break;
    }

    case 'compare':
    case 'ci': {
      const acceptedJSON = require(acceptedPath);
      for (const suite of suites) {
        const current = results[suite];
        const accepted = acceptedJSON.results[suite];
        if (current.mean - current.stdDev > accepted.mean + accepted.stdDev) {
          console.error(`A performance regression has been observed on the ${suite} test.`);
          console.error(`Current: ${current.mean} ± ${current.stdDev}`);
          console.error(`Accepted: ${accepted.mean} ± ${accepted.stdDev}`);
          console.error(`The current run is ${pctChange(current.mean, accepted.mean)}% worse`);
          return process.exit(1);
        } else if (current.mean + current.stdDev < accepted.mean - accepted.stdDev) {
          console.error(`A performance improvement has been observed on the ${suite} test.`);
          console.error(`Current: ${current.mean} ± ${current.stdDev}`);
          console.error(`Accepted: ${accepted.mean} ± ${accepted.stdDev}`);
          console.error();
          console.error(
            `The current run seems to be ${-pctChange(current.mean, accepted.mean)}% better`,
          );
          console.error(`Consider saving your results with the following command:`);
          console.error(`  yarn bench:accept`);
        }
      }
    }
  }

  process.exit(0);
}

run(process.argv.slice(2));
