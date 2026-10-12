The complete Noto Music and Noto Sans Math regular fonts are bundled as WOFF2
under the SIL Open Font License 1.1. Their licenses are in `NotoMusic_LICENSE`
and `NotoSansMath_LICENSE`.

Sources:

- https://github.com/google/fonts/blob/main/ofl/notomusic/NotoMusic-Regular.ttf
- https://github.com/google/fonts/blob/main/ofl/notosansmath/NotoSansMath-Regular.ttf

The TTFs were converted without subsetting using FontTools 4.66.1 and Brotli:

```python
from fontTools.ttLib import TTFont

for family in ('NotoMusic', 'NotoSansMath'):
    font = TTFont(f'{family}-Regular.ttf')
    font.flavor = 'woff2'
    font.save(f'{family}-Regular.woff2')
```

The CSS limits these faces to music notation and technical brackets, so they
do not change ordinary text or mathematical typesetting. Both remain after
the configured editor font stack to preserve user font preferences.

All styled HTML exports embed both fonts and their license
notices as data URIs and CSS comments. The PDF/print container loads the fonts
before printing because it is hidden during screen layout.
