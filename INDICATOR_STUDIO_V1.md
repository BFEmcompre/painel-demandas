# FLOW — Indicator Studio v1

Branch: `feature/indicator-studio-v1`

## O que entrou nesta primeira entrega

- Nova Central de Indicadores em `/indicadores`.
- Studio diário em `/indicadores/studio`.
- Weekly Review em `/indicadores/semanal`.
- Configuração de KPIs em `/indicadores/configuracao`.
- Fluxo legado preservado em `/indicadores/configuracao-legada`, `/meus-indicadores` e `/indicadores/apresentacao`.
- Menu radial atualizado para apontar para a Central/Studio.
- Novo modelo de dados aditivo para KPI, histórico, apresentações, blocos, insights e planos de ação.

## Antes de abrir as novas telas

Aplicar no Supabase do FLOW:

`supabase/migrations/20260828190000_indicator_studio_v1.sql`

A migration NÃO remove as tabelas antigas de indicadores.

## Fluxo inicial

1. Gestor abre `/indicadores/configuracao`.
2. Seleciona uma plataforma e cadastra seus KPIs.
3. Define unidade, direção, meta e consolidação semanal.
4. Responsável abre `/indicadores/studio`.
5. Informa os valores do dia e registra a explicação/contexto.
6. O FLOW compara com a última medição válida disponível.
7. `/indicadores/semanal` agrega a semana atual e compara com a anterior de acordo com a regra configurada para cada KPI.

## Modelo novo

- `indicator_definitions`
- `indicator_measurements`
- `indicator_reports`
- `indicator_report_blocks`
- `indicator_insights`
- `indicator_actions`

## Próximas fases previstas

- Canvas 16:9 com blocos arrastáveis.
- Upload de evidências dentro dos blocos.
- Blocos de causa, impacto, alerta e plano de ação.
- Geração automática dos slides a partir das medições.
- Timeline/trilha semanal com os acontecimentos registrados durante os dias.
- Snapshot imutável das apresentações concluídas.
- Consolidado de diretoria com todas as plataformas.
- Exportação PDF/PPTX.
- Importação CSV/XLSX e integrações via API.
- Endurecimento de RLS por papel/responsável/plataforma.

## Observação de segurança

Nesta V1 as novas tabelas usam políticas `authenticated` para facilitar a implantação incremental enquanto o modelo de permissões do módulo é consolidado. Antes da publicação definitiva para todos os usuários, restringir as políticas por role e ownership.
