// Load in our dependencies
var assert = require('assert');
var request = require('request');
var convertSourceMap = require('convert-source-map');

// Start our tests
describe('A file with a source map loaded with karma-electron', function () {
  before(function retrieveHttpFile (done) {
    // Retrieve karma-electron processed HTTP body
    var that = this;
    request('http://localhost:9876/base/source-map-test.js', function handleRequest (err, res, body) {
      that.httpBody = body;
      done(err);
    });
  });
  after(function cleanup () {
    delete this.httpBody;
  });

  it('extends its source map', function () {
    // Load in our HTTP lines
    var generatedContent = this.httpBody;
    var generatedSourcemap = convertSourceMap.fromComment(generatedContent).toObject();

    // Verify our source map's contents are in the source map
    // {version: 3, sources: ['/home/todd/.../_node-integration-iframe.mustache.js/path/to/source-map-test.js', ...],
    //   names: [], mappings: 'AAAA;...', file: 'generated.js',
    //   sourceRoot: '', sourcesContent: ['(function () {...', ...]}
    assert.strictEqual(generatedSourcemap.sources.length, 2);
    assert.strictEqual(generatedSourcemap.sources[1], '/src/foo.js');
    assert.strictEqual(generatedSourcemap.sourcesContent.length, 2);
    assert.strictEqual(generatedSourcemap.sourcesContent[1], 'console.log(\'hi\');');
  });
});
// Via https://github.com/thlorenz/convert-source-map
// jscs:disable
// Generated via:  echo '{"version":3,"file":"build/foo.min.js","sources":["src/foo.js"],"names":[],"mappings":"AAAA","sourceRoot":"/","sourcesContent":["console.log(\"hi\");"]}' | base64
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGQvZm9vLm1pbi5qcyIsInNvdXJjZXMiOlsic3JjL2Zvby5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSIsInNvdXJjZVJvb3QiOiIvIiwic291cmNlc0NvbnRlbnQiOlsiY29uc29sZS5sb2coJ2hpJyk7Il19Cg==
