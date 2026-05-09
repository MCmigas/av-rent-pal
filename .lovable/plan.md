# Eurosom — Reconstrução com arquitectura GESTio

Adaptar a arquitectura completa do GESTio (multi-tenant, RBAC granular, auditoria, dual-view, IA, mobile) ao domínio AV rental. Tudo em pt-PT, timezone `Europe/Lisbon`.

## Mapeamento de domínio

| GESTio (restauração) | Eurosom (AV rental) |
|---|---|
| Lojas / restaurantes | Armazéns / bases operacionais |
| Catálogo de produtos | Catálogo de equipamento (com nº série, estado) |
| Stocks | Disponibilidade por data (calendário de aluguer) |
| Encomendas | Reservas / packing lists |
| Caixa diário | Movimentos de caixa por evento |
| Faturas / Documentos | Quotes → Confirmação → Fatura → Recibo |
| Escalas equipa | Escalas crew por evento (técnico de som, luz, vídeo, op. câmara) |
| Picagens / horas | Horas in/out por evento + km + ajudas de custo |
| Receitas | Templates de packs (ex: "Pack PA 2kW") |
| Faltas (shortages) | Equipamento avariado / em falta |
| Inbox email | Inbox email por armazém (POs, faturas fornecedor) |
| HACCP | Checklists pré-evento, pós-evento, manutenção preventiva |
| Tickets equipa | Tickets internos + suporte cliente |
| Portal cliente | Portal cliente (quotes, contratos, faturas, eventos futuros) |

## Fases (ordem de execução)

### Fase 1 — Fundação (auth + multi-tenant + RBAC)
- Refactor schema actual: introduzir `organizations`, `locations` (armazéns), `user_locations`, `user_organization_ids()`, `user_location_ids()` (SECURITY DEFINER).
- Tabela `permission_profiles` (`permissions text[]`, `is_system bool`) com perfil "Administrador" bloqueado.
- Tabela `user_permission_profiles` (chave única `(user_id, organization_id)`).
- ~50 chaves de permissão AV: `equipment.view/manage`, `projects.view/manage/quote/confirm`, `crew.view/assign/view_hours`, `invoices.view/manage`, `payments.manage`, `clients.view/manage`, `reports.view`, `settings.manage`, `cash.view/close`, `maintenance.manage`, etc.
- Funções `user_has_permission(_perm)`, `is_admin()`, `is_super_admin()`.
- `super_admins` table; bypass RBAC mas filtro location mantém-se.
- Trigger `prevent_self_permission_change`.
- `sensitive_actions` + `log_sensitive_action(...)` + cleanup 90d.
- `auth_sessions` com heartbeat 1min.
- Onboarding `/register` (token), `/accept-invite`, recuperação password via edge fn `request-password-recovery` (Resend) com reCAPTCHA v3.
- Refactor RLS de TODAS as tabelas existentes para isolamento por `organization_id` + `location_id`.

### Fase 2 — Locations + Sidebar + Design System
- Selector de armazém activo persistido em `localStorage` (`eurosom_selected_location`).
- Helper `parseLocalDate`, `fetchAllRows`, `getFileUrl`.
- Sidebar agrupada: Operações (Calendário, Projetos, Equipamento), Financeiro (Quotes, Faturas, Pagamentos, Caixa), Equipa (Escalas, Picagens, Comunicados, Tickets), Manutenção (Checklists, Avarias), Relatórios, Definições.
- Design tokens HSL semânticos (já parcial no `styles.css` — completar). Logo Eurosom já está.
- Mobile: cards > tabelas, inputs date nativos.

### Fase 3 — Calendário de aluguer + Disponibilidade (core diário)
- `equipment` extende-se: `serial_number`, `condition`, `purchase_date`, `replacement_cost`.
- Tabela `equipment_units` (instâncias individuais por nº série, para tracking real).
- `project_equipment` ganha `pickup_date`, `return_date`, `condition_out`, `condition_in`.
- Função `equipment_availability(_equipment_id, _from, _to)` que considera projetos confirmados + manutenção.
- Vista de calendário (mensal/semanal) com gantt de equipamento ocupado.
- Conflict detection ao criar reserva.

