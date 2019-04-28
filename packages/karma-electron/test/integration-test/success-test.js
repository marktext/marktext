// Start our tests
// DEV: This doesn't use `assert` to allow this to run with other runners
describe('A basic operation', function () {
  it('asserts without errors', function () {
    if (1 + 1 !== 2) {
      throw new Error('1 + 1 !== 2');
    }
  });
});
