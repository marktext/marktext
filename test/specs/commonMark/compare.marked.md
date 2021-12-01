## Compare with `marked.js`

Marked.js failed examples count: 75
Mark Text failed examples count: 0

**Example51**

Mark Text success and marked.js fail

```markdown
Markdown content
Foo *bar
baz*
====

Expected Html
<h1>Foo <em>bar
baz</em></h1>

Actural Html
<p>Foo <em>bar
baz</em>
====</p>

marked.js html
<p>Foo <em>bar
baz</em>
====</p>

```

**Example52**

Mark Text success and marked.js fail

```markdown
Markdown content
  Foo *bar
baz*	
====

Expected Html
<h1>Foo <em>bar
baz</em></h1>

Actural Html
<p>  Foo <em>bar
baz</em><br>====</p>

marked.js html
<p>  Foo <em>bar
baz</em><br>====</p>

```

**Example65**

Mark Text success and marked.js fail

```markdown
Markdown content
Foo
Bar
---

Expected Html
<h2>Foo
Bar</h2>

Actural Html
<p>Foo
Bar</p>
<hr>

marked.js html
<p>Foo
Bar</p>
<hr>

```

**Example164**

Mark Text success and marked.js fail

```markdown
Markdown content
[Foo bar]:
<my url>
'title'

[Foo bar]

Expected Html
<p><a href="my%20url" title="title">Foo bar</a></p>

Actural Html
<p>[Foo bar]:
<my url>
&#39;title&#39;</p>
<p>[Foo bar]</p>

marked.js html
<p>[Foo bar]:
<my url>
&#39;title&#39;</p>
<p>[Foo bar]</p>

```

**Example169**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo]: <>

[foo]

Expected Html
<p><a href="">foo</a></p>

Actural Html
<p><a href="%3C">foo</a></p>

marked.js html
<p><a href="%3C">foo</a></p>

```

**Example171**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo]: /url\bar\*baz "foo\"bar\baz"

[foo]

Expected Html
<p><a href="/url%5Cbar*baz" title="foo&quot;bar\baz">foo</a></p>

Actural Html
<p><a href="/url%5Cbar%5C*baz" title="foo\&quot;bar\baz">foo</a></p>

marked.js html
<p><a href="/url%5Cbar%5C*baz" title="foo\&quot;bar\baz">foo</a></p>

```

**Example206**

Mark Text success and marked.js fail

```markdown
Markdown content
>     foo
    bar

Expected Html
<blockquote>
<pre><code>foo
</code></pre>
</blockquote>
<pre><code>bar
</code></pre>

Actural Html
<blockquote>
<pre><code class="indented-code-block">foo
bar</code></pre>
</blockquote>

marked.js html
<blockquote>
<pre><code>foo
bar</code></pre>
</blockquote>

```

**Example207**

Mark Text success and marked.js fail

```markdown
Markdown content
> \`\`\`
foo
\`\`\`

Expected Html
<blockquote>
<pre><code></code></pre>
</blockquote>
<p>foo</p>
<pre><code></code></pre>

Actural Html
<blockquote>
<pre><code class="fenced-code-block">foo</code></pre>
</blockquote>
<pre><code class="fenced-code-block"></code></pre>

marked.js html
<blockquote>
<pre><code>foo</code></pre>
</blockquote>
<pre><code></code></pre>

```

**Example225**

Mark Text success and marked.js fail

```markdown
Markdown content
- one

 two

Expected Html
<ul>
<li>one</li>
</ul>
<p>two</p>

Actural Html
<ul>
<li><p>one</p>
<p>two</p>
</li>
</ul>

marked.js html
<ul>
<li><p>one</p>
<p>two</p>
</li>
</ul>

```

**Example227**

Mark Text success and marked.js fail

```markdown
Markdown content
 -    one

     two

Expected Html
<ul>
<li>one</li>
</ul>
<pre><code> two
</code></pre>

Actural Html
<ul>
<li><p>one</p>
<p>two</p>
</li>
</ul>

marked.js html
<ul>
<li><p>one</p>
<p>  two</p>
</li>
</ul>

```

