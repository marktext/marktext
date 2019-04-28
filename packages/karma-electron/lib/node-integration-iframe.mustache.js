(function () {
  // Set up local filename, dirname, and `module.filename`
  // DEV: `__filename` would be a path to Electron since we are loading an HTTP URL
  //   /home/todd/github/karma-electron/node_modules/electron/dist/resources/electron.asar/renderer/init.js
  //   This overrides to user's expectations of Karma's `file://` filepaths
  // DEV: Ignore JSHint so we can override `__filename` in our closure
  // DEV: We use `window.require` sniffing to prevent emulating a Node.js environment in a non-Node.js one
  var __filename, __dirname;
  if (window.require) {
    // If we have a `__filename` override, then use it
    // DEV: To work around JSCS errors, we are using `if_`, `else_`, and `end_`
    // jscs:disable
    // jshint ignore:start
    {{if___filenameOverride}}
      __filename = '{{!__filenameOverride}}';
    {{end___filenameOverride}}
    // Otherwise, use `context.html` as our `__filename`
    {{notif___filenameOverride}}
      __filename = window.location.pathname !== '/debug.html' ? '{{!karmaContextFile}}' : '{{!karmaDebugFile}}';
    {{end___filenameOverride}}
    // jshint ignore:end
    // jscs:enable
    __dirname = window.require('path').dirname(__filename);
    if (window.module) {
      module.filename = __filename;
    }
  }

  // Save original require/require.resolve
  if (window.require) {
    var __require = window.require;
    var __requireResolve = __require.resolve;

    // Add our base directory as the path to find node modules from
    if (!window.__karmaBasePathAddedToModule) {
      module.paths = module.paths.concat(__require('module')._nodeModulePaths('{{!karmaBasePath}}'));
      window.__karmaBasePathAddedToModule = true;
    }

    // Define our patched require/require.resolve
    var __requireFilepath = function (filepath) {
      // If the filepath is relative, prepend the filename
      // e.g. `./submodule` -> `/home/todd/.../integration-test/./submodule`
      if (filepath && filepath[0] === '.') {
        filepath = __dirname + '{{!sep}}' + filepath;
      }

      // Return our filepath
      return filepath;
    };
    // Define our require/resolve.resolve
    window.require = function (filepath) {
      return __require(__requireFilepath(filepath));
    };
    window.require.resolve = function (filepath) {
      return __requireResolve(__requireFilepath(filepath));
    };
  }

  // If we want to require our content, then load it via `require`
  // DEV: To work around JSCS errors, we are using `if_`, `else_`, and `end_`
  // jscs:disable
  // jshint ignore:start
  {{if_loadScriptsViaRequire}}
    require('{{!filename}}');
  {{end_loadScriptsViaRequire}}
  // Otherwise, inject our content
  {{notif_loadScriptsViaRequire}}
    __CONTENT__
  {{end_loadScriptsViaRequire}}
  // jshint ignore:end
  // jscs:enable
}());
