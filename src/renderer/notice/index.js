import bus from '../bus'
import { getIdWithoutSet } from '../../editor/utils'

export const error = msg => {
  bus.$emit('status-error', msg)
}

export const message = (msg, timeout) => {
  bus.$emit('status-message', msg, timeout)
}

export const promote = msg => {
  const eventId = getIdWithoutSet()
  bus.$emit('status-promote', msg, eventId)

  return new Promise((resolve, reject) => {
    bus.$on(eventId, bool => {
      bool ? resolve() : reject(bool) // reject bool just for fix the esint error: `prefer-promise-reject-errors`
    })
  })
}
