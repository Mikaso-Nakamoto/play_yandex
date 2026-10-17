# Agent Design Skills Vault

Универсальная библиотека дизайн-навыков (Agent Skills) в формате Markdown для AI-агентов (Antigravity, Claude, Cursor, Codex, Windsurf, Lovable, v0 и других).

Каждый навык автономен, содержит файл спецификации `SKILL.md` со структурированным frontmatter (`name`, `description`), конкретными правилами, сниппетами кода, токенами и списком антипаттернов.

---

## Каталог навыков

### 1. Стратегия, Арт-дирекшн и Промптинг
- **[`frontend-design/`](frontend-design/SKILL.md)** — Борьба с шаблонным AI-дизайном, создание индивидуального характера интерфейса, типографические пары, правило баланса цвета 60-30-10, пространственный ритм.
- **[`design-first-ui-prompting/`](design-first-ui-prompting/SKILL.md)** — Структурирование UI-промптов в виде дизайн-спецификаций (цель, сетка, шрифты, жесткие ограничения, негативные промпты).
- **[`build-awwwards-quality-sites/`](build-awwwards-quality-sites/SKILL.md)** — Создание сайтов уровня Awwwards: сильный арт-дирекшн, один движок плавного скролла (Lenis), строгие критерии качества, Three.js со смыслом.

### 2. Дизайн-системы и стандарты
- **[`google-material-design-3/`](google-material-design-3/SKILL.md)** — Официальная система Material Design 3 (Material You) от Google: динамический цвет HCT, тональные поверхности, адаптивная 8dp-сетка, Compose M3, Flutter, Web CSS Tokens.
- **[`shadcn-ui-design-system/`](shadcn-ui-design-system/SKILL.md)** — Архитектура современных веб-приложений на Radix UI + Tailwind CSS: дизайн-токены на CSS-переменных, CVA-варианты, доступные диалоги, поповеры, формы.
- **[`refactoring-ui/`](refactoring-ui/SKILL.md)** — Тактические правила дизайна от разработчиков (Steve Schoger & Adam Wathan): визуальная иерархия через вес/контраст, отказ от чистого черного, двойные границы, метод grayscale-first.
- **[`apple-hig-design/`](apple-hig-design/SKILL.md)** — Эстетика Apple Human Interface Guidelines: материалы и размытия (vibrancy/blur), непрерывные скругления (squircle), системный шрифт SF Pro, эргономика тач-зон.

### 3. Готовые визуальные темы и стили
- **[`beautiful-shadows/`](beautiful-shadows/SKILL.md)** — Реалистичные многослойные нейтральные тени Tailwind CSS для карточек, поповеров и модальных окон.
- **[`blue-cloudy-clean-modern/`](blue-cloudy-clean-modern/SKILL.md)** — Воздушная светлая тема с рассеянным синим градиентом и утонченной типографикой.
- **[`blue-laser-clean-glass-layout/`](blue-laser-clean-glass-layout/SKILL.md)** — Тёмный технологичный UI со стеклянными плашками и тонкими синими лазерными линиями.
- **[`book-serif-index/`](book-serif-index/SKILL.md)** — Редакционный книжный стиль: классическая антиква, моноширинный индекс, эстетика благородной бумаги.
- **[`bright-green-tech-system-webgl/`](bright-green-tech-system-webgl/SKILL.md)** — Инженерный темный сплит-интерфейс с неоново-зеленым акцентом и интерактивной WebGL-сценой.
- **[`agency-grid-layout-minimal/`](agency-grid-layout-minimal/SKILL.md)** — Минималистичная швейцарская сетка агентства с крупной типографикой.

### 4. Анимации, моушн и интерактивность
- **[`cinematic-gsap-lenis-motion-system/`](cinematic-gsap-lenis-motion-system/SKILL.md)** — Кинематографичный моушн на связке GSAP + ScrollTrigger + Lenis Smooth Scroll.
- **[`framer-motion-system/`](framer-motion-system/SKILL.md)** — Декларативные анимации в React/Next.js: пружинная физика, переходы `layoutId`, выходы `AnimatePresence`, жесты.
- **[`animation-systems/`](animation-systems/SKILL.md)** — Комплексная координация анимаций на странице.
- **[`animation-on-scroll/`](animation-on-scroll/SKILL.md)** — Производительное появление элементов через `IntersectionObserver`.

### 5. WebGL, шейдеры и эффекты
- **[`add-shader-cursor-trail/`](add-shader-cursor-trail/SKILL.md)** — Курсорный шейдерный след на WebGL / Three.js.
- **[`ambient-section-particles/`](ambient-section-particles/SKILL.md)** — Легковесные интерактивные частицы для фонов секций.
- **[`background-grid-webgl/`](background-grid-webgl/SKILL.md)** — Трехмерная координатная сетка с реакцией на курсор.
- **[`beam-glow-states/`](beam-glow-states/SKILL.md)** — Неоновые лучи, переливающиеся градиенты и подсветка границ.
- **[`atmosphere-background/`](atmosphere-background/SKILL.md)** — Атмосферное освещение и глубокий градиент.

### 6. Адаптивная верстка нового поколения
- **[`responsive-layout-systems/`](responsive-layout-systems/SKILL.md)** — Внутренняя адаптивность (intrinsic layout), CSS Container Queries (`@container`), CSS Subgrid, плавная типографика через `clamp()`.

### 7. Воркфлоу захвата и анализа дизайна (Codex Workflows)
- **[`video-to-superprompt/`](video-to-superprompt/SKILL.md)** — Анализ видеозаписи интерфейса и сборка детального промпта для генерации верстки.
- **[`html-to-interaction-prompts/`](html-to-interaction-prompts/SKILL.md)** — Деконструкция готового сайта на изолированные промпты компонентов.
- **[`daily-ui-inspiration-capture/`](daily-ui-inspiration-capture/SKILL.md)** — Цикл поиска, захвата и пополнения базы UI-референсов.
- **[`generate-reference-inspired-brand-worlds/`](generate-reference-inspired-brand-worlds/SKILL.md)** — Генерация дизайн-вселенной бренда по референсам.
- **[`build-daily-inspiration-sites/`](build-daily-inspiration-sites/SKILL.md)** — Быстрая сборка сайтов на основе свежих референсов.
- **[`optimize-web-animations/`](optimize-web-animations/SKILL.md)** — Профилирование и оптимизация производительности 60 FPS.

---

## Как использовать навыки с любым AI-агентом

- **Для Claude Code:** Добавьте путь к папке навыков в ваш `CLAUDE.md` или передавайте нужный `SKILL.md` в контекст сессии.
- **Для Cursor:** Укажите путь к нужным файлам `SKILL.md` в файле `.cursorrules` или прикрепите как context file в чате.
- **Для Antigravity:** Навыки читаются агентом автоматически при наличии в рабочей директории или при вызове `view_file`.
- **Для Codex / v0 / Lovable / Web-чатов:** Просто скопируйте блок Markdown нужного `SKILL.md` и вставьте его в System Prompt или перед началом задачи.
