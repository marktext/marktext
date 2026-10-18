The complete Noto Music and Noto Sans Math regular fonts are bundled as WOFF2
under the SIL Open Font License 1.1. The complete license texts are embedded in
each font's `name` table (name ID 13); the original copyright metadata remains.

Sources:

- https://github.com/google/fonts/blob/main/ofl/notomusic/NotoMusic-Regular.ttf
- https://github.com/google/fonts/blob/main/ofl/notosansmath/NotoSansMath-Regular.ttf

The TTFs were converted without subsetting using FontTools 4.66.1 and Brotli.
Download each family's `OFL.txt` alongside its TTF before converting:

```python
from fontTools.ttLib import TTFont
from pathlib import Path

for family in ('NotoMusic', 'NotoSansMath'):
    font = TTFont(f'{family}-Regular.ttf')
    license_text = Path(f'{family}/OFL.txt').read_text()
    for record in font['name'].names:
        if record.nameID == 13:
            record.string = license_text.encode(record.getEncoding())
    font.flavor = 'woff2'
    font.save(f'{family}-Regular.woff2')
```

The CSS limits these faces to music notation and technical brackets, so they
do not change ordinary text or mathematical typesetting. Built-in export
styles put these range-limited faces first to avoid system missing-glyph
placeholders taking precedence over the bundled notation.

All styled HTML exports embed both fonts as data URIs. The PDF/print container loads the fonts
before printing because it is hidden during screen layout.
