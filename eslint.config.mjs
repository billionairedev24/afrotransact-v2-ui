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
      // Enforced as error: all user-visible images must use next/image for optimization.
      // Remaining intentional exceptions (e.g. blob: previews) must use eslint-disable-next-line.
      "@next/next/no-img-element": "error",
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
