import nextConfig from "eslint-config-next";

const tsPlugin = nextConfig.find((c) => c.plugins?.["@typescript-eslint"])?.plugins;

const eslintConfig = [
  ...nextConfig,
  {
    plugins: tsPlugin,
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
