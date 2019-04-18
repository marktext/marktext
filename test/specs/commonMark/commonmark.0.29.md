## Test Result

Total test 649 examples, and failed 97 examples:

**Example53**

```markdown
Markdown content
Foo
-------------------------

Foo
=

Expected Html
<h2>Foo</h2>
<h1>Foo</h1>

Actural Html
<h2>Foo</h2>
<p>Foo
=</p>

```

**Example63**

```markdown
Markdown content
> foo
bar
===

Expected Html
<blockquote>
<p>foo
bar
===</p>
</blockquote>

Actural Html
<blockquote>
<p>foo</p>
</blockquote>
<h1>bar</h1>

```

**Example116**

```markdown
Markdown content
~~~ aa \`\`\` ~~~
foo
~~~

Expected Html
<pre><code class="language-aa">foo
</code></pre>

Actural Html
<p><del>~ aa ``` ~</del>
foo</p>
<pre><code class="fenced-code-block">
</code></pre>

```

**Example164**

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

```

**Example169**

```markdown
Markdown content
[foo]: <>

[foo]

Expected Html
<p><a href="">foo</a></p>

Actural Html
<p><a href="%3C">foo</a></p>

```

**Example171**

```markdown
Markdown content
[foo]: /url\bar\*baz "foo\"bar\baz"

[foo]

Expected Html
<p><a href="/url%5Cbar*baz" title="foo&quot;bar\baz">foo</a></p>

Actural Html
<p><a href="/url%5Cbar%5C*baz" title="foo\&quot;bar\baz">foo</a></p>

```

**Example205**

```markdown
Markdown content
> - foo
- bar

Expected Html
<blockquote>
<ul>
<li>foo</li>
</ul>
</blockquote>
<ul>
<li>bar</li>
</ul>

Actural Html
<blockquote>
<ul>
<li>foo</li>
<li>bar</li>
</ul>
</blockquote>

```

**Example206**

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
bar
</code></pre>
</blockquote>

```

**Example207**

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
<pre><code class="fenced-code-block">foo
</code></pre>
</blockquote>

```

**Example225**

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

```

**Example227**

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

```

**Example232**

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

```

**Example234**

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
<pre><code class="indented-code-block">bar
</code></pre>
</li>
</ul>
<pre><code class="indented-code-block">  baz
</code></pre>

```

**Example243**

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

```

**Example244**

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

```

**Example246**

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

```

**Example248**

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
<pre><code class="fenced-code-block">  bar
</code></pre>
<p>-
      baz</p>

```

**Example250**

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

```

**Example254**

```markdown
Markdown content
*

Expected Html
<ul>
<li></li>
</ul>

Actural Html
<p>*</p>

```

**Example265**

```markdown
Markdown content
- foo
 - bar
  - baz
   - boo

Expected Html
<ul>
<li>foo</li>
<li>bar</li>
<li>baz</li>
<li>boo</li>
</ul>

Actural Html
<ul>
<li>foo<ul>
<li>bar</li>
<li>baz<ul>
<li>boo</li>
</ul>
</li>
</ul>
</li>
</ul>

```

**Example267**

```markdown
Markdown content
10) foo
   - bar

Expected Html
<ol start="10">
<li>foo</li>
</ol>
<ul>
<li>bar</li>
</ul>

Actural Html
<ol start="10">
<li>foo<ul>
<li>bar</li>
</ul>
</li>
</ol>

```

**Example274**

```markdown
Markdown content
The number of windows in my house is
14.  The number of doors is 6.

Expected Html
<p>The number of windows in my house is
14.  The number of doors is 6.</p>

Actural Html
<p>The number of windows in my house is</p>
<ol start="14">
<li>The number of doors is 6.</li>
</ol>

```

**Example276**

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

```

**Example277**

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
<pre><code class="indented-code-block">  bim
</code></pre>

```

**Example280**

```markdown
Markdown content
- a
 - b
  - c
   - d
  - e
 - f
