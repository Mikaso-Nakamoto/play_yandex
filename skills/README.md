# Скиллы (навыки для ИИ-агентов)

Папка — ваш архив навыков, добавленный в репозиторий как есть, без изменений. Здесь три коллекции:

| Коллекция | Размер | Что внутри |
|---|---|---|
| [`Skills-main/`](Skills-main/) | 13 МБ | Репозиторий Meng To (лицензия MIT, [`LICENSE`](Skills-main/LICENSE)) — `agent-skills/` по разделам `YA_SKILLS`, `game-development`, `codex`, `web-design`, `ui`, `media` |
| [`Agent-Design-Skills/`](Agent-Design-Skills/) | 8 МБ | Навыки веб-дизайна с русским README. Многие папки совпадают с `Skills-main/agent-skills/web-design` и `codex` |
| [`Agent-Security-Crypto-Skills/`](Agent-Security-Crypto-Skills/) | 52 КБ | Прикладная криптография и безопасность |

> Папка `skills/` не попадает в архив игры: `tools/build.mjs` копирует в `dist/` только файлы игры.
> Каждый навык — это `SKILL.md` (или `.md` в `YA_SKILLS`) с инструкцией для агента. Чтобы применить навык, попросите агента «используй скилл <название>», и он прочитает файл.

## Что полезно для «Мяу-шариков»

### Модерация Яндекс Игр — главное
| Навык | Путь | Как используем |
|---|---|---|
| **Yandex Games Moderation Auditor** | [`Skills-main/agent-skills/YA_SKILLS/yandex-games-moderation-auditor.md`](Skills-main/agent-skills/YA_SKILLS/yandex-games-moderation-auditor.md) | Только анализ, без изменений. Отчёт в фиксированном формате. **Применён:** [`docs/yandex-audit.md`](../docs/yandex-audit.md) |
| **Yandex Games Auto Fixer** | [`Skills-main/agent-skills/YA_SKILLS/yandex-games-auto-fixer.md`](Skills-main/agent-skills/YA_SKILLS/yandex-games-auto-fixer.md) | Только после явного «да» владельца. Минимальные правки по отчёту аудитора. Не трогает название, уровни и монетизацию, не добавляет ссылки и библиотеки |

Порядок: **аудитор → ваше подтверждение → авто-фиксер → тесты → повторный аудит** перед каждой отправкой на модерацию.

### Процесс и качество
| Навык | Путь | Как используем |
|---|---|---|
| iterate-until-verified | [`Skills-main/agent-skills/codex/iterate-until-verified`](Skills-main/agent-skills/codex/iterate-until-verified/SKILL.md) | Цикл «правка → проверка → доказательство» с критериями приёмки. Это основа плана в [`docs/commercial-plan.md`](../docs/commercial-plan.md) |
| test-playable-web-games | [`Skills-main/agent-skills/game-development/test-playable-web-games`](Skills-main/agent-skills/game-development/test-playable-web-games/SKILL.md) | Матрица проверок играбельности, детерминированные сцены, режим уменьшенной анимации. **Применён:** soak-тест `npm run test:soak` |
| audit-verify-explain-grade-5 | [`Skills-main/agent-skills/codex/audit-verify-explain-grade-5`](Skills-main/agent-skills/codex/audit-verify-explain-grade-5/SKILL.md) | Каждое утверждение аудита проверяется независимо (эксперимент `tools/repro-late-ad.mjs`) |
| ship-web-games | [`Skills-main/agent-skills/game-development/ship-web-games`](Skills-main/agent-skills/game-development/ship-web-games/SKILL.md) | Чеклист релизной сборки и проверки уже загруженной версии (черновик в консоли) |
| optimize-web-animations | [`Skills-main/agent-skills/codex/optimize-web-animations`](Skills-main/agent-skills/codex/optimize-web-animations/SKILL.md) | Плавность анимаций интерфейса на слабых телефонах |
| browser-video-recording | [`Skills-main/agent-skills/codex/browser-video-recording`](Skills-main/agent-skills/codex/browser-video-recording/SKILL.md) | Запись роликов из браузера. У нас уже есть свой детерминированный конвейер `npm run promo:video` |

