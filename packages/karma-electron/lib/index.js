// Load in our dependencies
var xtend = require('xtend');

// Return our merged exports
module.exports = xtend({},
  require('./karma-electron-launcher'),
  require('./karma-electron-preprocessor'));
