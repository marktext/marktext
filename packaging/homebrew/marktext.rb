# typed: strict
# frozen_string_literal: true

# Experimental Homebrew on Linux formula template for a future MarkText tap.
# Replace the URL and checksum after publishing a tagged Linux release artifact.
class Marktext < Formula
  desc "Simple and elegant open-source Markdown editor"
  homepage "https://github.com/marktext/marktext"
  url "https://github.com/marktext/marktext/releases/download/v0.18.9/marktext-linux-0.18.9.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"

  depends_on "alsa-lib"
  depends_on arch: :x86_64
  depends_on "cups"
  depends_on "gtk+3"
  depends_on "hicolor-icon-theme"
  depends_on "libsecret"
  depends_on "libx11"
  depends_on "libxkbfile"
  depends_on :linux
  depends_on "nss"

  def install
    app_dir = Pathname.glob("*").find { |path| path.directory? && (path/"marktext").executable? }
    odie "Could not find the unpacked MarkText Linux application" if app_dir.nil?

    libexec.install app_dir.children
    bin.write_exec_script libexec/"marktext"

    (share/"applications").install_symlink libexec/"resources/app.asar.unpacked/resources/linux/marktext.desktop" if
      (libexec/"resources/app.asar.unpacked/resources/linux/marktext.desktop").exist?
  end

  def caveats
    <<~EOS
      This formula installs MarkText from the Linux release tarball and creates:
        #{opt_bin}/marktext

      The existing Homebrew cask `mark-text` is macOS-only and is separate from
      this Linux formula template.
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/marktext --version")
  end
end
