// Based on https://github.com/microsoft/vscode/blob/main/src/vs/platform/files/common/watcher.ts under MIT license.
//
// MIT License
//
// Copyright (c) 2015 - present Microsoft Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import path from 'path'
import { WATCHER_CHANGE_TYPE } from 'common/filesystem/watcher'
import { isLinux } from '../../config'

/**
 * Given events that occurred, applies some rules to normalize the events
 */
export const normalizeFileChanges = changes => {
  // Build deltas
  const normalizer = new EventNormalizer()
  for (let i = 0; i < changes.length; i++) {
    const event = changes[i]
    normalizer.processEvent(event)
  }
  return normalizer.normalize()
}

const startsWithIgnoreCase = (str, candidate) => {
  if (candidate.length > str.length) {
    return false
  }
  return str.toLowerCase().startsWith(candidate.toLowerCase())
}

const isParent = (p, candidate, ignoreCase) => {
  if (!p || !candidate || p === candidate) {
    return false
  }

  if (candidate.length > p.length) {
    return false
  }

  if (candidate.charAt(candidate.length - 1) !== path.sep) {
    candidate += path.sep
  }

  if (ignoreCase) {
    return startsWithIgnoreCase(p, candidate)
  }

  return p.indexOf(candidate) === 0
}

class EventNormalizer {
  constructor () {
    this.normalized = new Set()
    this.mapPathToChange = new Map()
  }

  toKey (event) {
    if (isLinux) {
      return event.path
    }
    return event.path.toLowerCase() // normalise to file system case sensitivity
  }

  processEvent (event) {
    let existingEvent = this.mapPathToChange.get(this.toKey(event))

    let keepEvent = false

    // Event path already exists
    if (existingEvent) {
      const currentChangeType = existingEvent.type
      const newChangeType = event.type

      // macOS/Windows: track renames to different case but
      // same name by changing current event to DELETED
      // this encodes some underlying knowledge about the
      // file watcher being used by assuming we first get
      // an event for the CREATE and then an event that we
      // consider as DELETE if same name / different case.
      if (existingEvent.path !== event.path && event.type === WATCHER_CHANGE_TYPE.DELETED) {
        keepEvent = true
      }

      if (currentChangeType === WATCHER_CHANGE_TYPE.ADDED && newChangeType === WATCHER_CHANGE_TYPE.DELETED) {
        // Ignore CREATE followed by DELETE in one go
        this.mapPathToChange.delete(this.toKey(event))
        this.normalized.delete(existingEvent)
      } else if (currentChangeType === WATCHER_CHANGE_TYPE.DELETED && newChangeType === WATCHER_CHANGE_TYPE.ADDED) {
        // Flatten DELETE followed by CREATE into CHANGE
        existingEvent.type = WATCHER_CHANGE_TYPE.UPDATED
        existingEvent.mtime = event.mtime
      } else if (currentChangeType === WATCHER_CHANGE_TYPE.ADDED && newChangeType === WATCHER_CHANGE_TYPE.UPDATED) {
        // Do nothing. Keep the created event
      } else {
        // Otherwise apply change type
        existingEvent.type = newChangeType
        existingEvent.mtime = event.mtime
      }
    } else {
      // Otherwise Store
      keepEvent = true
    }

    if (keepEvent) {
      this.normalized.add(event)
      this.mapPathToChange.set(this.toKey(event), event)
    }
  }

  normalize () {
    let addOrChangeEvents = []
    let deletedPaths = []

    // This algorithm will remove all DELETE events up to the root folder
    // that got deleted if any. This ensures that we are not producing
    // DELETE events for each file inside a folder that gets deleted.
    //
    // 1.) split ADD/CHANGE and DELETED events
    // 2.) sort short deleted paths to the top
    // 3.) for each DELETE, check if there is a deleted parent and ignore the event in that case

    const deleted = Array.from(this.normalized).filter(e => {
      if (e.type !== WATCHER_CHANGE_TYPE.DELETED) {
        addOrChangeEvents.push(e)
        return false // remove ADD / CHANGE
      }

      return true // keep DELETE
    })
    const shortestFirst = deleted.sort((e1, e2) => {
      return e1.path.length - e2.path.length // shortest path first
    })
    const parentsWithoutChildren = shortestFirst.filter(e => {
      if (deletedPaths.some(deletedPath => isParent(e.path, deletedPath, !isLinux /* ignorecase */))) {
        return false // DELETE is ignored if parent is deleted already
      }

      // otherwise mark as deleted
      deletedPaths.push(e.path)

      return true
    })

    return [...parentsWithoutChildren, ...addOrChangeEvents]
  }
}
