# STACK.md — Personal Trainer

Stack tecnológica do projeto Personal Trainer. Referência para desenvolvedores e agentes AI.
Baseada na stack consolidada do ecossistema MasterWise (mesma base: DS-Dashboard).

---

## 1. Visão Geral

| Camada       | Tecnologia                          | Versão   |
|--------------|--------------------------------------|----------|
| Runtime      | Node.js (ESM)                       | 24+      |
| Backend      | Express                              | 4.x      |
| Frontend     | React (JSX puro, sem TypeScript)     | 18.3     |
| Build        | Vite + @vitejs/plugin-react          | 6.x      |
| Banco        | SQLite (`node:sqlite` nativo)        | —        |
| Testes       | Vitest + Supertest                   | 2.x      |
| Lint         | ESLint (flat config)                 | 9.x      |
| IA           | Claude API (Anthropic) via proxy     | —        |

---

## 2. Backend

### Entry Points

- **`server.js`** — Bootstrap HTTP. Importa `createApp()`, escuta na porta definida em `PORT`.
- **`app.js`** — Factory Express. Exporta `createApp(options)` para testabilidade (desabilita SPA em testes).

```js
// server.js
import { createApp } from "./app.js";
const PORT = process.env.PORT || 3400;
const app = await createApp();
app.listen(PORT);
```

### Middleware Stack (ordem)

1. **Helmet** — Headers de segurança (`contentSecurityPolicy: false` para SPA).
2. **CORS** — Origens configuradas via `CORS_ALLOWED_ORIGINS` (env), suporte a ngrok dinâmico.
3. **JSON body parser** — `express.json({ limit: "10mb" })`.
4. **URL rewrite** — `/api/pt/*` → `/api/*` (compatibilidade Caddy).
5. **Rate limiting** — Global (60/min), Login (5/min), Claude (10/5min). Configurável via env.

### Autenticação

- **Session-based** com tokens Bearer (`Authorization: Bearer <sessionId>`).
- Middleware `authMiddleware` valida sessão no SQLite.
- `requireRole("role")` para controle de acesso por perfil.
- `optionalAuth` para rotas que funcionam com ou sem autenticação.
- Senhas com `crypto.scryptSync` + salt.

### Rotas

- Organizadas por feature em `routes/<feature>.js`.
- Cada arquivo exporta uma função factory: `export default function featureRoutes() { ... }`.
- Prefixo `/api/` para todas as rotas de dados.
- Rota `/api/health` obrigatória para health checks.

### Banco de Dados

- **SQLite síncrono** via `node:sqlite` (nativo do Node 24+).
- Conexão única exportada de `db/index.js`.
- **Migrations**: arquivos `.sql` numerados em `db/migrations/` (ex: `001_initial.sql`).
- **Prepared Statements** centralizados no objeto `stmts` exportado de `db/index.js`.
- Schema versionado na tabela `schema_version`.

```
db/
├── index.js          # Conexão + migration runner + prepared statements
└── migrations/
    ├── 001_initial.sql
    └── ...
```

### Serviços Backend

- Lógica de negócio em `services/<feature>.js`.
- Proxy para API Anthropic em rota dedicada (nunca expor chave no frontend).

---

## 3. Frontend

### Princípios

- **React 18.3 com JSX puro** — sem TypeScript.
- **Sem React Router** — navegação por abas controlada via estado.
- **Context API + custom hooks** — sem Redux, sem Zustand.
- **Feature-first** — componentes agrupados por domínio, não por tipo.

### Provider Stack (aninhamento)

```
ThemeProvider
  └── AuthProvider
        └── FeatureProvider(s)
              └── ToastProvider
                    └── <App />
```

### Organização do Frontend

```
src/
├── main.jsx          # ReactDOM.createRoot
├── App.jsx           # Layout + providers + navegação por abas
├── components/       # Feature-first (components/<feature>/)
├── contexts/         # React contexts (ThemeContext, AuthContext, etc.)
├── hooks/            # Custom hooks para lógica de negócio
├── services/         # Camada de abstração de API (fetch wrappers)
├── views/            # Views fullscreen por aba
├── styles/           # CSS + design tokens
│   ├── tokens.css    # CSS variables
│   └── tokens.js     # Tokens em JS para inline styles
├── data/             # Constantes e dados estáticos
└── utils/            # Utilitários puros
```

