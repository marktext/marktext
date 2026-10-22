class MarkdownPrint {
  private container: HTMLElement | null = null

  /**
   * Prepare document export and append a hidden print container to the window.
   * Everything outside of this hidden print container will be hidden with display: none.
   *
   * @param html HTML string from `exportStyledHTML`, whose local images the
   *   engine has already resolved to `file://` URLs (GH#678).
   * @param dir Text direction to mirror onto the container. `innerHTML` drops
   *   the exporter's outer `<html dir=…>` shell and the container is a sibling
   *   of `.editor-wrapper`, so RTL documents print LTR unless we set it here
   *   (#4833). LTR is the default and stays implicit.
   */
  async renderMarkdown(html: string, dir?: string): Promise<void> {
    this.clearup()
    const printContainer = document.createElement('article')
    printContainer.classList.add('print-container')
    if (dir === 'rtl' || dir === 'auto') {
      printContainer.setAttribute('dir', dir)
    }
    this.container = printContainer
    printContainer.innerHTML = html

    document.body.appendChild(printContainer)
    // The print container is hidden on screen, so layout does not request its fonts.
    await Promise.all([
      document.fonts.load('16px "Noto Music"', '𝅗𝅥𝅘𝅥𝅯'),
      document.fonts.load('16px "Noto Sans Math"', '⏜⏝')
    ])
    await document.fonts.ready
  }

  clearup(): void {
    if (this.container) {
      this.container.remove()
    }
  }
}

export default MarkdownPrint
