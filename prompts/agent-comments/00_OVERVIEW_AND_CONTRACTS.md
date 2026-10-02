# MarkText Agent Comments — комплект промптов для реализации

> Источник требований: **`prompts/TZ-marktext-agent-comments.md` (версия 1)** плюс решения из
> интервью от 2 октября 2026 (§0 ниже). Если ТЗ и §0 расходятся, действует §0.
>
> Этот файл — «нулевой» контекст. Его дают исполнителю **первым** и держат в контексте всех
> последующих сессий. Он фиксирует решения, раскладку модулей, общие константы и контракты
> между процессами, чтобы у исполнителя не было разночтений.
>
> Исполнитель — любой кодовый агент (Claude Code, Cursor, OpenCode). Один промпт — один шаг
> размером с PR, у каждого есть **Definition of Done (DoD)** и команды проверки. Перед началом
> любого шага исполнитель читает `AGENTS.md` в корне репозитория и `packages/muya/AGENTS.md`,
> если трогает muya.

## 0. Зафиксированные решения

| # | Решение | Значение |
|---|---|---|
| D1 | Платформы v1 | **Linux и Windows**. macOS — без гарантий: сборка не должна ломаться, но не тестируется |
| D2 | Поставка | Внутренний форк `agentic-marktext`, PR в его `develop`. UI-строки на **en и ru**, в остальных 10 локалях — копия en (тест `locale-validation.spec.ts` требует одинаковых ключей) |
| D3 | Протокол harness | Все три harness — **ACP (Agent Client Protocol) по stdio**. Cursor — через нативный `agent acp` (а не свой адаптер `cursor-agent`, как в ТЗ §3). Отличия harness живут в тонком слое особенностей (`quirks`) |
| D4 | Команды по умолчанию | OpenCode: `opencode acp`; Pi: `pi-acp`; Cursor: `agent acp`. Путь к программе задаётся в настройках; пустой путь — поиск в `PATH` (с учётом `envPath` MarkText) |
| D5 | Список моделей | Адаптер открывает **пробную ACP-сессию** в корне репозитория без промпта, читает `configOptions` с `category == "model"` и закрывает сессию. Результат кэшируется для каждого harness, в UI есть кнопка «Обновить». Пустой список — модель выбрать нельзя, причина видна |
| D6 | Ответ в тред | **MCP-сервер редактора** с инструментом `reply_to_thread`. Передаётся в `session/new`/`resume` через `mcpServers` как stdio-сервер. Это мост: дочерний процесс (Electron с `ELECTRON_RUN_AS_NODE=1`), который связан с main-процессом через локальный сокет (Unix socket или Windows named pipe) и аутентифицирован токеном хода |
| D7 | Запасной путь ответа | В quirks адаптера есть флаг `repliesVia: 'mcp' \| 'block'`. Для harness, который игнорирует MCP из `session/new` (проверяется на spike B-0; вероятный кандидат — pi-acp), редактор разбирает блок ```` ```marktext-replies ```` из финального ответа агента. Запись всё равно идёт через ту же операцию `CommentsService.appendAgentReply` |
| D8 | Выделение для комментария | **Только внутри одного текстового блока** (абзац, заголовок, пункт списка, ячейка таблицы, строка цитаты). Правило одинаковое для WYSIWYG и режима исходника. Выделение через границу блока — команда недоступна, показывается подсказка |
| D9 | Режим исходника (CodeMirror 5) | Создание и подсветка комментариев работают (`markText`). Якорь общий для обоих режимов, треды переносятся между режимами без потерь |
| D10 | Привязка при собственных правках | После паузы во вводе (debounce 400 мс) цитата ищется заново тем же алгоритмом, что и после внешней правки. Не нашлась или нашлась неоднозначно — тред **оторван**. Признак оторванности вычисляется во время работы и в JSON **не хранится** |
| D11 | Несохранённый файл | Перед отправкой агенту текущий `.md` **сохраняется автоматически** (если есть несохранённые правки) |
| D12 | Агент не ответил в тред | По окончании хода в чате появляется системное предупреждение со списком тредов без ответа, на тредах — бейдж «нет ответа агента». Автоповтора нет |
| D13 | Правила тредов | Закрытый тред можно открыть снова. Реплики агента человек не редактирует и не удаляет. Свою реплику человек может править и удалять. Удаление треда — жёсткое (из JSON), с подтверждением. Переименование или перенос `.md` средствами MarkText переносит JSON; внешние переименования не отслеживаются |
| D14 | Раскладка | Новая **правая панель** с вкладками «Комментарии \| Чат», ширина регулируется. **Diff** — специальная вкладка только для чтения в ряду вкладок редактора. **Терминал** — скрываемая нижняя панель под редактором |
| D15 | Diff | **diff2html** поверх `git diff HEAD`. Режимы «единый» и «рядом», список файлов. Принятия и отклонения кусков нет |
| D16 | Терминал | **xterm.js + node-pty**, несколько вкладок, все стартуют в корне репозитория. Shell по умолчанию: `$SHELL` (Linux) или `powershell.exe` (Windows); путь меняется в настройках |
| D17 | Пути, записанные в ходе | Объединение двух источников: (а) пути из ACP — `locations` и diff-контент в `tool_call`/`tool_call_update`; (б) разница снимков рабочей копии до и после хода (`git status --porcelain=v1 -z --untracked-files=all` плюс хэши содержимого). Исключаются `.marktext/comments/**` и пути, которые за время хода сохранил сам MarkText, если ACP о них не сообщал |
| D18 | Diff после хода | Вкладка diff открывается сама, только если в ходе есть изменённые пути. Иначе в чате пометка «файлы не изменены». Под каждым завершённым ходом в чате есть ссылка «Изменения хода (N)» |
| D19 | Репозиторий и окно | Корень находится через `git rev-parse --show-toplevel` (открыта может быть и подпапка). Агент, терминал и `.marktext/` живут в корне. Попытка открыть тот же репозиторий во втором окне фокусирует уже открытое окно. Если в окне заменили папку во время хода — подтверждение, отмена хода, процессы harness и терминалы старого репозитория завершаются |
| D20 | Где выбирается harness и модель | В окне настроек — новая страница «Агент»: включение режима, пути к трём harness, shell терминала, статус каждого harness с причиной недоступности. Пара «harness + модель» **для текущего репозитория** выбирается в шапке панели чата |
| D21 | Жизненный цикл процесса harness | Процесс запускается при первой отправке или открытии чата. Один процесс на окно — для активного harness. При смене harness старый процесс завершается. Во время хода сменить harness нельзя. При закрытии окна ход отменяется и процесс завершается |
| D22 | Язык служебной инструкции агенту | **Английский**, с явным требованием «отвечай в тред на языке реплик человека» |
| D23 | Состав треда в сообщении | Как в ТЗ (путь, цитата, признак оторванности, все реплики человека) **плюс** id треда, диапазон строк цитаты (если найдена) и предыдущие реплики агента с подписями |
| D24 | Тесты | Скриптовый **fake ACP-агент** (Node, сценарии из JSON) для unit- и Playwright-тестов в CI. Три реальных harness проверяются вручную по чеклисту приёмки (03, F-12) |
| D25 | Включение режима | Настройка `agentMode.enabled`, **по умолчанию включена**. Режим активен только в git-репозитории. Выключен — MarkText выглядит и работает как раньше |

### 0.1. Отличия от ТЗ (для согласования с заказчиком)

1. ТЗ §3: Cursor через `cursor-agent` и свой адаптер → **`agent acp`** (D3, D4).
2. ТЗ §5.1: «комментарий из выделения» → **выделение внутри одного блока** (D8).
3. ТЗ §6: состав сообщения расширен репликами агента и диапазоном строк (D23).
4. Добавлено: автосохранение перед отправкой (D11), повторное открытие треда (D13), выключатель режима (D25).

## 1. Раскладка новых модулей

Все пути — относительно `packages/desktop/`, если не указано иное.

```
src/
├── shared/types/
│   ├── agent.ts                  # HarnessId, ModelOption, ChatEvent, TurnRecord, PermissionRequest …
│   ├── comments.ts               # CommentsFile, Thread, Message, Anchor (контракт §3)
│   └── ipc.ts                    # + каналы mt::agent::*, mt::comments::*, mt::git::*, mt::term::* (§6)
├── main/
│   └── agent/
│       ├── index.ts              # регистрация IPC, связь с EditorWindow
│       ├── repo/
│       │   ├── gitService.ts     # rev-parse, user.name, status, diff, hash-object — execFile('git')
│       │   └── repoRegistry.ts   # repoRoot ↔ windowId, правило «один репозиторий — одно окно»
│       ├── comments/
│       │   ├── commentsStore.ts  # чтение/запись .marktext/comments/**, атомарная запись, сериализация
│       │   └── commentsService.ts# операции над тредами (единственная точка записи, §3.3)
│       ├── harness/
│       │   ├── harnessRegistry.ts# описания трёх harness + quirks (§4)
│       │   ├── acpConnection.ts  # обёртка над ACP TypeScript SDK: spawn, initialize, session/*
│       │   ├── modelProbe.ts     # пробная сессия → список моделей, кэш
│       │   └── replyBlockParser.ts # запасной путь D7
│       ├── mcpBridge/
│       │   ├── bridgeServer.ts   # сокет/pipe в main, проверка токена, вызов CommentsService
│       │   └── bridgeEntry.ts    # отдельный entry: stdio MCP-сервер ↔ сокет (собирается в out/)
│       ├── turn/
│       │   ├── messageBuilder.ts # шаблон сообщения агенту (§5)
│       │   ├── turnRunner.ts     # ход: отправка, события, отмена, финализация
│       │   └── changeTracker.ts  # снимки рабочей копии, объединение с ACP-путями (D17)
│       ├── sessions/
│       │   └── sessionStore.ts   # userData/agent/** (§7)
│       └── terminal/
│           └── ptyManager.ts     # node-pty, вкладки, resize, kill
├── preload/index.ts              # + window.agent.*, window.comments.*, window.term.* (типизированно)
├── types/global.d.ts             # + типы новых мостов
└── renderer/src/
    ├── store/
    │   ├── agent.ts              # состояние чата, хода, сессий, выбранной пары
    │   ├── comments.ts           # треды текущего файла, якоря, выбранный тред
    │   └── terminal.ts           # вкладки терминала
    ├── agent/anchoring/          # чистое ядро привязки (без DOM, покрыто unit-тестами)
    ├── components/
    │   ├── agentPanel/           # правая панель: вкладки, список тредов, тред, чат
    │   ├── diffView/             # вкладка diff (diff2html)
    │   └── terminalPanel/        # нижняя панель (xterm.js)
    └── prefComponents/agent/     # страница настроек «Агент»
test/
├── unit/specs/agent-*.spec.ts
├── e2e/agent-*.spec.ts
└── fixtures/fake-acp-agent/      # fake ACP-агент и сценарии (D24)
```

Изменения в `packages/muya/` (свой toolchain, 4 пробела, точки с запятой, префикс `_` у приватных
членов, `I` у интерфейсов) описаны в эпике F-1 файла 03.

## 2. Общие константы (`src/shared/types/agent.ts` и `comments.ts`)

| Константа | Значение | Назначение |
|---|---|---|
| `HARNESS_IDS` | `'opencode' \| 'pi' \| 'cursor'` | Идентификаторы harness |
| `COMMENTS_DIR` | `.marktext/comments` | Каталог тредов относительно корня репозитория |
| `COMMENTS_FILE_VERSION` | `1` | Версия формата JSON треда |
| `ANCHOR_CONTEXT_CHARS` | `32` | Длина `prefix` и `suffix` якоря (в пределах того же блока) |
| `REANCHOR_DEBOUNCE_MS` | `400` | Пауза перед повторным поиском цитаты после ввода |
| `HUMAN_FALLBACK_NAME` | `me` | Подпись, если `git config user.name` пуст |
| `MODEL_PROBE_TIMEOUT_MS` | `20000` | Тайм-аут пробной сессии |
| `ACP_INIT_TIMEOUT_MS` | `15000` | Тайм-аут `initialize` |
| `HISTORY_REPLAY_MAX_CHARS` | `40000` | Лимит переписки, переносимой в новый процесс, когда harness не умеет возобновлять сессию |
| `REPLY_MAX_CHARS` | `20000` | Предельная длина одной реплики агента в тред |
| `MCP_SERVER_NAME` | `marktext` | Имя MCP-сервера в `mcpServers` |
| `MCP_TOOL_REPLY` | `reply_to_thread` | Имя инструмента |
| `REPLY_BLOCK_LANG` | `marktext-replies` | Язык fenced-блока для запасного пути D7 |

## 3. Контракт хранения комментариев

### 3.1. Путь файла

Для `<repo>/docs/guide.md` треды лежат в `<repo>/.marktext/comments/docs/guide.md.json`
(структура каталогов зеркалит репозиторий, к имени добавляется `.json`). Пути в JSON — POSIX,
относительно корня репозитория, на Windows тоже. Пустой файл (нет тредов) удаляется, пустые
каталоги внутри `.marktext/comments/` удаляются. Редактор не коммитит каталог и не трогает `.gitignore`.

### 3.2. Схема (`CommentsFile`)

```jsonc
{
  "version": 1,
  "file": "docs/guide.md",
  "threads": [
    {
      "id": "c0f4f6a2-3b1e-4d8e-9a57-0d1c2b3a4f5e",   // crypto.randomUUID()
      "status": "open",                              // "open" | "closed"
      "createdAt": "2026-10-02T12:00:00.000Z",
      "closedAt": null,
      "anchor": {
        "quote": "строгий режим TypeScript",          // точный текст выделения (markdown-источник блока)
        "prefix": "Проект использует ",               // ≤ 32 символа до цитаты в том же блоке
        "suffix": " и ESLint.",                       // ≤ 32 символа после цитаты в том же блоке
        "blockHint": { "type": "paragraph", "index": 14 } // подсказка для разрешения неоднозначности
      },
      "messages": [
        {
          "id": "…uuid…",
          "author": { "kind": "human", "name": "Evgeniy" },
          "text": "Тут неточность, проверь tsconfig.",
          "createdAt": "2026-10-02T12:00:05.000Z",
          "editedAt": null
        },
        {
          "id": "…uuid…",
          "author": { "kind": "agent", "harness": "opencode", "model": "anthropic/claude-sonnet-4-5" },
          "text": "Исправил формулировку, strict включён в tsconfig.base.json.",
          "createdAt": "2026-10-02T12:03:10.000Z",
          "turnId": "…uuid…"
        }
      ]
    }
  ]
}
```

Правила сериализации (ради читаемого git diff и merge): `JSON.stringify(data, null, 2)` + `\n`,
фиксированный порядок ключей как в примере, треды отсортированы по `createdAt`, сообщения — по
`createdAt`. Запись атомарная: временный файл в том же каталоге, затем `rename`. Файл с конфликтными
маркерами или невалидным JSON **не перезаписывается**: треды файла показываются как «ошибка чтения»
с путём к файлу, запись в него блокируется до исправления человеком.

### 3.3. Операции (`CommentsService`, единственная точка записи)

| Операция | Кто вызывает | Правила |
|---|---|---|
| `createThread(file, anchor, firstText)` | человек | Нужна непустая цитата внутри одного блока |
| `addHumanMessage(threadId, text)` | человек | До и после отправки |
| `editHumanMessage(messageId, text)` | человек | Только `kind: human`; ставит `editedAt` |
| `deleteHumanMessage(messageId)` | человек | Только `kind: human`; последняя реплика человека не удаляется — для этого удаляют тред |
| `setStatus(threadId, 'open' \| 'closed')` | человек | Повторное открытие разрешено (D13) |
| `deleteThread(threadId)` | человек | Жёсткое удаление, UI спрашивает подтверждение |
| `appendAgentReply(turnId, threadId, text)` | MCP-мост или парсер D7 | Только для тредов из пачки текущего хода; статус не меняется; `text` ≤ `REPLY_MAX_CHARS` |
| `moveFile(oldPath, newPath)` | rename/move в MarkText | Переносит JSON и обновляет поле `file` |

После каждой записи main шлёт `mt::comments::changed { file }` всем окнам этого репозитория.
Изменение JSON извне (git checkout, merge) ловится существующим chokidar-наблюдателем каталога
и приводит к тому же событию.

## 4. Harness: описания и особенности

```ts
interface HarnessDescriptor {
  id: HarnessId                       // 'opencode' | 'pi' | 'cursor'
  displayName: string                 // 'OpenCode' | 'Pi' | 'Cursor'
  defaultCommand: string              // 'opencode' | 'pi-acp' | 'agent'
  defaultArgs: string[]               // ['acp'] | [] | ['acp']
  quirks: {
    repliesVia: 'mcp' | 'block'       // D7; уточняется на spike B-0
    resume: 'auto' | 'none'           // 'auto' — смотреть capabilities из initialize
    authMethodId?: string             // cursor: 'cursor_login'
  }
}
```

ACP-клиент редактора **не объявляет** клиентские возможности `fs` и `terminal`: агент читает и пишет
файлы и запускает команды своими инструментами. Возобновление сессии выбирается по возможностям
агента из `initialize`: `session/resume`, если есть; иначе `session/load`, если `loadSession: true`;
иначе — новый процесс и переписка в контексте (§7.3). Модель ставится через
`session/set_config_option` (опция с `category == "model"`) сразу после создания сессии.

## 5. Сообщение агенту (контракт `messageBuilder`)

Отправка тредов — один `session/prompt` с одним текстовым блоком. Шаблон (английский, D22):

````text
You are reviewing comments left by a human on a Markdown document in this repository.

Rules:
- Address every thread below. You may edit any files in the repository.
- For EACH thread, call the MCP tool `marktext.reply_to_thread` exactly once with
  { "threadId": "<id>", "text": "<your answer>" } describing what you did or why not.
- Write each reply in the same language as the human messages of that thread.
- Do not change thread status, do not delete threads, do not edit `.marktext/comments/**` directly.
- A thread marked ORPHANED means the quoted text was not found in the current file; use the
  quote and messages to locate the intent, or explain in your reply why you could not.

File: docs/guide.md

### Thread c0f4f6a2-3b1e-4d8e-9a57-0d1c2b3a4f5e
Status: anchored (lines 41-41)          # или: ORPHANED (quote not found in file)
Quote:
> строгий режим TypeScript
Messages:
- [human: Evgeniy, 2026-10-02T12:00:05Z] Тут неточность, проверь tsconfig.
- [agent: opencode/anthropic/claude-sonnet-4-5, 2026-10-02T12:03:10Z] Исправил формулировку…
- [human: Evgeniy, 2026-10-02T12:10:00Z] Ещё добавь ссылку на AGENTS.md.
````

Для `repliesVia: 'block'` пункт про MCP-инструмент заменяется требованием закончить ответ блоком:

````text
```marktext-replies
[{"threadId": "<id>", "text": "<your answer>"}]
```
````

Пачка хода (`turn.threadIds`) фиксируется в момент отправки; ответы в другие треды отклоняются
с ошибкой инструмента `thread is not part of the current turn`. Отправленный текст сообщения
сохраняется в переписке как есть; последующие правки реплик его не меняют.

## 6. IPC-контракт (добавления в `src/shared/types/ipc.ts`)

Все каналы привязаны к окну-отправителю: main определяет репозиторий по `event.sender`, renderer
путь репозитория не передаёт.

**Invoke (renderer → main):**

| Канал | args | ret |
|---|---|---|
| `mt::agent::get-repo-state` | `[]` | `RepoState` (`{ kind: 'none' } \| { kind: 'repo', root, userName }`) |
| `mt::agent::get-harness-status` | `[]` | `HarnessStatus[]` (найден ли бинарь, версия, причина) |
| `mt::agent::list-models` | `[harness, { refresh?: boolean }]` | `{ ok: true, models: ModelOption[] } \| { ok: false, reason }` |
| `mt::agent::get-selection` | `[]` | `{ harness, model } \| null` (для текущего репозитория) |
| `mt::agent::set-selection` | `[harness, model]` | `void` |
| `mt::agent::list-sessions` | `[harness]` | `SessionSummary[]` |
| `mt::agent::open-session` | `[harness, sessionId \| 'last' \| 'new']` | `SessionSnapshot` |
| `mt::agent::send-threads` | `[file, threadIds[]]` | `{ turnId }` |
| `mt::agent::send-message` | `[text]` | `{ turnId }` |
| `mt::agent::cancel-turn` | `[]` | `void` |
| `mt::agent::answer-permission` | `[requestId, optionId \| 'cancelled']` | `void` |
| `mt::comments::load` | `[file]` | `CommentsLoadResult` |
| `mt::comments::mutate` | `[CommentsMutation]` | `CommentsFile` |
| `mt::git::diff` | `[{ paths?: string[] }]` | `{ patch: string }` (`git diff HEAD`, без `paths` — вся рабочая копия) |
| `mt::term::create` | `[{ cols, rows }]` | `{ termId }` |
| `mt::term::kill` | `[termId]` | `void` |

**Send (renderer → main):** `mt::term::input [termId, data]`, `mt::term::resize [termId, cols, rows]`.

**Main → renderer events:** `mt::agent::event` (`ChatEvent`: `message_chunk`, `thought_chunk`,
`tool_call`, `tool_call_update`, `plan`, `permission_request`, `turn_started`, `turn_finished`
с `{ stopReason, changedPaths, missingReplyThreadIds }`, `error`), `mt::agent::harness-status-changed`,
`mt::comments::changed { file }`, `mt::term::data [termId, data]`, `mt::term::exit [termId, code]`.

Типы `ChatEvent` — нормализованные события ACP; renderer не видит сырого JSON-RPC.

## 7. Хранение переписки (данные приложения, не в git)

### 7.1. Раскладка

```
<userData>/agent/
├── repos.json                      # { "<repoRoot>": { selection: {harness, model}, lastSession: {<harness>: sessionId} } }
├── last-selection.json             # последняя успешно использованная пара (для новых репозиториев)
├── model-cache.json                # { <harness>: { fetchedAt, models[] } }
└── sessions/<sha256(repoRoot)[0..16]>/<harness>/
    ├── index.json                  # SessionSummary[]: id, title, model, createdAt, updatedAt, acpSessionId
    └── <sessionId>.jsonl           # по строке на событие: user_message, agent_message, tool_call, permission, turn_finished …
```

### 7.2. Правила

- Одна активная сессия на пару «репозиторий + harness». «Новый чат» добавляет сессию и не удаляет старые.
- После перезапуска открывается `lastSession[harness]` этой пары.
- Модель сессии фиксируется при создании. Смена модели в шапке не трогает открытую сессию: редактор
  показывает «текущая сессия останется на модели X» и кнопку «Новый чат».
- Для нового репозитория подставляется `last-selection.json`, если эта модель есть в свежем списке.

### 7.3. Возобновление

Если harness умеет возобновлять сессию (§4), сохраняется `acpSessionId`, и поднимается та же сессия.
Если нет — показывается сохранённая переписка. В новом процессе первым сообщением (до сообщения
пользователя) отправляется выжимка: последние сообщения пользователя и агента до
`HISTORY_REPLAY_MAX_CHARS` с пометкой `Previous conversation (restored by MarkText)`.

## 8. Настройки (`schema.json` + `static/preference.json` + `IUserPreferences`)

| Ключ | Тип | По умолчанию |
|---|---|---|
| `agentModeEnabled` | boolean | `true` |
| `agentOpencodePath` | string | `""` |
| `agentPiPath` | string | `""` |
| `agentCursorPath` | string | `""` |
| `agentTerminalShell` | string | `""` (пусто — `$SHELL` или `powershell.exe`) |

Выбор пары «harness + модель» хранится не в preferences, а в `userData/agent/repos.json` (§7.1).

## 9. Как пользоваться комплектом

1. `00` (этот файл) — всегда в контексте.
2. `01_BACKEND_PROMPTS.md` — main-процесс и preload: эпики B-0…B-12.
3. `02_UI_MOCKUP_PROMPTS.md` — статические HTML-прототипы экранов (дизайн, без интеграции).
4. `03_FRONTEND_PROMPTS.md` — доработка muya и renderer по макетам: эпики F-0…F-12.

Порядок сборки: B-0 (spike) → контракты (§2–§8 в `shared/types`) → B-1…B-12 → макеты 02 →
F-1 (muya) → F-0, F-2…F-12. Эпики 02 можно делать параллельно с 01.

Перед закрытием каждого шага: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`; если
трогали muya — ещё `pnpm -C packages/muya lint`, `lint:types`, `test`, `check-circular`.
Комментарии в коде — по `.github/COMMENTING-GUIDELINES.md`.
