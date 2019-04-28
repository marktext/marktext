// Log information about our module
// jscs:disable validateIndentation
console.log('script-src-submodule: __filename', __filename);
  // /home/todd/github/karma-electron/test/reference/js/script-src-submodule.js
console.log('script-src-submodule: __dirname', __dirname);
  // /home/todd/github/karma-electron/test/reference/js
console.log('script-src-submodule: module.filename', module.filename);
  // /home/todd/github/karma-electron/test/reference/js/script-src-submodule.js
console.log('script-src-submodule: module.exports', module.exports); // {}
console.log('script-src-submodule: module.id', module.id);
  // /home/todd/github/karma-electron/test/reference/js/script-src-submodule.js
console.log('script-src-submodule: module.loaded', module.loaded); // false
console.log('script-src-submodule: module.parent', module.parent);
  // {children: Array[9], exports: {}, filename: /home/todd/github/karma-electron/test/reference/index.html,
  //    id: ., loaded: true, parent: null, paths: Array[6]}
// jscs:enable validateIndentation
