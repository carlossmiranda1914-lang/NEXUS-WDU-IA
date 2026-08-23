# Nexus Edu IA — Readiness Baseline pós-AUDIT-01

**Atualizado:** 2026-08-19  
**Estado:** BLOQUEADO PARA PILOTO / expansão funcional ampla.  
**Base factual:** `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` + checkpoint congelado `689d1dd8919a25e91911ae118c5aad9ff69c5862`.

## 1. Regra

Readiness mede comportamento comprovado, não quantidade de ecrãs, documentação ou código. A AUDIT-01 invalida qualquer score anterior que dependesse de cobertura superficial ou missões históricas como prova de estado atual.

## 2. Escala

- **0 — não definido/sem autoridade confiável**
- **1 — definido/conceptual**
- **2 — implementação parcial com lacunas materiais**
- **3 — implementação relevante, validação/convergência incompleta**
- **4 — validado no ambiente alvo, sem P0/P1 aberto no domínio**
- **5 — pronto para piloto no âmbito, DoD e evidências completas**

## 3. Baseline conservadora atual

| Domínio | Peso | Nível | Contribuição | Evidência/limite principal |
|---|---:|---:|---:|---|
| Fundação técnica/reprodutibilidade | 15 | 2 | 6 | boa base vNext, mas schema authority/runtime DDL e readiness DB ainda competem |
| Segurança/IAM/RBAC | 15 | 2 | 6 | Membership/contexto fortes no vNext; administração/legacy identity ainda compete |
| Multi-instituição/isolamento | 10 | 2 | 4 | núcleo forte, cobertura desigual em legacy/AI/realtime/bridges |
| PostgreSQL/persistência | 10 | 3 | 6 | migrations/constraints vNext fortes; autoridade de evolução ainda não convergiu |
| Produto/fluxos essenciais | 15 | 2 | 6 | Enrollment tem profundidade; Finance/Academic Core e vários fluxos ainda não são canónicos completos |
| UX multidispositivo/produto real | 10 | 2 | 4 | direção definida, mas frontend é inconsistente e existem mocks/simulações/client-only state |
| Realtime/auditoria/observabilidade | 10 | 2 | 4 | padrões úteis existem; audit truth e cobertura transversal precisam convergir |
| Qualidade/testes/CI | 10 | 2 | 4 | suites fortes localmente em partes; CI não protege uniformemente a fundação vNext |
| IA segura/governada | 5 | 1 | 1 | direção arquitetural existe; ferramentas legacy têm riscos de tenant/autoridade |
| **Total matemático** | **100** | — | **41/100** | produto em construção; não candidato a piloto |

**Readiness oficial atual: 41/100 — BLOQUEADO.**

Este número é uma baseline de gestão pós-auditoria, não certificação de produção. Deve cair ou subir quando novas evidências contradisserem ou comprovarem os níveis acima.

## 4. Tetos e bloqueios

Mesmo que a média matemática suba:

- qualquer P0 estrutural aberto → máximo global 59/100;
- tenant isolation não provado nos caminhos autoritativos → sem piloto multi-instituição;
- IAM/admin authority concorrente → sem gestão institucional real considerada pronta;
- schema authority/readiness insegura → sem declaração de fundação reprodutível;
- Finance sem ledger/payment authority → Finance não conta como fluxo essencial pronto;
- mock/simulação apresentada como operação → domínio de produto não pode atingir nível 4;
- CI crítico não executado/FAIL → release BLOQUEADO;
- IA com acesso cross-tenant ou direct-write inseguro → IA operacional BLOQUEADA.

## 5. Ouro preservado — não confundir com readiness global

A AUDIT-01 reconhece valor elevado em Person/Identity/Membership, InstitutionalContext, Person Resolution, Academic Year, Enrollment intake/idempotency, registration/relationships, validation/state machine, atomic activation no checkpoint, document policy snapshots/files, constraints tenant-aware, process concurrency patterns e helpers tenant-safe.

Esses ativos justificam preservar e convergir, não reescrever tudo. Eles não anulam os riscos fora do núcleo.

## 6. Condições para sair de 41/100

A primeira recalibração formal ocorre após Foundation Authority Convergence:

- FND-01 Schema Authority;
- FND-02 Legacy Write Authority & Fences;
- FND-03 Tenant Sweep;
- FND-04 Product Truth Cleanup;
- FND-05 Audit Truth;
- FND-06 CI vNext Gate.

Cada missão só altera o score com evidência executada. Documento ou código não testado, sozinho, não aumenta nível.

## 7. Evidência mínima para nível 4/5

Nível 4 exige critérios funcionais, persistência, autorização/tenant, negativos, CI e validação aplicável sem P0/P1 no domínio. Nível 5 exige ainda DoD integral, evidências anexadas, operação/piloto definida e risco residual formalmente aceite.

Estados de evidência: **PASS / FAIL / BLOCKED / NOT RUN / N/A**. BLOCKED e NOT RUN nunca contam como PASS.

## 8. Regra final

> O objetivo não é elevar a percentagem. É aumentar a quantidade de comportamento crítico que conseguimos provar sem contradição de autoridade.
