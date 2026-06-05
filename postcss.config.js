// Tailwind v3 — directly usable as a PostCSS plugin. If we ever migrate to
// v4 we'll need to switch to "@tailwindcss/postcss" and rewrite
// tailwind.config.ts theme tokens as CSS @theme directives.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
