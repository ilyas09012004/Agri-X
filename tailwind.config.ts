import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D5A27',
          dark: '#4CAF50',
          light: '#8BC34A',
        },
        secondary: {
          DEFAULT: '#4CAF50',
          dark: '#2D5A27',
          light: '#66BB6A',
        },
        background: {
          light: '#FFFFFF',
          dark: '#0F1F14',
        },
        surface: {
          light: '#F5F9F4',
          dark: '#1A2F1E',
        },
        text: {
          primary: {
            light: '#1B1B1B',
            dark: '#FFFFFF',
          },
          secondary: {
            light: '#666666',
            dark: '#B0B0B0',
          },
        },
        border: {
          light: '#E0E0E0',
          dark: '#2D5A27',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;