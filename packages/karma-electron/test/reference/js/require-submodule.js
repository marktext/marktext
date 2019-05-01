// Log information about our module
// jscs:disable validateIndentation
console.log('require-submodule: __filename', __filename);
  // /home/todd/github/karma-electron/test/reference/js/require-submodule.js
console.log('require-submodule: __dirname', __dirname);
  // /home/todd/github/karma-electron/test/reference/js
console.log('require-submodule: module.filename', module.filename);
  // /home/todd/github/karma-electron/test/reference/js/require-submodule.js
console.log('require-submodule: module.exports', module.exports); // {}
console.log('require-submodule: module.id', module.id);
  // /home/todd/github/karma-electron/test/reference/js/require-submodule.js
console.log('require-submodule: module.loaded', module.loaded); // false
console.log('require-submodule: module.parent', module.parent);
  // {children: Array[1], exports: {}, filename: /home/todd/github/karma-electron/test/reference/js/require-main.js,
  //    id: /home/todd/github/karma-electron/test/reference/js/require-main.js,
  //    loaded: true, parent: {Same as `require-main.parent`}, paths: Array[6]}
// jscs:enable validateIndentation
