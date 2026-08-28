# FLOW V3 — Dark Blue / Radial Menu / School Board

## Arquivos para substituir

1. `src/app/components/layouts/RootLayout.tsx`
2. `src/app/components/header/Header.tsx`
3. `src/app/components/pages/LoginPage.tsx`
4. `src/app/components/pages/FlowHome.tsx`
5. `src/styles/theme.css`
6. `src/app/components/sidebar/Sidebar.tsx` (vira componente legado vazio)

## Arquivos novos

1. `src/app/components/navigation/RadialMenu.tsx`
2. `src/app/components/pages/BoardNote.tsx`
3. `supabase/migrations/20260820100000_upgrade_flow_board_v3.sql`

## package.json

Remova `motion` do bloco `dependencies`. Esta V3 usa animações CSS/3D e não depende de `motion`/`framer-motion`.

No seu computador, depois das trocas:

```powershell
npm uninstall motion framer-motion
npm install
npm run dev
```

Se você já tiver rodado a migration original do mural, rode apenas a migration V3.
Se ainda não tiver criado o mural, rode primeiro `20260819201200_create_flow_announcements.sql` e depois `20260820100000_upgrade_flow_board_v3.sql`.

## Navegação

- Clique no botão `MENU` no canto inferior esquerdo.
- `Alt + Q` abre/fecha a roda.
- `ESC` fecha a roda.
- Com a roda aberta, as teclas numéricas selecionam os módulos.

## Mural

ADMIN/Gestor pode:
- criar/editar/excluir avisos;
- arrastar papéis pelo quadro;
- trocar tons de azul do papel;
- alterar tamanho e inclinação;
- colocar emoji;
- adicionar imagem por URL ou upload;
- fixar, publicar/rascunhar e programar período de exibição.

As telas operacionais existentes continuam usando a mesma lógica e rotas. O novo `RootLayout` e o `theme.css` aplicam o novo visual ao restante do sistema sem reescrever as regras de negócio.
