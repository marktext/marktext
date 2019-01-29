import { getUniqueId } from '../utils'

class EventCenter {
  constructor () {
    this.events = []
    this.listeners = {}
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
  }
  /**
   * inner method for subscribe and subscribeOnce
   */
  _subscribe (event, listener, once = false) {
    const listeners = this.listeners[event]
    const handler = { listener, once }
    if (listeners && Array.isArray(listeners)) {
      listeners.push(handler)
    } else {
      this.listeners[event] = [ handler ]
    }
  }
  /**
   * [subscribe] subscribe custom event
   */
  subscribe (event, listener) {
    this._subscribe(event, listener)
  }
  /**
   * [unsubscribe] unsubscribe custom event
   */
  unsubscribe (event, listener) {
    const listeners = this.listeners[event]
    if (Array.isArray(listeners) && listeners.find(l => l.listener === listener)) {
      const index = listeners.findIndex(l => l.listener === listener)
      listeners.splice(index, 1)
    }
  }
  /**
   * [subscribeOnce] usbscribe event and listen once
   */
  subscribeOnce (event, listener) {
    this._subscribe(event, listener, true)
  }
  /**
   * dispatch custom event
   */
  dispatch (event, ...data) {
    const eventListener = this.listeners[event]
    if (eventListener && Array.isArray(eventListener)) {
      eventListener.forEach(({ listener, once }) => {
        listener(...data)
        if (once) {
          this.unsubscribe(event, listener)
        }
      })
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
