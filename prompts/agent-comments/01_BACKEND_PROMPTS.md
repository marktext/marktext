# 01 — Промпты main-процесса и preload (harness, MCP-мост, git, комментарии, терминал)

> Контекст: держать в контексте `00_OVERVIEW_AND_CONTRACTS.md`. Решения D1–D25, контракты
> хранения (§3), сообщения (§5), IPC (§6), переписки (§7) и настроек (§8) берутся оттуда и в коде
> не переизобретаются.
>
> Общие правила для всех эпиков:
> - Код живёт в `packages/desktop/src/main/agent/**`, типы — в `src/shared/types/{agent,comments}.ts`.
> - Внешние процессы запускаются через `child_process.spawn`/`execFile` с `PATH` из
>   `src/main/app/envPath.ts`, без `shell: true`. Аргументы передаются массивом.
> - Пути внутри репозитория в контрактах — POSIX и относительные. На Windows приводить через
>   `path.posix`/`path.win32` в одном хелпере `repoPath.ts`, а не по месту.
> - Renderer работает в песочнице: всё, что ему нужно, идёт через типизированные каналы
>   `ipc.ts` → `preload/index.ts` → `types/global.d.ts`.
> - Каждый эпик самодостаточен и заканчивается **DoD**. Unit-тесты — Vitest в
>   `test/unit/specs/agent-*.spec.ts`, Electron мокается через `vi.mock('electron', …)`, как в
>   соседних спеках.

---

# ЧАСТЬ A. Разведка и основа

## Epic B-0 — Spike: реальные harness по ACP (без продуктового кода)

**Промпт:**
> Проведи технический spike и оформи результат в `docs/agent/harness-spike.md` (корень репозитория).
> Продуктовый код не пиши. Напиши одноразовый скрипт `scripts/acp-probe.ts` (Node, официальный
> TypeScript SDK ACP — проверь актуальное имя пакета, ожидается `@agentclientprotocol/sdk`). Скрипт
> запускает указанную команду, делает `initialize`, `session/new` с `cwd` = переданный каталог и
> `mcpServers` = тестовый stdio MCP-сервер с одним инструментом `ping`, печатает ответ и закрывает
> сессию. Для каждого harness (`opencode acp`, `pi-acp`, `agent acp`) зафиксируй:
> 1. Версию протокола и `agentCapabilities`: `loadSession`, `session/resume`, `mcpCapabilities`, `promptCapabilities`.
> 2. Есть ли в ответе `session/new` поле `configOptions` с `category: "model"`: формат `options`, `currentValue`. Работает ли `session/set_config_option`.
> 3. Вызывает ли агент инструмент `ping` переданного MCP-сервера, если явно попросить. Это решает `quirks.repliesVia` (D7).
> 4. Формат `session/request_permission` (варианты `options`, `kind`) и поведение `session/cancel`.
> 5. Содержат ли `tool_call`/`tool_call_update` поля `locations` и diff-контент с путями.
> 6. Аутентификация: что происходит без логина (`agent login` для Cursor, ключи в конфиге OpenCode/Pi).
> 7. Поведение на Windows: имя бинаря (`.cmd`/`.exe`), запуск через `spawn` без shell.
>
> В конце документа — таблица «harness × возможность» и итоговые значения `quirks` для `harnessRegistry.ts`.

**DoD:** документ с таблицей возможностей по каждому установленному harness. Недоступные локально
harness помечены «не проверено» с планом проверки. Значения `quirks` предложены. Скрипт запускается
командой `pnpm exec tsx scripts/acp-probe.ts -- <command…> --cwd <dir>`.

## Epic B-1 — Контракты в `shared/types`

### B-1.1 — Типы домена
**Шаги реализации:**
1. `src/shared/types/comments.ts`: `CommentsFile`, `Thread`, `ThreadStatus`, `Message`, `HumanAuthor`,
   `AgentAuthor`, `Anchor`, `CommentsMutation` (дискриминированное объединение операций §3.3),
   `CommentsLoadResult` (`ok` | `parse_error` с путём и сообщением) и константы §2.
