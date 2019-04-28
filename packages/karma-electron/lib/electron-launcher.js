// When we run into an uncaught exception, fail hard
// DEV: Without this line, Karma can hang indefinitely
process.on('uncaughtException', function handleUncaughtException (err) {
  throw err;
});

// Load in our dependencies
var assert = require('assert');
var path = require('path');
var app = require('electron').app;
var BrowserWindow = require('electron').BrowserWindow;
var program = require('commander');

// Set up our CLI parser
program.name = 'electron-launcher';
program.option('--user-data-dir [dir]', 'Directory to store user data');
program.option('--show', 'Boolean to make the window visible', false);
program.option('--url [url]', 'URL to load page at');
program.option('--require [filepath]', 'Path to main process file to require');
program.allowUnknownOption();

// Parse and assert our arguments
program.parse(process.argv);
assert(program.userDataDir, 'Expected `--user-data-dir` to be provided but it was not.');
assert(program.url, 'Expected `--url` to be provided but it was not.');

// When all windows are closed, exit out
app.on('window-all-closed', function handleWindowsClosed () {
  app.quit();
});

// Update `userData` before Electron loads
// DEV: This prevents cookies/localStorage from contaminating across apps
app.setPath('userData', program.userDataDir);

// If we have another file to require, then load it
// DEV: We use `path.resolve` to resolve relative paths from working directory
//   Otherwise, a `require('./foo')` would load relative to this file
if (program.require) {
  require(path.resolve(program.require));
}

// When Electron is done loading, launch our applicaiton
app.on('ready', function handleReady () {
  // Create our browser window
  var browserWindow = new BrowserWindow({
    show: !!program.show,
    webPreferences: {
      nodeIntegration: true
    }
  });
  browserWindow.loadURL(program.url, {
    // Set a custom User-Agent for better logging
    // https://github.com/atom/electron/blob/v0.36.9/docs/api/browser-window.md#winloadurlurl-options
    // https://github.com/atom/electron/blob/v0.36.9/docs/api/web-contents.md#webcontentsloadurlurl-options
    // DEV: Default would be "Chrome 47.0.2526 (Linux 0.0.0)"
    //   https://github.com/karma-runner/karma/blob/v0.13.21/lib/browser.js#L25
    //   https://github.com/karma-runner/karma/blob/v0.13.21/lib/helper.js#L7-L11
    // Example: Electron 0.36.9 (Node.js 5.1.1)
    userAgent: 'Electron ' + process.versions.electron + ' (Node ' + process.versions.node + ')'
  });
});
