const vm = [
  {
    parentType: null,
    id: 'ag-xxx',
    active: true, // boolean, 一个 viewModel 只可能有一个 blockType 为 true
    markedText: 'LUORAN**ransixi**',
    paragraphType: 'ul', 
    // h1~6/ p / ul / ol / tl: task list / blockCode / blockquote / hr /(p, blockCode, hr 不支持嵌套)
    cursorRange: [1, 2],
    sections: [
      {
        id: 'ag-xer',
        active: true,
        parentType: 'ul',
        paragraphType: 'p',
        markedText: 'luoran**luoran**', // string not markdown
        // active: true 才有光标
        cursorRange: [1, 2], // 如果 cursorIndex[0] !== cursorIndex[1] 说明选择范围，如果相等，说明是光标位置。
      }
    ]
  }
]