# Debugging

## Use Visual Studio Code

The most simplest way is to debug using the `Debug MarkText` configuration. You can set breakpoints and use the `debugger` statement.

**Prerequisites:**

- [Debugger for Chrome](https://marketplace.visualstudio.com/itemdetails?itemName=msjsdiag.debugger-for-chrome)

## Use Chrome Developer Tools

You can use the built-in developer tools via `View -> Toggle Developer Tools` in debug mode or connect via `chrome://inspect` using port `5858` for the main process and `8315` for the renderer process when launched via `yarn run dev`.

### Debug built application

You can use the default Electron command-line parameters to enable debug mode as described above.

```shell
$ marktext --inspect=5858 --remote-debugging-port=8315
```

## Debug slow startup performance

Regardless of whether you are using the built or development version, you can use the [node-profiler](https://github.com/fxha/node-profiler) to analysis startup issues. Please follow the tool description for setup. Afterwards, launch the following commands in parallel (e.g. use three terminal windows and launch MarkText last).

```shell
$ node-profiler main
$ node-profiler renderer
$ marktext --inspect=5858 --remote-debugging-port=8315
```

After the successful launch of MarkText, press `Ctrl+C` on both `node-profiler` instances. The tools created two files named `main.cpuprofile` and `renderer.cpuprofile`. You can now analyse these files via *Chrome Developer Tools* or *Visual Studio Code*.