2. `src/shared/types/agent.ts`: `HarnessId`, `HarnessStatus`, `ModelOption { id, label }`, `RepoState`,
   `SessionSummary`, `SessionSnapshot`, `ChatEvent` (дискриминированное объединение §6),
   `PermissionRequest { requestId, title, options: { id, label, kind }[] }`, `TurnRecord`.
3. Добавь каналы §6 в `IpcInvokeChannels`, `IpcSendChannels`, `IpcMainEventChannels` с точными
   типами аргументов и ответов, без `unknown`.
4. Чистые функции валидации `isCommentsFile(value): value is CommentsFile` и
   `serializeCommentsFile(file): string` (порядок ключей и сортировка по §3.2).

**DoD:** `pnpm run typecheck` чистый. Unit-тест: `serializeCommentsFile` даёт стабильный вывод
(сериализация после парсинга не меняет байты), сортировка тредов и сообщений по `createdAt`,
валидатор отклоняет неизвестный `status` и сообщение агента без `turnId`.

---

# ЧАСТЬ B. Репозиторий и комментарии

## Epic B-2 — Git и привязка окна к репозиторию

### B-2.1 — `gitService`
**Шаги реализации:**
1. `execFile('git', args, { cwd })` с тайм-аутом и `maxBuffer` 64 МБ. Отсутствие `git` в `PATH` —
   типизированная ошибка `git_not_found`.
2. Функции: `getRepoRoot(dir)` (`rev-parse --show-toplevel`, нормализовать путь; на Windows — в
   нативный вид), `getUserName(root)` (`config user.name`, пусто → `me`),
   `statusSnapshot(root)` (`status --porcelain=v1 -z --untracked-files=all`, разбор `-z`, включая
   переименования), `hashFiles(root, paths)` (`hash-object --stdin-paths`),
   `diffHead(root, paths?)` (`diff HEAD --no-color --no-ext-diff -- <paths>`; для неотслеживаемых
   путей из списка — `diff --no-index /dev/null <path>` (`NUL` на Windows); код выхода 1 — не ошибка).
3. Репозиторий без коммитов (нет `HEAD`): diff строится против пустого дерева
   (`git hash-object -t tree /dev/null`).

### B-2.2 — `repoRegistry` и жизненный цикл окна (D19)
**Шаги реализации:**
1. При `EditorWindow.openFolder` (`src/main/windows/editor.ts`) определи корень репозитория для папки.
   Если папка не в репозитории — `RepoState { kind: 'none' }`.
2. Реестр `repoRoot → windowId`. Если репозиторий уже открыт в другом окне: открываемое окно папку
   не загружает, а существующее окно фокусируется (`win.show(); win.focus()`). То же для
   `app-open-directory-by-id` при `openFolderInNewWindow`.
3. Замена папки в окне во время хода: main спрашивает подтверждение через существующий механизм
   диалогов. При согласии — `cancelTurn`, завершение процесса harness и всех pty окна, затем
   загрузка новой папки. При отказе папка не меняется.
4. Закрытие окна: отмена хода, завершение процесса harness и pty, удаление записи из реестра.
5. Событие в renderer: `mt::agent::harness-status-changed` и обновлённый `get-repo-state`.

**DoD:** unit-тесты `gitService` на временном репозитории (`git init` в `os.tmpdir()`): корень из
подпапки, `user.name` и `me`, разбор `status -z` с пробелами и кириллицей в именах и с
переименованием, diff для отслеживаемого, неотслеживаемого файла и пустого репозитория. Реестр не
даёт двум окнам один корень.

## Epic B-3 — Хранилище и сервис комментариев

