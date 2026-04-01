/** @type {import("tailwindcss").Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        matrix: [
          '"Tahoma"',
          '"MS Sans Serif"',
          '"Arial"',
          "sans-serif",
        ],
        mono: ['"Courier New"', "Courier", "monospace"],
      },
      fontSize: {
        display: [
          "clamp(28px, 4vw, 42px)",
          {
            lineHeight: "1",
            letterSpacing: "-0.01em",
            fontWeight: "700",
          },
        ],
        heading: [
          "11px",
          {
            lineHeight: "1.3",
            letterSpacing: "0em",
            fontWeight: "700",
          },
        ],
        body: [
          "11px",
          {
            lineHeight: "1.4",
            fontWeight: "400",
          },
        ],
        caption: [
          "10px",
          {
            lineHeight: "1.3",
            letterSpacing: "0em",
            fontWeight: "400",
          },
        ],
      },
      colors: {
        matrix: {
          // Win2K color remapping — keeps all existing class references working
          primary: "#000000",       // text
          bright: "#000000",        // bright text
          muted: "#808080",         // disabled/muted text
          dim: "#808080",           // dimmed
          ghost: "#c0c0c0",         // subtle borders (use win-btn-face)
          panel: "#c0c0c0",         // panel background
          panelStrong: "#c0c0c0",   // stronger panel bg
          dark: "#c0c0c0",          // body bg
        },
        gold: "#000080",            // remap gold -> navy blue for Win2K accent
        win: {
          bg: "#c0c0c0",
          dark: "#808080",
          darker: "#404040",
          titlebar: "#000080",
          titlebarbg: "#1084d0",
          text: "#000000",
          sunken: "#ffffff",
          highlight: "#000080",
          "highlight-text": "#ffffff",
          btn: "#c0c0c0",
          "btn-light": "#dfdfdf",
          "btn-highlight": "#ffffff",
          "btn-shadow": "#808080",
          "btn-dark-shadow": "#404040",
          green: "#008000",
          navy: "#000080",
        },
      },
      boxShadow: {
        "matrix-glow": "none",
        "matrix-gold": "none",
        "win-raised": "inset -1px -1px 0 #808080, inset 1px 1px 0 #dfdfdf, 1px 1px 0 #404040, -1px -1px 0 #ffffff",
        "win-inset": "inset 1px 1px 0 #808080, inset -1px -1px 0 #dfdfdf",
      },
      backdropBlur: {
        panel: "0px",
      },
    },
  },
  plugins: [],
};
