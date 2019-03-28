// we can load custom theme from userData folder, we also can write this theme in userData folder.
import imageDark from '../../muya/lib/assets/icons/image_dark.png'
import imageDarkFail from '../../muya/lib/assets/icons/image_dark_fail.png'

export const dark = `
:root {
  /*editor*/
  --themeColor: #f48237;
  --highlightColor: rgba(244, 130, 55, .9);
  --selectionColor: rgba(244, 130, 55, .4);
  --editorColor: rgba(255, 255, 255, .8);
  --editorColor50: rgba(255, 255, 255, .5);
  --editorColor30: rgba(255, 255, 255, .3);
  --editorColor10: rgba(255, 255, 255, .1);
  --editorColor04: rgba(255, 255, 255, .04);
  --editorBgColor: #34393f;
  --deleteColor: #ff6969;
  --iconColor: rgba(255, 255, 255, .8);
  --codeBgColor: #d8d8d869;
  --codeBlockBgColor: rgba(244, 130, 55, .04);
  /*marktext*/
  --sideBarColor: rgba(255, 255, 255, .6);
  --sideBarTitleColor: rgba(255, 255, 255, 1);
  --sideBarTextColor: rgba(255, 255, 255, .4);
  --sideBarBgColor: rgba(26, 33, 41, 0.9);
  --sideBarItemHoverBgColor: rgba(255, 255, 255, .03);
  --itemBgColor: rgba(71, 78, 86, 0.6);
  --floatBgColor: #3c4650;
  --floatHoverColor: rgba(255, 255, 255, .04);
  --floatBorderColor: rgba(0, 0, 0, .03);
  --floatShadow: rgba(0, 0, 0, 0.1);
  --editorAreaWidth: 700px;
}
div.title-bar .frameless-titlebar-button > div > svg {
  fill: #ffffff;
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

.ag-image-marked-text::before {
  background: url(${imageDark});
}

.ag-image-marked-text.ag-image-fail::before {
  background-image: url(${imageDarkFail});
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


export const ulysses = `
:root {
  --themeColor: rgb(12, 139, 186);
  --highlightColor: rgba(12, 139, 186, .9);
  --selectionColor: rgba(12, 139, 186, .4);
  --editorColor: rgba(101, 101, 101, .8);
  --editorColor50: rgba(101, 101, 101, .5);
  --editorColor30: rgba(101, 101, 101, .3);
  --editorColor10: rgba(101, 101, 101, .1);
  --editorColor04: rgba(101, 101, 101, .04);
  --editorBgColor: #f3f3f3;
  --deleteColor: #ff6969;
  --iconColor: rgba(101, 101, 101, .8);
  --codeBgColor: #d8d8d869;
  --codeBlockBgColor: rgba(12, 139, 186, .04);
  --sideBarColor: rgba(101, 101, 101, .6);
  --sideBarTitleColor: rgba(101, 101, 101, 1);
  --sideBarTextColor: rgba(101, 101, 101, .4);
  --sideBarBgColor: rgba(248, 248, 248, 0.9);
  --sideBarItemHoverBgColor: rgba(101, 101, 101, .03);
  --itemBgColor: rgba(245, 245, 245, 0.6);
  --floatBgColor: #ffffff;
  --floatHoverColor: rgba(101, 101, 101, .04);
  --floatBorderColor: rgba(0, 0, 0, .03);
  --floatShadow: rgba(0, 0, 0, 0.1);
  --editorAreaWidth: 700px;
}
h1, h2, h3, h4, h5, h6 {
  color: var(--themeColor);
  text-align: center;
}
li.ag-bullet-list-item {
  position: relative;
  list-style: none;
}
li.ag-bullet-list-item::before {
  content: '';
  display: block;
  position: absolute;
  width: 5px;
  height: 2px;
  left: -18px;
  top: 15px;
  background: var(--editorColor);
}
blockquote.ag-paragraph {
  background: rgb(233, 233, 233);
}
blockquote.ag-paragraph::before {
  content: none;
}
li.ag-paragraph {
  color: var(--editorColor);
}
/*task list*/
li.ag-task-list-item {
  list-style-type: none;
  position: relative;
}

li.ag-task-list-item > input[type=checkbox] {
  position: absolute;
  cursor: pointer;
  width: 16px;
  height: 16px;
  margin: 4px 0px 0px;
  top: 2px;
  left: -22px;
  transform-origin: center;
  transform: rotate(-90deg);
  transition: all .2s ease;
}

li.ag-task-list-item > input.ag-checkbox-checked {
  transform: rotate(0);
  opacity: .5;
}

