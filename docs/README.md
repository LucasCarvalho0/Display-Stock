# DISPLAY STOCK CONTROL

Sistema de controle de estoque, movimentações, inventário e Reporte Nissan que substitui a planilha `PEÇAS DISPLAY.xlsm`.
Stack: Next.js 14 (App Router + Route Handlers) · TypeScript · Tailwind · PostgreSQL · Prisma · Zod · React Hook Form · Recharts · Lucide.

## Como subir (desenvolvimento)
```bash
cp .env.example .env            # defina SESSION_SECRET (openssl rand -base64 48)
npm install
docker compose up -d db         # PostgreSQL 16
npx prisma migrate dev --name init
psql "postgresql://dsc:dsc_password@localhost:5432/display_stock" -f prisma/sql/constraints.sql   # CHECKs e triggers (obrigatório)
npm run db:seed                 # carrega os dados reais da planilha e CONFERE os saldos com ela
npm run dev                     # http://localhost:3000
```
Usuários criados pelo seed (senha = `SEED_TEMP_PASSWORD`, troca obrigatória no 1º acesso):
`admin@`, `administrativo1..3@`, `lider1..3@suaempresa.com.br` — **troque os e-mails** em Usuários.

Produção: `docker compose up -d` (app + banco). O container roda `prisma migrate deploy` ao iniciar. Use HTTPS no proxy reverso.

## Testes
| Comando | O que cobre |
|---|---|
| `npm test` | Unitários (sem banco): saldo esperado, comparação entre turnos, bloqueios de fechamento, regra de código NG |
| `npm run test:integration` | Contra PostgreSQL real: entrada/saída, saldo insuficiente, **concorrência** (2 saídas pelas últimas unidades; 20 saídas × saldo 15), correção, trigger anti-exclusão, fluxo completo de inventário, **paridade com a planilha** |
| `npm run test:e2e` | Playwright: login → troca de senha → saída bloqueada |

## Análise da planilha original (item 23 do prompt)
| Aba | Conteúdo | Tratamento no sistema |
|---|---|---|
| Estoque | 24 SKUs; `Saldo Atual = Saldo Inicial congelado + Entradas − Saídas` após a **Data de Corte** (28/10/2026 12:16:19); Estoque Mínimo = 1 em todos | `Product.initialBalance` + `Setting stock.cutoff`; `balancesAsOf()` usa a mesma fórmula |
| Movimentacao | 16 lançamentos (Data/Hora, Tipo, Código, Produto, Qtd, Modelo, Cliente, NG). Sem usuário | Migrados com origem `IMPORTACAO_PLANILHA` e usuário técnico "Importação da planilha" |
| Entrada e Saída | Formulário com macro VBA; "Possui NG? = Sim" acrescenta " NG" ao código; saída bloqueada se estoque insuficiente | `fullCode()`; seleção Normal/NG; bloqueio no servidor |
| Resumo Nissan | "Estoque VPC": 25 linhas, **NG primeiro**, depois normais; inclui `BRPRT 11487` | `Product.sortNissan`; colunas idênticas (Código, Produto, Modelo, Cliente, Saldo Atual) |
| Resumo Geral | 24 linhas, normal e NG intercalados | `Product.sortGeral` |
| Dashboard / Aux_Dashboard | Saldo por cliente, entradas × saídas 12 meses, top 10 saldos | Reproduzidos no Dashboard |
| Listas | 11 clientes, 153 códigos-base (a maioria sem estoque) | Clientes importados; códigos extras podem entrar pela importação de produtos |

**Pontos de atenção encontrados (decisões suas):**
1. **`BRPRT 11487` (Módulo Inclinação Retrovisor)** está no Resumo Nissan mas **não existe na aba Estoque** (a planilha mostra 0 via IFERROR). Foi cadastrado com saldo 0 para preservar o relatório; confirme se deve existir.
2. O comentário da planilha diz que o histórico antes da data de corte tem **lançamentos corrompidos**; por isso o saldo antes do corte não é recalculável e o Reporte Nissan recusa datas anteriores a 28/10/2026.
3. Inconsistências normalizadas na migração: "Saida" × "Saída", "Nissan" × "NISSAN".
4. Conferência feita: o histórico migrado reproduz **exatamente** os 25 saldos da planilha (0 divergências).

