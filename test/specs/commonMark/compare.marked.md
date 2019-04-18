## Compare with `marked.js`

Marked.js failed examples count: 133
Mark Text failed examples count: 111

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

**Example341**

Mark Text success and marked.js fail

```markdown
Markdown content
*foo\`*\`

Expected Html
<p>*foo<code>*</code></p>

Actural Html
<p>*foo<code>*</code></p>

marked.js html
<p><em>foo`</em>`</p>

```

**Example353**

Mark Text success and marked.js fail

```markdown
Markdown content
* a *

Expected Html
<p>* a *</p>

Actural Html
<p>* a *</p>

marked.js html
<ul>
<li>a *</li>
</ul>

```

**Example361**

Mark Text success and marked.js fail

```markdown
Markdown content
пристаням_стремятся_

Expected Html
<p>пристаням_стремятся_</p>

Actural Html
<p>пристаням_стремятся_</p>

marked.js html
<p>пристаням<em>стремятся</em></p>

```

**Example367**

Mark Text success and marked.js fail

```markdown
Markdown content
*(*foo)

Expected Html
<p>*(*foo)</p>

Actural Html
<p>*(*foo)</p>

marked.js html
<p><em>(</em>foo)</p>

```

**Example371**

Mark Text success and marked.js fail

```markdown
Markdown content
_(_foo)

Expected Html
<p>_(_foo)</p>

Actural Html
<p>_(_foo)</p>

marked.js html
<p><em>(</em>foo)</p>

```

**Example379**

Mark Text success and marked.js fail

```markdown
Markdown content
a**"foo"**

Expected Html
<p>a**&quot;foo&quot;**</p>

Actural Html
<p>a**&quot;foo&quot;**</p>

marked.js html
<p>a<strong>&quot;foo&quot;</strong></p>

```

**Example387**

Mark Text success and marked.js fail

```markdown
Markdown content
пристаням__стремятся__

Expected Html
<p>пристаням__стремятся__</p>

Actural Html
<p>пристаням__стремятся__</p>

marked.js html
<p>пристаням<strong>стремятся</strong></p>

```

**Example391**

Mark Text success and marked.js fail

```markdown
Markdown content
**(**foo)

Expected Html
<p>**(**foo)</p>

Actural Html
<p>**(**foo)</p>

marked.js html
<p><strong>(</strong>foo)</p>

```

**Example397**

Mark Text success and marked.js fail

```markdown
Markdown content
__(__foo)

Expected Html
<p>__(__foo)</p>

Actural Html
<p>__(__foo)</p>

marked.js html
<p><strong>(</strong>foo)</p>

```

**Example399**

Mark Text success and marked.js fail

```markdown
Markdown content
__foo__bar

Expected Html
<p>__foo__bar</p>

Actural Html
<p>__foo__bar</p>

marked.js html
<p><strong>foo</strong>bar</p>

```

**Example400**

Mark Text success and marked.js fail

```markdown
Markdown content
__пристаням__стремятся

Expected Html
<p>__пристаням__стремятся</p>

Actural Html
<p>__пристаням__стремятся</p>

marked.js html
<p><strong>пристаням</strong>стремятся</p>

```

**Example475**

Mark Text success and marked.js fail

```markdown
Markdown content
**<a href="**">

Expected Html
<p>**<a href="**"></p>

Actural Html
<p>**<a href="**"></p>

marked.js html
<p><strong>&lt;a href=&quot;</strong>&quot;&gt;</p>

```

**Example476**

Mark Text success and marked.js fail

```markdown
Markdown content
__<a href="__">

Expected Html
<p>__<a href="__"></p>

Actural Html
<p>__<a href="__"></p>

marked.js html
<p><strong>&lt;a href=&quot;</strong>&quot;&gt;</p>

```

**Example479**

Mark Text success and marked.js fail

```markdown
Markdown content
**a<http://foo.bar/?q=**>

Expected Html
<p>**a<a href="http://foo.bar/?q=**">http://foo.bar/?q=**</a></p>

Actural Html
<p>**a<a href="http://foo.bar/?q=**">http://foo.bar/?q=**</a></p>

marked.js html
<p><strong>a&lt;<a href="http://foo.bar/?q=">http://foo.bar/?q=</a></strong>&gt;</p>

```

**Example480**

Mark Text success and marked.js fail

```markdown
Markdown content
__a<http://foo.bar/?q=__>

Expected Html
<p>__a<a href="http://foo.bar/?q=__">http://foo.bar/?q=__</a></p>

Actural Html
<p>__a<a href="http://foo.bar/?q=__">http://foo.bar/?q=__</a></p>

marked.js html
<p><strong>a&lt;<a href="http://foo.bar/?q=">http://foo.bar/?q=</a></strong>&gt;</p>

```

There are 24 examples are different with marked.js.