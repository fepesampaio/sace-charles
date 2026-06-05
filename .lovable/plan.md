# Filtro de Período no Painel do Agente

Adicionar, acima dos cards de estatísticas (Total de Visitas, Concluídas, Pendentes, Focos), um filtro global que controla os dados exibidos em todos os dashboards da tela e também na lista de visitas abaixo.

## Comportamento padrão (ao abrir o painel)

1. Buscar as SEs da prefeitura cujo período (`data_inicial <= hoje <= data_final`) contemple a data atual.
2. Se houver uma ou mais SEs válidas → seleciona automaticamente todas elas (modo "Semana Epidemiológica") e os dashboards mostram os dados consolidados.
3. Se não houver nenhuma SE válida para hoje → seleciona automaticamente o **ano corrente** (modo "Anual", ano = ano atual).

## Tipos de agrupamento disponíveis no filtro

Ao clicar no filtro (botão/seletor acima dos cards), abre um Sheet/Popover com:

- **Semana Epidemiológica (SE)** — multi-seleção de SEs cadastradas (lista todas as SEs da prefeitura, ordenadas por ano/SE desc). Usuário marca uma ou várias.
- **Mensal** — escolhe Ano + Mês (ou múltiplos meses).
- **Quadrimestral** — escolhe Ano + Quadrimestre (1º: jan–abr, 2º: mai–ago, 3º: set–dez).
- **Anual** — escolhe Ano.
- **Período Personalizado** — dois date pickers (data inicial e data final, livre).

Cada modo resolve para um intervalo `[dataInicio, dataFim]` (ou união de intervalos no caso de múltiplas SEs/meses) que é aplicado nas queries.

## Atualização

Sempre que o filtro for confirmado/alterado, refaz a query de `visitas` aplicando o filtro de data sobre `datahora` (e `prefeituraid` + `agenteid` como já hoje), e recalcula os 4 cards e a lista. Loading state durante o refetch.

## Layout

```text
┌─────────────────────────────────────────┐
│ ☰  sex, 8 de maio                       │
│    Painel do Agente                      │
├─────────────────────────────────────────┤
│  [📅 SE21 • 11/05–17/05  (alterar) ▾]  │  ← novo filtro
├─────────────────────────────────────────┤
│  [Total]   [Concluídas]                  │
│  [Pendentes] [Focos]                     │
│                                          │
│  VISITAS DO PERÍODO                      │
│  ...                                     │
└─────────────────────────────────────────┘
```

O título da seção de visitas muda de "Visitas do Dia" para "Visitas do Período" (ou mantém "Visitas do Dia" só quando o intervalo é exatamente hoje).

## Detalhes técnicos

**Novo componente** `src/components/DashboardFilter.tsx`:
- Props: `value: FilterState`, `onChange: (f: FilterState) => void`, `prefeituraId: string`.
- `type FilterMode = "se" | "mensal" | "quadrimestral" | "anual" | "personalizado"`.
- `type FilterState = { mode: FilterMode; seIds?: string[]; ano?: number; meses?: number[]; quadrimestre?: 1|2|3; dataInicio?: string; dataFim?: string }`.
- Helper `resolveRange(state, ses): { start: string; end: string }` retorna o intervalo ISO usado na query.
- UI: botão (Trigger) com label resumido + Sheet/Dialog com Tabs por modo. Usa `Calendar` (shadcn datepicker) no modo Personalizado, `Select` para Ano/Mês/Quadrimestre, lista com `Checkbox` para SEs.

**`src/pages/Dashboard.tsx`**:
- Estado `filter: FilterState`.
- `useEffect` inicial: carrega SEs da prefeitura → se alguma cobre hoje, define `{mode:"se", seIds:[...]}`; senão `{mode:"anual", ano: new Date().getFullYear()}`.
- `useEffect([filter, prefeituraId, user])`: monta o range, faz `select` em `visitas` filtrando `datahora >= start AND datahora <= end`, mantém o mapping atual para `Visit[]`.
- Renderiza `<DashboardFilter />` acima do grid de `StatCard`.

**Sem mudanças no Supabase** — usa as tabelas existentes `semanas_epidemiologicas` e `visitas`. Apenas leitura adicional.

## Fora de escopo

- Persistir o filtro escolhido entre sessões.
- Aplicar o mesmo filtro em outras telas (Mapa, Resumo) — fica só no Painel.
- Gráficos novos; mantém os 4 cards atuais e a lista de visitas, apenas reagindo ao período.
