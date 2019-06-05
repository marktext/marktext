# Debugging

## Using Visual Studio Code

The most simplest way is to debug using the `Debug Mark Text` configuration. You can set breakpoints and use the `debugger` statement.

**Prerequisites:**

- [Debugger for Chrome](https://marketplace.visualstudio.com/itemdetails?itemName=msjsdiag.debugger-for-chrome)

## Using Chrome Developer Tools

You can use the built-in developer tools via `View -> Toggle Developer Tools` in debug mode or connect via `chrome://inspect` using port `5861` for the main process and `8315` for the renderer process (`npm run dev`).
