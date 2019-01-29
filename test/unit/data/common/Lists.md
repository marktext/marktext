# Lists

* an asterisk starts an unordered list
* and this is another item in the list
* and this is another item in the list

To start an ordered list, write this:

<!-- Strange indentation -->

1. this starts a list *with* numbers
2. this will show as number "2"
3. this will show as number "3."
4. any number, +, -, or * will keep the list going.
   * just indent by 4 spaces (or tab) to make a sub-list
     1. keep indenting for more sub lists
   * here i'm back to the second level

---

- foo
  - bar
    - baz
      - boo

---

- a
  - b
    - c
      - d
        - e
      - f
    - g
  - h
- i

---

- foo
- 
- bar

---

**TODO:** Empty comments should not be displayed as HTML in preview mode because they may be used to separate consecutive lists of the same type (CM Example 270).

- foo
- bar

<!-- -->

- baz
- bim

---

-one

2.two

---

## Failing Tests

```
* an asterisk starts an unordered list
* and this is another item in the list
+ or you can also use the + character
- or the - character
```

```
1. this starts a list *with* numbers
+  this will show as number "2"
*  this will show as number "3."
9. any number, +, -, or * will keep the list going.
    * just indent by 4 spaces (or tab) to make a sub-list
        1. keep indenting for more sub lists
    * here i'm back to the second level
```

```
1. this starts a list *with* numbers
+  this will show as number "2"
*  this will show as number "3."
9. any number, +, -, or * will keep the list going.
  * just indent by 2 spaces to make a sub-list
    1. keep indenting for more sub lists
  * here i'm back to the second level
```

```
CommonMark Example 266

Foo
- bar
- baz
```

```
- foo
-
- bar
```