### Serviços (API Layer)

- Cada `services/<feature>.js` encapsula chamadas fetch.
- Base URL relativa (`/api/...`), Vite proxy em dev.
- Token Bearer injetado automaticamente via header.

---

## 4. Design System

### Filosofia

- **Sem Tailwind, sem CSS-in-JS, sem biblioteca de componentes.**
- CSS puro com **CSS Variables** para temas.
- Nomes de classe **BEM-inspired** com prefixo de componente (ex: `.mc__header`, `.sh__label`).
- **Design tokens** em duas formas: `tokens.css` (variáveis CSS) + `tokens.js` (objetos JS).
- **Dark-first** — tema escuro como padrão.
- **Mobile-first** — layout constraint com `max-width`, header fixo + bottom nav.

### Tokens CSS (`:root`)

```css
:root {
  /* Layout */
  --pt-app-max-width: 385px;
  --pt-header-height: 56px;
  --pt-bottom-nav-height: 64px;

  /* Border Radius */
  --pt-radius-sm: 8px;
  --pt-radius-md: 12px;
  --pt-radius-lg: 16px;

  /* Tipografia */
  --pt-fs-2xs: 0.65rem;   /* 10.4px */
  --pt-fs-xs: 0.75rem;    /* 12px   */
  --pt-fs-sm: 0.85rem;    /* 13.6px */
  --pt-fs-base: 1rem;     /* 16px   */
  --pt-fs-lg: 1.25rem;    /* 20px   */
  --pt-fs-xl: 1.5rem;     /* 24px   */
  --pt-fs-2xl: 2rem;      /* 32px   */

  /* Espaçamento (base 4px) */
  --pt-space-1: 4px;
  --pt-space-2: 8px;
  --pt-space-3: 12px;
  --pt-space-4: 16px;
  --pt-space-5: 20px;
  --pt-space-6: 24px;

  /* Z-Index */
  --pt-z-header: 100;
  --pt-z-view: 50;
  --pt-z-bottom-nav: 1000;

  /* Transições */
  --pt-transition-fast: 0.15s ease;
  --pt-transition-default: 0.3s ease;
}
```

> **Prefixo**: usar `--pt-` (personal-trainer) ao invés de `--ds-` para evitar colisão.

### Tokens JS

Objeto exportado de `tokens.js` com escalas de:

| Categoria       | Conteúdo                                                    |
|-----------------|--------------------------------------------------------------|
| `fontSize`      | 7 níveis: `2xs` a `2xl`                                     |
| `spacing`       | Múltiplos de 4px: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48      |
| `radius`        | sm(8), md(12), lg(16), xl(20), 2xl(24), full                |
| `colors`        | bg, text, accent, border — com variantes                     |
| `gradients`     | Fundos, botões, barras de progresso                          |
| `shadows`       | sm, md, lg + glow variants                                   |
| `transitions`   | fast(0.15s), default(0.2s), slow(0.3s)                       |
| `zIndex`        | base(1), dropdown(100), sticky(200), modal(1000), tooltip(1100) |

Estilos pré-construídos disponíveis: `buttonStyles`, `badgeStyles`, `inputStyles`, `gridStyles`, `typographyStyles`, `containerStyles`.

### Tipografia

- **Serif**: Google Fonts — **Playfair Display** (títulos, destaque). Pesos: 400, 600, 700.
- **Sans-serif**: **Inter** (corpo, interface).
- Carregamento via `@import` no CSS + preload no `index.html`.
- Anti-aliasing: `-webkit-font-smoothing: antialiased`.

### Ícones

- **Emoji/Unicode** — sem biblioteca de ícones externa.
- Dimensionamento via `font-size` no CSS.

### Hierarquia Visual (3 Níveis)

| Nível | Componente | Visual | Uso |
|-------|-----------|--------|-----|
| Tier 1 | `SectionHeader` | Tipografia flat, sem borda | Seções principais |
| Tier 2 | `SubgroupHeader` | Barra lateral 3px, colapsável | Agrupamentos |
| Tier 3 | Cards | Borda + radius + background | Itens individuais |

