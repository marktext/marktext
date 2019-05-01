// Log information about our module
// DEV: For reference, this is identical to `script-src-submodule.js`
// jscs:disable validateIndentation
console.log('require-main: __filename', __filename);
  // /home/todd/github/karma-electron/test/reference/js/require-main.js
console.log('require-main: __dirname', __dirname);
  // /home/todd/github/karma-electron/test/reference/js
console.log('require-main: module.filename', module.filename);
  // /home/todd/github/karma-electron/test/reference/js/require-main.js
console.log('require-main: module.exports', module.exports); // {}
console.log('require-main: module.id', module.id);
  // /home/todd/github/karma-electron/test/reference/js/require-main.js
console.log('require-main: module.loaded', module.loaded); // false
console.log('require-main: module.parent', module.parent);
  // {children: Array[9], exports: {}, filename: /home/todd/github/karma-electron/test/reference/index.html,
  //    id: ., loaded: true, parent: null, paths: Array[6]}
// jscs:enable validateIndentation

// Load another script via `require`
void require('./require-submodule.js');
