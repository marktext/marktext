import { resolveLocalImageSrc } from '../util/resolveImageSrc'

class MarkdownPrint {
  private container: HTMLElement | null = null
  private injectedStyles: HTMLStyleElement[] = []

  /**
   * Prepare document export and append a hidden print container to the window.
   * Everything outside of this hidden print container will be hidden with display: none.
   *
   * `html` may be either a body-only HTML fragment (legacy callers) or a full
   * `<!DOCTYPE html>` document produced by `exportStyledHTML`. When a full
   * document is detected, the `<head>` stylesheets are extracted and injected
   * into the current page's `<head>` so they apply during `printToPDF`, and
   * only the `<body>` content is placed into the print container. This avoids
   * the browser silently stripping `<html>`/`<head>`/`<body>` wrapper tags
   * when assigned via `innerHTML`, which previously caused `<style>` elements
   * to render as visible text and the markdown content to appear twice.
   *
   * @param html HTML string (fragment or full document)
   * @param renderStatic Render for static files like PDF documents
   * @param dir Text direction to mirror onto the container. `innerHTML` drops
   *   the exporter's outer `<html dir=…>` shell and the container is a sibling
   *   of `.editor-wrapper`, so RTL documents print LTR unless we set it here
   *   (#4833). LTR is the default and stays implicit.
   */
  renderMarkdown(html: string, renderStatic?: boolean, dir?: string): void {
    this.clearup()
    const printContainer = document.createElement('article')
    printContainer.classList.add('print-container')
    if (dir === 'rtl' || dir === 'auto') {
      printContainer.setAttribute('dir', dir)
    }
    this.container = printContainer

    // Detect whether `html` is a full HTML document or just a fragment.
    // `exportStyledHTML` produces `<!DOCTYPE html>\n<html …>…</html>`.
    const isFullDocument = /^\s*<!DOCTYPE\s/i.test(html)

    if (isFullDocument) {
      // Parse into a temporary DOM to safely extract <head> styles and <body>.
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      // Extract all <style> elements from the parsed <head> and inject them
      // into the live page so their rules apply to the print container during
      // Chromium's `printToPDF` capture.
      const headStyles = doc.head.querySelectorAll('style')
      for (const style of Array.from(headStyles)) {
        const liveStyle = document.createElement('style')
        liveStyle.setAttribute('data-print-service', 'true')
        liveStyle.textContent = style.textContent
        document.head.appendChild(liveStyle)
        this.injectedStyles.push(liveStyle)
      }

      // Use only the parsed <body> innerHTML — this is the article + any
      // header/footer table wrapping, WITHOUT the document shell.
      printContainer.innerHTML = doc.body.innerHTML
    } else {
      printContainer.innerHTML = html
    }

    // Fix images when rendering for static files like PDF (GH#678).
    if (renderStatic) {
      // Traverse through the DOM tree and fix all relative image sources.
      const images = printContainer.getElementsByTagName('img')
      for (const image of Array.from(images)) {
        const rawSrc = image.getAttribute('src') ?? ''
        image.src = resolveLocalImageSrc(rawSrc)
      }
    }

    document.body.appendChild(printContainer)
  }

  /**
   * Remove the print container and any injected styles from the window.
   */
  clearup(): void {
    if (this.container) {
      this.container.remove()
      this.container = null
    }
    // Remove all <style> elements we injected into <head> during renderMarkdown.
    for (const style of this.injectedStyles) {
      style.remove()
    }
    this.injectedStyles = []
  }
}

export default MarkdownPrint
