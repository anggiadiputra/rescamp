/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary-color, #000000)",
        header: "var(--header-color, #ffffff)",
        sidebar: "var(--sidebar-color, #ffffff)",
      },
      fontFamily: {
        sans: ["'Source Sans 3'", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

