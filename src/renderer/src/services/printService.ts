import { getImageInfo } from 'muya/lib/utils'

class MarkdownPrint {
  private container: HTMLElement | null = null

  /**
   * Prepare document export and append a hidden print container to the window.
   * Everything outside of this hidden print container will be hidden with display: none.
   *
   * @param html HTML string
   * @param renderStatic Render for static files like PDF documents
   */
  renderMarkdown(html: string, renderStatic?: boolean): void {
    this.clearup()
    const printContainer = document.createElement('article')
    printContainer.classList.add('print-container')
    this.container = printContainer
    printContainer.innerHTML = html

    // Fix images when rendering for static files like PDF (GH#678).
    if (renderStatic) {
      // Traverse through the DOM tree and fix all relative image sources.
      const images = printContainer.getElementsByTagName('img')
      for (const image of Array.from(images)) {
        const rawSrc = image.getAttribute('src') ?? ''
        image.src = getImageInfo(rawSrc).src
      }
    }

    document.body.appendChild(printContainer)
  }

  /**
   * Remove the print container from the window.
   */
  clearup(): void {
    if (this.container) {
      this.container.remove()
    }
  }
}

export default MarkdownPrint
