const moduleAlias = require('module-alias');
const path = require('path');

const prettierMajor = process.env.PRETTIER_MAJOR;
const prettierPackage = prettierMajor === '3' ? 'prettier3' : 'prettier2';
const prettierPath = path.dirname(require.resolve(`${prettierPackage}/package.json`));

export function setup() {
  moduleAlias.addAlias('prettier', prettierPath);
  console.error('====================================');
  console.error(`Prettier version: ${require('prettier').version}`);
  console.error('====================================');
}
