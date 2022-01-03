## Compare with `marked.js`

Marked.js failed examples count: 1
MarkText failed examples count: 0

**Example653**

MarkText success and marked.js fail

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
marked.js html
<p><strong> <title> <style> <em></p>
<blockquote>
  <xmp> is disallowed.  <XMP> is also disallowed.
</blockquote>
```

There are 1 examples are different with marked.js.