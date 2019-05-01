// Load in our dependencies
var assert = require('assert');

// Start our tests
describe('A karma configuration using a __filenameOverride file', function () {
  // DEV: Determined exepctations via `../reference`
  it('uses the __filenameOverride for its filename and dirname', function () {
    // DEV: We use a shortened directory listing to work around line lengths on Appveyor
    //   https://ci.appveyor.com/project/twolfson/karma-electron-launcher/build/180/job/mgc51cvx44uvns7l
    // Example: /home/todd/github/karma-electron/test/integration-test/test-files/filename-override-context.html
    assert(/integration-test[\/\\]test-files[\/\\]filename-override-context\.html$/.test(__filename),
      'Expected "' + __filename + '" to end with "integration-test/test-files/filename-override-context.html"');
    // Example: /home/todd/github/karma-electron/test/integration-test/test-files
    assert(/integration-test[\/\\]test-files$/.test(__dirname),
      'Expected "' + __dirname + '" to end with "integration-test/test-files"');
    // Example: /home/todd/github/karma-electron/test/integration-test/test-files/filename-override-context.html
    assert(/integration-test[\/\\]test-files[\/\\]filename-override-context\.html$/.test(module.filename),
      'Expected "' + module.filename + '" to end with ' +
      '"integration-test/test-files/filename-override-context.html"');
    assert.strictEqual(module.id, '.');
  });

  it('doesn\'t load the file at all', function () {
    // There is no file on disk so we are fine
  });
});
