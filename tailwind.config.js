we/** @type {import('tailwindcss').Config} */
export default {
  // Beritahu Tailwind untuk memindai semua file HTML dan JavaScript/React
  // untuk menemukan nama kelas yang digunakan.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