- g

Expected Html
<ul>
<li>a</li>
<li>b</li>
<li>c</li>
<li>d</li>
<li>e</li>
<li>f</li>
<li>g</li>
</ul>

Actural Html
<ul>
<li>a<ul>
<li>b</li>
<li>c<ul>
<li>d</li>
</ul>
</li>
<li>e</li>
<li>f</li>
</ul>
</li>
<li>g</li>
</ul>

```

**Example281**

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
<li>
<p>c</p>
</li>
</ol>

Actural Html
<ol>
<li><p>a</p>
<ol start="2">
<li><p>b</p>
</li>
<li><p>c</p>
</li>
</ol>
</li>
</ol>

```

**Example282**

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

```

**Example283**

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

```

**Example285**

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

```

**Example287**

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

```

**Example288**

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
<pre><code class="fenced-code-block">- c
</code></pre>

```

**Example289**

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

```

**Example291**

```markdown
Markdown content
- a
  > b
  \`\`\`
  c
  \`\`\`
- d

Expected Html
<ul>
<li>a
<blockquote>
<p>b</p>
</blockquote>
<pre><code>c
</code></pre>
</li>
<li>d</li>
</ul>

Actural Html
<ul>
<li>a<blockquote>
<p>b</p>
<pre><code class="fenced-code-block">c
</code></pre>
</blockquote>
</li>
<li>d</li>
</ul>

```

**Example309**

```markdown
Markdown content
[foo]

[foo]: /bar\* "ti\*tle"

Expected Html
<p><a href="/bar*" title="ti*tle">foo</a></p>

Actural Html
<p><a href="/bar%5C*" title="ti\*tle">foo</a></p>

```

**Example314**

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

```

**Example318**

```markdown
Markdown content
[foo](/f&ouml;&ouml; "f&ouml;&ouml;")

Expected Html
<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>

Actural Html
<p><a href="/f&ouml;&ouml;" title="f&ouml;&ouml;">foo</a></p>

```

**Example319**

```markdown
Markdown content
[foo]

[foo]: /f&ouml;&ouml; "f&ouml;&ouml;"

Expected Html
<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>

Actural Html
<p><a href="/f&ouml;&ouml;" title="f&ouml;&ouml;">foo</a></p>