**Example232**

Mark Text success and marked.js fail

```markdown
Markdown content
- foo


  bar

Expected Html
<ul>
<li>
<p>foo</p>
<p>bar</p>
</li>
</ul>

Actural Html
<ul>
<li>foo</li>
</ul>
<p>  bar</p>

marked.js html
<ul>
<li>foo</li>
</ul>
<p>  bar</p>

```

**Example234**

Mark Text success and marked.js fail

```markdown
Markdown content
- Foo

      bar


      baz

Expected Html
<ul>
<li>
<p>Foo</p>
<pre><code>bar


baz
</code></pre>
</li>
</ul>

Actural Html
<ul>
<li><p>Foo</p>
<pre><code class="indented-code-block">bar</code></pre>
</li>
</ul>
<pre><code class="indented-code-block">  baz</code></pre>

marked.js html
<ul>
<li><p>Foo</p>
<pre><code>bar</code></pre>
</li>
</ul>
<pre><code>  baz</code></pre>

```

**Example243**

Mark Text success and marked.js fail

```markdown
Markdown content
1.     indented code

   paragraph

       more code

Expected Html
<ol>
<li>
<pre><code>indented code
</code></pre>
<p>paragraph</p>
<pre><code>more code
</code></pre>
</li>
</ol>

Actural Html
<ol>
<li><p>indented code</p>
<p>paragraph</p>
<p> more code</p>
</li>
</ol>

marked.js html
<ol>
<li><p> indented code</p>
<p>paragraph</p>
<pre><code>more code</code></pre>
</li>
</ol>

```

**Example244**

Mark Text success and marked.js fail

```markdown
Markdown content
1.      indented code

   paragraph

       more code

Expected Html
<ol>
<li>
<pre><code> indented code
</code></pre>
<p>paragraph</p>
<pre><code>more code
</code></pre>
</li>
</ol>

Actural Html
<ol>
<li><p>indented code</p>
<p>paragraph</p>
<p> more code</p>
</li>
</ol>

marked.js html
<ol>
<li><p>  indented code</p>
<p>paragraph</p>
<pre><code>more code</code></pre>
</li>
</ol>

```

**Example246**

Mark Text success and marked.js fail

```markdown
Markdown content
-    foo

  bar

Expected Html
<ul>
<li>foo</li>
</ul>
<p>bar</p>

Actural Html
<ul>
<li><p>foo</p>
<p>bar</p>
</li>
</ul>

marked.js html
<ul>
<li><p> foo</p>
<p>bar</p>
</li>
</ul>

```

**Example248**

Mark Text success and marked.js fail

```markdown
Markdown content
-
  foo
-
  \`\`\`
  bar
  \`\`\`
-
      baz

Expected Html
<ul>
<li>foo</li>
<li>
<pre><code>bar
</code></pre>
</li>
<li>
<pre><code>baz
</code></pre>
</li>
</ul>

Actural Html
<p>-
  foo
-</p>
<pre><code class="fenced-code-block">bar</code></pre>
<p>-
      baz</p>

marked.js html
<p>-
  foo
-</p>
<pre><code>bar</code></pre>
<p>-
      baz</p>

```

**Example250**

Mark Text success and marked.js fail

```markdown
Markdown content
-

  foo

Expected Html
<ul>
<li></li>
</ul>
<p>foo</p>

Actural Html
<p>-</p>
<p>  foo</p>

marked.js html
<p>-</p>
<p>  foo</p>

```

**Example254**

Mark Text success and marked.js fail

```markdown
Markdown content
*

Expected Html
<ul>
<li></li>
</ul>

Actural Html
<p>*</p>

marked.js html
<p>*</p>

```

**Example276**

Mark Text success and marked.js fail