### Fase 4 — Quotes → Projeto → Fatura
- Estados projeto: `quote → confirmed → in_progress → completed → cancelled`.
- PDF de quote/confirmação (jsPDF) com logo Eurosom, tabela equipamento+crew+transporte, IVA 23%, condições.
- Email de envio via Resend (connector).
- Conversão automática quote→fatura com numeração sequencial (`FAT YYYY/NNNN`).
- Tabela `invoice_items` (linhas individuais).
- Notas de crédito.

### Fase 5 — Inbox + IA (faturação fornecedor)
- Inbox email por armazém (`armazem-{slug}-{6}@inbox.eurosom.pt`) — Postmark webhook.
- Edge fn `inbound-email-webhook` + `classify-inbox-attachment` (IA).
- Edge fn `invoice-extract` com OpenAI via Lovable AI Gateway: extrai NIF, data, itens, IVA, vencimento. Chunking base64 8KB.
- Detecção duplicados, validação E-Fatura, conciliação bancária, IRS, batch settlement.
- Centros de custo (Fixo/Variável, spot/periódico).

### Fase 6 — Crew (escalas + picagens) + RH
- Refactor `crew_assignments` para escalas por evento com áreas de trabalho (Som, Luz, Vídeo, Op. câmara, Backline, Carga).
- Trocas de turno workflow 2 passos (colega aceita → gestor aprova).
- Picagens IN/OUT por evento + km + ajudas de custo (subsídio noite, refeição, transporte).
- Conciliação horas vs picagens.
- Comunicados, Tickets (3 colunas), Anúncios.
- RH: contratos, recibos, férias, documentos legais (bucket `hr-documents`), feriados nacionais 2026 auto-seed.
- Vencimentos 2026 PT: SS 11/23.75%, sub. alim. 6.15/10.46€, km 0.36€, IRS 50% extras, horas extras CT 268.º.

### Fase 7 — Manutenção + Caixa + Relatórios + Dashboard
- Checklists pré/pós-evento (substitui HACCP no domínio AV): "Equipamento testado", "Cabos verificados", "Carga conferida", "Devolução conferida", com fotos + assinatura.
- Avarias / equipamento em manutenção (substitui shortages).
- Caixa: entradas (sinais/depósitos) + saídas (combustível, ajudas), conta empresa vs caixa físico.
- Relatórios: rentabilidade por projeto, ocupação de equipamento (utilização %), top clientes, CMV operacional, mapa IVA, custos pro-rata.
- Dashboard com widgets configuráveis (próximos eventos, ocupação semanal, faturação pendente, etc.).

### Fase 8 — Portal cliente + Chatbot IA + Notificações
- Portal cliente (`role = client`): vê próprios quotes, contratos, faturas, eventos, pode aceitar quote (assinatura).
- Chatbot IA da empresa (`location-chat`) — SSE streaming via Lovable AI Gateway.
- Notificações: `user_notifications` + `notification_settings` por armazém. Triggers para novos tickets, faturas inbox, avarias, quotes aceites.

### Fase 9 — Capacitor (mobile nativo)
- iOS + Android, ML Kit (scanner códigos barras p/ tracking equipamento), FCM push, biometria.
- Páginas legais: `/privacy`, `/terms`, `/account-deletion`.

## Notas técnicas

- **AI**: usar Lovable AI Gateway (`google/gemini-3-flash-preview` por defeito), não OpenAI directo. Secret `LOVABLE_API_KEY` já existe.
- **Email**: Resend via connector standard (não Postmark — não há connector). Postmark inbound webhook continua via HTTP route público se necessário.
- **Edge functions vs server fns**: este projeto está em TanStack Start. Para lógica interna usar `createServerFn`. Para webhooks externos (Postmark inbound) usar server route em `src/routes/api/public/`. Edge functions Supabase só se houver razão forte.
- **Storage buckets**: `documents` (privado), `logos` (público), `event-photos` (privado), `avatars` (público), `hr-documents` (privado), `equipment-photos` (privado).
- **Trigger global**: `rls_auto_enable` event trigger.
- **Reset de dados**: apaga transacções, mantém estrutura.

## Dimensão e cadência

Isto é trabalho para muitas iterações (estimativa: 15–30 mensagens). Vou começar pela **Fase 1** (auth + multi-tenant + RBAC) que é a fundação que muda RLS de tudo o resto. Cada fase termina com a app a funcionar — não fica meio-partida.

Confirma que queres avançar e arranco já com a migração da Fase 1.
