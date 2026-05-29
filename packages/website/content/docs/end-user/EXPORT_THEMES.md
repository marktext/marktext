# Themes (Export)

MarkText allows you to modify the appearance of the document that you want to export. By default we provide three themes: Academic, GitHub and Liber (writing theme).

## Install a theme

You can install a theme by copying the `.css` file to `themes/export/` directory inside the [application data directory](APPLICATION_DATA_DIRECTORY.md) location but you may need to restart MarkText to detect the theme.

## Create a theme

MarkText use the GitHub theme as basic style that is always available. A custom theme can add additional styles but have to overwrite the GitHub style to make changes such as font family or the underling for heading. You can see all predefined styles [here](https://github.com/sindresorhus/github-markdown-css/blob/gh-pages/github-markdown.css). An example for custom themes can be found [here](https://github.com/marktext/marktext/blob/develop/src/renderer/assets/themes/export/academic.theme.css) and [here](https://github.com/marktext/marktext/blob/develop/src/renderer/assets/themes/export/liber.theme.css).

### Theme settings

A theme currently only have a name (`A-z0-9 -`) that is defined by a CSS comment at the first line like:

```css
/** Liber **/

.markdown-body {
  /* ... */
}
```