li.ag-task-list-item > input[type=checkbox]::before {
  content: '';
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  display: inline-block;
  border: 2px solid var(--editorColor);
  border-radius: 2px;
  background-color: var(--editorBgColor);
  position: absolute;
  top: 0;
  left: 0;
  transition: all .2s ease;
}

li.ag-task-list-item > input.ag-checkbox-checked::before {
  border: transparent;
  background-color: var(--editorColor);
}

li.ag-task-list-item > input::after {
  content: '';
  transform: rotate(-45deg) scale(0);
  width: 9px;
  height: 5px;
  border: 2px solid #fff;
  border-top: none;
  border-right: none;
  position: absolute;
  display: inline-block;
  top: 1px;
  left: 5px;
  transition: all .2s ease;
}

li.ag-task-list-item > input.ag-checkbox-checked::after {
  transform: rotate(-45deg) scale(1);
}
/*horizontal line*/
p:not(.ag-active)[data-role="hr"]::before {
  content: '';
  position: absolute;
  width: 50%;
  display: block;
  left: 50%;
  top: 50%;
  height: 2px;
  box-sizing: border-box;
  border-bottom: 2px dashed var(--editorColor50);
  transform: translateX(-50%) translateY(-50%);
}
`

export const graphite = `
:root {
  --themeColor: rgb(104, 134, 170);
  --highlightColor: rgba(104, 134, 170, .9);
  --selectionColor: rgba(104, 134, 170, .4);
  --editorColor: rgba(43, 48, 50, .8);
  --editorColor50: rgba(43, 48, 50, .5);
  --editorColor30: rgba(43, 48, 50, .3);
  --editorColor10: rgba(43, 48, 50, .1);
  --editorColor04: rgba(43, 48, 50, .04);
  --editorBgColor: #f7f7f7;
  --deleteColor: #ff6969;
  --iconColor: rgba(135, 135, 135, .8);
  --codeBgColor: #d8d8d869;
  --codeBlockBgColor: rgba(104, 134, 170, .04);
  --sideBarColor: rgba(188, 193, 197, .8);
  --sideBarTitleColor: rgba(255, 255, 255, 1);
  --sideBarTextColor: rgba(188, 193, 197, .4);
  --sideBarBgColor: rgba(69, 75, 80, 1);
  --sideBarItemHoverBgColor: rgba(255, 255, 255, .03);
  --itemBgColor: rgba(43, 48, 50, .5);
  --floatBgColor: rgb(237, 237, 238);
  --floatHoverColor: rgba(43, 48, 50, .04);
  --floatBorderColor: rgba(0, 0, 0, .03);
  --floatShadow: rgba(0, 0, 0, 0.1);
  --editorAreaWidth: 700px;
}
li.ag-paragraph {
  color: var(--editorColor);
}
/*task list*/
li.ag-task-list-item {
  list-style-type: none;
  position: relative;
}

li.ag-task-list-item > input[type=checkbox] {
  position: absolute;
  cursor: pointer;
  width: 16px;
  height: 16px;
  margin: 4px 0px 0px;
  top: 2px;
  left: -22px;
  transform-origin: center;
  transform: rotate(-90deg);
  transition: all .2s ease;
}

li.ag-task-list-item > input.ag-checkbox-checked {
  transform: rotate(0);
  opacity: .5;
}

li.ag-task-list-item > input[type=checkbox]::before {
  content: '';
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  display: inline-block;
  border: 2px solid var(--editorColor);
  border-radius: 2px;
  background-color: var(--editorBgColor);
  position: absolute;
  top: 0;
  left: 0;
  transition: all .2s ease;
}

li.ag-task-list-item > input.ag-checkbox-checked::before {
  border: transparent;
  background-color: var(--editorColor);
}

li.ag-task-list-item > input::after {
  content: '';
  transform: rotate(-45deg) scale(0);
  width: 9px;
  height: 5px;
  border: 2px solid #fff;
  border-top: none;
  border-right: none;
  position: absolute;
  display: inline-block;
  top: 1px;
  left: 5px;
  transition: all .2s ease;
}

li.ag-task-list-item > input.ag-checkbox-checked::after {
  transform: rotate(-45deg) scale(1);
}
/*horizontal line*/
p:not(.ag-active)[data-role="hr"]::before {
  content: '';
  position: absolute;
  width: 100%;
  display: block;
  left: 50%;
  top: 50%;
  height: 2px;
  box-sizing: border-box;
  border-bottom: 2px dashed var(--editorColor50);
  transform: translateX(-50%) translateY(-50%);
}
`
