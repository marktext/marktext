// we can load custom theme from userData folder, we also can write this theme in userData folder.

export const dark = `
:root {
  --themeColor: #f48237;
  --highlightColor: rgba(244, 130, 55, .9);
  --selectionColor: rgba(244, 130, 55, .4);
  --editorColor: rgba(255, 255, 255, .8);
  --editorColor50: rgba(255, 255, 255, .5);
  --editorColor30: rgba(255, 255, 255, .3);
  --editorColor10: rgba(255, 255, 255, .1);
  --editorBgColor: #34393f;
  --deleteColor: #ff6969;
  --iconColor: rgba(255, 255, 255, .8);
  --codeBgColor: #d8d8d869;
  --codeBlockBgColor: rgba(244, 130, 55, .04);
  --sideBarColor: rgba(255, 255, 255, .6);
  --sideBarTitleColor: rgba(255, 255, 255, 1);
  --sideBarTextColor: rgba(255, 255, 255, .4);
  --sideBarBgColor: rgba(26, 33, 41, 0.9);
  --sideBarItemHoverBgColor: rgba(255, 255, 255, .03);
  --itemBgColor: rgba(71, 78, 86, 0.6);
  --floatBgColor: #3c4650;
  --floatHoverColor: rgba(255, 255, 255, .04);
  --floatBorderColor: rgba(0, 0, 0, .1);
  --editorAreaWidth: 700px;
}
/**
 * okaidia theme for JavaScript, CSS and HTML
 * Loosely based on Monokai textmate theme by http://www.monokai.nl/
 * @author ocodia
 */

code[class*="language-"],
pre.ag-paragraph {
   color: #f8f8f2;
   /*font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;*/
   text-align: left;
   white-space: pre;
   word-spacing: normal;
   word-break: normal;
   word-wrap: normal;
   -moz-tab-size: 4;
   -o-tab-size: 4;
   tab-size: 4;
 
   -webkit-hyphens: none;
   -moz-hyphens: none;
   -ms-hyphens: none;
   hyphens: none;
   overflow: visible;
 }
 
 /* Code blocks */
 pre.ag-paragraph {
   padding: 1em;
   margin: 1em 0;
   border-radius: 0.3em;
 }
 
 :not(pre) > code[class*="language-"],
 pre.ag-paragraph {
   /*background: #272822;*/
 }
 
 /* Inline code */
 :not(pre) > code[class*="language-"] {
   padding: .1em;
   border-radius: .3em;
   white-space: normal;
 }
 
 .token.comment,
 .token.prolog,
 .token.doctype,
 .token.cdata {
   color: slategray;
 }
 
 .token.punctuation {
   color: #f8f8f2;
 }
 
 .namespace {
   opacity: .7;
 }
 
 .token.property,
 .token.tag,
 .token.constant,
 .token.symbol {
   color: #f92672;
 }
 
 .token.boolean,
 .token.number {
   color: #ae81ff;
 }
 
 .token.selector,
 .token.attr-name,
 .token.string,
 .token.char,
 .token.builtin {
   color: #a6e22e;
 }

 .token.inserted {
  color: #22863a;
  background: #f0fff4;
}

.token.deleted {
  color: #b31d28;
  background: #ffeef0;
}
 
 .token.operator,
 .token.entity,
 .token.url,
 .language-css .token.string,
 .style .token.string,
 .token.variable {
   color: #f8f8f2;
 }
 
 .token.atrule,
 .token.attr-value,
 .token.function,
 .token.class-name {
   color: #e6db74;
 }
 
 .token.keyword {
   color: #66d9ef;
 }
 
 .token.regex,
 .token.important {
   color: #fd971f;
 }
 
 .token.important,
 .token.bold {
   font-weight: bold;
 }
 .token.italic {
   font-style: italic;
 }
 
 .token.entity {
   cursor: help;
 }
`
