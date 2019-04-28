// Load our dependencies
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var minstache = require('minstache');
var jsStringEscape = require('js-string-escape');
var combineSourceMap = require('combine-source-map');
var convertSourceMap = require('convert-source-map');

// Define our constants
var CONTENT_PLACEHOLDER_STR = '__CONTENT__';

// Resolve filepath to Karma's `context.html` and `debug.html`
// https://github.com/karma-runner/karma/blob/v1.3.0/lib/middleware/karma.js#L138-L157
// https://github.com/karma-runner/karma/blob/v1.3.0/lib/web-server.js#L33-L37
// https://github.com/karma-runner/karma/blob/v1.3.0/lib/middleware/common.js#L30-L70
var karmaWebServerFilepath = require.resolve('karma/lib/web-server');
var karmaStaticDirectoryFilepath = path.normalize(path.join(path.dirname(karmaWebServerFilepath), '/../static'));
// Example: /home/todd/github/karma-electron/node_modules/karma/static/context.html
var karmaDefaultContextFile = karmaStaticDirectoryFilepath + '/context.html';
var karmaDefaultDebugFile = karmaStaticDirectoryFilepath + '/debug.html';

// Load our template
// DEV: We minify to remove impact of line numbers
//   To reproduce this, make a test fail and remove minification
//   Notice how the error line goes from 10 to 30 =(
// DEV: We should be using a minifier but the mustache template prevents this
var templateStr = fs.readFileSync(__dirname + '/node-integration-iframe.mustache.js', 'utf8');
var minifiedTemplateStr = templateStr.replace(/\/\/[^\n]+/g, '\n').replace(/\n/g, '');
// DEV: Fix up JSCS work arounds
minifiedTemplateStr = minifiedTemplateStr.replace(/{{if_/g, '{{#')
  .replace(/{{notif_/g, '{{^').replace(/{{end_/g, '{{/');
// DEV: We inject a newline after content to prevent `//` comments from breaking our closure
minifiedTemplateStr = minifiedTemplateStr.replace(CONTENT_PLACEHOLDER_STR, CONTENT_PLACEHOLDER_STR + '\n');
var template = minstache.compile(minifiedTemplateStr);

// Define our framework to inject our `node-integration`
var $inject = ['config.basePath', 'config.client', 'config.customContextFile', 'config.customDebugFile'];
function createElectronPreprocessor(karmaBasePath, karmaClientConfig, karmaCustomContextFile, karmaCustomDebugFile) {
  // Generate our preprocessor function
  function electronPreprocessor(content, file, done) {
    // Render our content without a source map
    var output = template({
      __filenameOverride: karmaClientConfig.__filenameOverride,
      dirname: jsStringEscape(path.dirname(file.originalPath)),
      filename: jsStringEscape(file.originalPath),
      karmaBasePath: jsStringEscape(karmaBasePath),
      karmaContextFile: jsStringEscape(karmaCustomContextFile || karmaDefaultContextFile),
      karmaDebugFile: jsStringEscape(karmaCustomDebugFile || karmaDefaultDebugFile),
      loadScriptsViaRequire: !!karmaClientConfig.loadScriptsViaRequire,
      sep: jsStringEscape(path.sep)
    });

    // If we are using `loadScriptsViaRequire`
    if (karmaClientConfig.loadScriptsViaRequire) {
      // If there was a source map, notify user about sourcemap loss
      var contentSourceMap = convertSourceMap.fromSource(content);
      if (contentSourceMap) {
        console.warn('Detected sourcemap in "' + file.originalPath + '" while `loadScriptsViaRequire: true` was set. ' +
          '`karma-electron` cannot sourcemap this content as it\'s no longer present in the file ' +
          'as it\'s loaded via `require`');
      }
    // Otherwise, we are directly injecting content
    } else {
      // Create a source map with our content on a new line
      // DEV: Heavily based on https://github.com/browserify/browser-pack/blob/v6.1.0/index.js#L56-L102
      var splitOutput = output.split(CONTENT_PLACEHOLDER_STR);
      assert.strictEqual(splitOutput.length, 2);
      var sourcemapCombiner = combineSourceMap.create();
      sourcemapCombiner.addFile({
        // /home/todd/.../_node-integration-iframe.mustache.js/home/path/to/file
        sourceFile: __dirname + '/_node-integration-iframe.mustache.js' + file.originalPath,
        source: splitOutput[0]
      }, {line: 0});
      sourcemapCombiner.addFile({
        sourceFile: file.originalPath,
        source: content
      }, {line: 1});

      // Generate our output with our combiner's result
      output = [
        splitOutput[0],
        content,
        splitOutput[1],
        sourcemapCombiner.comment()
      ].join('\n');
    }

    // Callback with our content
    done(null, output);
  }

  // Return our preprocessor
  return electronPreprocessor;
}

// Define depenencies so our function can receive them
createElectronPreprocessor.$inject = $inject;

// Export our launcher
module.exports = {
  'preprocessor:electron': ['factory', createElectronPreprocessor]
};
