## Compare with `marked.js`

Marked.js failed examples count: 133
Mark Text failed examples count: 126

**Example7**

Mark Text success and marked.js fail

```markdown
Markdown content
-		foo

Expected Html
<ul>
<li>
<pre><code>  foo
</code></pre>
</li>
</ul>

Actural Html
<ul>
<li><pre><code class="indented-code-block">foo
</code></pre>
</li>
</ul>

marked.js html
<ul>
<li>foo</li>
</ul>

```

**Example40**

Mark Text success and marked.js fail

```markdown
Markdown content
foo
    # bar

Expected Html
<p>foo
# bar</p>

Actural Html
<p>foo
    # bar</p>

marked.js html
<p>foo</p>
<pre><code># bar</code></pre>
```

**Example57**

Mark Text success and marked.js fail

```markdown
Markdown content
Foo
    ---

Expected Html
<p>Foo
---</p>

Actural Html
<p>Foo
    ---</p>

marked.js html
<h2>Foo</h2>

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

There are 9 examples are different with marked.js.