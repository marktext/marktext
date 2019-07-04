const easeInOutQuad = (time, start, change, duration) => {
  time /= duration / 2
  if (time < 1) {
    return change / 2 * time * time + start
  }

  time--
  return -change / 2 * (time * (time - 2) - 1) + start
}

const validatePositiveNumber = (number, name) => {
  if (typeof number !== 'number' || isNaN(number)) {
    throw new Error(`${name} should be a number`)
  }
  if (number < 0) {
    throw new Error(`${name} should be greater than or equal to zero`)
  }
}

export default class AnimatedScroll {
  constructor (element, options = {}) {
    if (!element) {
      throw new Error('provide a DOM element')
    }

    if (typeof element !== 'object' || typeof element.nodeName !== 'string') {
      throw new Error('the element should be a DOM element')
    }

    this.element = element

    const timeIncrement = options.timeIncrement
    if (typeof timeIncrement !== 'undefined') {
      validatePositiveNumber(timeIncrement, 'the timeIncrement option')
      this.timeIncrement = timeIncrement
    } else {
      this.timeIncrement = 20
    }

    const duration = options.duration
    if (typeof duration !== 'undefined' && duration !== false) {
      validatePositiveNumber(duration, 'the duration option')
      this.duration = duration
    } else {
      this.duration = 400
    }

    const easing = options.easing
    if (typeof easing !== 'undefined') {
      if (typeof easing !== 'function') {
        throw new Error('the easing option should be a function')
      }
      this.easing = easing
    } else {
      this.easing = easeInOutQuad
    }
  }

  _scroll (direction, offset, duration = this.duration, easing = this.easing) {
    return new Promise((resolve) => {
      validatePositiveNumber(offset, direction)

      if (duration !== false) {
        validatePositiveNumber(duration, 'duration')
      }
      if (typeof easing !== 'function') {
        throw new Error('easing should be a function')
      }

      let elementProperty
      let animationProperty
      if (direction === 'top') {
        elementProperty = 'scrollTop'
        animationProperty = 'topAnimation'

        this.stopTop()
      } else {
        elementProperty = 'scrollLeft'
        animationProperty = 'topAnimation'

        this.stopLeft()
      }

      offset = parseFloat(offset)
      if (!duration) {
        this.element[elementProperty] = offset
        return resolve(this.element[elementProperty])
      }

      // based on http://stackoverflow.com/a/16136789/1004406
      const start = this.element[elementProperty]
      const change = offset - start
      const timeIncrement = this.timeIncrement

      duration = parseInt(duration, 10) // you want to use radix 10
      // so you get a decimal number even with a leading 0 and an old browser ([IE8, Firefox 20, Chrome 22 and older][1])

      let currentTime = 0
      const animate = () => {
        currentTime += timeIncrement

        const newValue = easing(currentTime, start, change, duration)
        try {
          validatePositiveNumber(newValue)
        } catch (e) {
          this._stop(direction) // TODO: ensure this is tested
          e.message += ' (check your easing function)'
          throw e
        }

        this.element[elementProperty] = newValue

        if (currentTime < duration) {
          this[animationProperty] = requestAnimationFrame(
            animate,
            timeIncrement
          )
        } else {
          resolve(this.element[elementProperty])
        }
      }
      animate()
    })
  }

  top (top, duration, easing) {
    return this._scroll('top', top, duration, easing)
  }

  left (left, duration, easing) {
    return this._scroll('left', left, duration, easing)
  }

  to ({ top, left }, duration, easing) {
    if (top === undefined) {
      return this.left(left, duration, easing)
    }

    if (left === undefined) {
      return this.top(top, duration, easing)
    }

    return Promise.all([
      this.top(top, duration, easing),
      this.left(left, duration, easing)
    ])
      .then(([top, left]) => ({ top, left }))
  }

  _stop (direction) {
    const animation = direction === 'top' ?
      this.topAnimation :
      this.leftAnimation

    if (animation) {
      cancelAnimationFrame(animation)
    }
  }

  stopTop () {
    return this._stop('top')
  }

  stopLeft () {
    return this._stop('left')
  }

  stop () {
    this.stopTop()
    this.stopLeft()
  }
}
