# PAP Feature Record Template

Use this template only for significant PAP-relevant capabilities. Ground every statement in current repository evidence.

```text
FEATURE=
MODULE=
PRODUCT_STATUS=IMPLEMENTED_AND_PROVEN|IN_DEVELOPMENT|PLANNED|BLOCKED_BY_EXTERNAL_DEPENDENCY|OUTSIDE_PAP_SCOPE
PAP_STATUS=KNOWLEDGE_CAPTURE_PENDING|DOCUMENTED_AS_IN_PROGRESS|PAP_READY

INSTITUTIONAL_PROBLEM=
USER=
WHY_IT_EXISTS=

USER_FLOW=
1.
2.
3.

FRONTEND=
- surface/component:
- user intent collected:
- visible result:

API=
- endpoint(s):
- request intent:
- response/readiness/errors:

BACKEND=
- authoritative service/command:
- domain rules:
- failure behavior:

DATABASE=
- authoritative tables/entities:
- relationships:
- persistence/readback:
- immutability/history rules:

SECURITY=
- authentication:
- authorization:
- tenant isolation:

SCALE_PROFILE=
EXPECTED_VOLUME=
CONCURRENT_USAGE=
DATA_GROWTH=
LARGE_LIST_BEHAVIOR=
TRANSACTION_RISK=
STORAGE_RISK=
PERFORMANCE_RISK=

IMPORTANT_CODE=
- file/function/responsibility:

TESTING_AND_EVIDENCE=
- proof:

TRUTH_BOUNDARY=
- implemented:
- not implemented:
- test/UAT-only:
- external dependency:

KNOWN_LIMITATIONS=

HOW_I_EXPLAIN_THIS_TO_THE_JURY=

WHAT_I_LEARNED=

REPOSITORY_REFERENCES=
```

## Rules

- Omit the scale profile only when scale is genuinely immaterial.
- Do not describe a plan, mock, preview or fixture as product truth.
- Prefer a short explanation of why important code exists over line-by-line narration.
- Update this record when the product state materially changes.
