// Log information about our module
// jscs:disable validateIndentation
console.log('script-src-main: __filename', __filename);
  // /home/todd/github/karma-electron/test/reference/index.html
console.log('script-src-main: __dirname', __dirname);
  // /home/todd/github/karma-electron/test/reference
console.log('script-src-main: module.filename', module.filename);
  // /home/todd/github/karma-electron/test/reference/index.html
console.log('script-src-main: module.exports', module.exports); // {}
console.log('script-src-main: module.id', module.id); // .
console.log('script-src-main: module.loaded', module.loaded); // true
console.log('script-src-main: module.parent', module.parent); // null
// jscs:enable validateIndentation

// Load another script via `require`
// DEV: Our path begins from perspective of `index.html` due to using `<script src=`
//   https://github.com/twolfson/karma-electron/issues/11
void require('./js/script-src-submodule.js');
