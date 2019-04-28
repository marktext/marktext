// Start our tests
// DEV: This doesn't use `assert` to allow this to run with other runners
describe('An invalid assertion', function () {
  it('raises an error', function () {
    // jscs:disable disallowYodaConditions
    if (1 !== 2) {
      throw new Error('1 !== 2');
    }
    // jscs:enable disallowYodaConditions
  });
});
