# XSS Tests

<script>throw new Error('XSS 1')</script>

<img src="#" onerror="throw new Error('XSS 2')">

<svg/onload="throw new Error('XSS 3')">

<svg width="100" height="100">
  <script>throw new Error('XSS 4')</script>
  <rect width="100" height="100" style="fill:rgb(0,0,0)" />
</svg>

<iframe src="javascript:throw new Error('XSS 5');"></iframe>

<iframe src="#" onerror="throw new Error('XSS 6')" onload="throw new Error('XSS 6')"></iframe>

<iframe src="not-a-real-file.extension" onerror="throw new Error('XSS 7')" onload="throw new Error('XSS 7')"></iframe>

<iframe/src="data:text/html,<svg onload=\"throw new Error('XSS 7')\"">

<embed src="data:image/svg+xml;base64,PHN2ZyB4bWxuczpzdmc9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjAiIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48c2NyaXB0PnRocm93IG5ldyBFcnJvcignWFNTIDgnKTwvc2NyaXB0Pjwvc3ZnPgo=" type="image/svg+xml" AllowScriptAccess="always"></embed>

<script foo>throw new Error('XSS 9')</script>
