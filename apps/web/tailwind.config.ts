import type { Config } from 'tailwindcss';

/**
 * Colors resolve to CSS variables defined in `globals.css` (see `:root` / `.dark`).
 * The bare-channel `hsl(var(--token))` form preserves Tailwind opacity modifiers
 * like `bg-primary/30`. Dark mode is class-based, toggled on <html> by ThemeProvider.
 */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: token('page'),
        border: token('border'),
        background: token('background'),
        elevated: token('elevated'),
        sunken: token('sunken'),
        foreground: token('foreground'),
        muted: token('muted'),
        'muted-foreground': token('muted-foreground'),
        primary: token('primary'),
        'primary-foreground': token('primary-foreground'),
        accent: token('accent'),
        'accent-foreground': token('accent-foreground'),
        ring: token('ring'),
        destructive: token('destructive'),
        info: token('info'),
        'info-foreground': token('info-foreground'),
        warn: token('warn'),
        'warn-foreground': token('warn-foreground'),
        success: token('success'),
        'success-foreground': token('success-foreground'),
        error: token('error'),
        'error-foreground': token('error-foreground'),
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        label: ['var(--font-geist)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
