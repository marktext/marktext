// Load in our dependencies
// DEV: By using an internal require here, we have verified that we support internal requires
var assert = require('assert');
// DEV: By using a `node_modules` require here, we have verified that we support external requires
void require('js-string-escape');
// DEV: By using a `./` require here, we have verified that we support relative requires
var submodule = require('./test-files/submodule');

// Start our tests
describe('All `require` based Node.js integrations', function () {
  it('function as expected', function () {
    // Example: /home/todd/github/karma-electron/test/integration-test/node-require-test.js
    assert(/test[\/\\]integration-test[\/\\]node-require-test\.js$/.test(__filename),
      'Expected "' + __filename + '" to end with "test/integration-test/node-require-test.js"');
    // Example: /home/todd/github/karma-electron/test/integration-test
    assert(/test[\/\\]integration-test$/.test(__dirname),
      'Expected "' + __dirname + '" to end with "test/integration-test"');
  });
});

describe('module for `require` based Node.js integrations', function () {
  describe('in the top level', function () {
    // DEV: Determined exepctations via `../reference`
    it('identify as the page itself', function () {
      // Example: /home/todd/github/karma-electron/test/integration-test/node-require-test.js
      assert(/test[\/\\]integration-test[\/\\]node-require-test\.js$/.test(module.filename),
        'Expected "' + module.filename + '" to end with "test/integration-test/node-require-test.js"');
      assert.strictEqual(typeof module.exports, 'object');
      // Example: /home/todd/github/karma-electron/test/integration-test/node-require-test.js
      assert(/test[\/\\]integration-test[\/\\]node-require-test\.js$/.test(module.id),
        'Expected "' + module.id + '" to end with "test/integration-test/node-require-test.js"');
      assert.strictEqual(submodule.loaded, true);
      // Example: /home/todd/github/karma-electron/node_modules/karma/static/context.html
      assert(/karma[\/\\]static[\/\\]context\.html$/.test(module.parent.filename),
        'Expected "' + module.parent.filename + '" to end with "karma/static/context.html"');
    });
  });

  describe('in a child module', function () {
    // DEV: Determined exepctations via `../reference`
    it('identify as a standalone module', function () {
      // Example: /home/todd/github/karma-electron/test/integration-test/test-files/submodule.js
      assert(/test[\/\\]integration-test[\/\\]test-files[\/\\]submodule\.js$/.test(submodule.filename),
        'Expected "' + submodule.filename + '" to end with "test/integration-test/test-files/submodule.js"');
      // Verify `hello` property of `module.exports`
      assert.strictEqual(submodule.exports.hello, 'world');
      // Example: /home/todd/github/karma-electron/test/integration-test/test-files/submodule.js
      assert(/test[\/\\]integration-test[\/\\]test-files[\/\\]submodule\.js$/.test(submodule.id),
        'Expected "' + submodule.id + '" to end with "test/integration-test/test-files/submodule.js"');
      assert.strictEqual(submodule.loaded, true);
      assert.strictEqual(submodule.parent, module);

      // Verify exported values
      assert.strictEqual(submodule.hello, 'world');
      // Example: /home/todd/github/karma-electron/test/integration-test/node-require-test.js
      assert(/test[\/\\]integration-test[\/\\]test-files[\/\\]submodule\.js$/.test(submodule.filename),
        'Expected "' + submodule.filename + '" to end with "test/integration-test/test-files/submodule.js"');
      // Example: /home/todd/github/karma-electron/test/integration-test
      assert(/test[\/\\]integration-test[\/\\]test-files$/.test(submodule.dirname),
        'Expected "' + submodule.dirname + '" to end with "test/integration-test/test-files"');
    });

    it('has same window context as parent', function () {
      assert.strictEqual(submodule.before, window.before);
    });
  });
});
