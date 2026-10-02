# Spike B-0 — реальные harness по ACP

Дата прогона: 2026-10-02. Хост: Linux, Node.js 22.22.1.
Клиент — `scripts/acp-probe.ts` на `@agentclientprotocol/sdk` **1.7.0** (`zod` 4.6.5 — peer).
В `initialize` уходит `protocolVersion: 1` и пустые `clientCapabilities`: без `fs` и без `terminal`, как в обзоре §4.

Продуктовый код адаптера не писался. Скрипт одноразовый.

```bash
pnpm exec tsx scripts/acp-probe.ts -- <command…> --cwd <dir>
```

Дополнительные флаги того же скрипта: `--roundtrip-model`, `--set-config <id>=<value>`, `--prompt <text>`, `--cancel-after-ms <n>`, `--permission allow-once|reject-once|cancelled`, `--timeout-ms <n>`. Отчёт — JSON в stdout. Процесс harness запускается через `spawn` с `shell: false`. `PATH` дополняется так же, как в редакторе (`patchEnvPath` / `ensureShellEnvPath` из `packages/desktop/src/main/app/envPath.ts`).

Тестовый MCP-сервер — тот же файл с `--mcp`: один инструмент `ping`, stdio, имя сервера `probe`. Агент получает его в `session/new.mcpServers` (абсолютный `node`, аргументы `--import <tsx> <script> --mcp`, переменная `ACP_PROBE_LOG`).

## Что установлено локально

| Команда        | Состояние                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------- |
| `opencode acp` | snap `opencode` **1.18.32**, `agentInfo.version` тот же. `opencode auth list` — 0 credentials |
| `pi-acp`       | нет в `PATH`                                                                                  |
| `agent acp`    | нет в `PATH`                                                                                  |

Прогон OpenCode шёл во временном каталоге `/tmp/acp-probe-cwd` (git-репозиторий с `note.md`), не в дереве MarkText.

## OpenCode — проверено

### 1. Протокол и возможности

`initialize` за 1–4 с. Ответ:

- `protocolVersion`: **1**
- `agentInfo`: `{ name: "OpenCode", version: "1.18.32" }`
- `loadSession`: **true**
- `sessionCapabilities.resume`: **`{}`** (метод `session/resume` объявлен)
- `sessionCapabilities.close`: **`{}`** (`session/close` ответил `{}`)
- также объявлены `sessionCapabilities.list` и `fork` (`{}`). `delete` нет
- `mcpCapabilities`: `{ http: true, sse: true }`. Stdio в протоколе базовый и отдельно не объявляется; на этом прогоне он работает
- `promptCapabilities`: `{ embeddedContext: true, image: true }`. `audio` нет

### 2. Модель и `session/set_config_option`

`session/new` возвращает `configOptions` из двух `type: "select"`. Групп (`group`) нет.

Опция модели:

- `id`: `"model"`, `category`: `"model"`, `currentValue`: `"opencode/big-pickle"`
- `options`: плоский массив `{ value, name }` из **9** значений, все `opencode/…-free` либо `opencode/big-pickle`. Поля `description` у моделей нет

Вторая опция: `id: "mode"`, `category: "mode"`, `currentValue: "build"`, значения `build` и `plan` (у них есть `description`).

`session/set_config_option` с `{ configId: "model", value: "opencode/space-bunny-free" }` вернул полный список, `currentValue` стал `opencode/space-bunny-free`. Повторная установка текущего значения тоже возвращает полный список. Поле `type` в запросе для select не нужно.

### 3. MCP `ping` — `repliesVia`

На `session/new`, ещё до промпта, сервер `probe` стартовал и получил `initialize`, `notifications/initialized`, `tools/list`. Переменная окружения дошла (лог пишется по `ACP_PROBE_LOG`).

Промпт «вызови инструмент `ping` ровно один раз» (модель по умолчанию, ~12 с):

- в логе MCP есть `tools/call` с `name: "ping"`, ответ инструмента `pong`
- `session/update`: `tool_call` / `tool_call_update`, `title: "probe_ping"`, `kind: "other"`, `status` доходит до `completed`
- финальный текст агента: `pong`, `stopReason: "end_turn"`
- запросов `session/request_permission` на этот вызов не было

Harness **не игнорирует** MCP из `session/new`. Для OpenCode `quirks.repliesVia = 'mcp'`.

### 4. `session/request_permission` и `session/cancel`

Правка `note.md` внутри `cwd` прошла без запроса разрешения (режим `build`, правки в каталоге сессии разрешены по умолчанию).

Чтение файла **вне** `cwd` (`/tmp/acp-probe-outside/hello.txt`) вызвало один `session/request_permission`. Ответ `allow_once` (`optionId: "once"`) — чтение завершилось.

Формат `options` в этом запросе:

