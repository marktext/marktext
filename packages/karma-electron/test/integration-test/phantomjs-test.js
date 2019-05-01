// Define a helper for our asserts
function assertUndefinedStr(val) {
  if (val !== 'undefined') {
    throw new Error('Expected "' + val + '" to be "undefined" but it was not');
  }
}

// Start our tests
describe('All node integrations', function () {
  it('don\'t exist as expected', function () {
    assertUndefinedStr(typeof require);
    assertUndefinedStr(typeof module);
    assertUndefinedStr(typeof __filename);
    assertUndefinedStr(typeof __dirname);
    assertUndefinedStr(typeof process);
    assertUndefinedStr(typeof setImmediate);
    assertUndefinedStr(typeof clearImmediate);
  });
});
