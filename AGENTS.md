# Service Link development

- Read `ServiceLink_MVP_Development_Handover.md`, `docs/SOURCE_ASSESSMENT.md` and `docs/INTEGRATION.md`.
- Implement only in this repository. AdvisorLink source and infrastructure remain read-only.
- Use dedicated feature branches. Preserve reviewed source provenance and third-party notices.
- Never copy AL environment files, data, credentials, deployment targets, gateway merchants or operational documents.
- One plan: 14-day trial, RM9.90 monthly, RM49 first annual year, RM99 annual renewal. Optional gateway included; its transaction charges are separate. Membership billing and customer-to-provider payments are separate domains.
- Keep preview/public presentation shared. Geography lives in `app/src/data/malaysia.json`; provider editing, search and comparison must all consume it. Update its SQL seed together and test parity.
- Local mode is a demonstration, never real auth, shared hosting or a payment sandbox. Keep that visible.
- Run `npm run lint`, `npm run build` and `npm test` in `app/`. Run the browser flow after UI/behavior changes.
- No production deployment, paid subscription, real payment or external messaging without a separate user instruction. Draft PRs and code pushes are authorized.
