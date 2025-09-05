# Testing Problem Diagrams in Mermaid v11

## 1. Pie Chart
```mermaid
pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
```

## 2. Block Diagram (Beta)
```mermaid
block-beta
columns 3
  a:3
  block:alice:2
  c
  d
  e
```

## 3. GitGraph
```mermaid
gitGraph
    commit
    branch develop
    checkout develop
    commit
    commit
```

## 4. Alternative GitGraph with colon
```mermaid
gitGraph:
    commit
    branch develop
    checkout develop
    commit
    commit
```

## Working Reference - Flowchart
```mermaid
flowchart TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]
```