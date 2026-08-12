# 07 — Decision Catalog

The concrete rule catalog implemented by `lib/decision-engine/rules.ts` (Milestone 4). Sourced from `REBUILD_MASTER_HANDOFF.md` §14. Each entry is a pure function producing zero or more `DecisionCandidate`s from a `DailyContext`. `domain` values below use the actual DB enum: `training` | `nutrition` | `sleep` | `recovery` | `planning`.

## Training (`domain: training`)

| Rule | Conditions | Example intervention |
|---|---|---|
| Lunch training | Preferred training day; free lunch window ≥ 35 min; no calendar conflict | *"Treina entre as 12:05 e as 12:45. Esta é a melhor janela livre hoje."* |
| Reduced training | Overloaded day, low energy, or poor sleep (from check-in); useful window shorter than ideal | *"Faz 20 minutos hoje. O objetivo é consistência, não performance máxima."* |
| Mobility instead of cancellation | Physical limitation (from check-in) or poor recovery; no appropriate full-training window | *"Substitui a sessão completa por 15 minutos de mobilidade."* |
| Prepare training equipment | Training planned later today; preparation friction is a known risk | *"Prepara agora a roupa de treino."* |

## Nutrition (`domain: nutrition`)

| Rule | Conditions | Example intervention |
|---|---|---|
| Decide dinner early | Busy evening; approaching the takeaway-risk period; no dinner decision recorded yet today | *"Decide o jantar agora, antes da janela de fadiga da noite."* |
| Defrost ingredients | A home meal requires prep; enough time remains before dinner | *"Tira o frango do congelador agora."* |
| Prepare tomorrow's lunch | Tomorrow's calendar is busy; lunch prep is likely to fail later | *"Prepara o almoço de amanhã depois do jantar."* |
| Avoid takeaway commitment | High-risk evening; repeated recent takeaway pattern (`recentDecisions`) | *"Compromete-te com a refeição de hoje antes de abrires uma app de entregas."* |

## Sleep (`domain: sleep`)

| Rule | Conditions | Example intervention |
|---|---|---|
| Shutdown routine | Target sleep time approaching; work/screen use likely to continue | *"Começa a desligar às 22:30."* |
| Earlier sleep for tomorrow | An early calendar event tomorrow; recent poor sleep (check-in or `recentDecisions`) | *"Amanhã começa cedo. Protege o sono de hoje."* |
| Prepare the next day | Dense morning schedule tomorrow | *"Prepara a roupa e o essencial antes de dormir."* |

## Recovery (`domain: recovery`)

| Rule | Conditions | Example intervention |
|---|---|---|
| Short walk | High stress (check-in); sedentary schedule; insufficient time for a full workout | *"Faz uma caminhada de 15 minutos entre reuniões."* |

## Planning (`domain: planning`)

| Rule | Conditions | Example intervention |
|---|---|---|
| Protect a free window | Only meaningful free period remaining today | *"Mantém esta janela livre. É a melhor oportunidade de recuperação de hoje."* |
| Move low-priority work | Overloaded calendar; no meal, exercise, or recovery window remains | *"Move uma tarefa de baixa prioridade e protege 30 minutos."* |

## Extending the catalog

New rules must:

- Be a pure function of `DailyContext` — no side effects, no network calls.
- Return an empty array when the trigger condition isn't met, never throw.
- Set `baseImpact` conservatively; let `scorer.ts` do the ranking, not the rule itself.
- Never require an intense/demanding action as the *only* branch — always have a reduced/protective fallback branch, consistent with `03_PRODUCT_PRINCIPLES.md` ("progress over perfection," "no shame").
- Ship with unit tests using synthetic `DailyContext` fixtures (see `lib/decisions/prioritize.test.ts` in the previous local-only slice for the pattern this replaces).

## Explicitly out of scope for the catalog

Social comparison and opaque medical or ML inferences remain outside this catalog. Nutrition and Health Data Bridge inputs may only affect a rule after the input has provenance, explicit consent and a deterministic, documented decision use case. Milestone 16A stores and exposes health context to the Coach; it does not yet add health-signal rules to the deterministic catalog.
