#### Code Block

```javascript
const arr1 = [1,2,3,[1,2,3,4, [2,3,4]]]
function flatten(input) { // flatten deep using a stack
  const stack = [...input]
  const res = []
  while (stack.length) {
    const next = stack.pop()
    if (Array.isArray(next)) {
      stack.push(...next)
    } else {
      res.push(next)
    }
  }
  return res.reverse()
}
flatten(arr1)// [1, 2, 3, 1, 2, 3, 4, 2, 3, 4]
```