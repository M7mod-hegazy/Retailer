import rtl from "tailwindcss-rtl";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* Primary - Teal */
        primary: {
          50: '#f0fdf9',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          DEFAULT: '#0d9488',
          600: '#0f766e',
          700: '#115e59',
          800: '#134e4a',
          900: '#042f2e',
          glow: 'rgba(45, 212, 191, 0.3)',
        },
        /* Semantic Colors */
        success: {
          DEFAULT: '#047857',
          light: 'rgba(5, 150, 105, 0.1)',
          bg: '#ecfdf5',
          text: '#047857',
          border: '#a7f3d0',
        },
        danger: {
          DEFAULT: '#dc2626',
          light: 'rgba(220, 38, 38, 0.1)',
          bg: '#fef2f2',
          text: '#b91c1c',
          border: '#fecaca',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: 'rgba(245, 158, 11, 0.1)',
          bg: '#fffbeb',
          text: '#b45309',
          border: '#fde68a',
        },
        info: {
          DEFAULT: '#3b82f6',
          light: 'rgba(59, 130, 246, 0.1)',
          bg: '#eff6ff',
          text: '#1d4ed8',
          border: '#bfdbfe',
        },
        /* Text Colors */
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
          accent: '#0d9488',
        },
        /* Border Colors */
        border: {
          DEFAULT: '#e2e8f0',
          strong: '#94a3b8',
          accent: 'rgba(13, 148, 136, 0.4)',
        },
        /* Background Colors */
        bg: {
          base: '#f8fafc',
          surface: '#ffffff',
          elevated: '#ffffff',
          overlay: '#f1f5f9',
          input: '#f1f5f9',
        },
      },
      fontFamily: {
        sans: ["Noto Sans Arabic", "Inter", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        mono: ["Inter", "monospace"],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)",
        elevated: "0 10px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08)",
        modal: "0 25px 50px rgba(0, 0, 0, 0.2)",
        glow: "0 0 20px rgba(13, 148, 136, 0.2)",
        "glow-green": "0 4px 12px rgba(13, 148, 136, 0.25)",
        "glow-red": "4px 0 12px rgba(239, 68, 68, 0.2)",
        focus: "0 0 0 3px rgba(13, 148, 136, 0.2)",
      },
      backdropBlur: {
        DEFAULT: '20px',
        sm: '12px',
        lg: '30px',
      },
      transitionDuration: {
        instant: '60ms',
        fast: '120ms',
        DEFAULT: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        modalEnter: {
          from: { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        scanFlash: {
          "0%": { background: "rgba(13, 148, 136, 0)" },
          "20%": { background: "rgba(13, 148, 136, 0.3)" },
          "100%": { background: "rgba(13, 148, 136, 0)" },
        },
        totalBounce: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.98)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 250ms ease-out",
        "slide-down": "slideDown 200ms ease-out",
        "modal-enter": "modalEnter 250ms ease-out",
        shimmer: "shimmer 1.5s linear infinite",
        pulse: "pulse 2s ease-in-out infinite",
        spin: "spin 1s linear infinite",
        "scan-flash": "scanFlash 600ms ease-out",
        "total-bounce": "totalBounce 350ms ease-out",
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        'xs': ['0.6875rem', { lineHeight: '1rem' }],
        '2sm': ['0.75rem', { lineHeight: '1.125rem' }],
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'base': ['0.9375rem', { lineHeight: '1.5rem' }],
        'lg': ['1.0625rem', { lineHeight: '1.5rem' }],
        'xl': ['1.125rem', { lineHeight: '1.5rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.5rem' }],
        '3xl': ['1.5rem', { lineHeight: '1.4' }],
        '4xl': ['1.875rem', { lineHeight: '1.3' }],
        '5xl': ['2.25rem', { lineHeight: '1.2' }],
      },
      lineHeight: {
        'tighter': '1.2',
        'tight': '1.3',
        'normal': '1.5',
        'relaxed': '1.625',
        'loose': '1.75',
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em',
      },
    },
  },
  plugins: [rtl],
};