| `optionId` | `name`       | `kind`         |
| ---------- | ------------ | -------------- |
| `once`     | Allow once   | `allow_once`   |
| `always`   | Always allow | `allow_always` |
| `reject`   | Reject       | `reject_once`  |

`reject_always` в этом ответе не было. В `toolCall` запроса: `kind: "other"`, `status: "pending"`, `title` — каталог, `locations` — абсолютные пути файла и родителя. Редактор должен возвращать **`optionId` из запроса**, а не строку `kind`.

`session/cancel` — уведомление, не запрос. На длинном промпте отмена через 1500 мс после старта: `session/prompt` завершился нормальным результатом `{ stopReason: "cancelled" }` примерно через 40 мс после уведомления, без текста ответа и без ошибки JSON-RPC.

### 5. `locations` и diff

Правка `note.md` (добавлена строка `probe-edit`):

- первый `tool_call` приходит с `locations: []` и пустым `rawInput`
- `tool_call_update` со статусом `in_progress` заполняет `locations: [{ path: "/tmp/acp-probe-cwd/note.md" }]` — **абсолютный** путь, поля `line` нет
- завершающий `tool_call_update` **не содержит** ключ `locations` (это не очистка) и кладёт diff в `content`:

```json
{
  "type": "diff",
  "path": "/tmp/acp-probe-cwd/note.md",
  "oldText": "hello",
  "newText": "hello\nprobe-edit"
}
```

Рядом в том же массиве блок `{ type: "content", content: { type: "text", text: "Edit applied successfully." } }`. Поле `name` у tool call пустое; человекочитаемое имя живёт в `title` (`read` / `edit`, на завершении — `note.md`).

Для D17 пути из ACP надо приводить к POSIX-относительным от корня репозитория. Пропуск ключа `locations` в обновлении нельзя трактовать как «путей больше нет».

Помимо перечисленных, сессия слала `available_commands_update` и `usage_update`. Нормализатор B-5 должен их пропускать.

### 6. Аутентификация

`authMethods`: один метод `id: "opencode-login"`, имя «Login with opencode», описание «Run `opencode auth login` in the terminal».

`session/new` и промпты к бесплатным моделям `opencode/…` прошли **без** `authenticate` и при пустом `opencode auth list`. В списке моделей других провайдеров не было. `authenticate` продуктовому клиенту нужен только на ошибке `auth_required`; идентификатор для этого вызова — `opencode-login`.

### 7. Windows

На этой машине не проверялось. На Linux `spawn('opencode', ['acp'], { shell: false })` находит snap-обёртку в `PATH` и говорит по ACP.

Скрипт на `win32` ищет имя без расширения по `PATHEXT`, но **не** включает shell. Для `.cmd`/`.bat` Node отвечает `EINVAL`. Обход из эпика B-4 (`cmd.exe /d /s /c`, не `shell: true`) в probe сознательно не встроен, чтобы ошибка была видна в JSON (`spawn.note`).

## Pi — не проверено

`pi-acp` в `PATH` нет. Значения в таблице ниже — не замер.

План:

```bash
npm install -g @earendil-works/pi-coding-agent pi-acp
# ключи провайдера — в конфиге pi, не через ACP authenticate
d=$(mktemp -d) && git -C "$d" init && printf '# probe\n\nhello\n' > "$d/note.md"
pnpm exec tsx scripts/acp-probe.ts -- pi-acp --roundtrip-model --cwd "$d"
pnpm exec tsx scripts/acp-probe.ts -- pi-acp --cwd "$d" \
  --prompt 'Call the MCP tool named ping on the MCP server named probe exactly once. Reply with exactly pong.'
pnpm exec tsx scripts/acp-probe.ts -- pi-acp --cwd "$d" \
  --prompt 'Append the line probe-edit to note.md using your edit tool.'
pnpm exec tsx scripts/acp-probe.ts -- pi-acp --cwd "$d" --cancel-after-ms 1500 \
  --prompt 'Write a long essay. Do not use tools.'
```

На npm пакет называется `pi-acp` и зависит от бинаря `pi`. Пока замера нет, для D7 остаётся гипотеза обзора: `repliesVia: 'block'`. Если лог MCP покажет `tools/call` `ping`, значение сменить на `'mcp'`.

## Cursor — не проверено

