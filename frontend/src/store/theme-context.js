import { createContext } from 'react';

export const THEME_STORAGE_KEY = 'leen-theme';
export const THEMES = ['light', 'dark', 'system'];

export const ThemeContext = createContext(null);
