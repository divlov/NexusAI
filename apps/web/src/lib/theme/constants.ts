/**
 * Kept in a plain module (no 'use client') so server-evaluated code — like the
 * no-flash script rendered from the root layout — can read the literal value.
 * Exporting it from ThemeProvider.tsx instead would have every export of that
 * client module replaced with a server-reference stub, turning this constant
 * into a throwing function at runtime.
 */
export const THEME_STORAGE_KEY = 'nexus-theme';