```markdown
Markdown content
- foo

- bar


- baz

Expected Html
<ul>
<li>
<p>foo</p>
</li>
<li>
<p>bar</p>
</li>
<li>
<p>baz</p>
</li>
</ul>

Actural Html
<ul>
<li><p>foo</p>
</li>
<li><p>bar</p>
</li>
</ul>
<ul>
<li>baz</li>
</ul>

marked.js html
<ul>
<li><p>foo</p>
</li>
<li><p>bar</p>
</li>
</ul>
<ul>
<li>baz</li>
</ul>

```

**Example277**

Mark Text success and marked.js fail

```markdown
Markdown content
- foo
  - bar
    - baz


      bim

Expected Html
<ul>
<li>foo
<ul>
<li>bar
<ul>
<li>
<p>baz</p>
<p>bim</p>
</li>
</ul>
</li>
</ul>
</li>
</ul>

Actural Html
<ul>
<li>foo<ul>
<li>bar<ul>
<li>baz</li>
</ul>
</li>
</ul>
</li>
</ul>
<pre><code class="indented-code-block">  bim</code></pre>

marked.js html
<ul>
<li>foo<ul>
<li>bar<ul>
<li>baz</li>
</ul>
</li>
</ul>
</li>
</ul>
<pre><code>  bim</code></pre>

```

**Example282**

Mark Text success and marked.js fail

```markdown
Markdown content
- a
 - b
  - c
   - d
    - e

Expected Html
<ul>
<li>a</li>
<li>b</li>
<li>c</li>
<li>d
- e</li>
</ul>

Actural Html
<ul>
<li>a<ul>
<li>b</li>
<li>c<ul>
<li>d</li>
<li>e</li>
</ul>
</li>
</ul>
</li>
</ul>

marked.js html
<ul>
<li>a</li>
<li>b</li>
<li>c</li>
<li>d<ul>
<li>e</li>
</ul>
</li>
</ul>

```

**Example283**

Mark Text success and marked.js fail

```markdown
Markdown content
1. a

  2. b

    3. c

Expected Html
<ol>
<li>
<p>a</p>
</li>
<li>
<p>b</p>
</li>
</ol>
<pre><code>3. c
</code></pre>

Actural Html
<ol>
<li><p>a</p>
<ol start="2">
<li><p>b</p>
<ol start="3">
<li>c</li>
</ol>
</li>
</ol>
</li>
</ol>

marked.js html
<ol>
<li><p>a</p>
</li>
<li><p>b</p>
<ol start="3">
<li>c</li>
</ol>
</li>
</ol>

```

**Example287**

Mark Text success and marked.js fail

```markdown
Markdown content
- a
- b

  [ref]: /url
- d

Expected Html
<ul>
<li>
<p>a</p>
</li>
<li>
<p>b</p>
</li>
<li>
<p>d</p>
</li>
</ul>

Actural Html
<ul>
<li>a</li>
<li>b</li>
</ul>
<ul>
<li>d</li>
</ul>

marked.js html
<ul>
<li>a</li>
<li>b</li>
</ul>
<ul>
<li>d</li>
</ul>

```

**Example288**

Mark Text success and marked.js fail

```markdown
Markdown content
- a
- \`\`\`
  b


  \`\`\`
- c

Expected Html
<ul>
<li>a</li>
<li>
<pre><code>b


</code></pre>
</li>
<li>c</li>
</ul>

Actural Html
<ul>
<li>a</li>
<li><pre><code class="fenced-code-block">b

</code></pre>
</li>
</ul>
<pre><code class="fenced-code-block">- c</code></pre>

marked.js html
<ul>
<li>a</li>
<li><pre><code>b

</code></pre>
</li>
</ul>
<pre><code>- c</code></pre>

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

**Example309**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo]

[foo]: /bar\* "ti\*tle"

Expected Html
<p><a href="/bar*" title="ti*tle">foo</a></p>

Actural Html
<p><a href="/bar%5C*" title="ti\*tle">foo</a></p>

marked.js html
<p><a href="/bar%5C*" title="ti\*tle">foo</a></p>

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
<pre><code class="fenced-code-block language-foo\+bar">foo</code></pre>

marked.js html
<pre><code class="language-foo\+bar">foo</code></pre>

```

