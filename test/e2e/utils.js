import electron from 'electron'
import { Application } from 'spectron'

export default {
  afterEach () {
    this.timeout(30000)

    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  },
  beforeEach () {
    this.timeout(30000)
    this.app = new Application({
      path: electron,
      args: ['dist/electron/main.js'],
      startTimeout: 30000,
      waitTimeout: 30000
    })

    return this.app.start()
  }
}
