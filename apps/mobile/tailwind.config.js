/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#0A0E0D",
        panel: "#111816",
        line: "#28332F",
        paper: "#F4F0E5",
        signal: "#68F5A5",
        flare: "#FF9C66",
        muted: "#8C9A95",
      },
      fontFamily: {
        display: ["serif"],
        body: ["sans-serif"],
        mono: ["monospace"],
      },
    },
  },
  plugins: [],
};
