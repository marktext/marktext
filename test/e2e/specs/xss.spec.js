import utils from '../utils'

describe('Cross-site Scripting Test', function () {
  beforeEach(utils.beforeXss)
  afterEach(utils.afterEach)

  it('Load malicious document', function () {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, 3000)
    })
      .then(() => {
        return this.app.client.getRenderProcessLogs()
          .then(function (logs) {
            const xssErrorCount = logs.filter(log => {
              return log.level === 'SEVERE' && /XSS/i.test(log.message) && log.source === 'javascript'
            }).length
            expect(xssErrorCount).to.equal(0)
          })
      })
  })
})
