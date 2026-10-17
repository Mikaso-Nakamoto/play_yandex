# Происхождение рисованных ресурсов

Все картинки сгенерированы ИИ заранее, во время разработки (правило 1.23 Яндекс Игр разрешает такие материалы). Затем они обработаны локально.
Эталон стиля — ключевой арт `promo/src/keyart.png`, выбранный владельцем проекта.

| Файл в игре | Мастер | Дата | Референсы |
|---|---|---|---|
| `src/assets/bg/w0-p.jpg` | `promo/src/bg/bg-0-meadow.jpg` | 17.10.2026 | keyart |
| `src/assets/bg/w1-p.jpg` … `w7-p.jpg` | `promo/src/bg/bg-<n>-<мир>.jpg` | 17.10.2026 | bg-0-meadow (композиция) + keyart (стиль) |
| `src/assets/bg/w0-l.jpg`, `w1-l.jpg`, `w2-l.jpg` | `promo/src/bg/bgl-<n>-<мир>.jpg` | 17.10.2026 | вертикальный фон того же мира + keyart |

Обработка (Pillow): игровые файлы — JPEG q84 progressive, мастер-файлы — JPEG q93. Размеры 768×1376 и 1376×768.

## Шаблон промпта — вертикальный фон 9:16
> Vertical 9:16 background for a casual mobile bubble-shooter game. Use the first reference image (a painted meadow game background) as the exact reference for composition, framing, level of detail and painting technique, and the second reference image for the art style and color richness. Create a NEW scene: **⟨СЦЕНА⟩**. Soft painted storybook illustration, gouache and watercolor texture, ⟨свет⟩. Upper 55% of the image is open ⟨небо⟩ with soft clouds near the edges and calm empty space in the middle (game bubbles will cover it). Middle band: ⟨даль⟩, soft and low contrast. Bottom 25%: foreground ⟨передний план⟩ only near the left and right edges and the very bottom; keep an open flat area at bottom center and bottom left. No characters, no animals, no bubbles, no text, no letters, no UI, no frame, full-bleed.

| Мир | Сцена (кратко) |
|---|---|
| 0 Солнечная поляна | sunny meadow: голубое небо, зелёные холмы, рощица, полевые цветы (первый фон: референс — только keyart) |
| 1 Конфетная страна | CANDY LAND: розово-сиреневое небо, облака из сахарной ваты, мятные и клубничные холмы, деревья-леденцы, конфетный замок, заборчики-карамельки |
| 2 Морской берег | SUNNY SEA SHORE: бирюзовое море, маяк на мысу, парусник, песчаный пляж с ракушками и морскими звёздами, пальмовые листья |
| 3 Осенний лес | AUTUMN FOREST: золотой свет, оранжевые и красные деревья, мельница, листопад, грибы, жёлуди, тыквы |
| 4 Снежные горы | SNOWY MOUNTAINS: заснеженные вершины, ели, домик с тёплыми окнами, сугробы, ягоды, деревянный забор |
| 5 Звёздная ночь | MAGICAL STARRY NIGHT: сине-фиолетовое небо со звёздами, полумесяц, силуэты деревьев, домик с огоньками, светлячки (уютно, не страшно) |
| 6 Лавандовое поле | LAVENDER FIELD in Provence: сиренево-персиковое утреннее небо, ряды лаванды до горизонта, каменный дом, бабочки |
| 7 Закатная долина | SUNSET VALLEY: закатное небо от персикового к сиреневому, низкое солнце, тёплые холмы, река с отражением заката, полевые цветы |

## Шаблон промпта — горизонтальный фон 16:9
> Horizontal 16:9 wide desktop version of the reference game background (⟨мир⟩), same painted storybook style, same colors, same lighting and level of detail. Wide panorama: ⟨небо⟩ in the upper half; ⟨детали⟩ on the left and right sides; ⟨передний план⟩ along the bottom edge and in the bottom corners. The central vertical third of the image must stay calm and simple (open sky and soft distant hills) because the game field will be placed there. No characters, no animals, no bubbles, no text, no letters, no UI, no frame, full-bleed.

## Ещё не сделано (следующий этап)
- Горизонтальные фоны миров 3–7: пока широкий кадр собирается из вертикального.
- Рисованный кот (ожидание / радость / грусть) и котята в шариках — генерация на зелёном фоне + вырезание.
- Рисованные иконки: монета-лапка, бомба, радуга, огненный шар, подарок.
