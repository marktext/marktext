import utils from '../utils'

describe('Cross-site Scripting Test', function () {
  beforeEach(utils.beforeXss)
  afterEach(utils.afterEach)

  it('Load malicious document', function (done) {
    setTimeout(() => {
      // If a test fails, an exception is thrown.

      // TODO: The process is not terminated if a test fails because the connection to Electron is lost (spectron bug?).
      //       I think thats not a problem as long as you kill the process.
      //   Message:
      //         chrome not reachable
      //     Error: Request timed out after the element was still found on the page.
      //         at execute(<Function>, "require") - api.js:63:26

      done()
    }, 3000)
  })
})
