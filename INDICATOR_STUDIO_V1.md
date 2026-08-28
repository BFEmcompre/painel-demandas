# FLOW — Indicator Studio

Branch: `feature/indicator-studio-v1`

## Conceito implementado

O módulo trabalha em quatro camadas:

1. Plataforma
2. Várias métricas por plataforma
3. Prints diários -> extração -> revisão -> histórico
4. Canvas de apresentação + análises por período

## Rotas

- `/indicadores` — Central de Indicadores
- `/indicadores/configuracao` — ADM: plataformas, responsáveis, ordem, prazo e métricas
- `/indicadores/studio` — upload, extração, revisão e montagem da apresentação
- `/indicadores/apresentacao` — modo apresentação das páginas montadas no Studio
- `/indicadores/semanal` — Weekly Review
- `/indicadores/analises` — período customizado e exportações

O fluxo legado continua disponível em `/indicadores/configuracao-legada` e `/meus-indicadores` durante a migração.

## Banco: aplicar nessa ordem

1. `supabase/migrations/20260828190000_indicator_studio_v1.sql`
2. `supabase/migrations/20260828203000_indicator_studio_v2_extraction.sql`

As migrations são aditivas e não apagam as tabelas antigas.

## Extração dos prints

A Edge Function fica em:

`supabase/functions/extract-indicators/index.ts`

Ela recebe o `submission_id`, consulta as métricas configuradas para a plataforma, envia as imagens e o dicionário de métricas para um modelo multimodal e retorna valores estruturados para revisão humana.

### Secrets necessários

No projeto Supabase do FLOW:

```bash
supabase secrets set OPENAI_API_KEY="SUA_CHAVE"
```

Opcionalmente:

```bash
supabase secrets set INDICATOR_VISION_MODEL="gpt-4.1-mini"
```

### Deploy da função

```bash
supabase functions deploy extract-indicators
```

A função exige JWT do usuário. Não publique com `--no-verify-jwt`.

## Fluxo do ADM

Em `/indicadores/configuracao`:

- cria a plataforma;
- escolhe o responsável;
- define a ordem da apresentação;
- define o horário limite do envio;
- cadastra quantas métricas forem necessárias;
- define unidade, meta, regra de melhora e consolidação semanal;
- pode informar aliases e uma dica de extração para layouts difíceis.

## Fluxo diário do responsável

Em `/indicadores/studio`:

1. Seleciona a plataforma.
2. Anexa quantos prints forem necessários.
3. O primeiro upload do dia registra o horário e o banco calcula se houve atraso.
4. Clica em **Extrair dados**.
5. O FLOW procura somente as métricas configuradas pelo ADM.
6. A tela exibe valor, trecho encontrado e confiança para conferência.
7. O usuário corrige qualquer leitura necessária.
8. Clica em **Confirmar e salvar histórico**.
9. Os valores ficam em `indicator_measurements` e passam a alimentar comparações e gráficos.
10. O canvas da apresentação é liberado.

## Canvas

O relatório diário usa `indicator_report_blocks`.

Blocos atuais:

- métrica destacada;
- gráfico de evolução;
- print/evidência;
- texto/observação.

Os blocos podem ser arrastados livremente dentro do canvas 16:9 e suas coordenadas ficam persistidas no banco.

## Comparação e relatórios

Em `/indicadores/analises` é possível:

- filtrar uma plataforma ou todas;
- definir data inicial e final;
- usar atalhos de 7, 30 e 90 dias;
- comparar automaticamente contra o período imediatamente anterior de mesma duração;
- visualizar evolução por métrica;
- acompanhar quantidade de envios no prazo e atrasados;
- exportar CSV;
- usar a impressão do navegador para gerar PDF.

## Tabelas adicionadas

V1:

- `indicator_definitions`
- `indicator_measurements`
- `indicator_reports`
- `indicator_report_blocks`
- `indicator_insights`
- `indicator_actions`

V2:

- `indicator_submissions`
- `indicator_submission_images`

Além disso, V2 acrescenta aliases/dicas de extração, confiança/raw text nas medições e coordenadas livres nos blocos de apresentação.

## Observações de implantação

- O bucket `platform-indicators` é reutilizado pelo novo fluxo.
- A extração não salva os números automaticamente: sempre existe a etapa de revisão/confirmar.
- A leitura por IA não substitui a conferência do usuário.
- As políticas RLS ainda são permissivas para usuários autenticados nesta fase de implantação incremental. Endurecer por role/ownership antes de abrir o módulo para um público maior.
- O ambiente usado para editar esta branch não conseguiu executar o build local porque não conseguiu resolver `github.com` por DNS. Rode `npm install` e `npm run build` na máquina do projeto antes de publicar.
