/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B0C0E",
        foreground: "#F8FAFC",
        muted: "#111827",
        "muted-foreground": "#94A3B8",
        border: "#334155",
        input: "#1f2937",
        ring: "#14B8A6",
        card: "#111827",
        "card-foreground": "#F8FAFC",
        primary: "#14B8A6",
        "primary-foreground": "#0F172A",
        secondary: "#0EA5E9",
        "secondary-foreground": "#FFFFFF",
        destructive: "#EF4444",
        "destructive-foreground": "#FFFFFF",
        accent: "#22C55E",
        "accent-foreground": "#FFFFFF",
        "sidebar-foreground": "#E2E8F0",
      },
    },
  },
  plugins: [],
}
