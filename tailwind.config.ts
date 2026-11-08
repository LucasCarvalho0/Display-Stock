import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060D17",
          900: "#0B192C",
          800: "#1E3E62",
          700: "#2A4D78",
        },
        brand: {
          DEFAULT: "#0066CC",
          dark: "#004E9F",
          light: "#E8F0FD",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