### Игровая «сочность» и ресурсы
| Навык | Путь | Как используем |
|---|---|---|
| create-game-vfx | [`Skills-main/agent-skills/game-development/create-game-vfx`](Skills-main/agent-skills/game-development/create-game-vfx/SKILL.md) | Пулы частиц, лимиты, вариант для уменьшенной анимации (Фаза 2 плана) |
| build-game-audio-feedback | [`Skills-main/agent-skills/game-development/build-game-audio-feedback`](Skills-main/agent-skills/game-development/build-game-audio-feedback/SKILL.md) | Лимит голосов, переходы музыки, раздельные выключатели звука (Фаза 2) |
| build-hybrid-game-assets | [`Skills-main/agent-skills/game-development/build-hybrid-game-assets`](Skills-main/agent-skills/game-development/build-hybrid-game-assets/SKILL.md) | Сгенерированные 2D-картинки как ресурсы игры + журнал источников. **Применён:** концепт-фон [`docs/concept/`](../docs/concept/) |
| author-game-levels | [`Skills-main/agent-skills/game-development/author-game-levels`](Skills-main/agent-skills/game-development/author-game-levels/SKILL.md) | Навык для 3D-уровней; берём только идеи о темпе, ориентирах и целях (Фаза 5) |
| build-game-changelog | [`Skills-main/agent-skills/game-development/build-game-changelog`](Skills-main/agent-skills/game-development/build-game-changelog/SKILL.md) | По желанию: окно «Что нового» после обновлений |

### Интерфейс и дизайн
| Навык | Путь | Как используем |
|---|---|---|
| refactoring-ui | [`Agent-Design-Skills/refactoring-ui`](Agent-Design-Skills/refactoring-ui/) | Иерархия, контраст, отступы. Без чистого чёрного (Фаза 1, «конфетный» интерфейс) |
| beautiful-shadows | [`Agent-Design-Skills/beautiful-shadows`](Agent-Design-Skills/beautiful-shadows/) | Многослойные мягкие тени для кнопок и окон |
| animation-systems | [`Agent-Design-Skills/animation-systems`](Agent-Design-Skills/animation-systems/) | Длительности 120–200 / 180–260 / 220–320 мс, ease-out, задержка между элементами 40–90 мс |
| apple-hig-design | [`Agent-Design-Skills/apple-hig-design`](Agent-Design-Skills/apple-hig-design/) | Зоны касания ≥ 44 px, отклик нажатия (scale 0.96), safe-area |
| frontend-design | [`Agent-Design-Skills/frontend-design`](Agent-Design-Skills/frontend-design/) | Как уйти от «шаблонного» вида: смелая единая тема |

## Что не пригодится в этом проекте
- **Three.js и 3D-ARPG:** `build-isometric-arpg`, `build-game-camera-controls`, `build-game-monster-system`, `build-threejs-enemy-systems`, `tune-enemy-ai`, `design-action-combat`, `design-game-encounters`, `build-game-inventory`, `build-game-map-editor`, `build-mobile-threejs-games`, `optimize-threejs-games`, `build-vesperfall-review-assets`, `implement-fog-of-war`. У нас 2D canvas-головоломка.
- **Лендинги и веб-темы:** большинство `web-design/*`, `Agent-Design-Skills/*-layout*`, `shadcn-ui-design-system`, `google-material-design-3`, `framer-motion-system`, `cinematic-gsap-lenis-motion-system` и т. п. Это сайты, а не игровые интерфейсы.
- **Медиа и соцсети:**
  - `elevenlabs-tts` — нужен платный ключ API;
  - `unsplash-asset-images` — фото не подходят к рисованному стилю;
  - `write-like-meng-on-x`, `x-bookmark-quote-posts`, `article-prompts-to-skills`.
- **`codex/performance-profiling`** — профилирование через Apple Instruments (macOS), здесь неприменимо. Для нас есть `npm run test:soak`.
- **`Agent-Security-Crypto-Skills/*`** — криптография и безопасность приложений. В браузерной игре без сервера не нужны.
