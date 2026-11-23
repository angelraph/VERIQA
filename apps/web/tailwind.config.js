/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Veriga violet, from the logo's upper ribbon.
        violet: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        // Electric blue, from the logo's lower ribbon and link.
        electric: {
          50: "#eef4ff",
          100: "#dbe7ff",
          200: "#bfd4ff",
          300: "#93b6ff",
          400: "#5f8dff",
          500: "#3d6bff",
          600: "#2a4ff5",
          700: "#213de0",
          800: "#2034b5",
          900: "#1f328f",
        },
        ink: {
          DEFAULT: "#0b0b1f",
          900: "#0b0b1f",
          800: "#16163a",
          700: "#2a2a4f",
          600: "#4a4a6a",
          500: "#6b6b88",
          400: "#9494ab",
          300: "#c3c3d3",
          200: "#e3e3ec",
          100: "#f1f1f6",
        },
        canvas: "#f8f7fd",
        mint: { 500: "#10b981", 600: "#059669", 50: "#ecfdf5" },
        amber: { 500: "#f59e0b", 600: "#d97706", 50: "#fffbeb" },
        rose: { 500: "#f43f5e", 600: "#e11d48", 50: "#fff1f2" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #8b5cf6 0%, #5f4bff 45%, #3d6bff 100%)",
        "brand-soft": "linear-gradient(135deg, #f5f3ff 0%, #eef4ff 100%)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,11,31,0.04), 0 8px 24px -12px rgba(11,11,31,0.12)",
        lift: "0 2px 4px rgba(11,11,31,0.04), 0 24px 48px -20px rgba(61,43,180,0.35)",
        glow: "0 0 0 1px rgba(124,58,237,0.15), 0 12px 40px -12px rgba(93,75,255,0.55)",
      },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        ping2: { "0%": { transform: "scale(1)", opacity: "0.6" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        ping2: "ping2 1.6s cubic-bezier(0,0,0.2,1) infinite",
      },
    },
  },
  plugins: [],
};
