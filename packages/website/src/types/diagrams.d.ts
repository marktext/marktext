declare module 'flowchart.js' {
  const flowchart: {
    parse(source: string): {
      drawSVG(target: HTMLElement): void
      clean(): void
    }
  }
  export default flowchart
}

declare module '*sequence-diagram-snap' {
  const sequence: {
    parse(source: string): {
      drawSVG(target: HTMLElement, options: { theme: 'simple' }): void
    }
  }
  export default sequence
}

declare module 'plantuml-encoder' {
  const encoder: { encode(source: string): string }
  export default encoder
}
