## Compare with `marked.js`

Marked.js failed examples count: 38
MarkText failed examples count: 0

**Example23**

MarkText success and marked.js fail

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

**Example24**

MarkText success and marked.js fail

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
<pre><code class="language-foo\+bar">foo
</code></pre>

```

**Example28**

MarkText success and marked.js fail

```markdown
Markdown content
&nbsp &x; &#; &#x;
&#87654321;
&#abcdef0;
&ThisIsNotDefined; &hi?;

Expected Html
<p>&amp;nbsp &amp;x; &amp;#; &amp;#x;
&amp;#87654321;
&amp;#abcdef0;
&amp;ThisIsNotDefined; &amp;hi?;</p>

Actural Html
<p>&amp;nbsp &x; &amp;#; &#x;
&#87654321;
&#abcdef0;
&ThisIsNotDefined; &amp;hi?;</p>

marked.js html
<p>&amp;nbsp &x; &amp;#; &#x;
&#87654321;
&#abcdef0;
&ThisIsNotDefined; &amp;hi?;</p>

```

**Example32**

MarkText success and marked.js fail

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

**Example33**

MarkText success and marked.js fail

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

**Example34**

MarkText success and marked.js fail

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
<pre><code class="language-f&amp;ouml;&amp;ouml;">foo
</code></pre>

```

**Example81**

MarkText success and marked.js fail

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

**Example82**

MarkText success and marked.js fail

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

**Example95**

MarkText success and marked.js fail

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

**Example195**

MarkText success and marked.js fail

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

**Example200**

MarkText success and marked.js fail

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

**Example202**

MarkText success and marked.js fail

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

**Example236**

MarkText success and marked.js fail

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
bar
</code></pre>
</blockquote>

```

**Example237**

MarkText success and marked.js fail

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
<pre><code>foo
</code></pre>
</blockquote>
<pre><code>
</code></pre>

```

**Example496**

MarkText success and marked.js fail

```markdown
Markdown content
[link](foo(and(bar))

Expected Html
<p>[link](foo(and(bar))</p>

Actural Html
<p><a href="foo(and(bar)">link</a></p>

marked.js html
<p><a href="foo(and(bar)">link</a></p>

```

**Example502**

MarkText success and marked.js fail

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

**Example506**

MarkText success and marked.js fail

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

**Example511**

MarkText success and marked.js fail

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

**Example517**

MarkText success and marked.js fail

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

**Example518**

MarkText success and marked.js fail

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

**Example519**

MarkText success and marked.js fail

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

**Example523**

MarkText success and marked.js fail

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

**Example525**

MarkText success and marked.js fail

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

**Example527**

MarkText success and marked.js fail

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

**Example531**

MarkText success and marked.js fail

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

**Example532**

MarkText success and marked.js fail

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

**Example535**

MarkText success and marked.js fail

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

**Example537**

MarkText success and marked.js fail

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

**Example539**

MarkText success and marked.js fail

```markdown
Markdown content
[ẞ]

[SS]: /url

Expected Html
<p><a href="/url">ẞ</a></p>

Actural Html
<p>[ẞ]</p>

marked.js html
<p>[ẞ]</p>

```

**Example572**

MarkText success and marked.js fail

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

**Example573**

MarkText success and marked.js fail

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

**Example574**

MarkText success and marked.js fail

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

**Example575**

MarkText success and marked.js fail

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

**Example576**

MarkText success and marked.js fail

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

**Example584**

MarkText success and marked.js fail

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

**Example588**

MarkText success and marked.js fail

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

**Example625**

MarkText success and marked.js fail

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

**Example626**

MarkText success and marked.js fail

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

There are 38 examples are different with marked.js.