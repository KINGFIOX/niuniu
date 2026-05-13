import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        niuniu: {
          pink: "#f78fa7",
          pinkSoft: "#fde6ec",
          cream: "#fff8f1",
        },
      },
      fontFamily: {
        rounded: [
          "ui-rounded",
          "\"Hiragino Maru Gothic ProN\"",
          "\"PingFang SC\"",
          "\"Microsoft YaHei\"",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        bubble: "0 4px 14px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
