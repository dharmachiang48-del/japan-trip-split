/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        japan: {
          red: '#E83929',      // 茜色 (Akane)
          cherry: '#FEE4E8',   // 櫻花粉 (Sakura)
          indigo: '#1E2B37',   // 藍鼠 (Ainezumi)
          gold: '#C5A059',     // 金茶
          cream: '#FBF9F5',    // 和紙白
          sage: '#4A6B5D'      // 抹茶綠
        }
      }
    },
  },
  plugins: [],
}
