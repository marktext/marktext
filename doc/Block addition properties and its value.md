### Block addition properties and its value

##### 1. span

- functionType
  
  - languageInput
  
  - codeLine
  
  - paragraphContent (defaultValue)

- lang - only when it's code line
  
  - All prismjs support language or empty string

##### 2. div

used for preview `block math`, `mermaid`, `flowchart`, `vega-lite`, `sequence` and `html block`.

- functionType
  
  - multiplemath
  
  - mermaid
  
  - flowchart
  
  - vega-lite
  
  - sequence
  
  - html

##### 3. figure

The container block of `table`, `html`, `block math`, `mermaid`,`flowchart`,`vega-lite`,`sequence`.

- functionType
  
  - table
  
  - html
  
  - multiplemath
  
  - mermaid
  
  - flowchart
  
  - vega-lite
  
  - sequence

##### 4. pre

Used for `html`,`block math`,`mermaid`,`flowchart`,`vega-lite`,`sequence` `code block`.

- functionType
  
  - html
  
  - multiplemath
  
  - mermaid
  
  - flowchart
  
  - vega-lite
  
  - sequence
  
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
