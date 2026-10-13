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
      // Tighter corners app-wide (Tailwind defaults: lg 8px, xl 12px, 2xl 16px, 3xl 24px).
      borderRadius: {
        lg: "0.375rem",
        xl: "0.5rem",
        "2xl": "0.625rem",
        "3xl": "0.75rem",
      },
      fontFamily: {
        sans: ["'Source Sans 3'", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

