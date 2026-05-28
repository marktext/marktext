# Performance Testing

- We mainly rely on Chrome's `Performance` tab to analyse and record the performance of MarkText

- Electron is split into 3 processes: `main`, `preload` and `renderer`. We will be focusing on `main` and `renderer` since these are the heaviest

## 1. Testing `main` process

```
pnpm run perf:inspect-brk
```

- This launches a **production build** of Marktext that has a break-point **before** the first line of Javascript is ran

- A debugger at port `5858` is also attached

## 1.1 Navigate to Chrome Inspect

- Go to `chrome://inspect`

- Press `Configure`, and add `localhost:5858`

- Press "Inspect" on the entry that appears below (might take a while)

## 1.2 Record Performance

- When Developers Tools first launches, you will notice the breakpoint that is set

- Simply go to `Performance`, press `Record`, and wait for MarkText to launch fully, then Stop the recording

## 1.3 Alternative: `inspect`

- If you do not need the breakpoint to test start-up performance, simply run:

```
pnpm run perf:inspect
```

# 2. Testing `renderer`

```
pnpm run start
```

- This previews the most recent `pnpm run build` output via `electron-vite preview` with `PERF_TESTING=true` (so it behaves like a production launch). It does **not** rebuild — re-run `pnpm run build:unpack` first if your sources changed.

- Press `F12` to open Dev Tools and press `Reload and Record` to benchmark start-up render performance






