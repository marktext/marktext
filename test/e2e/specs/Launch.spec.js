import utils from '../utils'

describe('Launch', function () {
  beforeEach(utils.beforeEach)
  afterEach(utils.afterEach)

  it('shows the proper application title', function () {
    return this.app.client.getTitle()
      .then(title => {
        const expectedTitle = process.platform === 'darwin' ? 'Mark Text' : 'Untitled-1'
        expect(title).to.equal(expectedTitle)
      })
  })
})