**Example314**

Mark Text success and marked.js fail

```markdown
Markdown content
&nbsp &x; &#; &#x;
&#987654321;
&#abcdef0;
&ThisIsNotDefined; &hi?;

Expected Html
<p>&amp;nbsp &amp;x; &amp;#; &amp;#x;
&amp;#987654321;
&amp;#abcdef0;
&amp;ThisIsNotDefined; &amp;hi?;</p>

Actural Html
<p>&amp;nbsp &x; &amp;#; &#x;
&#987654321;
&#abcdef0;
&ThisIsNotDefined; &amp;hi?;</p>

marked.js html
<p>&amp;nbsp &x; &amp;#; &#x;
&#987654321;
&#abcdef0;
&ThisIsNotDefined; &amp;hi?;</p>

```

**Example318**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo](/f&ouml;&ouml; "f&ouml;&ouml;")

Expected Html
<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>

Actural Html
<p><a href="/f&ouml;&ouml;" title="f&ouml;&ouml;">foo</a></p>

marked.js html
<p><a href="/f&ouml;&ouml;" title="f&ouml;&ouml;">foo</a></p>

```

**Example319**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo]

[foo]: /f&ouml;&ouml; "f&ouml;&ouml;"

Expected Html
<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>

Actural Html
<p><a href="/f&ouml;&ouml;" title="f&ouml;&ouml;">foo</a></p>

marked.js html
<p><a href="/f&ouml;&ouml;" title="f&ouml;&ouml;">foo</a></p>

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
<pre><code class="fenced-code-block language-f&amp;ouml;&amp;ouml;">foo</code></pre>

marked.js html
<pre><code class="language-f&amp;ouml;&amp;ouml;">foo</code></pre>

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

**Example388**

Mark Text success and marked.js fail

```markdown
Markdown content
__foo, __bar__, baz__

Expected Html
<p><strong>foo, <strong>bar</strong>, baz</strong></p>

Actural Html
<p><strong>foo, __bar</strong>, baz__</p>

marked.js html
<p><strong>foo, __bar</strong>, baz__</p>

```

**Example407**

Mark Text success and marked.js fail

```markdown
Markdown content
__foo_ bar_

Expected Html
<p><em><em>foo</em> bar</em></p>

Actural Html
<p><em>_foo</em> bar_</p>

marked.js html
<p>__foo_ bar_</p>

```

**Example412**

Mark Text success and marked.js fail

```markdown
Markdown content
***foo** bar*

Expected Html
<p><em><strong>foo</strong> bar</em></p>

Actural Html
<p><strong>*foo</strong> bar*</p>

marked.js html
<p>*<strong>foo</strong> bar*</p>

```

**Example415**

Mark Text success and marked.js fail

```markdown
Markdown content
foo***bar***baz

Expected Html
<p>foo<em><strong>bar</strong></em>baz</p>

Actural Html
<p>foo***bar***baz</p>

marked.js html
<p>foo**<em>bar**</em>baz</p>

```

**Example416**

Mark Text success and marked.js fail

```markdown
Markdown content
foo******bar*********baz

Expected Html
<p>foo<strong><strong><strong>bar</strong></strong></strong>***baz</p>

Actural Html
<p>foo******bar*********baz</p>

marked.js html
<p>foo*<strong><strong><em>bar****</em></strong></strong>baz</p>

```

**Example424**

Mark Text success and marked.js fail

```markdown
Markdown content
__foo __bar__ baz__

Expected Html
<p><strong>foo <strong>bar</strong> baz</strong></p>

Actural Html
<p><strong>foo __bar</strong> baz__</p>

marked.js html
<p><strong>foo __bar</strong> baz__</p>

```

**Example425**

Mark Text success and marked.js fail

```markdown
Markdown content
____foo__ bar__

Expected Html
<p><strong><strong>foo</strong> bar</strong></p>

Actural Html
<p><strong>__foo</strong> bar__</p>

marked.js html
<p><strong>__foo</strong> bar__</p>

