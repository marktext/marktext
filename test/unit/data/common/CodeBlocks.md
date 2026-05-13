# Code Blocks

## Indent Code Block

    This line won't *have any markdown* formatting applied.
    I can even write <b>HTML</b> and it will show up as text.
    This is great for showing program source code, or HTML or even
    Markdown. <b>this won't show up as HTML</b> but
    exactly <i>as you see it in this text file</i>.

Within a paragraph, you can use backquotes to do the same thing.
`This won't be *italic* or **bold** at all.`

## Fence Code Block

```cpp
#include <iostream>

int main(int argc, const char* argv[]) {
  std::cout << "C++ code block test" << std::endl;
  return 0;
}
```

```
This is a code block without language identifier.
```
