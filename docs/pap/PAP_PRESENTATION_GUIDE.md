# PAP Presentation Guide

This guide helps present the real Nexus Edu IA project to the jury without inventing capabilities or reducing engineering rigor.

## 1. Presentation principle

Explain the real problem, the implemented solution, the architecture that makes it reliable, the evidence that proves it and the limits that still exist.

A strong explanation follows:

```text
PROBLEM
-> ANALYSIS
-> DECISION
-> IMPLEMENTATION
-> EVIDENCE
-> RESULT
-> LIMITATIONS
-> LEARNING
```

## 2. What to show

Prefer real implemented flows with real persistence and truthful state. When showing a capability, be prepared to explain:

- who uses it;
- what institutional pain it addresses;
- what happens in the frontend;
- what request reaches the backend;
- which server-side rule owns the decision;
- what is stored in PostgreSQL or file storage;
- what security/tenant rule protects it;
- how tests or UAT prove it.

## 3. What not to claim

Do not present as complete:

- planned modules;
- mocked integrations;
- test/UAT fixtures as production data;
- UI-only behavior without persistence;
- externally blocked capabilities;
- unfinished workflows.

Use the canonical state vocabulary:

```text
IMPLEMENTED_AND_PROVEN
IN_DEVELOPMENT
PLANNED
BLOCKED_BY_EXTERNAL_DEPENDENCY
OUTSIDE_PAP_SCOPE
```

## 4. Explaining difficult code

Do not read code line by line. Explain the responsibility of the file/function, the inputs, the authoritative rule, the important invariant and the result.

Example pattern:

```text
This route receives the user's intent.
The server resolves the active institution and permission.
The service validates the business rule.
The repository writes the authoritative state inside a transaction.
The UI then reads the persisted result back.
```

## 5. Explaining the database

Explain why entities are separate and how their relationships protect real institutional truth. Use focused diagrams and concrete examples rather than dumping the whole schema.

## 6. Explaining limitations

A limitation is acceptable when stated clearly. Explain whether it is:

- still in development;
- planned later;
- blocked by an external provider or legal/fiscal dependency;
- outside the PAP delivery scope.

Then explain what would be required to complete it.

## 7. Jury preparation checklist

Before presenting a material feature, the author should be able to answer:

```text
What problem does this solve?
Who uses it?
Why was this architecture chosen?
What is authoritative: browser, server or database?
What data is persisted?
How is tenant/security enforced?
What happens on retry or failure?
What test/evidence proves it?
What is still missing?
What did I learn building it?
```