### Paleta de Cores (referência)

**Backgrounds** (RGBA com transparência):
- Primary: `rgba(18,8,8,0.95)` — fundo principal escuro
- Secondary: `rgba(30,15,15,0.95)` — fundo secundário
- Overlay: `rgba(0,0,0,0.85)` — modais e overlays

**Texto**:
- Primary: `#fce7e7` — texto principal (rosa claro)
- Secondary: `rgba(255,255,255,0.7)` — texto secundário
- Muted: `rgba(255,255,255,0.5)` — texto desabilitado

**Acentos**:
- Gold: `#d4af37` / `#f5d060` — destaque, recompensas
- Rose: `#f43f5e` / `#f9a8d4` — alertas, ações
- Purple: `#a855f7` / `#c4b5fd` — categorias
- Green: `#4ade80` — sucesso
- Orange: `#ff6b35` — avisos

**Gradientes** pré-definidos para: backgrounds, botões, barras de progresso, títulos.

**Sombras**: sm, md, lg + variantes glow (gold, purple, green).

### Temas

Sistema de temas dinâmico via `ThemeContext`:
- Cada tema define cores, fontes, gradientes e sombras.
- CSS variables aplicadas ao `:root` via `useEffect`.
- Persistência em `localStorage`.
- Tema padrão: escuro (dark-first).

---

## 5. PWA

| Recurso              | Implementação                                     |
|----------------------|---------------------------------------------------|
| Manifest             | `public/manifest.json` — `display: "standalone"`  |
| Service Worker       | Network-first com cache fallback em `public/sw.js` |
| Push Notifications   | `web-push` + VAPID keys (env)                      |
| Offline              | Cache de assets estáticos, API network-only         |

