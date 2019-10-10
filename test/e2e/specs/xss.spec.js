import utils from '../utils'

describe('Cross-site Scripting Test', function () {
  beforeEach(utils.beforeXss)
  afterEach(utils.afterEach)

  it('Load malicious document', function (done) {
    setTimeout(() => {
      this.app.client.getRenderProcessLogs()
        .then(function (logs) {
          const xssErrorCount = logs.filter(log => {
            return log.level === 'SEVERE' && /XSS/i.test(log.message) && log.source === 'javascript'
          }).length

          // This will result in a timeout when a test fails.
          expect(xssErrorCount).to.equal(0)
          done()
        })
    }, 3000)
  })
})
