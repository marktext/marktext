### Block addition properties and its value

##### 1. span

- functionType

  - languageInput

  - footnoteInput

  - codeContent (used in code block)

  - cellContent (used in table cell, it's parent must be th or td block)

  - atxLine (can not contain soft line break and hard line break use in atx heading)

  - thematicBreakLine (can not contain soft line break and hard line break use in thematic break)

  - paragraphContent (defaultValue use in paragraph and setext heading)

- lang - only when it's functionType is `codeContent`

  - All prismjs support language or empty string

##### 2. div

used for preview `block math`, `mermaid`, `flowchart`, `vega-lite`, `sequence`, `plantuml` and `html block`.

- functionType

  - multiplemath

  - mermaid

  - flowchart

  - vega-lite

  - sequence

  - plantuml

  - html

##### 3. figure

The container block of `table`, `html`, `block math`, `mermaid`,`flowchart`,`vega-lite`,`sequence`,`plantuml`.

- functionType

  - table

  - footnote

  - html

  - multiplemath

  - mermaid

  - flowchart

  - vega-lite

  - sequence

  - plantuml

##### 4. pre

Used for `html`,`block math`,`mermaid`,`flowchart`,`vega-lite`,`sequence`, `plantuml`, `code block`.

- functionType

  - html

  - multiplemath

  - mermaid

  - flowchart

  - vega-lite

  - sequence

  - plantuml

  - fencecode

  - indentcode

  - frontmatter

- lang

  - all prismjs support language or empty string

##### 5. code

- lang

  - all prismjs support language or empty string

##### ul

- listType

  - bullet

  - task

##### ol

- listType

  - order

- start

  - 0-999999999

##### li

- listItemType

  - order

  - bullet

  - task

- isLooseListItem

  - true

  - false

- bulletMarkerOrDelimiter

  - bulletMarker：`-`, `+`, `*`

  - Delimiter：  `)`, `.`

##### h1~6

- headingStyle

  - atx

  - setext

- marker - only setext heading has marker

##### input

- checked

  - true

  - false

##### table

- row

- column

##### th/td

- align

- column