Chaves VAPID configuradas via `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.

---

## 6. Testes

### Ferramentas

- **Vitest** — runner + assertions (ambiente `node`).
- **Supertest** — testes HTTP contra a app Express.
- **@vitest/coverage-v8** — cobertura com provider V8.

### Configuração (`vitest.config.js`)

```js
export default defineConfig({
  resolve: { alias: { sqlite: "node:sqlite" } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/setup/test-env.js"],
    fileParallelism: false,
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
});
```

### Estrutura

```
tests/
├── setup/
│   └── test-env.js       # Setup de ambiente (env vars, mocks)
├── routes/
│   ├── health.test.js
│   └── <feature>.test.js
└── services/
    └── <feature>.test.js
```

### Padrão de Teste (Supertest)

```js
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";

describe("GET /api/health", () => {
  it("retorna status 200", async () => {
    const app = await createApp({ enableSpa: false });
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});
```

---

## 7. Dependências

### Produção

| Pacote              | Função                                    |
|---------------------|--------------------------------------------|
| express             | Framework HTTP                             |
| cors                | Cross-Origin Resource Sharing              |
| helmet              | Headers de segurança                       |
| express-rate-limit  | Rate limiting por endpoint                 |
| dotenv              | Variáveis de ambiente via `.env`           |
| react               | Biblioteca de UI                           |
| react-dom           | Renderização DOM                           |
| web-push            | Push notifications (VAPID)                 |

### Desenvolvimento

| Pacote               | Função                                   |
|-----------------------|-------------------------------------------|
| vite                 | Build tool + dev server com HMR           |
| @vitejs/plugin-react | JSX transform para Vite                   |
| vitest               | Test runner                               |
| @vitest/coverage-v8  | Cobertura de código                       |
| supertest            | Testes HTTP                               |
| eslint               | Linting (flat config, ESLint 9)           |
| concurrently         | Rodar backend + frontend em paralelo      |

---

## 8. Scripts (`package.json`)

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node server.js",
    "start": "concurrently \"npm run server\" \"npm run dev\"",
    "lint": "eslint . --max-warnings=0",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 9. Configuração

### Vite (`vite.config.js`)

```js
export default defineConfig({
  base: "/pt/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api/pt": {
        target: "http://localhost:3400",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pt/, "/api"),
      },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
```

### ESLint (`eslint.config.js`)

```js
export default [
  { ignores: ["coverage/**", "data/**", "dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
];
```

### Variáveis de Ambiente (`.env.example`)

```env
# API Anthropic (Claude)
ANTHROPIC_API_KEY=

# Porta do servidor
PORT=3400

# Banco SQLite
DATABASE_PATH=./data/personal-trainer.sqlite

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5174

# Rate Limiting
RATE_LIMIT_GLOBAL_MAX=60
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_CLAUDE_MAX=10

# Push Notifications (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
```

---

## 10. Infraestrutura

### `service.json`

Metadados para o lifecycle manager (`manage.mjs`) e integração com Caddy:

```json
{
  "schemaVersion": 1,
  "id": "personal-trainer",
  "name": "Personal Trainer",
  "type": "project",
  "pidFile": "pt-server.pid",
  "logFile": "pt-server.log",
  "port": 3400,
  "healthUrl": "http://127.0.0.1:3400/api/health",
  "build": { "command": "node", "args": ["node_modules/vite/bin/vite.js", "build"] },
  "start": { "command": "node", "args": ["server.js"] },
  "dev": { "command": "node", "args": ["server.js"], "env": { "NODE_ENV": "development" } },
  "stop": { "gracefulTimeoutMs": 5000 },
  "caddy": {
    "routes": [
      { "id": "pt-api", "path": "/api/pt*", "target": "http://localhost:3400/api", "stripPrefix": true, "enabled": true },
      { "id": "pt-app", "path": "/pt*", "target": "http://localhost:3400", "stripPrefix": true, "enabled": true }
    ]
  }
}
```

### `manage.mjs`

Script reutilizável de lifecycle (start/stop/restart/status + menu interativo).
Lê `service.json`, gerencia PID file, faz health check via HTTP.

### Caddy (reverse proxy)

- API: `/api/pt/*` → `localhost:3400/api/*`
- App: `/pt/*` → `localhost:3400/*`

---

## 11. Estrutura de Diretórios

```
personal-trainer/
├── server.js            # HTTP bootstrap
├── app.js               # Express factory (createApp)
├── middleware/           # auth.js, security.js
├── routes/              # Feature-based route files
│   ├── health.js
│   ├── auth.js
│   └── <feature>.js
├── services/            # Backend business logic
│   └── <feature>.js
├── db/                  # SQLite
│   ├── index.js         # Conexão + migrations + stmts
│   └── migrations/      # *.sql numerados
├── src/                 # Frontend (Vite + React)
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/      # Feature-first
│   ├── contexts/        # ThemeContext, AuthContext, ...
│   ├── hooks/           # useAuth, useTheme, ...
│   ├── services/        # API layer (fetch)
│   ├── views/           # Tab views fullscreen
│   ├── styles/          # tokens.css, tokens.js, *.css
│   ├── data/            # Constantes
│   └── utils/           # Helpers puros
├── public/              # Static, manifest.json, sw.js, icons/
├── tests/               # Vitest suites
│   ├── setup/
│   ├── routes/
│   └── services/
├── data/                # SQLite file (gitignored)
├── vite.config.js
├── vitest.config.js
├── eslint.config.js
├── package.json
├── service.json         # Metadados do serviço
├── manage.mjs           # Lifecycle manager
├── AGENTS.md            # Instruções para agentes AI
├── STACK.md             # Este arquivo
└── .env.example
```

---

## 12. Convenções

| Aspecto             | Padrão                                                     |
|---------------------|------------------------------------------------------------|
| Módulos             | ESM (`"type": "module"` no package.json)                   |
| Indentação          | 2 espaços                                                   |
| Aspas               | Duplas (`"`)                                                |
| Funções             | camelCase                                                    |
| Classes/Componentes | PascalCase                                                   |
| Env vars            | SCREAMING_SNAKE_CASE                                        |
| Validação I/O       | Zod                                                          |
| Organização         | Feature-first (componentes, rotas, serviços)                |
| Commits             | PT-BR, imperativo, < 72 chars na primeira linha             |
| Segredos            | Nunca no `.env.example` — usar valores vazios como template |
| CSS Variables       | Prefixo `--pt-` (personal-trainer)                          |
| data-testid         | BEM-like: `componente-elemento--modificador`                |
