export default [
  {
    ignores: ["coverage/**", "data/**", "dist/**", "node_modules/**", "worktrees/**"],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        process: "readonly",
        URL: "readonly",
        Response: "readonly",
        Request: "readonly",
        HTMLElement: "readonly",
      },
    },
  },
];
