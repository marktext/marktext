// Load in our dependencies
var assert = require('assert');

// Start our tests
// DEV: To test custom debug file, append the following config and `console.log's`
//   Then, run our standalone script: `TEST_TYPE=CUSTOM_CONTEXT_FILE npm run test-karma-continuous`
//   Then, click on "DEBUG" in the Electron window and view its console
/*
// Append to config
config.set({
  browsers: ['CustomElectron'],
  customLaunchers: {
    CustomElectron: {
      base: 'Electron',
      flags: ['--show']
    }
  }
});

// Add console.log's to this file
console.log(__filename); // Should be `integration-test/test-files/custom-debug.html`
console.log(__dirname); // Should be `integration-test/test-files/
console.log(module); // Should have `filename: integration-test/test-files/custom-debug.html`
*/
describe('A karma configuration using a custom context file', function () {
  // DEV: Determined exepctations via `../reference`
  it('has the custom context file as its filename and dirname', function () {
    // Example: /home/todd/github/karma-electron/test/integration-test/test-files/custom-context.html
    assert(/test[\/\\]integration-test[\/\\]test-files[\/\\]custom-context\.html$/.test(__filename),
      'Expected "' + __filename + '" to end with "test/integration-test/test-files/custom-context.html"');
    // Example: /home/todd/github/karma-electron/test/integration-test/test-files
    assert(/test[\/\\]integration-test[\/\\]test-files$/.test(__dirname),
      'Expected "' + __dirname + '" to end with "test/integration-test/test-files"');
    // Example: /home/todd/github/karma-electron/test/integration-test/test-files/custom-context.html
    assert(/test[\/\\]integration-test[\/\\]test-files[\/\\]custom-context\.html$/.test(module.filename),
      'Expected "' + module.filename + '" to end with "test/integration-test/test-files/custom-context.html"');
    assert.strictEqual(module.id, '.');
  });
});
