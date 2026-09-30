# Homebrew on Linux

This directory contains an experimental formula template for publishing MarkText through a custom Homebrew tap on Linux.

It is not an official distribution channel yet. Do not publish it as-is: update the formula after a tagged release has a Linux `tar.gz` artifact, replace the placeholder checksum, and test the result with Homebrew on Linux.

The formula intentionally uses the Linux release archive instead of a cask. Homebrew casks are for macOS application bundles in this project, while Homebrew on Linux should install a Linux artifact or build from source.

Before publishing:

1. Create and push a release tag.
2. Confirm the release uploads `marktext-linux-<version>.tar.gz`.
3. Replace the formula `url` and `sha256` for that release.
4. Copy `marktext.rb` into the tap's `Formula/` directory.
5. Run:

   ```bash
   brew style packaging/homebrew/marktext.rb
   brew audit --strict --online <tap>/marktext
   brew install <tap>/marktext
   brew test <tap>/marktext
   ```

Source builds from `develop` are deliberately not used here. They require a full pnpm/Electron build and network downloads during installation, which is too heavy and fragile for a first Homebrew packaging path.
