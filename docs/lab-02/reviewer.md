# Lab 2 — Peer Review Record

**Author:** Supichaya Limwatanasamut — 67070501087 — GitHub: @PingSupichaya

**Peer reviewer:**
- Norawit Mahaprom — 67070501026 — GitHub: @NxNxmm
- Chawin Chinpraditsuk — 67070501012 — GitHub: @Finyakginshabu

## Pull Requests I authored (reviewed by my partner) (Norawit)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| https://github.com/PingSupichaya/toktickit/pull/16 | sprint-specification | The level of detail across all 4 documents is impressive and provides a solid foundation but I have some suggestions for each file. Lastly, all the feedback is addressed. |
| https://github.com/PingSupichaya/toktickit/pull/21 | feature/lab2-database-increment | database schema, migration script, seed implementation can work but there is some error when running in local, so please make sure everything is working even if they aren't in the AC. |
| https://github.com/PingSupichaya/toktickit/pull/22 | feature/lab2-ui-foundation | From local tests, API and context can work well and correctly, but some bugs occur in the UI part where the dropdown menu overflows in mobile screen size. |
| https://github.com/PingSupichaya/toktickit/pull/23 | feature/reference-api | All backend tests are passing cleanly and all endpoints are verified. |
| https://github.com/PingSupichaya/toktickit/pull/27 | feature/attachment-api | All automated test suites for both Server and Client passed successfully. |
| https://github.com/PingSupichaya/toktickit/pull/28 | revert-27-feature/attachment-api | revert merging from main. |
| https://github.com/PingSupichaya/toktickit/pull/29 | feature/attachment-api | merge branch into lab2-staging. |
| https://github.com/PingSupichaya/toktickit/pull/30 | feature/create-ticket | The Create Ticket page implementation aligns well with the UI specifications and passes all acceptance criteria and CreateTicketForm.test.tsx passes cleanly. |
| https://github.com/PingSupichaya/toktickit/pull/31 | feature/my-tickets | All functional requirements and test cases passed smoothly. Web page can be improved by adding container spacing. |
| https://github.com/PingSupichaya/toktickit/pull/33 | feature/e2e-testing | Everything meets the lab requirements and acceptance criteria |

### Lab2/Sprint specification and test plan documents

**Reviewer comment I received:**

> **Requested changes:** Excellent effort on this PR!
> The level of detail across all 4 specification documents (api-spec.md, specification.md, tests.md, and ui-spec.md) is impressive and provides a solid foundation for Spec-Driven Development (SDD). The REST API structure, Zen Green theme tokens, and BDD-style test scenarios align very well with our Lab 2 requirements.
>
> But just a little more changes, please check the detailed inline comments on each file for specific suggestions! Once these structural sections and alignments are added, please re-request a review. Great job so far!

> **docs/lab-02/api-spec.md:** Great job on drafting the API Specification! The RESTful structure, status codes, payload structures, and error handling patterns are well-defined and aligned with our Lab 2 requirements.
>
> Here are a few comments and suggestions before we merge this PR:
>
> In Lab 2 Lab Sheet (Section 4.5), it states that "A removed Attachment remains visible as metadata but cannot be downloaded."
>
> In GET /api/tickets/:ticketId, please ensure whether attachments array includes soft-removed attachments by default or if the client needs to explicitly call GET /api/tickets/:ticketId/attachments?includeRemoved=true to render the removed attachment metadata on the Ticket Detail screen.
>
> Ensure all endpoints (especially file downloads GET /api/attachments/:attachmentId/download) strictly validate the requesterId parameter against the ticket's owner in the backend before serving the response/file.
>
> The status codes (200, 201, 400, 403, 404, 409, 413, 415) and validation limits (5MB, PDF/JPG/PNG/WEBP, max 5 active attachments) correctly reflect the lab sheet criteria.
>
> Overall, LGTM with just minor clarifications needed regarding how soft-removed attachment metadata is fetched for the Ticket Detail view!

