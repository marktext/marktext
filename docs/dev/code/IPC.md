# Inter-Process Communication (IPC)

[Electron](https://electronjs.org/docs/api/ipc-main) provides `ipcMain` and `ipcRenderer` to communicate asynchronously between the main process and renderer processes. The event name/channel must be prefixed with `mt::` if used between main process and renderer processes. The default argument list will be `(event, ...args)`. The event name/channel is not prefixed when using `ipcMain` to emit events to the main process directly and emitted events don't have an `event` parameter. The parameter list will only be `(...args)`! When simulate a renderer event you must specify a [event](https://electronjs.org/docs/api/ipc-main#event-object) parameter (`null` or `undefined` may lead to unexpected exceptions).

## Examples

Listening to a renderer event in the main process:

```js
import { ipcMain } from 'electron'

// Listen for renderer events
ipcMain.on('mt::some-event-name', (event, arg1, arg2) => {
  // ...

  // Send a direct response to the renderer process
  event.sender.send('mt::some-event-name-response', 'pong')
})

// Listen for main events
ipcMain.on('some-event-name', (arg1, arg2) => {
  // ...
})


ipcMain.emit('some-event-name', 'arg 1', 'arg 2')
// ipcMain.emit('mt::some-event-name-response', undefined, 'arg 1', 'arg 2') // crash because event is used
```

Listening to a main event in the renderer process:

```js
import { ipcRenderer } from 'electron'

// Listen for main events
ipcRenderer.on('mt::some-event-name-response', (event, arg1, arg2) => {
  // ...
})

ipcRenderer.send('mt::some-event-name-response', 'arg 1', 'arg 2')
```