### B-3.1 — `commentsStore`
**Шаги реализации:**
1. `pathFor(root, mdRelPath)` → `<root>/.marktext/comments/<mdRelPath>.json`. Выход за корень
   (`..`, абсолютные пути) запрещён.
2. `load(root, mdRelPath)`: нет файла → пустой `CommentsFile`. Невалидный JSON или маркеры
   конфликта (`<<<<<<<`) → `parse_error`, такой файл блокируется для записи.
3. `save(root, file)`: атомарная запись (tmp + `rename`; на Windows с повтором при `EPERM`/`EBUSY`).
   Пустой список тредов — удалить файл и пустые родительские каталоги до `.marktext/comments`.
4. Сериализация — только через `serializeCommentsFile` (B-1.1).

### B-3.2 — `commentsService` (операции §3.3)
**Шаги реализации:**
1. Каждая операция: прочитать, проверить инвариант, изменить, записать, разослать
   `mt::comments::changed { file }` всем окнам репозитория. Мутации одного файла выполняются
   последовательно (очередь промисов на путь).
2. Инварианты: `editHumanMessage`/`deleteHumanMessage` — только `author.kind === 'human'`; агентские
   реплики неизменяемы; `appendAgentReply` — только для `threadId` из `turn.threadIds` текущего хода
   этого окна, текст обрезается до `REPLY_MAX_CHARS`, статус не меняется.
3. `moveFile`: подключить к существующим rename и move в main (`src/main/menu/actions/file.ts`,
   IPC rename и move-to), если исходный файл — `.md` внутри репозитория.
4. Внешние изменения `.marktext/comments/**`: существующий chokidar-наблюдатель каталога проекта
   (`src/main/filesystem/watcher.ts`) превращает их в `mt::comments::changed`. Собственные записи
   отмечаются, чтобы не дублировать событие.

**DoD:** unit-тесты на каждую операцию и каждый запрет; конкурентные мутации одного файла не теряют
изменений; `parse_error` блокирует запись; `moveFile` переносит JSON и обновляет `file`; после
удаления последнего треда файла и пустых каталогов нет.

---

# ЧАСТЬ C. Harness и ACP

## Epic B-4 — Реестр harness и статус

**Шаги реализации:**
1. `harnessRegistry.ts` — три `HarnessDescriptor` (00 §4) со значениями `quirks` из spike B-0.
2. Разрешение команды: путь из настроек (§8); если пуст — поиск `defaultCommand` в `PATH` (на Windows
   с учётом `PATHEXT`). Для `.cmd`/`.bat` на Windows — запуск через `cmd.exe /d /s /c` с корректным
   экранированием, а не `shell: true`.
3. `getHarnessStatus()` для каждого: `found`, `resolvedPath`, `reason` (`not_found`,
   `not_executable`, `init_failed: <msg>`, `auth_required`, `no_models`). Проверка запуском
   `initialize` с тайм-аутом `ACP_INIT_TIMEOUT_MS`, результат кэшируется до смены пути в настройках.
4. Событие `mt::agent::harness-status-changed` при смене путей в настройках.

**DoD:** unit-тесты разрешения пути (пустая настройка → PATH, несуществующий путь → `not_found`,
`.cmd` на Windows — через мок `process.platform`). Статус fake-агента (B-11) — `found`.

## Epic B-5 — ACP-соединение

### B-5.1 — `acpConnection`
**Шаги реализации:**
1. Обёртка над ACP TypeScript SDK (клиентская сторона): `spawn(cmd, args, { cwd: repoRoot, stdio: ['pipe','pipe','pipe'] })`,
   ndjson по stdin/stdout, stderr — в лог main (с ограничением объёма).
2. `initialize` с `clientInfo { name: 'MarkText', version }` и **без** клиентских возможностей `fs` и
   `terminal` (00 §4). Если агент требует аутентификацию (`authMethods` и ошибка `auth_required`),
   вызвать `authenticate` с `quirks.authMethodId`; при неудаче — статус `auth_required` с подсказкой
   (`agent login` для Cursor).