```

**Example342**

```markdown
Markdown content
[not a \`link](/foo\`)

Expected Html
<p>[not a <code>link](/foo</code>)</p>

Actural Html
<p><a href="/foo%60">not a `link</a></p>

```

**Example368**

```markdown
Markdown content
*(*foo*)*

Expected Html
<p><em>(<em>foo</em>)</em></p>

Actural Html
<p>*(<em>foo</em>)*</p>

```

**Example372**

```markdown
Markdown content
_(_foo_)_

Expected Html
<p><em>(<em>foo</em>)</em></p>

Actural Html
<p>_(<em>foo</em>)_</p>

```

**Example388**

```markdown
Markdown content
__foo, __bar__, baz__

Expected Html
<p><strong>foo, <strong>bar</strong>, baz</strong></p>

Actural Html
<p><strong>foo, __bar</strong>, baz__</p>

```

**Example390**

```markdown
Markdown content
**foo bar **

Expected Html
<p>**foo bar **</p>

Actural Html
<p>*<em>foo bar *</em></p>

```

**Example401**

```markdown
Markdown content
__foo__bar__baz__

Expected Html
<p><strong>foo__bar__baz</strong></p>

Actural Html
<p>__foo__bar__baz__</p>

```

**Example406**

```markdown
Markdown content
_foo _bar_ baz_

Expected Html
<p><em>foo <em>bar</em> baz</em></p>

Actural Html
<p><em>foo _bar</em> baz_</p>

```

**Example407**

```markdown
Markdown content
__foo_ bar_

Expected Html
<p><em><em>foo</em> bar</em></p>

Actural Html
<p><em>_foo</em> bar_</p>

```

**Example412**

```markdown
Markdown content
***foo** bar*

Expected Html
<p><em><strong>foo</strong> bar</em></p>

Actural Html
<p><strong>*foo</strong> bar*</p>

```

**Example413**

```markdown
Markdown content
*foo **bar***

Expected Html
<p><em>foo <strong>bar</strong></em></p>

Actural Html
<p>*foo <strong>bar*</strong></p>

```

**Example414**

```markdown
Markdown content
*foo**bar***

Expected Html
<p><em>foo<strong>bar</strong></em></p>

Actural Html
<p>*foo<strong>bar*</strong></p>

```

**Example415**

```markdown
Markdown content
foo***bar***baz

Expected Html
<p>foo<em><strong>bar</strong></em>baz</p>

Actural Html
<p>foo***bar***baz</p>

```

**Example416**

```markdown
Markdown content
foo******bar*********baz

Expected Html
<p>foo<strong><strong><strong>bar</strong></strong></strong>***baz</p>

Actural Html
<p>foo******bar*********baz</p>

```

**Example417**

```markdown
Markdown content
*foo **bar *baz* bim** bop*

Expected Html
<p><em>foo <strong>bar <em>baz</em> bim</strong> bop</em></p>

Actural Html
<p><em>foo **bar *baz</em> bim** bop*</p>

```

**Example418**

```markdown
Markdown content
*foo [*bar*](/url)*

Expected Html
<p><em>foo <a href="/url"><em>bar</em></a></em></p>

Actural Html
<p>*foo <a href="/url"><em>bar</em></a>*</p>

```

**Example424**

```markdown
Markdown content
__foo __bar__ baz__

Expected Html
<p><strong>foo <strong>bar</strong> baz</strong></p>

Actural Html
<p><strong>foo __bar</strong> baz__</p>

```

**Example425**

```markdown
Markdown content
____foo__ bar__

Expected Html
<p><strong><strong>foo</strong> bar</strong></p>

Actural Html
<p><strong>__foo</strong> bar__</p>

```

**Example431**

```markdown
Markdown content
**foo *bar **baz**
bim* bop**

Expected Html
<p><strong>foo <em>bar <strong>baz</strong>
bim</em> bop</strong></p>

Actural Html
<p><strong>foo *bar **baz</strong>
bim* bop**</p>

```

**Example441**

```markdown
Markdown content
**foo*

Expected Html
<p>*<em>foo</em></p>

Actural Html
<p><em>*foo</em></p>

```

**Example442**

```markdown
Markdown content
*foo**

Expected Html
<p><em>foo</em>*</p>

Actural Html
<p><em>foo*</em></p>

```

**Example443**

```markdown
Markdown content
***foo**

Expected Html
<p>*<strong>foo</strong></p>

Actural Html
<p><strong>*foo</strong></p>

```

**Example444**

```markdown
Markdown content
****foo*

Expected Html
<p>***<em>foo</em></p>

Actural Html
<p><em>***foo</em></p>

```

**Example445**

```markdown
Markdown content
**foo***

Expected Html
<p><strong>foo</strong>*</p>

Actural Html
<p><strong>foo*</strong></p>

```

**Example446**

```markdown
Markdown content
*foo****

Expected Html
<p><em>foo</em>***</p>

Actural Html
<p><em>foo***</em></p>

```

**Example453**

```markdown
Markdown content
__foo_

Expected Html
<p>_<em>foo</em></p>

Actural Html
<p><em>_foo</em></p>

```

**Example454**

```markdown
Markdown content
_foo__

Expected Html
<p><em>foo</em>_</p>

Actural Html
<p><em>foo_</em></p>

```

**Example455**

```markdown
Markdown content
___foo__

Expected Html
<p>_<strong>foo</strong></p>

Actural Html
<p><strong>_foo</strong></p>

```

**Example456**

```markdown
Markdown content
____foo_

Expected Html
<p>___<em>foo</em></p>

Actural Html
<p><em>___foo</em></p>

```

**Example457**

```markdown
Markdown content
__foo___

Expected Html
<p><strong>foo</strong>_</p>

Actural Html
<p><strong>foo_</strong></p>

```

**Example458**

```markdown
Markdown content
_foo____

Expected Html
<p><em>foo</em>___</p>

Actural Html
<p><em>foo___</em></p>

```

**Example465**

```markdown
Markdown content
******foo******

Expected Html
<p><strong><strong><strong>foo</strong></strong></strong></p>

Actural Html
<p>*<strong><strong><em>foo*</em></strong></strong></p>

```

**Example466**

```markdown
Markdown content
***foo***

Expected Html
<p><em><strong>foo</strong></em></p>

Actural Html
<p><strong><em>foo</em></strong></p>

```

**Example467**

```markdown
Markdown content
_____foo_____

Expected Html
<p><em><strong><strong>foo</strong></strong></em></p>

Actural Html
<p><strong><strong><em>foo</em></strong></strong></p>

```

**Example470**

```markdown
Markdown content
**foo **bar baz**

Expected Html
<p>**foo <strong>bar baz</strong></p>

Actural Html
<p><strong>foo **bar baz</strong></p>

```

**Example471**

```markdown
Markdown content
*foo *bar baz*

Expected Html
<p>*foo <em>bar baz</em></p>

Actural Html
<p><em>foo *bar baz</em></p>

```

**Example477**

```markdown
Markdown content
*a \`*\`*

Expected Html
<p><em>a <code>*</code></em></p>

Actural Html
<p>*a <code>*</code>*</p>

```

**Example486**

```markdown
Markdown content
[link](</my uri>)

Expected Html
<p><a href="/my%20uri">link</a></p>

Actural Html
<p>[link](&lt;/my uri&gt;)</p>

```

**Example489**

```markdown
Markdown content
[a](<b)c>)

Expected Html
<p><a href="b)c">a</a></p>

Actural Html
<p><a href="%3Cb">a</a>c&gt;)</p>

```

**Example490**

```markdown
Markdown content
[link](<foo\>)

Expected Html
<p>[link](&lt;foo&gt;)</p>

Actural Html
<p><a href="foo%5C">link</a></p>

```

**Example491**

```markdown
Markdown content
[a](<b)c
[a](<b)c>
[a](<b>c)

Expected Html
<p>[a](&lt;b)c
[a](&lt;b)c&gt;
[a](<b>c)</p>

Actural Html
<p><a href="%3Cb">a</a>c
<a href="%3Cb">a</a>c&gt;
<a href="%3Cb%3Ec">a</a></p>

```

**Example499**

```markdown
Markdown content
[link](foo%20b&auml;)

Expected Html
<p><a href="foo%20b%C3%A4">link</a></p>

Actural Html
<p><a href="foo%20b&auml;">link</a></p>

```

**Example503**

```markdown
Markdown content
[link](/url "title")

Expected Html
<p><a href="/url%C2%A0%22title%22">link</a></p>

Actural Html
<p><a href="/url" title="title">link</a></p>

```

**Example508**

```markdown
Markdown content
[link [foo [bar]]](/uri)

Expected Html
<p><a href="/uri">link [foo [bar]]</a></p>

Actural Html
<p>[link [foo [bar]]](/uri)</p>

```

**Example514**

```markdown
Markdown content
[foo [bar](/uri)](/uri)

Expected Html
<p>[foo <a href="/uri">bar</a>](/uri)</p>

Actural Html
<p><a href="/uri">foo <a href="/uri">bar</a></a></p>

```

**Example515**

```markdown
Markdown content
[foo *[bar [baz](/uri)](/uri)*](/uri)

Expected Html
<p>[foo <em>[bar <a href="/uri">baz</a>](/uri)</em>](/uri)</p>

Actural Html
<p>[foo *<a href="/uri">bar <a href="/uri">baz</a></a>*](/uri)</p>

```

**Example516**

```markdown
Markdown content
![[[foo](uri1)](uri2)](uri3)

Expected Html
<p><img src="uri3" alt="[foo](uri2)" /></p>

Actural Html
<p>![<a href="uri2"><a href="uri1">foo</a></a>](uri3)</p>

```

**Example524**

```markdown
Markdown content
[link [foo [bar]]][ref]

[ref]: /uri

Expected Html
<p><a href="/uri">link [foo [bar]]</a></p>

Actural Html
<p>[link [foo [bar]]]<a href="/uri">ref</a></p>

```

**Example528**

```markdown
Markdown content
[foo [bar](/uri)][ref]

[ref]: /uri

Expected Html
<p>[foo <a href="/uri">bar</a>]<a href="/uri">ref</a></p>

Actural Html
<p><a href="/uri">foo <a href="/uri">bar</a></a></p>

```

**Example529**

```markdown
Markdown content
[foo *bar [baz][ref]*][ref]

[ref]: /uri

Expected Html
<p>[foo <em>bar <a href="/uri">baz</a></em>]<a href="/uri">ref</a></p>

Actural Html
<p><a href="/uri">foo <em>bar <a href="/uri">baz</a></em></a></p>

```

**Example532**

```markdown
Markdown content
[foo <bar attr="][ref]">

[ref]: /uri

Expected Html
<p>[foo <bar attr="][ref]"></p>

Actural Html
<p><a href="/uri">foo &lt;bar attr=&quot;</a>&quot;&gt;</p>

```

**Example533**

```markdown
Markdown content
[foo\`][ref]\`

[ref]: /uri

Expected Html
<p>[foo<code>][ref]</code></p>

Actural Html
<p><a href="/uri">foo`</a>`</p>

```

**Example534**

```markdown
Markdown content
[foo<http://example.com/?search=][ref]>

[ref]: /uri

Expected Html
<p>[foo<a href="http://example.com/?search=%5D%5Bref%5D">http://example.com/?search=][ref]</a></p>

Actural Html
<p><a href="/uri">foo&lt;http://example.com/?search=</a>&gt;</p>

```

**Example570**

```markdown
Markdown content
![foo ![bar](/url)](/url2)

Expected Html
<p><img src="/url2" alt="foo bar" /></p>

Actural Html
<p><img src="/url2" alt="foo ![bar](/url)"></p>

```

**Example571**

```markdown
Markdown content
![foo [bar](/url)](/url2)

Expected Html
<p><img src="/url2" alt="foo bar" /></p>

Actural Html
<p><img src="/url2" alt="foo [bar](/url)"></p>

```

**Example598**

```markdown
Markdown content
<http://foo.bar/baz bim>

Expected Html
<p>&lt;http://foo.bar/baz bim&gt;</p>

Actural Html
<p>&lt;<a href="http://foo.bar/baz">http://foo.bar/baz</a> bim&gt;</p>

```

**Example604**

```markdown
Markdown content
< http://foo.bar >

Expected Html
<p>&lt; http://foo.bar &gt;</p>

Actural Html
<p>&lt; <a href="http://foo.bar">http://foo.bar</a> &gt;</p>

```

**Example607**

```markdown
Markdown content
http://example.com

Expected Html
<p>http://example.com</p>

Actural Html
<p><a href="http://example.com">http://example.com</a></p>

```

**Example608**

```markdown
Markdown content
foo@bar.example.com

Expected Html
<p>foo@bar.example.com</p>

Actural Html
<p><a href="mailto:foo@bar.example.com">foo@bar.example.com</a></p>

```

**Example622**

```markdown
Markdown content
foo <!-- not a comment -- two hyphens -->

Expected Html
<p>foo &lt;!-- not a comment -- two hyphens --&gt;</p>

Actural Html
<p>foo <!-- not a comment -- two hyphens --></p>

```

**Example623**

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

```

