import utils from '../utils'

describe('Launch', function () {
  beforeEach(utils.beforeEach)
  afterEach(utils.afterEach)

  it('shows the proper application title', function () {
    return this.app.client.getTitle()
      .then(title => {
        const result = /^Mark Text|Untitled-1$/.test(title)
        if (!result) {
          console.error(`AssertionError: expected '${title}' to equal 'Mark Text' or 'Untitled-1'`)
          expect(false).to.equal(true)
        }
      })
  })
})
