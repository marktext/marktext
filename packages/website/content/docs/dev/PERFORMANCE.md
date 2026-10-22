# Performance Testing

Profile the main process and renderer separately. Preload runs inside a renderer process; it is an execution context rather than a third operating-system process.

Run commands from the repository root and record the commit, operating system, architecture and document size alongside your measurements.

## Main process

The root scripts build and launch the application with a main-process inspector:

```sh
pnpm run perf:inspect-brk
```

This forwards `--inspect-brk=5858` to Electron. Open `chrome://inspect`, configure `localhost:5858`, attach to the main process and start recording before resuming execution. Use `pnpm run perf:inspect` to launch without the initial pause.

Both scripts run `electron-vite preview`, which rebuilds by default in electron-vite 5. To reuse a specific build:

```sh
pnpm run build:unpack
pnpm -C packages/desktop exec electron-vite preview --skipBuild -- --inspect-brk=5858
```

## Renderer

For development profiling with an explicit renderer debugging port:

```sh
pnpm -C packages/desktop exec electron-vite --remoteDebuggingPort 8315
```

Attach to the renderer through `chrome://inspect` at `localhost:8315`, then use the Performance panel to record an interaction or reload. Development tools are also available from the View menu in debug mode.

For an unpackaged production bundle, build first and forward the debug arguments explicitly:

```sh
pnpm run build:unpack
pnpm -C packages/desktop exec electron-vite preview --skipBuild -- --remote-debugging-port=8315 --debug
```

`--debug` enables MarkText's debug menu in this production preview. See [Debugging](DEBUGGING.md) for packaged installer restrictions and VS Code attachment.
