import { heroui } from "@heroui/theme";
import type { Config } from "tailwindcss";

const cyanScale = {
  50: "#ecfeff",
  100: "#cffafe",
  200: "#a5f3fc",
  300: "#67e8f9",
  400: "#22d3ee",
  500: "#06b6d4",
  600: "#0891b2",
  700: "#0e7490",
  800: "#155e75",
  900: "#164e63",
};

const slateScale = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
};

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [
    heroui({
      themes: {
        light: {
          extend: "light",
          colors: {
            background: "#f2f7fb",
            foreground: "#0f172a",
            content1: "#ffffff",
            content2: "#e9f2f8",
            content3: "#dde8f2",
            content4: "#ccd9e5",
            divider: "rgba(15, 23, 42, 0.14)",
            primary: {
              ...cyanScale,
              DEFAULT: cyanScale[600],
              foreground: cyanScale[50],
            },
            secondary: {
              ...slateScale,
              DEFAULT: slateScale[600],
              foreground: slateScale[50],
            },
            default: {
              ...slateScale,
              DEFAULT: slateScale[300],
              foreground: slateScale[900],
            },
            focus: {
              DEFAULT: cyanScale[500],
            },
          },
        },
        dark: {
          extend: "dark",
          colors: {
            background: "#0a121a",
            foreground: "#e2e8f0",
            content1: "#0f1b26",
            content2: "#132433",
            content3: "#1a3042",
            content4: "#223b50",
            divider: "rgba(148, 163, 184, 0.28)",
            primary: {
              50: "#164e63",
              100: "#155e75",
              200: "#0e7490",
              300: "#0891b2",
              400: "#06b6d4",
              500: "#22d3ee",
              600: "#67e8f9",
              700: "#a5f3fc",
              800: "#cffafe",
              900: "#ecfeff",
              DEFAULT: "#22d3ee",
              foreground: "#042f3d",
            },
            secondary: {
              50: "#0f172a",
              100: "#1e293b",
              200: "#334155",
              300: "#475569",
              400: "#64748b",
              500: "#94a3b8",
              600: "#cbd5e1",
              700: "#e2e8f0",
              800: "#f1f5f9",
              900: "#f8fafc",
              DEFAULT: "#94a3b8",
              foreground: "#020617",
            },
            default: {
              50: "#0f172a",
              100: "#1e293b",
              200: "#334155",
              300: "#475569",
              400: "#64748b",
              500: "#94a3b8",
              600: "#cbd5e1",
              700: "#e2e8f0",
              800: "#f1f5f9",
              900: "#f8fafc",
              DEFAULT: "#334155",
              foreground: "#f8fafc",
            },
            focus: {
              DEFAULT: "#22d3ee",
            },
          },
        },
      },
    }),
  ],
};

export default config;
