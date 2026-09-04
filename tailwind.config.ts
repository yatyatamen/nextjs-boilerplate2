import type { Config } from "tailwindcss"

const config: Config = {
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
        ring: "#40938c",
        card: "#111827",
        "card-foreground": "#F8FAFC",
        primary: "#40938c",
        "primary-foreground": "#000000",
        secondary: "#40938c",
        "secondary-foreground": "#000000",
        destructive: "#EF4444",
        "destructive-foreground": "#FFFFFF",
        accent: "#40938c",
        "accent-foreground": "#000000",
        "sidebar-foreground": "#E2E8F0",
      },
    },
  },
  plugins: [],
}

export default config
