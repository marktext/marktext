// Load in our dependencies
var app = require('electron').app;
var BrowserWindow = require('electron').BrowserWindow;

// When all windows are closed, exit out
app.on('window-all-closed', function handleWindowsClosed () {
  app.quit();
});

// When Electron is done loading, launch our applicaiton
app.on('ready', function handleReady () {
  // Open our webpage
  var browserWindow = new BrowserWindow();
  browserWindow.loadURL('file://' + __dirname + '/index.html');

  // Open DevTools automatically
  browserWindow.webContents.openDevTools({detach: true});
});
