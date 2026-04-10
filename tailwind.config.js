/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#F3EEFF",
          100: "#E0D1FE",
          200: "#C4A6FD",
          300: "#A87BFC",
          400: "#8B50FB",
          500: "#6C3AE1",
          600: "#5A2DBF",
          700: "#47229D",
          800: "#35187B",
          900: "#230E59",
        },
        accent: {
          50: "#FFF0F6",
          100: "#FFD6E7",
          200: "#FFADD2",
          300: "#FF85BD",
          400: "#FF5CA8",
          500: "#F5367B",
          600: "#D91A60",
          700: "#B3114D",
          800: "#8C0A3A",
          900: "#660527",
        },
        dark: {
          50: "#E8E8EC",
          100: "#C5C5CE",
          200: "#9D9DAE",
          300: "#75758E",
          400: "#4D4D6E",
          500: "#2A2A4A",
          600: "#1E1E3A",
          700: "#16162D",
          800: "#0E0E20",
          900: "#070713",
        },
      },
    },
  },
  plugins: [],
};
