const moduleAlias = require('module-alias')
const path = require('path');

const prettierMajor = process.env.PRETTIER_MAJOR;
const prettierPath = process.env.PRETTIER_MAJOR === '3'
  ? path.join(__dirname, '..', 'node_modules', 'prettier3')
  : path.join(__dirname, '..', 'node_modules', 'prettier2')

moduleAlias.addAlias('prettier', prettierPath);

console.error('====================================')
console.error(`Prettier version: ${require('prettier').version}`)
console.error('====================================')