```

**Example442**

Mark Text success and marked.js fail

```markdown
Markdown content
*foo**

Expected Html
<p><em>foo</em>*</p>

Actural Html
<p><em>foo*</em></p>

marked.js html
<p>*foo**</p>

```

**Example445**

Mark Text success and marked.js fail

```markdown
Markdown content
**foo***

Expected Html
<p><strong>foo</strong>*</p>

Actural Html
<p><strong>foo*</strong></p>

marked.js html
<p>*<em>foo**</em></p>

```

**Example446**

Mark Text success and marked.js fail

```markdown
Markdown content
*foo****

Expected Html
<p><em>foo</em>***</p>

Actural Html
<p><em>foo***</em></p>

marked.js html
<p>*foo****</p>

```

**Example453**

Mark Text success and marked.js fail

```markdown
Markdown content
__foo_

Expected Html
<p>_<em>foo</em></p>

Actural Html
<p><em>_foo</em></p>

marked.js html
<p>__foo_</p>

```

**Example454**

Mark Text success and marked.js fail

```markdown
Markdown content
_foo__

Expected Html
<p><em>foo</em>_</p>

Actural Html
<p><em>foo_</em></p>

marked.js html
<p>_foo__</p>

```

**Example455**

Mark Text success and marked.js fail

```markdown
Markdown content
___foo__

Expected Html
<p>_<strong>foo</strong></p>

Actural Html
<p><strong>_foo</strong></p>

marked.js html
<p>___foo__</p>

```

**Example456**

Mark Text success and marked.js fail

```markdown
Markdown content
____foo_

Expected Html
<p>___<em>foo</em></p>

Actural Html
<p><em>___foo</em></p>

marked.js html
<p>____foo_</p>

```

**Example457**

Mark Text success and marked.js fail

```markdown
Markdown content
__foo___

Expected Html
<p><strong>foo</strong>_</p>

Actural Html
<p><strong>foo_</strong></p>

marked.js html
<p>__foo___</p>

```

**Example458**

Mark Text success and marked.js fail

```markdown
Markdown content
_foo____

Expected Html
<p><em>foo</em>___</p>

Actural Html
<p><em>foo___</em></p>

marked.js html
<p>_foo____</p>

```

**Example465**

Mark Text success and marked.js fail

```markdown
Markdown content
******foo******

Expected Html
<p><strong><strong><strong>foo</strong></strong></strong></p>

Actural Html
<p>*<strong><strong><em>foo*</em></strong></strong></p>

marked.js html
<p><strong>**</strong>foo******</p>

```

**Example466**

Mark Text success and marked.js fail

```markdown
Markdown content
***foo***

Expected Html
<p><em><strong>foo</strong></em></p>

Actural Html
<p><strong><em>foo</em></strong></p>

marked.js html
<p><strong><em>foo</em></strong></p>

```

**Example467**

Mark Text success and marked.js fail

```markdown
Markdown content
_____foo_____

Expected Html
<p><em><strong><strong>foo</strong></strong></em></p>

Actural Html
<p><strong><strong><em>foo</em></strong></strong></p>

marked.js html
<p><strong><strong><em>foo</em></strong></strong></p>

```

**Example470**

Mark Text success and marked.js fail

```markdown
Markdown content
**foo **bar baz**

Expected Html
<p>**foo <strong>bar baz</strong></p>

Actural Html
<p><strong>foo **bar baz</strong></p>

marked.js html
<p><strong>foo **bar baz</strong></p>

```

**Example499**

Mark Text success and marked.js fail

```markdown
Markdown content
[link](foo%20b&auml;)

Expected Html
<p><a href="foo%20b%C3%A4">link</a></p>

Actural Html
<p><a href="foo%20b&auml;">link</a></p>

marked.js html
<p><a href="foo%20b&auml;">link</a></p>

```

**Example503**

Mark Text success and marked.js fail

```markdown
Markdown content
[link](/url "title")

Expected Html
<p><a href="/url%C2%A0%22title%22">link</a></p>

