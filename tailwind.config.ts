import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // paleta dark inspirada em dashboards fintech: superfícies quase pretas
        // com leve tom quente + acento verde-lima ("volt")
        noir: {
          950: "#0b0c09",
          900: "#13140e",
          850: "#181913",
          800: "#1c1d16",
          700: "#24251d",
          600: "#2e2f26",
          500: "#3d3e34",
        },
        volt: {
          DEFAULT: "#c9f24b",
          soft: "#dcf987",
          dim: "#8fb52c",
          ink: "#161807",
        },
      },
    },
  },
  plugins: [],
};
export default config;
