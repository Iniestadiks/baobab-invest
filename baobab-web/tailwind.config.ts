import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50:  "#E8F5EE",
          100: "#C5E5D3",
          500: "#23A663",
          600: "#1A7A4A",
          700: "#0F5C37",
          900: "#0a2e1a",
        },
        gold: {
          50:  "#FEF9EC",
          400: "#E8A020",
          500: "#C9972A",
          600: "#A07820",
        },
      },
      fontFamily: {
        sans: ["var(--font-sora)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