3. Методы: `newSession({ cwd, mcpServers })`, `resumeSession(acpSessionId)` (по возможностям агента,
   00 §4), `setModel(sessionId, modelId)` через `session/set_config_option`, `prompt(sessionId, text)`,
   `cancel(sessionId)`, `close(sessionId)` (если поддерживается), `dispose()` (SIGTERM, через 3 с SIGKILL;
   на Windows `taskkill /pid <pid> /T /F`).
4. Входящие запросы агента: `session/request_permission` пробрасывается в renderer как
   `permission_request` и ждёт `mt::agent::answer-permission`. Отмена хода отвечает `cancelled`.
   Своей политики разрешений у редактора нет: никаких автоответов.
5. Нормализация `session/update` в `ChatEvent` (00 §6). Неизвестные типы обновлений логируются и
   пропускаются.
6. Падение процесса во время хода → `error` и `turn_finished { stopReason: 'error' }`; следующая
   отправка поднимает процесс заново.

### B-5.2 — `modelProbe` (D5)
**Шаги реализации:**
1. `listModels(harness, { refresh })`: из кэша `model-cache.json`, если не `refresh`; иначе поднять
   отдельный процесс, `initialize`, `newSession({ cwd: repoRoot, mcpServers: [] })`, взять опцию с
   `category == "model"`, закрыть сессию и процесс. Тайм-аут `MODEL_PROBE_TIMEOUT_MS`.
2. Пустой список или нет такой опции → `{ ok: false, reason: 'no_models' }`. Ввода произвольного
   идентификатора модели нет.
3. Без открытого репозитория пробная сессия запускается во временном каталоге (для страницы настроек).

**DoD:** unit-тесты на fake-агенте (B-11): полный цикл initialize → new → prompt → updates → end;
запрос разрешения доходит до обработчика и ответ возвращается агенту; `cancel` завершает ход со
`stopReason: 'cancelled'`; падение процесса даёт `error`; `listModels` возвращает модели из
`configOptions`, кэширует их и обновляет при `refresh`; пустой список → `no_models`.

## Epic B-6 — MCP-мост для `reply_to_thread` (D6)

### B-6.1 — `bridgeServer` в main
**Шаги реализации:**
1. Локальный сервер: Linux — Unix socket в `app.getPath('userData')/agent/run/<random>.sock`
   (права 0600); Windows — named pipe `\\.\pipe\marktext-agent-<random>`. Один сервер на процесс
   приложения, поднимается лениво.
2. Протокол моста — ndjson: `{ token, method: 'reply_to_thread', params: { threadId, text } }` →
   `{ ok: true } | { ok: false, error }`. `token` — случайные 32 байта hex, выдаётся на сессию окна;
   по токену определяется окно и текущий ход. Неизвестный токен — отказ.
3. Вызов уходит в `commentsService.appendAgentReply(turnId, threadId, text)` с автором из пары
   сессии (harness + модель). Ответ в тред вне текущего хода — `thread is not part of the current turn`.

### B-6.2 — `bridgeEntry` (stdio MCP-сервер)
**Шаги реализации:**
1. Отдельный entry в `electron.vite.config.ts` (main build, `rollupOptions.input`) →
   `out/main/agentMcpBridge.js`. Зависимость — официальный MCP TypeScript SDK
   (`@modelcontextprotocol/sdk`), stdio-транспорт.
2. Один инструмент `reply_to_thread` с JSON Schema `{ threadId: string, text: string }` и описанием
   на английском: «Post your answer to a MarkText comment thread. Call once per thread in the
   current request. Does not change thread status.»
3. Адрес сокета и токен приходят через env (`MARKTEXT_BRIDGE_ADDR`, `MARKTEXT_BRIDGE_TOKEN`).
   Ошибка соединения → ошибка инструмента с понятным текстом.
