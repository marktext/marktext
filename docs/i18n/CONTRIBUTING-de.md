> 🌐 Dies ist die deutsche Übersetzung von [CONTRIBUTING.md](../../.github/CONTRIBUTING.md).

# MarkText Contributing Guide

Wir freuen uns sehr, dass du dich für einen Beitrag zu MarkText interessierst :tada:. Bevor du deinen Beitrag einreichst, nimm dir bitte einen Moment Zeit und lies die folgenden Richtlinien durch.

- [Code of Conduct](../../packages/website/content/docs/dev/CODE_OF_CONDUCT.md)
- [Philosophie](#philosophie)
- [Richtlinien zum Melden von Issues](#richtlinien-zum-melden-von-issues)
- [Richtlinien für Pull Requests](#richtlinien-für-pull-requests)
  - [Wo sollte ich anfangen?](#wo-sollte-ich-anfangen)
- [Schnellstart](#schnellstart)
  - [Build-Anleitung](#build-anleitung)
  - [Style Guide](#style-guide)
- [Entwicklerdokumentation](#entwicklerdokumentation)

## Philosophie

🔑 Unsere Philosophie ist es, die Dinge sauber, einfach und minimal zu halten.
MarkText verändert sich ständig, und wir möchten, dass diese Verbesserungen mit unserer Philosophie im Einklang stehen. Schau dir zum Beispiel die Seitenleiste und die Tabs an; diese beiden Panels bieten großartige Funktionalität *und* lenken den Benutzer nicht ab. Wir werden weiterhin mehr Features (wie Plugins) hinzufügen, die über die „Einstellungen“ aktiviert werden können, um MarkText zu verbessern. So kann jeder MarkText an seine Bedürfnisse anpassen und erhält trotzdem eine minimale Standardoberfläche.

## Richtlinien zum Melden von Issues

Bitte suche nach ähnlichen Issues, bevor du ein neues Issue eröffnest, und halte dich immer an das [Issue-Template](../../.github/ISSUE_TEMPLATE/). Bitte sieh dir die folgenden Pull-Request-Richtlinien an, bevor du deinen eigenen PR erstellst.

## Richtlinien für Pull Requests

**In *allen* Pull Requests:** Gib eine detaillierte Beschreibung des Problems an, ebenso wie eine Demonstration mit Bildschirmaufnahmen und/oder Screenshots.

Bitte stelle sicher, dass Folgendes erledigt ist, bevor du einen PR einreichst:

- Reiche PRs direkt am `develop`-Branch ein.
- Verweise im PR-Kommentar auf das zugehörige Issue.
- Nutze [JSDoc](https://github.com/jsdoc/jsdoc) für eine bessere Code-Dokumentation.
- Stelle sicher, dass alle Tests bestehen.
- Bitte lass deinen PR durch den Linter laufen (`pnpm run lint`).
- Alle PRs müssen die **CI** bestehen, bevor sie gemergt werden. Falls sie fehlschlägt, versuche bitte, die Probleme zu beheben, und frag gern jederzeit nach Hilfe.

Wenn du ein neues Feature hinzufügst:

- Eröffne zuerst ein Vorschlags-Issue.
- Begründe, warum du dieses Feature hinzufügen möchtest.
- Reiche deinen PR ein.

Wenn du einen Bug behebst:

- Wenn du ein bestimmtes Issue löst, füge bitte `fix: #<issue number> <short message>` in deinen PR-Titel ein (z. B. `fix: #3899 update entities encoding/decoding`).
- Gib eine detaillierte Beschreibung des Bugs in deinem PR an und/oder verlinke das Issue.

### Wo sollte ich anfangen?

Ein guter Einstieg ist es, ein [Issue](https://github.com/marktext/marktext/issues) zu finden, das mit `bug`, `help wanted` oder `feature request` gekennzeichnet ist. Die mit `good first issue` markierten Issues eignen sich gut für Neueinsteiger. Bitte diskutiere die Lösung größerer Issues zuerst, und nachdem die endgültige Lösung von den MarkText-Mitgliedern genehmigt wurde, kannst du den PR einreichen bzw. daran arbeiten. Für kleine Änderungen kannst du direkt einen PR eröffnen.

Weitere Möglichkeiten zu helfen:

- Dokumentation
- Übersetzungen
- Icons und Logos gestalten
- Die UI verbessern
- Tests für MarkText schreiben
- Teile deine Gedanken! Wir möchten von Features hören, die deiner Meinung nach fehlen, von Bugs, die du findest, und davon, warum du MarkText :heart:.

## Schnellstart

1. Forke das Repository.
2. Klone deinen Fork: `git clone git@github.com:<username>/marktext.git`
3. Erstelle einen Feature-Branch: `git checkout -b feature`
4. Nimm deine Änderungen vor und pushe deinen Branch.
5. Erstelle einen PR gegen `develop` und beschreibe deine Änderungen.

**Rebase deines PR:**

Wenn es Konflikte gibt oder du deinen lokalen Branch aktualisieren möchtest, gehe bitte wie folgt vor:

1. `git fetch upstream`
2. `git rebase upstream/develop`
3. Bitte [behebe](https://help.github.com/articles/resolving-merge-conflicts-after-a-git-rebase/) alle Konflikte und force-pushe deinen Feature-Branch: `git push -f`

### Build-Anleitung

🔗 [Build-Anleitung](https://marktext.me/docs/dev/build)

### Style Guide

Du kannst ESLint (`pnpm run lint`) ausführen, um dir dabei zu helfen, den Style Guide einzuhalten.

- ES6 und „Best Practices“
- 2 Leerzeichen Einrückung
- keine Semikolons
- Dokumentation: [JSDoc](https://github.com/jsdoc/jsdoc)

## Entwicklerdokumentation

Bitte [klicke hier](https://marktext.me/docs/dev/overview) für weitere Details.
