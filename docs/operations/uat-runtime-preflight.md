# Local UAT runtime gate

Run `npm run uat:preflight` before reporting any Nexus UX slice ready for human UAT. To validate an intended entry URL explicitly, use `npm run uat:preflight -- --origin http://localhost:3000`.

The only canonical local browser origin is `http://localhost:3000`. Do not substitute `127.0.0.1`; browser security providers treat it as a separate origin. A non-canonical `--origin` fails with `NON_CANONICAL_AUTH_UAT_ORIGIN_REJECTED=YES`; an HTTP server being reachable at `127.0.0.1` never authorizes authenticated UAT there.

The Codex preview currently opens `http://127.0.0.1:3000` and is not supported for authenticated Human UAT. Open the canonical URL manually in a normal browser only after the Firebase gate is verified.

The command verifies the expected test-server worktree, runtime PID and Git head through the development-only `/__uat/runtime` identity marker, backend reachability, the approved disposable PostgreSQL target, current migrations, Firebase client configuration, and canonical fixture prerequisites. HTTP `200` alone is insufficient. It deliberately returns a non-zero result with `EXTERNAL_CONFIGURATION_REQUIRED` until the Firebase authorized-domain configuration can be proved through a real authenticated browser session.

For project `nexus-edu-platform`, an authorized administrator must add `localhost` in Firebase Console → Authentication → Settings → Authorized domains. No Firebase bypass, wildcard, or application-side permission change is permitted. After the change, sign in at `http://localhost:3000`, then run the authenticated Finance HTTP smoke and the human UAT scenarios.

Technical, PostgreSQL, HTTP, lint, and build success are not product-UAT evidence. `READY_FOR_HUMAN_UAT=YES` requires a passing preflight and a proven authenticated runtime.