**How I responded:**

> Thanks for your suggestion! I think somethings I already have in my api-spec.md but I will improve it.

> **docs/lab-02/specification.md:** Great job on the engineering specification! The business rules, data model, validation requirements, and database rationale (indexes & soft removal decisions) are extremely detailed and follow Spec-Driven Development principles.
>
> Here are a few items to refine before merging this PR:
>
> I think you have missing section on Acceptance Criteria a little bit:
>
> Per Lab 2 Lab Sheet (Section 8.10 & 8.11), the specification must include a numbered Acceptance Criteria section using Given-When-Then format (e.g., AC-01, AC-02). This will be required to map against tests.md later.
>
> In the Rationale section, it mentions: "Queries filter by isRemoved = false to show only active attachments."
>
> Note that per Lab 2 Lab Sheet (Section 4.5), removed attachments should remain visible as metadata on the Ticket Detail screen, but downloading/previewing must be disabled. Please ensure the query strategy allows fetching soft-removed attachment metadata for display purposes as I commented in api-spec.md
>
> There is a gap in numbering from BR-25 directly to BR-36. Please renumber them sequentially so they can be accurately cited in test plans and PRs.
>
> Overall, excellent foundation! Once the Acceptance Criteria section is added and the soft-removal query behavior is clarified, this will be ready for approval.

**How I responded:**

> On topic 1, I forgot to include them to my specification.md. I appreciate that you noticed this. And topic 3, it was my mistake (in typo)😓
> For topic 2, I will change this hard code into another condition.

> **docs/lab-02/tests.md:** Excellent work on the test specification! The Given-When-Then scenarios are very thorough, covering happy paths, edge cases, validation boundaries, ownership checks (403), attachment restrictions, and mobile responsiveness.
>
> Here are a few key adjustments needed to fully align with the Lab Sheet requirements:
>
> There is a missing table on Planned-Test Table & Traceability Matrix:
>
> Per Lab 2 Lab Sheet (Section 9.1 & Appendix B), please include the Planned-Test Table near the top of the file. It must explicitly map each Test ID -> AC -> Automated Test File Path (e.g., server/tests/lab-02/tickets.api.test.ts) and its Final Pass Status.
>
> Ensure the AC-XX numbering defined here matches the Acceptance Criteria section in specification.md line-by-line for clear traceability.
>
> Add a brief ## Test Commands section documenting the exact CLI commands used to run unit, API, UI, and E2E tests (e.g., npm run test:api, npx playwright test).
>
> Once the Traceability Matrix table and CLI test commands are added, this test plan will be 100% complete and ready to merge!

**How I responded:**

> I will add missing things follow your suggestions thanks.

> **docs/lab-02/ui-spec.md:** Fantastic job on crafting the UI Specification! The Zen Green design tokens, component hierarchy, form validation styling, accessibility targets (44px touch targets), and responsive breakpoints are extremely well thought out and compliant with Lab 2 requirements.
>
> Here are a few quick items to add before finalizing the PR:
>
> There is a missing section in Visual Inspection Checklist & Screenshot Paths:
>
> Per Lab 2 Lab Sheet (Section 8.8, 12, and Appendix C), please add a Visual Inspection Checklist section and document the expected Playwright screenshot paths (e.g., artifacts/lab-02/screenshots/create-ticket/, my-tickets/, ticket-detail/).
>
> Under 4. Ticket Detail Screen, clarify that soft-removed attachments remain visible as read-only metadata rows (with a "Removed" badge and optional reason), but their Download and Preview actions are disabled, as specified in BR-14 and Lab Sheet Section 4.5.
>
> Overall, this is a top-tier UI Specification! Once the Visual Checklist and screenshot path definitions are included, this PR is good to merge.

**How I responded:**

> Looks like I really forgot to add Visual Inspection Checklist & Screenshot. Labsheet has too many pages, so I will be more careful.

