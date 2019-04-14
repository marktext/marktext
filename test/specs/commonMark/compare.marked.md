## Compare with `marked.js`

Marked.js failed examples count: 133
Mark Text failed examples count: 136

**Example66**

Mark Text fail and marked.js success

```markdown
Markdown content
---
Foo
---
Bar
---
Baz

Expected Html
<hr />
<h2>Foo</h2>
<h2>Bar</h2>
<p>Baz</p>

Actural Html
<pre class="front-matter">
Foo
</pre>
<h2>Bar</h2>
<p>Baz</p>

marked.js html
<hr>
<h2>Foo</h2>
<h2>Bar</h2>
<p>Baz</p>

```

**Example224**

Mark Text fail and marked.js success

```markdown
Markdown content
1.  A paragraph
    with two lines.

        indented code

    > A block quote.

Expected Html
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

Actural Html
<ol>
<li>A paragraph
with two lines.<pre><code class="indented-code-block">indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

marked.js html
<ol>
<li><p>A paragraph
with two lines.</p>
<pre><code>indented code</code></pre><blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

```

**Example256**

Mark Text fail and marked.js success

```markdown
Markdown content
 1.  A paragraph
     with two lines.

         indented code

     > A block quote.

Expected Html
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

Actural Html
<ol>
<li>A paragraph
with two lines.<pre><code class="indented-code-block">indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

marked.js html
<ol>
<li><p>A paragraph
with two lines.</p>
<pre><code>indented code</code></pre><blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

```

**Example257**

Mark Text fail and marked.js success

```markdown
Markdown content
  1.  A paragraph
      with two lines.

          indented code

      > A block quote.

Expected Html
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

Actural Html
<ol>
<li>A paragraph
with two lines.<pre><code class="indented-code-block">indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

marked.js html
<ol>
<li><p>A paragraph
with two lines.</p>
<pre><code>indented code</code></pre><blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

```

**Example258**

Mark Text fail and marked.js success

```markdown
Markdown content
   1.  A paragraph
       with two lines.

           indented code

       > A block quote.

Expected Html
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

Actural Html
<ol>
<li>A paragraph
with two lines.<pre><code class="indented-code-block">indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

marked.js html
<ol>
<li><p>A paragraph
with two lines.</p>
<pre><code>indented code</code></pre><blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

```

**Example260**

Mark Text fail and marked.js success

```markdown
Markdown content
  1.  A paragraph
with two lines.

          indented code

      > A block quote.

Expected Html
<ol>
<li>
<p>A paragraph
with two lines.</p>
<pre><code>indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

Actural Html
<ol>
<li>A paragraph
with two lines.<pre><code class="indented-code-block">indented code
</code></pre>
<blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

marked.js html
<ol>
<li><p>A paragraph
with two lines.</p>
<pre><code>indented code</code></pre><blockquote>
<p>A block quote.</p>
</blockquote>
</li>
</ol>

```

**Example266**

Mark Text success and marked.js fail

```markdown
Markdown content
10) foo
    - bar

Expected Html
<ol start="10">
<li>foo
<ul>
<li>bar</li>
</ul>
</li>
</ol>

Actural Html
<ol start="10">
<li>foo<ul>
<li>bar</li>
</ul>
</li>
</ol>

marked.js html
<p>10) foo
    - bar</p>

```

**Example271**

Mark Text success and marked.js fail

```markdown
Markdown content
- foo
- bar
+ baz

Expected Html
<ul>
<li>foo</li>
<li>bar</li>
</ul>
<ul>
<li>baz</li>
</ul>

Actural Html
<ul>
<li>foo</li>
<li>bar</li>
</ul>
<ul>
<li>baz</li>
</ul>

marked.js html
<ul>
<li>foo</li>
<li>bar</li>
<li>baz</li>
</ul>

```

**Example272**

Mark Text success and marked.js fail

```markdown
Markdown content
1. foo
2. bar
3) baz

Expected Html
<ol>
<li>foo</li>
<li>bar</li>
</ol>
<ol start="3">
<li>baz</li>
</ol>

Actural Html
<ol>
<li>foo</li>
<li>bar</li>
</ol>
<ol start="3">
<li>baz</li>
</ol>

marked.js html
<ol>
<li>foo</li>
<li>bar
3) baz</li>
</ol>

```

**Example285**

Mark Text fail and marked.js success

```markdown
Markdown content
* a
*

* c

Expected Html
<ul>
<li>
<p>a</p>
</li>
<li></li>
<li>
<p>c</p>
</li>
</ul>

Actural Html
<ul>
<li><p>a</p>
</li>
<li><p></p>
</li>
<li><p>c</p>
</li>
</ul>

marked.js html
<ul>
<li><p>a</p>
</li>
<li></li>
<li><p>c</p>
</li>
</ul>

```

**Example289**

Mark Text success and marked.js fail

```markdown
Markdown content
- a
  - b

    c
- d

Expected Html
<ul>
<li>a
<ul>
<li>
<p>b</p>
<p>c</p>
</li>
</ul>
</li>
<li>d</li>
</ul>

Actural Html
<ul>
<li>a<ul>
<li><p>b</p>
<p>c</p>
</li>
</ul>
</li>
<li>d</li>
</ul>

marked.js html
<ul>
<li><p>a</p>
<ul>
<li><p>b</p>
<p>c</p>
</li>
</ul>
</li>
<li><p>d</p>
</li>
</ul>

```

**Example294**

Mark Text fail and marked.js success

```markdown
Markdown content
1. \`\`\`
   foo
   \`\`\`

   bar

Expected Html
<ol>
<li>
<pre><code>foo
</code></pre>
<p>bar</p>
</li>
</ol>

Actural Html
<ol>
<li><pre><code class="fenced-code-block">foo
</code></pre>
bar</li>
</ol>

marked.js html
<ol>
<li><pre><code>foo</code></pre><p>bar</p>
</li>
</ol>

```

**Example295**

Mark Text fail and marked.js success

```markdown
Markdown content
* foo
  * bar

  baz

Expected Html
<ul>
<li>
<p>foo</p>
<ul>
<li>bar</li>
</ul>
<p>baz</p>
</li>
</ul>

Actural Html
<ul>
<li>foo<ul>
<li>bar</li>
</ul>
baz</li>
</ul>

marked.js html
<ul>
<li><p>foo</p>
<ul>
<li>bar</li>
</ul>
<p>baz</p>
</li>
</ul>

```

**Example310**

Mark Text success and marked.js fail

```markdown
Markdown content
\`\`\` foo\+bar
foo
\`\`\`

Expected Html
<pre><code class="language-foo+bar">foo
</code></pre>

Actural Html
<pre><code class="fenced-code-block language-foo\+bar">foo
</code></pre>

marked.js html
<pre><code class="language-foo\+bar">foo</code></pre>

```

**Example320**

Mark Text success and marked.js fail

```markdown
Markdown content
\`\`\` f&ouml;&ouml;
foo
\`\`\`

Expected Html
<pre><code class="language-föö">foo
</code></pre>

Actural Html
<pre><code class="fenced-code-block language-f&amp;ouml;&amp;ouml;">foo
</code></pre>

marked.js html
<pre><code class="language-f&amp;ouml;&amp;ouml;">foo</code></pre>

```

There are 15 examples are different with marked.js.