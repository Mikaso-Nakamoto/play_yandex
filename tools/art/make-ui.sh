#!/usr/bin/env bash
# Пересобрать игровые PNG интерфейса и кота из сгенерированных исходников (см. docs/art/PROVENANCE.md).
# Исходники: promo/src/ui/*.webp (без потерь, обрезаны по содержимому, однотонный фон). Результат: src/assets/ui/, src/assets/cat/.
set -e
cd "$(dirname "$0")/../.."
C="python3 tools/art/cutout.py"; U=promo/src/ui; O=src/assets/ui
mkdir -p $O src/assets/cat
# кнопка 3-slice: зелёная → цветовые варианты сдвигом тона (исходный тон ≈106°)
$C $U/btn-wide-green.webp $O/btn-green.png  --bg magenta --max 600 --png8
$C $U/btn-wide-green.webp $O/btn-orange.png --bg magenta --max 600 --png8 --hue -68 --sat 1.25 --val 1.22
$C $U/btn-wide-green.webp $O/btn-blue.png   --bg magenta --max 600 --png8 --hue 100
$C $U/btn-wide-green.webp $O/btn-pink.png   --bg magenta --max 600 --png8 --hue 226
$C $U/btn-wide-green.webp $O/btn-cream.png  --bg magenta --max 600 --png8 --hue -66 --sat 0.32 --val 1.1
# круглая кнопка (исходный тон ≈25°)
for v in "orange 0 1 1" "green 81 1 1" "blue 181 1 1" "pink -53 1 1" "red -23 1 1" "purple 250 1 1" "cream 15 0.25 1.12" "gold 18 1.05 1.15"; do
  set -- $v; $C $U/btn-round-orange.webp $O/round-$1.png --max 192 --png8 --hue $2 --sat $3 --val $4
done
# лента заголовка окна (исходный тон ≈339°)
for v in "pink 0 1.25" "green 127 1.6" "blue -133 1.5" "orange 51 1.6"; do set -- $v; $C $U/ribbon-pink.webp $O/ribbon-$1.png --max 600 --png8 --hue $2 --sat $3; done
# иконки
$C $U/icon-coin.webp $O/coin.png --max 160 --png8
$C $U/icon-bomb.webp $O/bomb.png --max 160 --png8
$C $U/icon-fire.webp $O/fire.png --max 160 --png8
$C $U/icon-rainbow.webp $O/rainbow.png --bg white --max 160 --png8
# кот
# кот: общий масштаб, чтобы все эмоции были одного размера (высота «ожидания» ≈ 360 px)
for c in idle happy sad; do $C $U/cat-$c.webp src/assets/cat/$c.png --scale 0.6 --png8; done
