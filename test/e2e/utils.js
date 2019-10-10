import electron from 'electron'
import { Application } from 'spectron'

export default {
  afterEach () {
    this.timeout(25000)

    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  },
  beforeEach () {
    this.timeout(25000)
    this.app = new Application({
      path: electron,
      args: ['dist/electron/main.js'],
      startTimeout: 25000,
      waitTimeout: 25000
    })
    return this.app.start()
  },
  beforeXss () {
    this.timeout(25000)
    this.app = new Application({
      path: electron,
      args: ['dist/electron/main.js', 'test/e2e/data/xss.md'],
      startTimeout: 25000,
      waitTimeout: 25000
    })
    return this.app.start()
  }
}
