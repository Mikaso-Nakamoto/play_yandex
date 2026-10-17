// Геометрия поля (в «мировых» единицах; на экран переводится одним коэффициентом масштаба).
export const COLS = 11;                       // шариков в «длинном» ряду (в сдвинутом — COLS - 1)
export const D = 40;                          // диаметр шарика
export const R = D / 2;                       // радиус
export const ROW_H = D * Math.sqrt(3) / 2;    // шаг рядов гексагональной сетки
export const FIELD_W = COLS * D;              // ширина поля = 440

// Нижняя зона под полем: пусковая установка, следующий шарик, кошка, бустеры.
export const LAUNCH_AREA = 132;               // высота зоны запуска в мировых единицах
export const MIN_VIEW_ROWS = 14.2;            // минимум рядов, которые должны помещаться над пушкой
export const VIEW_MIN_H = MIN_VIEW_ROWS * ROW_H + LAUNCH_AREA; // минимальная видимая высота мира
export const LAUNCH_FROM_BOTTOM = 64;         // центр пушки от нижнего края вида
export const BOARD_GAP = 150;                 // мин. расстояние от низа шариков до центра пушки
export const ENDLESS_MAX_ROWS = 12;           // бесконечный режим: проигрыш, если шарик ниже этого ряда

/** Куда должна смотреть камера, чтобы нижний ряд был не ближе BOARD_GAP к пушке */
export function cameraTarget(lowestRow, viewH) {
  if (lowestRow < 0) return 0;
  const bottom = R + lowestRow * ROW_H + R;
  const launcherViewY = viewH - LAUNCH_FROM_BOTTOM;
  return Math.max(0, bottom - (launcherViewY - BOARD_GAP));
}

// Типы ячеек
export const T_NORMAL = 0;
export const T_KITTEN = 1;
export const T_STONE = 2;
export const T_BOMB = 3;

// Спец-снаряды (бустеры)
export const S_NONE = '';
export const S_BOMB = 'bomb';
export const S_RAINBOW = 'rainbow';
export const S_FIRE = 'fire';

// Палитра шариков: [основной, светлый, тёмный]
export const PALETTE = [
  { name: 'red', base: '#ff4f64', light: '#ffb3bd', dark: '#c3173a' },
  { name: 'yellow', base: '#ffcf2e', light: '#fff2a8', dark: '#d98b00' },
  { name: 'green', base: '#45d16b', light: '#b9f7c4', dark: '#16924a' },
  { name: 'blue', base: '#3d8bff', light: '#b5d4ff', dark: '#1a4fc4' },
  { name: 'purple', base: '#a35cff', light: '#dcc0ff', dark: '#6526c9' },
  { name: 'cyan', base: '#26d9e0', light: '#b4f6f8', dark: '#078f9e' },
  { name: 'pink', base: '#ff6fc8', light: '#ffc6ea', dark: '#c42b8c' },
];

// Окрас котят внутри шариков
export const KITTEN_FURS = [
  { fur: '#fff7ee', ear: '#ffb4c6', patch: null },          // белый
  { fur: '#ffb35c', ear: '#ff9fb4', patch: '#f08a24' },     // рыжий
  { fur: '#b9c1cf', ear: '#ffb0c2', patch: '#8792a6' },     // серый
  { fur: '#4a4453', ear: '#ff9fb8', patch: '#fff7ee' },     // чёрный с белым
];

// Очки
export const PTS_POP = 10;
export const PTS_DROP = 20;
export const PTS_KITTEN = 100;
export const PTS_SHOT_LEFT = 100;

export const SHOT_SPEED = 1500;               // ед/с
export const MIN_ANGLE = 8 * Math.PI / 180;   // ограничение угла от горизонтали
export const HIT_DIST = D * 0.8;              // дистанция «касания» снаряда с шариком