## Regras de negócio principais
- **Saldo** só muda por movimentação, em transação, com `SELECT … FOR UPDATE` na linha do saldo (concorrência) e `CHECK (quantity >= 0)` no banco.
- **MOV-000001…** vem de sequência do PostgreSQL: nunca reutilizada. Movimentações não são apagadas (trigger); correções geram `MovementRevision` (antes/depois, justificativa, autor, data) e recalculam o saldo; estorno = correção com `void`.
- **Normal × NG** são produtos distintos (sufixo " NG"); o inventário v1 só carrega `classification = NORMAL`. `InventorySession.classification` e `InventoryCount` já são independentes, então o inventário NG é só habilitar a classificação no `startInventory`.
- **Inventário**: ao iniciar cada turno é gravado um *snapshot* do saldo (`referenceBalance/referenceAt`). Saldo esperado = snapshot + movimentações ATIVAS entre o snapshot e o instante da contagem. A noite é contada de forma independente (snapshot próprio) e há comparação Manhã→Noite considerando as movimentações do intervalo. Cada contagem é salva individualmente (retoma de onde parou).
- **Fechamento** exige: dois turnos completos, comparação executada, toda divergência justificada **e** aprovada, e aprovação do inventário. Ajuste de estoque = movimentação `AJUSTE_POSITIVO/NEGATIVO` + `StockAdjustment` com autorizador e justificativa.
- **Reporte**: saldo ao fim do dia escolhido; exibe/insere "Inventário FECHADO / PENDENTE / sem inventário". Cada exportação é registrada em `ReportExport` e na auditoria.

## Permissões (configuráveis em Usuários → Perfis)
Todos: registrar entrada/saída, consultar, contar inventário, exportar. **Líder** acrescenta: corrigir lançamentos, aprovar, fechar inventário, autorizar ajustes, editar cadastros. **Administrador**: tudo, inclusive usuários. *(Suposição minha: o prompt não diz quem recebe as permissões restritas; ajuste na tela.)*

## API
Todas retornam `{ data }` ou `{ error: { code, message, details } }`. Todas validam com Zod, exigem sessão e checam permissão no servidor.
| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/auth/login` · `logout` · `forgot` · `reset` · `password` · GET `me` | público/sessão |
| GET | `/api/dashboard` | stock.view |
| GET/POST | `/api/products` · PATCH/GET(histórico) `/api/products/:id` · GET `/api/products/lookup` | view / products.edit |
| GET | `/api/stock` | stock.view |
| GET/POST | `/api/movements` · GET `/api/movements/:id` · POST `/api/movements/:id/corrections` | view / movements.create / movements.correct |
| GET/POST | `/api/inventory` · GET `/api/inventory/:id[?shift=]` | view / inventory.count |
| POST | `/api/inventory/:id/shifts` · `counts` · `finish` · `justifications` | inventory.count |
| GET | `/api/inventory/:id/compare` | stock.view |
| POST | `/api/inventory/:id/approvals` · `close` | inventory.approve · inventory.close |
| GET | `/api/reports/nissan?kind=&date=` · POST `/api/reports/export` | view / reports.export |
| POST | `/api/import/excel` (multipart = prévia; JSON `{batchId}` = confirma) | products.edit |
| GET/POST/PATCH | `/api/users`, `/api/users/:id` · GET `/api/roles` · PUT `/api/roles/:id` | users.manage |
Extras além da lista do prompt: `/inventory/:id/shifts` (abrir o 2º turno com novo snapshot) e `/inventory/:id/finish` (gera as ocorrências; o GET `compare` não tem efeitos colaterais).

## Segurança
bcrypt (custo 12) · sessão em cookie `httpOnly`/`SameSite=Lax`/`Secure`, validada no banco a cada requisição (revogável) · bloqueio após 5 falhas · rate limiting (em memória; use Redis se houver várias instâncias) · verificação de `Origin` contra CSRF · recuperação de senha com token hash e expiração de 1 h (sem SMTP o link vai para o log do servidor) · auditoria append-only (trigger) · cabeçalhos de segurança.

## Backup e recuperação
`scripts/backup.sh` (pg_dump + gzip + retenção de 30 dias, agende no cron) e `scripts/restore.sh`. Teste a restauração em homologação. Em produção, ative também backup/PITR do provedor do banco.

## Limitações conhecidas
- **Este código foi escrito e revisado, mas ainda não foi executado de ponta a ponta**: o ambiente em que foi gerado não tinha rede (sem `npm install`) nem PostgreSQL. Foram verificados: a extração/validação dos dados da planilha, a lógica pura de inventário (exemplos do prompt) e a sintaxe de todos os arquivos. Rode `npm install && npm run typecheck && npm test && npm run test:integration` e me envie qualquer erro.
- Exportação do Estoque é CSV; o Reporte exporta XLSX/PDF. Importação aceita `.xlsx` (salve o `.xlsm` como `.xlsx`).
- Monitoramento (item 22, fase 8) ficou como logs + auditoria; conecte a sua ferramenta (Sentry/Grafana) na implantação.