> **Approved**: Approved kub! Awesome job on addressing all the feedback! The specifications are now ready to be handed over to the coding agent for implementation. Let's go next kubbb!

**How I responded:**

> Thanks a lot for the detailed review kubb. Next time, I will that ensure everything meets lab's criteria. <3

### Lab2/feature/database-increment

**Reviewer comment I received:**

> **Approved:** Overall LGTM Kub. The database schema, migration script, seed implementation, and automated test suite closely follow the Lab 2 specification (docs/lab-02/specification.md) and test plan (T-022).
>
> But there is some error I've got when running your project on my local, so please make sure everything is working evenif they aren't in the AC kub.
>
> server/prisma/seed.ts: I've got error on this line. "Object literal may only specify known properties, and 'isActive' does not exist in type '(Without<categoryCreateInput, categoryUncheckedCreateInput> & categoryUncheckedCreateInput) | (Without<...> & categoryCreateInput)'.
> @[server/prisma/seed.ts:L18]"
>
> I think what cause this is you have updated schema.prisma in Lab 2 to add isActive Boolean @default(true). However, TypeScript types for Prisma are generated inside node_modules/@prisma/client. When schema.prisma is edited, Prisma does not automatically regenerate those TypeScript type definitions until you explicitly command it to. And because npx prisma generate was not run after pulling or making the schema change, TypeScript was still inspecting the old types from Lab 1 kub.

**How I responded:**

> Sorry kub, I've added isActive in schema so you should run npx prisma generate to update types cause prisma doesn't auto regenerate.

### Lab2/feature/ui-foundation

**Reviewer comment I received:**

> **Requested changes:** After I've run local on my PC. The backend API logic, active requester filtering, and state persistence are working well. All users are shown correctly and accurate within Prisma Studio. Switch Requester & Context Reset are seamlessly.
>
> However, during local testing across different viewports, I noticed a few UI/UX and Responsive bugs that need to be addressed before we can merge this into lab2-staging:
>
> Mobile Responsive Dropdown Overflow:
>
> On mobile viewports (e.g., iPhone SE @ 375px), the expanded <select> dropdown menu overflows outside the card boundary on the right.
>
> Please ensure that the select container and options use width: 100%, max-width: 100%, and proper box-sizing: border-box to prevent horizontal clipping/overflow[cite: 7].
>
> Please fix the responsive CSS rules and layout wrapping, then re-request a review! Great work so far!

**How I responded:**

> I have changed native HTML component to custom dropdown so I think this problem has solved.

> **Approved:** Well after you have fixed the responsive bugs that I mentioned, Everything looks great now! But I noticed that in the very first page, there is a missing messege "DEVELOPER MODE" so make sure you bring it back in next issue kubbb. Figthing!

**How I responded:**

> I think I already add "Developer mode" in this fix😡

### Lab2/feature/reference APIs

**Reviewer comment I received:**

> **Approved:** I have performed local testing against the database and verified all required endpoints according to api-spec.md and acceptance criteria (AC-01, AC-03, AC-04, AC-05, AC-08). All backend tests are passing cleanly. Great work! Approved kubbb!

**How I responded:**

> Thanks for your review kub. <3

### Lab2/feature/attachment api, Revert "Lab2/feature/attachment api"

**Reviewer comment I received:**

> **Approved:** All automated test suites for both Server and Client passed successfully! Coverage for AC-12, AC-13, and AC-14 is fully verified. Excellent work kub! Hope to see the UI for creating ticket soon!

**How I responded:**

> Thanks for review! but I choose false base branch to merge into😭. Thanks a lot for helping me revert this pr and merge into lab2-staging.

### Lab2/feature/create ticket

**Reviewer comment I received:**