`agent` в `PATH` нет. Ниже — не замер, а то, что написано в документации CLI ([ACP](https://cursor.com/docs/cli/acp)), чтобы план проверки был конкретным.

Документация описывает поток `initialize` → `authenticate` `{ methodId: "cursor_login" }` → `session/new` или `session/load` → `session/prompt`. Вход без логина: `agent login`, либо `CURSOR_API_KEY` / `--api-key`, либо `CURSOR_AUTH_TOKEN`. Про `session/resume` страница не говорит. MCP описан как серверы из `.cursor/mcp.json`, а не как список `mcpServers` у `session/new`. Пример клиента отвечает на разрешение `optionId: "allow-once"` (дефис). Это может не совпасть с `kind` протокола; на OpenCode `optionId` был `once`, а `kind` — `allow_once`.

План (после установки CLI, сначала прогон **без** `agent login`, чтобы зафиксировать `auth_required`):

```bash
d=$(mktemp -d) && git -C "$d" init && printf '# probe\n\nhello\n' > "$d/note.md"
pnpm exec tsx scripts/acp-probe.ts -- agent acp --roundtrip-model --cwd "$d"
# если initialize/session/new требуют вход — agent login, затем те же четыре прогона, что у Pi
```

Пока `tools/call` `ping` не увиден, предлагается `repliesVia: 'block'`: документация не обещает MCP из `session/new`, а запасной путь D7 не теряет ответы. Если прогон покажет вызов `ping`, сменить на `'mcp'`. `authMethodId: 'cursor_login'` — из контракта §4 и этой документации, локально не подтверждался.

## Windows — план для всех трёх

На Windows, в обычном терминале пользователя (не из GUI, чтобы `PATH` был полон):

```bat
where opencode
where pi-acp
where agent
pnpm exec tsx scripts/acp-probe.ts -- opencode acp --roundtrip-model --cwd %TEMP%\acp-probe
```

То же для `pi-acp` и `agent acp`. В JSON смотреть `spawn.file`, `spawn.note`, `agentExit`. Ожидаемые имена установщиков, которые надо подтвердить, а не цитировать как факт: `opencode.cmd` / `opencode.exe`, `pi-acp.cmd`, `agent.exe` или `agent.cmd`. Если `spawn.note` сообщает `EINVAL` на `.cmd`, это вход для B-4, не повод ставить `shell: true` в probe.

## Таблица harness × возможность

«Не проверено» — на этой машине команда не запускалась. Для Cursor в скобках — только публичная документация CLI, не результат probe.

| Возможность                         | OpenCode 1.18.32                                                                      | Pi (`pi-acp`)                     | Cursor (`agent acp`)                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Версия протокола                    | 1                                                                                     | не проверено                      | не проверено (документация: 1)                           |
| `loadSession`                       | да                                                                                    | не проверено                      | не проверено (документация: `session/load`)              |
| `session/resume`                    | да (`{}`)                                                                             | не проверено                      | не проверено (в документации CLI не упомянут)            |
| `session/close`                     | да                                                                                    | не проверено                      | не проверено                                             |
| `mcpCapabilities`                   | `http`, `sse`; stdio работает                                                         | не проверено                      | не проверено                                             |
| `promptCapabilities`                | `image`, `embeddedContext`                                                            | не проверено                      | не проверено                                             |
| `configOptions` `category: "model"` | да, select, плоский `options`, `currentValue` — строка id                             | не проверено                      | не проверено                                             |
| `session/set_config_option`         | да, в ответе весь список                                                              | не проверено                      | не проверено                                             |
| Вызов MCP `ping` из `session/new`   | да                                                                                    | не проверено                      | не проверено (документация описывает `.cursor/mcp.json`) |
| `session/request_permission`        | `optionId` `once`/`always`/`reject`; `kind` `allow_once`/`allow_always`/`reject_once` | не проверено                      | не проверено                                             |
| `session/cancel`                    | `stopReason: "cancelled"`                                                             | не проверено                      | не проверено                                             |
| `locations`                         | да, абсолютный `path`, без `line`; приходят в `in_progress`                           | не проверено                      | не проверено                                             |
| diff с путём                        | да, `content[]` `type: "diff"`, `path` абсолютный, `oldText`/`newText`                | не проверено                      | не проверено                                             |
| Без логина                          | `session/new` и бесплатные модели работают; метод `opencode-login` объявлен           | не проверено (ключи в конфиге pi) | не проверено (документация: `agent login` или ключ)      |
| Windows, `spawn` без shell          | не проверено                                                                          | не проверено                      | не проверено                                             |

## Предлагаемые `quirks` для `harnessRegistry.ts`

`resume: 'auto'` везде: возобновление выбирается по возможностям `initialize` (обзор §4), а не выключается заранее. Для Pi и Cursor `repliesVia` — гипотеза до прогона плана выше.

```ts
const HARNESS_QUIRKS = {
  opencode: {
    repliesVia: 'mcp',
    resume: 'auto',
    authMethodId: 'opencode-login'
  },
  pi: {
    repliesVia: 'block',
    resume: 'auto'
  },
  cursor: {
    repliesVia: 'block',
    resume: 'auto',
    authMethodId: 'cursor_login'
  }
} as const
```

`authMethodId` у OpenCode не нужен для бесплатного каталога, который отдаёт этот билд. Он нужен ветке `auth_required` в B-5. У Pi идентификатор не предлагается: способ входа в замере не виден.
