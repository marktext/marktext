// Load in our dependencies
// DEV: By using an internal require here, we have verified that we support internal requires
var assert = require('assert');

// Start our tests
describe('All core Node.js integrations', function () {
  it('exist as expected', function () {
    assert(require);
    assert(module);
    assert(process);
    assert(setImmediate);
    assert(clearImmediate);
    assert.strictEqual(global, window);
  });
});

describe('setImmediate', function () {
  it('runs before `setTimeout`', function (done) {
    // Set up a setImmediate
    var setImmediateRan = false;
    setImmediate(function handleSetImmediate () {
      setImmediateRan = true;
    });

    // Set up a setTimeout to assert and callback
    setTimeout(function handleSetTimeout () {
      assert.strictEqual(setImmediateRan, true);
      done();
    }, 100);
  });
});

describe('clearImmediate', function () {
  it('clears an existing `setImmediate`', function (done) {
    // Set up a setImmediate
    var setImmediateRan = false;
    var setImmediateId = setImmediate(function handleSetImmediate () {
      setImmediateRan = true;
    });

    // Set up a setTimeout to assert and callback
    setTimeout(function handleSetTimeout () {
      assert.strictEqual(setImmediateRan, false);
      done();
    }, 100);

    // Clear our setImmediate
    clearImmediate(setImmediateId);
  });
});
