import mousetrap from 'mousetrap'
import {
  getUniqueId
} from './utils'

class Event {
  constructor () {
    this.events = []
    this.listeners = {}
    this.eventIds = new Set() // use to store eventId
    // bind mousetrap methods to event instance.
    ;['bind', 'unbind', 'trigger', 'stopCallback', 'reset', 'handleKey', 'addKeycodes'].forEach(mothod => {
      this[mothod] = mousetrap[mothod]
    })
  }
  /**
   * [attachDOMEvent] bind event listener to target, and return a unique ID,
   * this ID
   */
  attachDOMEvent (target, event, listener, capture) {
    if (this.checkHasBind(target, event, listener, capture)) return false
    const eventId = getUniqueId(this.eventIds)
    target.addEventListener(event, listener, capture)
    this.events.push({
      eventId,
      target,
      event,
      listener,
      capture
    })
    return eventId
  }
  /**
   * [detachDOMEvent removeEventListener]
   * @param  {[type]} eventId [unique eventId]
   */
  detachDOMEvent (eventId) {
    if (!eventId) return false
    const removeEvent = this.events.filter(e => e.eventId === eventId)[0]
    if (removeEvent) {
      const { target, event, listener, capture } = removeEvent
      target.removeEventListener(event, listener, capture)
    }
  }
  /**
   * [detachAllDomEvents remove all the DOM events handler]
   */
  detachAllDomEvents () {
    this.events.forEach(event => this.detachDOMEvent(event.eventId))
    this.reset()
  }
  /**
   * [subscribe] subscribe custom event one event one listener, old listener will be rewrite by new one.
   * so you should add only one listener to custom event.
   */
  subscribe (event, listener) {
    this.listeners[event] = listener
  }
  /**
   * dispatch custom event: custom event shoud only has **one** listener.
   * customEvent includes: {
   *   'markedTextChange',
   *   'paragraphChange',
   *   'arrow',
   *   'elementUpdate': 'update `p` elementNode to other elementNode. ex: `h1`, `ul-li`, `blockquote` or reversed'
   *   'enter',
   *   'delete',
   *   'tab',
   *   'backspace', 'paragraphBlur'
   * }
   * return a Promise resolve the listener result.
   */
  dispatch (event, ...data) {
    const eventListener = this.listeners[event]
    if (eventListener) {
      return Promise.resolve(eventListener(...data))
    } else {
      return Promise.reject(`${event} custom event does not created.`) // eslint-disable-line prefer-promise-reject-errors
    }
  }
  // Determine whether the event has been bind
  checkHasBind (cTarget, cEvent, cListener, cCapture) {
    let i
    let len = this.events.length
    for (i = 0; i < len; i++) {
      const { target, event, listener, capture } = this.events[i]
      if (target === cTarget && event === cEvent && listener === cListener && capture === cCapture) {
        return true
      }
    }
    return false
  }
}

export default Event