Actural Html
<p><a href="/url" title="title">link</a></p>

marked.js html
<p><a href="/url" title="title">link</a></p>

```

**Example508**

Mark Text success and marked.js fail

```markdown
Markdown content
[link [foo [bar]]](/uri)

Expected Html
<p><a href="/uri">link [foo [bar]]</a></p>

Actural Html
<p>[link [foo [bar]]](/uri)</p>

marked.js html
<p>[link [foo [bar]]](/uri)</p>

```

**Example514**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo [bar](/uri)](/uri)

Expected Html
<p>[foo <a href="/uri">bar</a>](/uri)</p>

Actural Html
<p><a href="/uri">foo <a href="/uri">bar</a></a></p>

marked.js html
<p><a href="/uri">foo <a href="/uri">bar</a></a></p>

```

**Example515**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo *[bar [baz](/uri)](/uri)*](/uri)

Expected Html
<p>[foo <em>[bar <a href="/uri">baz</a>](/uri)</em>](/uri)</p>

Actural Html
<p>[foo *<a href="/uri">bar <a href="/uri">baz</a></a>*](/uri)</p>

marked.js html
<p>[foo *<a href="/uri">bar <a href="/uri">baz</a></a>*](/uri)</p>

```

**Example516**

Mark Text success and marked.js fail

```markdown
Markdown content
![[[foo](uri1)](uri2)](uri3)

Expected Html
<p><img src="uri3" alt="[foo](uri2)" /></p>

Actural Html
<p>![<a href="uri2"><a href="uri1">foo</a></a>](uri3)</p>

marked.js html
<p>![<a href="uri2"><a href="uri1">foo</a></a>](uri3)</p>

```

**Example520**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo <bar attr="](baz)">

Expected Html
<p>[foo <bar attr="](baz)"></p>

Actural Html
<p>[foo <bar attr="](baz)"></p>

marked.js html
<p><a href="baz">foo &lt;bar attr=&quot;</a>&quot;&gt;</p>

```

**Example522**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo<http://example.com/?search=](uri)>

