# Local UAT runtime gate

Run `npm run uat:preflight` before reporting any Nexus UX slice ready for human UAT.

The only canonical local browser origin is `http://localhost:3000`. Do not substitute `127.0.0.1`; browser security providers treat it as a separate origin.

The command verifies the expected test-server worktree, backend reachability, the approved disposable PostgreSQL target, current migrations, Firebase client configuration, and canonical fixture prerequisites. It deliberately returns a non-zero result with `EXTERNAL_CONFIGURATION_REQUIRED` until the Firebase authorized-domain configuration can be proved through a real authenticated browser session.

For project `nexus-edu-platform`, an authorized administrator must add `localhost` in Firebase Console → Authentication → Settings → Authorized domains. No Firebase bypass, wildcard, or application-side permission change is permitted. After the change, sign in at `http://localhost:3000`, then run the authenticated Finance HTTP smoke and the human UAT scenarios.

Technical, PostgreSQL, HTTP, lint, and build success are not product-UAT evidence. `READY_FOR_HUMAN_UAT=YES` requires a passing preflight and a proven authenticated runtime.
