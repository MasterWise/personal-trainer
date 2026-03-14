# AGENTS.md - personal-trainer

## Proposito
- Este repositorio hospeda o app de coaching pessoal com IA, com backend em `3400`, frontend em `/pt/` e API exposta via `/api/pt/` no proxy.
- O `AGENTS.md` deste escopo deve ser lido como guia operacional e mapa de contexto; detalhes historicos e de decisoes ficam separados.

## Leituras obrigatorias
- Herda as politicas de [AGENTS.md](F:/GitProjects/vps-mw-aiserver/AGENTS.md), [projects/AGENTS.md](F:/GitProjects/vps-mw-aiserver/projects/AGENTS.md) e [projects/github/AGENTS.md](F:/GitProjects/vps-mw-aiserver/projects/github/AGENTS.md).
- Leia [README.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/README.md) antes de alterar escopo funcional, UX principal ou onboarding.
- Leia `STACK.md` antes de mexer em arquitetura, stack, docs model ou distribuicao de responsabilidades entre frontend e backend.
- Leia [DECISIONS.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/DECISIONS.md) antes de alterar protocolo da IA, formato do plano, conversas ou persistencia de documentos.
- Leia [HISTORY.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/HISTORY.md) antes de revisitar correcoes de prompt, cache, gateway, plano ou UI do chat.

## Excecoes locais
- Preserve o acoplamento via ai-gateway para chamadas Claude; nao reintroduza chamadas diretas ao provider sem necessidade validada.
- Mudancas no protocolo de `plano`, docs ou updates da IA devem continuar compativeis com structured outputs e com os guards de permissao/escopo ja adotados.
- O frontend continua sob `/pt/`; ajustes de rota ou base path exigem revisar proxy, PWA e build.

## Operacao rapida
- Instalar dependencias: `npm install`
- Desenvolvimento: `npm run dev`
- Build: `npm run build`
- Servidor combinado: `npm start`
- Backend isolado: `npm run server`
- Lint: `npm run lint`
- Testes: `npm run test:run`
- Lifecycle local: `node manage.mjs start|stop|restart|status`
- Health checks:
  - `curl http://localhost:3400/api/health`
  - `curl http://localhost:8080/api/pt/health`

## Mapa de contexto
- [README.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/README.md): visao funcional e fluxos do produto.
- `STACK.md`: stack, arquitetura e setup tecnico.
- [DECISIONS.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/DECISIONS.md): escolhas estruturais estaveis.
- [HISTORY.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/HISTORY.md): trilha cronologica de mudancas.