Expected Html
<p>[foo<a href="http://example.com/?search=%5D(uri)">http://example.com/?search=](uri)</a></p>

Actural Html
<p>[foo<a href="http://example.com/?search=%5D(uri)">http://example.com/?search=](uri)</a></p>

marked.js html
<p><a href="uri">foo&lt;http://example.com/?search=</a>&gt;</p>

```

**Example524**

Mark Text success and marked.js fail

```markdown
Markdown content
[link [foo [bar]]][ref]

[ref]: /uri

Expected Html
<p><a href="/uri">link [foo [bar]]</a></p>

Actural Html
<p>[link [foo [bar]]]<a href="/uri">ref</a></p>

marked.js html
<p>[link [foo [bar]]]<a href="/uri">ref</a></p>

```

**Example528**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo [bar](/uri)][ref]

[ref]: /uri

Expected Html
<p>[foo <a href="/uri">bar</a>]<a href="/uri">ref</a></p>

Actural Html
<p><a href="/uri">foo <a href="/uri">bar</a></a></p>

marked.js html
<p><a href="/uri">foo <a href="/uri">bar</a></a></p>

```

**Example529**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo *bar [baz][ref]*][ref]

[ref]: /uri

Expected Html
<p>[foo <em>bar <a href="/uri">baz</a></em>]<a href="/uri">ref</a></p>

Actural Html
<p><a href="/uri">foo <em>bar <a href="/uri">baz</a></em></a></p>

marked.js html
<p><a href="/uri">foo <em>bar <a href="/uri">baz</a></em></a></p>

```

**Example532**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo <bar attr="][ref]">

[ref]: /uri

Expected Html
<p>[foo <bar attr="][ref]"></p>

Actural Html
<p><a href="/uri">foo &lt;bar attr=&quot;</a>&quot;&gt;</p>

marked.js html
<p><a href="/uri">foo &lt;bar attr=&quot;</a>&quot;&gt;</p>

```

**Example534**

Mark Text success and marked.js fail

```markdown
Markdown content
[foo<http://example.com/?search=][ref]>

[ref]: /uri

Expected Html
<p>[foo<a href="http://example.com/?search=%5D%5Bref%5D">http://example.com/?search=][ref]</a></p>

Actural Html
<p><a href="/uri">foo&lt;http://example.com/?search=</a>&gt;</p>

marked.js html
<p><a href="/uri">foo&lt;http://example.com/?search=</a>&gt;</p>

```

**Example569**

Mark Text success and marked.js fail

```markdown
Markdown content
![foo *bar*]

[foo *bar*]: train.jpg "train & tracks"

Expected Html
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks" /></p>

Actural Html
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks"></p>

marked.js html
<p><img src="train.jpg" alt="foo *bar*" title="train &amp; tracks"></p>

```

**Example570**

Mark Text success and marked.js fail

```markdown
Markdown content
![foo ![bar](/url)](/url2)

Expected Html
<p><img src="/url2" alt="foo bar" /></p>

Actural Html
<p><img src="file:///url2" alt="foo ![bar](/url)"></p>

marked.js html
<p><img src="/url2" alt="foo ![bar](/url)"></p>

```

**Example571**

Mark Text success and marked.js fail

```markdown
Markdown content
![foo [bar](/url)](/url2)

Expected Html
<p><img src="/url2" alt="foo bar" /></p>

Actural Html
<p><img src="file:///url2" alt="foo [bar](/url)"></p>

marked.js html
<p><img src="/url2" alt="foo [bar](/url)"></p>

```

**Example572**

Mark Text success and marked.js fail

```markdown
Markdown content
![foo *bar*][]

[foo *bar*]: train.jpg "train & tracks"

Expected Html
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks" /></p>

Actural Html
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks"></p>

marked.js html
<p><img src="train.jpg" alt="foo *bar*" title="train &amp; tracks"></p>

```

**Example573**

Mark Text success and marked.js fail

```markdown
Markdown content
![foo *bar*][foobar]

[FOOBAR]: train.jpg "train & tracks"

Expected Html
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks" /></p>

Actural Html
<p><img src="train.jpg" alt="foo bar" title="train &amp; tracks"></p>

marked.js html
<p><img src="train.jpg" alt="foo *bar*" title="train &amp; tracks"></p>

```

**Example581**

Mark Text success and marked.js fail

```markdown
Markdown content
![*foo* bar][]

[*foo* bar]: /url "title"

Expected Html
<p><img src="/url" alt="foo bar" title="title" /></p>

Actural Html
<p><img src="file:///url" alt="foo bar" title="title"></p>

marked.js html
<p><img src="/url" alt="*foo* bar" title="title"></p>

```

**Example585**

Mark Text success and marked.js fail

```markdown
Markdown content
![*foo* bar]

[*foo* bar]: /url "title"

Expected Html
<p><img src="/url" alt="foo bar" title="title" /></p>

Actural Html
<p><img src="file:///url" alt="foo bar" title="title"></p>

marked.js html
<p><img src="/url" alt="*foo* bar" title="title"></p>

```

**Example622**

Mark Text success and marked.js fail

```markdown
Markdown content
foo <!-- not a comment -- two hyphens -->

Expected Html
<p>foo &lt;!-- not a comment -- two hyphens --&gt;</p>

Actural Html
<p>foo <!-- not a comment -- two hyphens --></p>

marked.js html
<p>foo <!-- not a comment -- two hyphens --></p>

```

**Example623**

Mark Text success and marked.js fail

```markdown
Markdown content
foo <!--> foo -->

foo <!-- foo--->

Expected Html
<p>foo &lt;!--&gt; foo --&gt;</p>
<p>foo &lt;!-- foo---&gt;</p>

Actural Html
<p>foo &lt;!--&gt; foo --&gt;</p>
<p>foo <!-- foo---></p>

marked.js html
<p>foo &lt;!--&gt; foo --&gt;</p>
<p>foo <!-- foo---></p>

```

There are 75 examples are different with marked.js.