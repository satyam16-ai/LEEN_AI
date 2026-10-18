/** Logical board size. The AI draws in these units; the canvas scales them to fit. */
export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;
export const MARGIN = 60;

export const FONT_SIZES = { sm: 34, md: 46, lg: 60, xl: 76 };
export const LINE_SPACING = 1.6;
export const HAND_FONT = 'Kalam, "Comic Sans MS", "Segoe Print", cursive';

export function handFont(size, weight = 400) {
  return `${weight} ${size}px ${HAND_FONT}`;
}

/** "Paper" whiteboard in light mode, chalkboard in dark mode. */
export const BOARD_THEMES = {
  light: {
    background: '#fffdf8',
    grid: 'rgba(99, 102, 241, 0.07)',
    colors: {
      ink: '#1e2433',
      blue: '#2563eb',
      red: '#dc2626',
      green: '#15803d',
      orange: '#ea580c',
      purple: '#7c3aed',
    },
    fillAlpha: 0.16,
  },
  dark: {
    background: '#1d2a25',
    grid: 'rgba(255, 255, 255, 0.035)',
    colors: {
      ink: '#f4f1e8',
      blue: '#93c5fd',
      red: '#fca5a5',
      green: '#86efac',
      orange: '#fdba74',
      purple: '#d8b4fe',
    },
    fillAlpha: 0.2,
  },
};

export function colorOf(theme, name) {
  const { colors } = BOARD_THEMES[theme] ?? BOARD_THEMES.light;
  return colors[name] ?? colors.ink;
}

/** Where visuals go when the AI gives no box: the right side of the board. */
export const STAGE = { x: 920, y: 100, w: 620, h: 760 };
/** Left edge of each writing column (writes without x/y flow down the active one). */
export const COLUMNS = { left: 80, right: 940, full: 80 };
/** Colours for multiple curves, bars or slices, in order. */
export const PALETTE = ['blue', 'red', 'green', 'purple'];
/** Font size of labels inside visuals (ticks, node text, diagram labels). */
export const LABEL_PX = 24;
