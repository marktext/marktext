# Frequently Asked Questions (FAQ)

### What are the supported platforms?

MarkText is a desktop application and available for:

- Linux x64 and arm64 (arm64 release packages are available since 0.23.0)
- macOS 12 (Monterey) or later, x64 and arm64 (Apple Silicon)
- Windows x64 and arm64

The current Electron 42-based application requires macOS 12 or later. See the [Electron announcement removing macOS 11 support](https://www.electronjs.org/blog/electron-38-0).

### Is MarkText open-source and free?

Yes, MarkText is licensed under the [MIT](https://github.com/marktext/marktext/blob/develop/LICENSE) license and completely free for everyone. The source-code is available on [GitHub](https://github.com/marktext/marktext).

### Can I use MarkText as note management/taking app?

MarkText is a pure markdown editor without features such as knowledge management and tags but yes, you can do this via the integrated filesystem explorer and task lists.

### Where can I find documentation?

The full documentation is available on the MarkText website:

- [End-user documentation](../README.md)

- [Developer documentation](../dev/README.md)

### Can I run a portable version of MarkText?

Yes, please see [here](PORTABLE.md) for further information.

### How can I report bugs and problems?

You can report bugs and problems via our [GitHub issue tracker](https://github.com/marktext/marktext/issues). Please provide a detailed description of the problem to better solve the issue.

### I cannot launch MarkText on Linux (SUID sandbox)

If Chromium reports that its sandbox helper is not configured correctly, see the [Linux notes](LINUX.md). The cause and available remedies depend on the distribution, package format and system sandbox configuration.
