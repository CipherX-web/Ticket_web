---
name: printx-build-workflow
description: Step-by-step, error-free build workflow for Print X. Use at the start and end of every implementation task: one small verified step at a time.
---

# Build Workflow (one step at a time, zero known errors)
1. **Read** `printx-project-context` and the skills relevant to the task. Confirm the current roadmap phase.
2. **Plan one small slice** (one module/screen/endpoint). State acceptance criteria and the threat model (see `printx-secure-coding`) BEFORE coding.
3. **Design first**: data model/migration, state machine, API contract (Zod/OpenAPI), permissions matrix.
4. **Write tests first or alongside** (see `printx-test-stack`), including abuse and failure cases.
5. **Implement** with `printx-design-principles`. No TODO-stubs for security; no mock auth left behind.
6. **Verify before moving on**: `tsc --noEmit`, lint, unit, integration, relevant E2E, `npm audit`. Fix every failure; never skip or silence a check, never `any`/`@ts-ignore` to pass.
7. **Self-review** with the security checklist and `printx-testing-definition-of-done`.
8. **Report**: what was built, what was run, what remains. Commit small, conventional commits. Only then start the next slice.
Rules: never proceed on a red build; never invent library APIs (check docs/versions); pin dependency versions with a lockfile; ask when requirements are ambiguous; never place secrets in code or logs; migrations are forward-only and reversible by a new migration.
