// Load in our dependencies
var assert = require('assert');

// Start our tests
// DEV: We run multiple times via `npm`
describe('A Karma test that runs multiple times', function () {
  it('does not use the same user data', function () {
    localStorage.foo = 'bar';
    assert.strictEqual(localStorage.foo, 'bar');
    assert.strictEqual(localStorage.hello, undefined);
    localStorage.hello = 'world';
  });
});
