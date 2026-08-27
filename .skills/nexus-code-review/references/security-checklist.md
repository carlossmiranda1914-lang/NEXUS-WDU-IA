# Security checklist

Apply only the relevant checks; do not create unrelated scope.

## Context and authorization
- Resolve authenticated identity and institutional context server-side.
- Verify membership is active/eligible according to the canonical contract before protected operations.
- Verify every privileged action checks the required capability/role on the server.
- Check horizontal isolation: another institution/tenant cannot read, mutate, enumerate or infer the resource.
- Check vertical isolation: a lower privilege cannot call the endpoint directly to bypass UI restrictions.
- Check self-service privilege changes for self-elevation, lockout and confused-deputy paths.

## Input and persistence
- Validate identifiers and state transitions at the trusted boundary.
- Keep writes atomic where partial success would violate authorization or product truth.
- Avoid secret/credential values in code, logs, fixtures, evidence or artifacts.
- Do not create shadow state in browser persistence to compensate for missing backend contracts.

## Audit and disclosure
- Ensure security-sensitive mutations emit the canonical durable audit/history evidence when required.
- Avoid exposing PII, internal identifiers, authorization reasons or tenant data beyond the consumer's need.
- Make denied/unknown states fail closed and non-enumerating where practical.
