'use strict'

if (!/yarn\.js$/.test(process.env.npm_execpath)) {
  console.error('Please use yarn to install dependencies.\n')
  process.exit(1)
}
