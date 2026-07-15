/** @type {import('postcss-load-config').Config} */
// Temporarily disable Tailwind's PostCSS plugin to avoid native binding issues
// while running API-focused development and tests. Re-enable for full styling.
const config = {
  plugins: {
    // '@tailwindcss/postcss': {},
  },
}

export default config
