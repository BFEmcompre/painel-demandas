# FLOW 2.0 — atualização visual

Esta versão mantém as funções existentes do sistema e renova a experiência visual, adicionando uma nova tela inicial para todos os perfis.

## O que mudou

- Nova Home em `/` para gestores e responsáveis.
- Dashboard operacional do gestor movido para `/dashboard`.
- Novo mural do Flow com avisos, novidades, aniversários, conquistas, eventos e comunicados.
- Gestores (`manager`) são tratados como administradores do mural. O código também aceita `admin` e `gestor` caso esses papéis sejam adicionados futuramente.
- Administração do mural diretamente pela Home: criar, editar, remover, fixar, agendar, publicar/rascunho, escolher categoria, emoji e identidade de cor.
- Atualização do mural em tempo real via Supabase Realtime.
- Login renovado.
- Sidebar, header e transições de página redesenhados.
- Animações, profundidade 3D, glassmorphism, gradientes e fundos em movimento.
- Respeito à preferência do sistema por redução de movimento (`prefers-reduced-motion`).
- As telas antigas ganham fundo integrado ao novo shell, cards translúcidos e microinterações sem alterar a lógica de negócio.

## Antes de rodar

O ZIP original trouxe `node_modules` instalado em Windows. Em outra máquina ou sistema operacional, apague a pasta `node_modules` e reinstale as dependências:

```bash
npm install
npm run dev
```

Mantenha o seu arquivo `.env` original com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Ativar o mural no Supabase

A migration está em:

`supabase/migrations/20260819201200_create_flow_announcements.sql`

Ela cria a tabela `flow_announcements`, habilita RLS e aplica as regras:

- qualquer usuário autenticado pode ler avisos publicados e dentro da janela de exibição;
- gestores/admins podem ler rascunhos e avisos agendados/expirados;
- somente gestores/admins podem criar, editar e excluir;
- a tabela é adicionada ao `supabase_realtime` quando necessário;
- um aviso inicial de boas-vindas é criado apenas se o mural estiver vazio.

A migration pode ser aplicada pelo fluxo de migrations do projeto ou colando o SQL no SQL Editor do Supabase.

## Arquivos principais da atualização

- `src/app/components/pages/FlowHome.tsx`
- `src/app/components/layouts/RootLayout.tsx`
- `src/app/components/sidebar/Sidebar.tsx`
- `src/app/components/header/Header.tsx`
- `src/app/components/pages/LoginPage.tsx`
- `src/app/routes.tsx`
- `src/styles/theme.css`
- `supabase/migrations/20260819201200_create_flow_announcements.sql`

## Validação realizada

O projeto passou na verificação TypeScript (`tsc --noEmit`) após as alterações.

O build do Vite não foi executado no ambiente de edição porque o `node_modules` incluído no ZIP contém binários nativos de Windows, enquanto o ambiente de validação é Linux. Ao reinstalar as dependências na máquina de destino, Vite/Rollup/esbuild receberão os binários corretos da plataforma.
