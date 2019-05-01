# karma-electron changelog
6.0.0 - Updated source map support to pass through original source map fully

5.3.0 - Upgraded to electron@1.8.4 to fix GitHub vulnerability warning

5.2.2 - Replaced Gratipay with support me page

5.2.1 - Upgraded to Node.js 4, 6, and 7 for CI

5.2.0 - Added support for `require` in main via @amireh in #23. Fixes #24

5.1.1 - Updated instructions to use `electron` not `electron-prebuilt` via @MLefebvreICO in #15

5.1.0 - Added support for `__filenameOverride`. Fixes #11

5.0.0 - Corrected `__filename`/`__dirname`/`module` inaccuracies between `karma-electron` and standalone Electron

4.1.3 - Upgraded to `jscs@3.0.7` and `jshint@2.9.3` to resolve lint errors

4.1.2 - Added reference application for default `electron` behavior

4.1.1 - Added requirements and notices to README. Fixes #13

4.1.0 - Added loading of `electron` package due to `electron-prebuilt` deprecation via @MLefebvreICO in #10

4.0.0 - Added submodules support by using local `require` and documenting `useIframe` usage (now supported by `karma@1.1.0` for Electron)

3.2.1 - Added configuration info to submodules documentation

3.2.0 - Added tolerance for EOF comments

3.1.1 - Added notice about submodule support

3.1.0 - Added support for source maps via @otbe in #4

3.0.5 - Upgraded to Electron@0.37.4 in development via @ppitonak in #1

3.0.4 - Added tests for Node.js@5 in Travis CI via @ppitonak in #1

3.0.3 - Added missing `test-karma-phantomjs` to `test-karma-all`

3.0.2 - Added tests to verify we don't pollute non-Node environments

3.0.1 - Fixed `xtend` dependency

3.0.0 - Moved from `framework` to `preprocessor` for better file-specific variable support (e.g. `__filename`, `__dirname`, `require`)

2.0.2 - Renamed package to `karma-electron`

2.0.1 - Repaired Appveyor failures

2.0.0 - Moved `files` hack to a framework implementation

1.1.0 - Added support for relative `require` and verified support for `module` properties

1.0.0 - Initial release
