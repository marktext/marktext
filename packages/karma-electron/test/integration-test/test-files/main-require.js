// Load in our dependencies
var ipcMain = require('electron').ipcMain;

// When we receive a sync message, reply to it immediately
ipcMain.on('sync-message', function handleSyncMessage (event, message) {
  event.returnValue = 'pong';
});
