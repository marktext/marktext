## Test Result

Total test 24 examples, and failed 1 examples:

|      Section      | Failed/Total  |  Percentage   |
|:-----------------:|:-------------:|:-------------:|
|      Tables       |      0/8      |    100.00%    |
|  Task list items  |      0/2      |    100.00%    |
|   Strikethrough   |      0/2      |    100.00%    |
|     Autolinks     |     0/11      |    100.00%    |
|Disallowed Raw HTML|      1/1      |     0.00%     |

**Example653**

```markdown
Markdown content
<strong> <title> <style> <em>

<blockquote>
  <xmp> is disallowed.  <XMP> is also disallowed.
</blockquote>
Expected Html
<p><strong> &lt;title> &lt;style> <em></p>
<blockquote>
  &lt;xmp> is disallowed.  &lt;XMP> is also disallowed.
</blockquote>
Actural Html
<p><strong> <title> <style> <em></p>
<blockquote>
  <xmp> is disallowed.  <XMP> is also disallowed.
</blockquote>
```

