'use strict'

const nodeMajor = Number(process.versions.node.match(/^(\d+)\./)[1])
if (nodeMajor < 14) {
  console.error('[ERROR] Node.js v14 or above is required.\n')
  process.exit(1)
}

if (!/yarn\.js$/.test(process.env.npm_execpath)) {
  console.error('[ERROR] Please use yarn to install dependencies.\n')
  process.exit(1)
}
