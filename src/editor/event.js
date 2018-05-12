import mousetrap from 'mousetrap'
import { getUniqueId } from './utils'

class EventCenter {
  constructor () {
    this.events = []
    this.listeners = {}
    // bind mousetrap methods to event instance.
    ;['bind', 'unbind', 'trigger', 'stopCallback', 'reset', 'handleKey', 'addKeycodes'].forEach(method => {
      this[method] = mousetrap[method]
    })
  }
  /**
   * [attachDOMEvent] bind event listener to target, and return a unique ID,
   * this ID
   */
  attachDOMEvent (target, event, listener, capture) {
    if (this.checkHasBind(target, event, listener, capture)) return false
    const eventId = getUniqueId()
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
   * [subscribe] subscribe custom event
   */
  subscribe (event, listener) {
    const eventListener = this.listeners[event]
    if (eventListener && Array.isArray(eventListener)) {
      eventListener.push(listener)
    } else {
      this.listeners[event] = [listener]
    }
  }
  /**
   * dispatch custom event
   */
  dispatch (event, ...data) {
    const eventListener = this.listeners[event]
    if (eventListener && Array.isArray(eventListener)) {
      eventListener.forEach(listener => listener(...data))
    }
  }
  // Determine whether the event has been bind
  checkHasBind (cTarget, cEvent, cListener, cCapture) {
    for (const { target, event, listener, capture } of this.events) {
      if (target === cTarget && event === cEvent && listener === cListener && capture === cCapture) {
        return true
      }
    }
    return false
  }
}

export default EventCenter