> **Approved:** The Create Ticket page implementation aligns well with the UI specifications and passes all acceptance criteria. The displayed as read-only, correctly to the active context user. Category and Related System dropdowns fetch and populate active options dynamically from the API. I love that priority radio buttons render horizontally on desktop viewports and collapse cleanly into a vertical stack on mobile screens. Also, file attachment area behaves optionally as required. Upon successful ticket submission, the drag & drop area disables properly until the top notification is dismissed. And lastly, CreateTicketForm.test.tsx passes cleanly. Everything functions as intended with solid responsive behavior and state management. Great job kub!

**How I responded:**

> I really appreciate your detailed review, thanksssss😍.

### Lab2/feature/my-tickets

**Reviewer comment I received:**

> **Approved:** All functional requirements and test cases passed smoothly! Search debouncing, filter/sort controls, clear filters action, and pagination are working as expected.
>
> But here's a little bit of suggestion. During testing on smaller screen sizes (Mobile and iPad viewports), I noticed that the ticket list content and card boundaries are quite flushed against the outer screen edges. The lack of outer margin/padding on small viewports makes the layout feel a bit cramped and visually constrained.
>
> Since all features, responsiveness, and tests are functioning properly, Approved to merge kub! You can polish the container spacing in a quick follow-up PR if needed.

**How I responded:**

> I see, thanks for the review. I will add some spaces from the edge in the next PR🙏.

### Lab2/feature/ticket-detail

**Reviewer comment I received:**

> **Approved:** Tested the Ticket Detail page, Ownership Guard, and Attachment Management flows locally. Everything works according to the specified requirements! All automated test suites are also passing cleanly.
>
> PS. I love the way to download attached file but for suggestion it might be better if there is a clearly visible download button. Also, it would be even better if the time the file was deleted were indicated. But if you don't think it's necessary, there's no need to include it! Still approved kubbb let's go next!

**How I responded:**

> Thanks kubb. I think for removing date doesn't need to include time just know the date is enough for me kub😆.

### Lab2/feature/e2e-testing

**Reviewer comment I received:**

> **Approved:** I have performed the final peer review and verified all E2E test runs and submission artifacts locally. Everything meets the lab requirements and acceptance criteria! All automated E2E test suites executed successfully without errors. Visual evidence and screenshots captured across all required viewports and clearly stored in artifacts/lab-02/screenshots/ as required lab2 structure kubb! Great job for lab 2!

**How I responded:**

> Thanks for your reviews until my last issue. <3

## Pull Requests I reviewed for my partner (Chawin)

### feat(db): implement Lab 2 Prisma models, migration, and seed data

**My comment:**

> The added database tables are well designed and usable. The migration runs smoothly as well. Nice!

**Partner's response:**

> Thanks for the review :P <3

### feat(requester): implement development requester context, selector modal, and Zen Green shell

**My comment:**

> The selector modal and requester information work smoothly. All tests passed. Such a good Zen Green 🤧

**Partner's response:**

> Thanks for the review :P <3, Zen Green is such a good color that cannot be found anywhere else right? :D

### feat(ticket): implement Create Ticket API, form validation, and attachment upload

**My comment:**

> Ticket can be created and attachment can be uploaded max 5 files. All tests passed, drop down of category and system are corrected. Great job!

**Partner's response:**

> Thanks for the review :P <3

### My Tickets

**My comment:**

> Now I can see my tickets, every details are covered, UI can work in both desktop view and mobile view, and every tests passed then this feature can work successfully. Nice job kub!

**Partner's response:**

> Thanks for the review :P <3

### feat(ticket): implement Ticket Detail view and attachment lifecycle

**My comment:**

> In each ticket can show every details, for soft removes can be used in every account of requester. Your web page is easy to read and this feature can work without any bug. Great job!

**Partner's response:**

> Thanks for the review :P <3

### feat(e2e): execute Playwright E2E suite, capture visual screenshots

**My comment:**

> This feature is really work! everything test passed and runs smoothly. The e2e screenshots can use to keep screenshots in project. Good job!

**Partner's response:**

> Thanks so much for reviewing all my issues and PRs throughout this lab! :P <3