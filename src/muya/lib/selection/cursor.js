import { compareParagraphsOrder } from './dom'

class Cursor {
  // You need to provide either `anchor`&&`focus` or `start`&&`end` or all.
  constructor ({ anchor, focus, start, end, noHistory = false }) {
    if (anchor && focus && start && end) {
      this.anchor = anchor
      this.focus = focus
      this.start = start
      this.end = end
    } else if (anchor && focus) {
      this.anchor = anchor
      this.focus = focus
      if (anchor.key === focus.key) {
        if (anchor.offset <= focus.offset) {
          this.start = this.anchor
          this.end = this.focus
        } else {
          this.start = this.focus
          this.end = this.anchor
        }
      } else {
        const anchorParagraph = document.querySelector(`#${anchor.key}`)
        const focusParagraph = document.querySelector(`#${focus.key}`)
        let order = true
        if (anchorParagraph && focusParagraph) {
          order = compareParagraphsOrder(anchorParagraph, focusParagraph)
        }

        if (order) {
          this.start = this.anchor
          this.end = this.focus
        } else {
          this.start = this.focus
          this.end = this.anchor
        }
      }
    } else {
      this.anchor = this.start = start
      this.focus = this.end = end
    }
    this.noHistory = noHistory
  }
}

export default Cursor
