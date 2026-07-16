import rtl from "tailwindcss-rtl";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* Primary - uses --primary-* CSS variables from color themes */
        primary: {
          50: 'var(--primary-50, #f0fdf9)',
          100: 'var(--primary-100, #ccfbf1)',
          200: 'var(--primary-200, #99f6e4)',
          300: 'var(--primary-300, #5eead4)',
          400: 'var(--primary-400, #2dd4bf)',
          DEFAULT: 'var(--primary, #0d9488)',
          600: 'var(--primary-600, #0f766e)',
          700: 'var(--primary-700, #115e59)',
          800: 'var(--primary-800, #134e4a)',
          900: 'var(--primary-900, #042f2e)',
          glow: 'var(--primary-glow, rgba(45, 212, 191, 0.3))',
        },
        /* Semantic Colors - use CSS variables from themes */
        success: {
          DEFAULT: 'var(--success-text, #047857)',
          light: 'var(--success-light, rgba(5, 150, 105, 0.1))',
          bg: 'var(--success-bg, #ecfdf5)',
          text: 'var(--success-text, #047857)',
          border: 'var(--success-border, #a7f3d0)',
        },
        danger: {
          DEFAULT: 'var(--danger, #dc2626)',
          light: 'var(--danger-light, rgba(220, 38, 38, 0.1))',
          bg: 'var(--danger-bg, #fef2f2)',
          text: 'var(--danger-text, #b91c1c)',
          border: 'var(--danger-border, #fecaca)',
        },
        warning: {
          DEFAULT: 'var(--warning-text, #f59e0b)',
          light: 'var(--warning-light, rgba(245, 158, 11, 0.1))',
          bg: 'var(--warning-bg, #fffbeb)',
          text: 'var(--warning-text, #b45309)',
          border: 'var(--warning-border, #fde68a)',
        },
        info: {
          DEFAULT: 'var(--info-text, #3b82f6)',
          light: 'var(--info-light, rgba(59, 130, 246, 0.1))',
          bg: 'var(--info-bg, #eff6ff)',
          text: 'var(--info-text, #1d4ed8)',
          border: 'var(--info-border, #bfdbfe)',
        },
        /* Text Colors - use CSS variables from themes */
        text: {
          primary: 'var(--text-primary, #0f172a)',
          secondary: 'var(--text-secondary, #475569)',
          muted: 'var(--text-muted, #94a3b8)',
          accent: 'var(--text-accent, #0d9488)',
        },
        /* Border Colors */
        border: {
          DEFAULT: 'var(--border-normal, #e2e8f0)',
          strong: 'var(--border-strong, #94a3b8)',
          accent: 'var(--border-accent, rgba(13, 148, 136, 0.4))',
        },
        /* Background Colors */
        bg: {
          base: 'var(--bg-base, #f8fafc)',
          surface: 'var(--bg-surface, #ffffff)',
          sidebar: 'var(--bg-sidebar, #f8fafc)',
          elevated: 'var(--bg-elevated, #ffffff)',
          overlay: 'var(--bg-overlay, #f1f5f9)',
          input: 'var(--bg-input, #f1f5f9)',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Noto Sans Arabic', 'Tajawal', 'sans-serif'],
        number: ['var(--font-number)', 'Outfit', 'sans-serif'],
        mono: ['Outfit', 'monospace'],
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
        bellRing: {
          "0%": { transform: "rotate(0)" },
          "15%": { transform: "rotate(14deg)" },
          "30%": { transform: "rotate(-12deg)" },
          "45%": { transform: "rotate(10deg)" },
          "60%": { transform: "rotate(-8deg)" },
          "75%": { transform: "rotate(4deg)" },
          "100%": { transform: "rotate(0)" },
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
        "bell-ring": "bellRing 0.5s ease-in-out",
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        '2sm': ['0.8125rem', { lineHeight: '1.125rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.5rem' }],
        'xl': ['1.25rem', { lineHeight: '1.5rem' }],
        '2xl': ['1.375rem', { lineHeight: '1.5rem' }],
        '3xl': ['1.625rem', { lineHeight: '1.4' }],
        '4xl': ['2rem', { lineHeight: '1.3' }],
        '5xl': ['2.5rem', { lineHeight: '1.2' }],
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
