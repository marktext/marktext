// Load in our dependencies
var assert = require('assert');
var ipcRenderer = require('electron').ipcRenderer;

// Start our tests
describe('A Karma configuration using a `require` file', function () {
  it('allows IPC binding', function () {
    var retVal = ipcRenderer.sendSync('sync-message', 'ping');
    assert.strictEqual(retVal, 'pong');
  });
});
