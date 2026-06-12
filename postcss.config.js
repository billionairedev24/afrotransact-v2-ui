// Tailwind v4 ships its PostCSS plugin as a separate package. The plugin
// keeps compat with @tailwind directives + tailwind.config.ts, so we don't
// need to rewrite tokens into CSS @theme directives yet.
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
}
