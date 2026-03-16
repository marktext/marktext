# Windows Installer Build Script Requirements

## Goal

Create a new Windows batch file for generating an installer build.

This is separate from the existing unpacked build script:

- Existing script: [tools/build-win.cmd](/C:/Users/StormSrain/Documents/LifeStorage/repo/marktext/tools/build-win.cmd)
- That script must remain focused on `win-unpacked` only.

The new script is for installer output only.

## Required Deliverable

Create a separate batch file:

- `tools/build-win-installer.cmd`

Do not replace or repurpose `tools/build-win.cmd`.

## Functional Requirements

The new script must:

1. Run from anywhere and switch to the repository root automatically.
2. Build the Electron app before packaging.
3. Generate a Windows installer for `x64`.
4. Target NSIS installer output.
5. Exit with the actual failing exit code if any step fails.

## Output Expectations

Primary expected artifact:

- `build/marktext-setup.exe`

Allowed secondary files if electron-builder emits them automatically:

- `build/marktext-setup.exe.blockmap`
- `build/latest.yml`
- `build/builder-debug.yml`
- `build/win-unpacked`

Not desired as final distributables from this script:

- `build/marktext-x64-win.zip`
- `build/marktext-ia32-win.zip`
- `build/win-ia32-unpacked`

If possible, the script should avoid generating those non-installer artifacts entirely.

## Behavior Constraints

- Keep the current unpacked-only workflow untouched.
- Do not modify the default install location behavior.
- Do not introduce interactive prompts.
- Do not require manual parameter input.
- Do not change existing package scripts unless strictly necessary.

## Default Install Location

The installer should preserve the current NSIS user-scope install behavior.

Expected default install directory:

- `C:\Users\<username>\AppData\Local\Programs\MarkText`

This comes from the current Electron Builder / NSIS configuration where installation is not per-machine.

## Implementation Notes

The script can call either:

- `yarn release:win` with adjusted targeting, or
- `node .electron-vue/build.js` followed by a direct `electron-builder` call

Direct `electron-builder` invocation is acceptable if it keeps outputs limited to installer-related artifacts.

## Acceptance Criteria

The work is complete when all of the following are true:

1. `tools/build-win-installer.cmd` exists.
2. Running it from the repo root succeeds on Windows.
3. It produces `build/marktext-setup.exe`.
4. It does not produce zip artifacts.
5. `tools/build-win.cmd` still produces unpacked output only.

## Nice To Have

- A short comment at the top of each BAT describing its purpose:
  - `build-win.cmd`: unpacked local build
  - `build-win-installer.cmd`: installer build

