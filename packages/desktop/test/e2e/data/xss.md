# XSS Tests

### HTML

<script>process.crash()</script>

<img src="#" onerror="process.crash()">

<svg/onload="process.crash()">

<svg width="100" height="100">
  <script>process.crash()</script>
  <rect width="100" height="100" style="fill:rgb(0,0,0)" />
</svg>

<iframe src="javascript:process.crash();"></iframe>

<iframe src="#" onerror="process.crash()" onload="process.crash()"></iframe>

<iframe src="not-a-real-file.extension" onerror="process.crash()" onload="process.crash()"></iframe>

<iframe/src="data:text/html,<svg onload=\"process.crash()\"">

<embed src="data:image/svg+xml;base64,PHN2ZyB4bWxuczpzdmc9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjAiIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48c2NyaXB0PnRocm93IG5ldyBFcnJvcignWFNTIDgnKTwvc2NyaXB0Pjwvc3ZnPgo=" type="image/svg+xml" AllowScriptAccess="always"></embed>

<script foo>process.crash()</script>

#### Markdown

```<style/onload=process.crash()>
foo
```

```"><script>process.crash()</script>
foo
```