4. Описание в `mcpServers` для `session/new`/`resume`:
   `{ name: 'marktext', command: process.execPath, args: [<путь к agentMcpBridge.js>], env: [
   { name: 'ELECTRON_RUN_AS_NODE', value: '1' }, { name: 'MARKTEXT_BRIDGE_ADDR', … }, { name: 'MARKTEXT_BRIDGE_TOKEN', … } ] }`.
   В упакованном приложении путь к скрипту — вне asar (`asarUnpack` в `electron-builder.yml`).

### B-6.3 — Запасной путь `replyBlockParser` (D7)
**Шаги реализации:**
1. Для `quirks.repliesVia === 'block'` в конце хода найти в итоговом тексте агента **последний** блок
   ```` ```marktext-replies ```` , разобрать JSON-массив `{ threadId, text }[]` и вызвать для каждого
   элемента `appendAgentReply`. Невалидный блок → системное предупреждение в чате, ответы не пишутся.
2. Блок не удаляется из сохранённой переписки, но renderer показывает его свёрнутым (F-7).

**DoD:** интеграционный тест: fake-агент вызывает `marktext.reply_to_thread` → реплика появилась в
JSON с автором `{ kind: 'agent', harness, model }`, статус не изменился; чужой токен и тред не из
пачки отклоняются; режим `block` пишет те же реплики из блока; мост запускается из собранного
`out/` через `ELECTRON_RUN_AS_NODE` на Linux и Windows.

---

# ЧАСТЬ D. Ход агента и сессии

## Epic B-7 — Хранилище сессий (00 §7)

**Шаги реализации:**
1. `sessionStore`: `repos.json`, `last-selection.json`, `model-cache.json`, `sessions/<hash>/<harness>/index.json`
   и `<sessionId>.jsonl` (дозапись строк, `fsync` после `turn_finished`). Ключ каталога —
   `sha256(repoRoot)` (первые 16 hex), исходный путь хранится в `repos.json`.
2. API: `getSelection(root)`, `setSelection(root, pair)` (заодно обновляет `last-selection.json`
   после первого успешного хода), `listSessions(root, harness)`, `createSession(root, harness, model)`,
   `appendEvent(...)`, `readSession(...)`, `setLastSession(...)`.
3. Подстановка пары для нового репозитория: `last-selection.json`, если её модель есть в актуальном
   списке `listModels` (00 §7.2).
4. Заголовок сессии: первые 60 символов первого сообщения пользователя или «Комментарии: <файл>».

**DoD:** unit-тесты: создание, перезапуск (чтение `lastSession`), «Новый чат» не удаляет старые,
обрезанная последняя строка jsonl (сбой записи) пропускается без падения, подстановка
`last-selection` срабатывает только при наличии модели.

## Epic B-8 — `turnRunner`, `messageBuilder`, `changeTracker`

### B-8.1 — `messageBuilder` (00 §5)
**Шаги реализации:**
1. Чистая функция `buildThreadsMessage({ file, threads, anchors, repliesVia })` → текст строго по
   шаблону §5. `anchors` приходят из renderer вместе с командой: `{ threadId, orphaned, lines? }`
   (renderer — источник правды о привязке, D10).
2. Порядок тредов — по положению в файле, оторванные — в конце.

### B-8.2 — `changeTracker` (D17)
**Шаги реализации:**
1. `before = statusSnapshot + hashFiles(изменённые и неотслеживаемые пути)` перед `prompt`.
2. Во время хода копить пути из ACP (`locations[].path`, diff-контент `path`) — приводить к
   относительным POSIX; пути вне репозитория отбрасывать.
3. Копить пути, которые сохранил сам MarkText за время хода (хук в обработчике сохранения файла в
   main).
4. `after` — тот же снимок после хода. `changed = (пути с другим статусом или хэшем) ∪ ACP-пути`,
   минус `.marktext/comments/**`, минус пути, сохранённые MarkText и не упомянутые ACP. Удалённые
   файлы входят.

### B-8.3 — `turnRunner`
**Шаги реализации:**
1. `sendThreads(windowId, file, threadIds, anchors)`:
   - проверить, что режим активен, harness найден и модель выбрана; иначе ошибка с причиной (ТЗ §9);
   - нет хода в процессе (иначе `turn_in_progress`);
   - сохранение файла перед отправкой (D11) делает renderer до вызова канала (F-6); main это не
     перепроверяет;
   - закрытые треды в пачку не входят; треды другого файла — тоже;
   - зафиксировать `turn { id, threadIds, startedAt }`, снимок `before`, записать `user_message` в сессию,
     отправить `prompt`.
2. `sendMessage(text)` — тот же ход без тредов и без инструкции §5, текст как есть.
3. События ACP → `appendEvent` + `mt::agent::event` в окно.
4. Конец хода (`end_turn`, `cancelled`, `max_tokens`, `refusal`, `error`): для режима `block` —
   разбор B-6.3; посчитать `changedPaths` (B-8.2) и `missingReplyThreadIds` (треды пачки без
   `appendAgentReply` в этом ходе); отправить `turn_finished`; записать `TurnRecord`.
5. `cancelTurn()` → `session/cancel`, отклонить ожидающие запросы разрешений (`cancelled`). Уже
   записанные файлы не откатываются.
6. Первый успешный ход пары обновляет `last-selection.json`.

**DoD:** e2e-подобный unit-тест на fake-агенте: пачка из двух тредов → агент меняет файл и отвечает
в оба треда → `turn_finished` с `changedPaths=[файл]` и пустым `missingReplyThreadIds`; сценарий,
где агент ответил в один тред → `missingReplyThreadIds=[второй]`; отмена во время хода → `cancelled`,
повторная отправка до конца хода → `turn_in_progress`; правка человеком другого файла во время хода
в `changedPaths` не попадает; `.marktext/comments/**` не попадает никогда.

## Epic B-9 — Сессии: открытие, переключение, возобновление

**Шаги реализации:**
1. `openSession(harness, 'last' | 'new' | id)`:
   - смена harness (D21): завершить процесс предыдущего harness (если нет хода), поднять процесс нового;
   - `'new'` — новая ACP-сессия с текущей моделью пары, `mcpServers` с мостом, `setModel`;
   - существующая — `resumeSession(acpSessionId)` при поддержке; иначе новая ACP-сессия и выжимка
     истории (00 §7.3), отправляемая перед следующим сообщением пользователя, а не сразу.
2. Возвращает `SessionSnapshot { summary, events, model, resumable }` для отрисовки переписки.
3. Смена модели при открытой сессии сессию не трогает (00 §7.2): main только сохраняет пару.

**DoD:** тесты на fake-агенте в двух режимах (`resume` поддерживается и нет): после «перезапуска»
(новый `turnRunner`) открывается последняя сессия, в режиме без resume первое сообщение содержит
выжимку не длиннее `HISTORY_REPLAY_MAX_CHARS`; смена harness завершает старый процесс; смена
модели не меняет модель открытой сессии.

---

# ЧАСТЬ E. Diff, терминал, настройки

## Epic B-10 — Diff и терминал

### B-10.1 — `mt::git::diff`
**Шаги реализации:** обработчик вызывает `gitService.diffHead(root, paths)`. Без `paths` — вся
рабочая копия, включая неотслеживаемые файлы (кроме игнорируемых git). Ответ — unified patch
одной строкой. Ограничение 5 МБ: сверх него — `{ patch, truncated: true }`.

### B-10.2 — `ptyManager` (D16)
**Шаги реализации:**
1. Зависимость `node-pty` (на spike B-0 проверь сборку под Electron 42 на Linux и Windows: prebuilt-
   бинарники или `electron-rebuild`). Добавь модуль в `asarUnpack` и в список пересборки
   `scripts/postinstall.ts`.
2. `create(windowId, { cols, rows })`: shell из `agentTerminalShell`, иначе `$SHELL`/`/bin/bash`
   (Linux) или `powershell.exe` (Windows); `cwd` = корень репозитория; env — из `envPath` плюс
   `TERM=xterm-256color`.
3. Поток `onData` → `mt::term::data` с буферизацией по 16 мс; `input`, `resize`, `kill`;
   `onExit` → `mt::term::exit`.
4. Все pty окна завершаются при закрытии окна или смене репозитория (B-2.2).
5. Без репозитория `create` возвращает ошибку `no_repo` (ТЗ §9).

**DoD:** unit-тест `ptyManager` с реальным pty: `echo $PWD` (`$PWD` в PowerShell) выводит корень
репозитория; `resize` не падает; `kill` даёт `exit`. `pnpm run build:unpack` собирает приложение с
`node-pty`.

## Epic B-11 — Fake ACP-агент для тестов (D24)

**Промпт:**
> Сделай `test/fixtures/fake-acp-agent/agent.mjs` — ACP-агент на том же SDK, что использует клиент,
> управляемый сценарием из JSON (`FAKE_ACP_SCENARIO=<путь>`). Возможности:
> - `initialize` с настраиваемыми возможностями (`loadSession`, `resume`, `mcpCapabilities`);
> - `session/new` возвращает `configOptions` с моделью (список из сценария, может быть пустым);
> - шаги хода: `message_chunk`, `thought_chunk`, `tool_call` с `locations`, запись файла на диск,
>   `request_permission` (ждать ответа и ветвиться по нему), вызов MCP-инструмента
>   `marktext.reply_to_thread` (агент сам подключается к stdio MCP-серверу из `mcpServers`),
>   вывод блока `marktext-replies`, задержка, падение процесса;
> - реакция на `session/cancel` — завершить ход со `stopReason: 'cancelled'`.
>
> Сценарии в `test/fixtures/fake-acp-agent/scenarios/*.json`: `happy-two-threads`,
> `one-reply-missing`, `permission-allow`, `permission-reject`, `cancel-mid-turn`, `crash`,
> `no-models`, `block-replies`, `no-resume`.

**DoD:** все сценарии используются в тестах B-5…B-9 и e2e (03, F-12). Агент работает на Linux и
Windows (запуск через `process.execPath`).

## Epic B-12 — Настройки и preload

### B-12.1 — Ключи настроек (00 §8)
**Шаги реализации:** добавь ключи в `src/main/preferences/schema.json`, `static/preference.json`,
`src/shared/types/preferences.ts`. Смена `agent*Path` сбрасывает кэш статуса и моделей этого harness.
`agentModeEnabled: false` — все обработчики `mt::agent::*`, `mt::term::*`, `mt::git::*` отвечают
`agent_mode_disabled`, процессы harness и pty завершаются.

### B-12.2 — Preload и типы
**Шаги реализации:**
1. В `src/preload/index.ts` — `window.agent`, `window.comments`, `window.term` с методами поверх
   типизированных `invoke`/`send`/`on` и функциями отписки. Сырой `ipcRenderer` не выставляется.
2. Типы в `src/types/global.d.ts`.
3. Окно настроек получает `get-harness-status` и `list-models` (для статуса на странице «Агент»).

**DoD:** `pnpm run typecheck` и `lint` чистые. Существующий тест `context-isolation.spec.ts` проходит.
Unit-тест: при выключенном режиме обработчики возвращают `agent_mode_disabled`.

---

## Порядок реализации main/preload

B-0 (spike) → B-1 → B-2 → B-3 → B-11 (fake-агент нужен для тестов дальше) → B-4 → B-5 → B-6 →
B-7 → B-8 → B-9 → B-10 → B-12.
