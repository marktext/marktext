# Debugging

Use an unpackaged development or preview build when attaching a debugger. Run the commands below from the repository root.

## Main and renderer debugging

Launch electron-vite with explicit inspector ports:

```sh
pnpm -C packages/desktop exec electron-vite --sourcemap --inspect 5858 --remoteDebuggingPort 8315
```

Open `chrome://inspect`, configure `localhost:5858` and `localhost:8315`, then select the main-process or renderer target. Use `--inspectBrk 5858` instead of `--inspect 5858` to pause the main process before startup code executes.

The ordinary `pnpm run dev` command does not explicitly enable those ports. The renderer also has built-in developer tools, available through the View menu in debug mode.

## Production bundle debugging

Compile first, then preview the existing output:

```sh
pnpm run build:unpack
pnpm -C packages/desktop exec electron-vite preview --skipBuild -- --inspect=5858
```

The command above launches the existing bundles and forwards `--inspect=5858` to Electron. Use `--inspect-brk=5858` to pause before execution. The root `perf:inspect` and `perf:inspect-brk` scripts omit `--skipBuild`, so they rebuild before launch. See [Performance testing](PERFORMANCE.md).

Installer builds set `electronFuses.enableNodeCliInspectArguments: false` in `packages/desktop/electron-builder.yml`. The packaged executable therefore does not offer the same Node inspector workflow through `--inspect` or `--inspect-brk`. Use the unpackaged build above to investigate main-process code.

## Visual Studio Code

Attach VS Code's built-in JavaScript debugger to the explicit main-process port (`5858`). For renderer debugging, attach a browser debugger to port `8315` and use `packages/desktop/src/renderer` as the source root.

The checked-in `.vscode/launch.json` contains older launch paths and a renderer port of `9222`; reconcile its paths and ports before using it with the current workspace. The command-line workflow above avoids depending on that launch configuration.

## Startup profiling

In Chrome DevTools, record a main-process CPU profile or renderer Performance trace while launching or reloading the application. For startup measurements, build once and reuse the same preview build. Record the operating system, architecture, application commit and document size so results can be compared.
