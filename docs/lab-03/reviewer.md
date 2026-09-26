# Lab 3 — Peer Review Record

**Author:** Supichaya Limwatanasamut — 67070501087 — GitHub: @PingSupichaya

**Peer reviewer:**
- Norawit Mahaprom — 67070501026 — GitHub: @NxNxmm
- Chawin Chinpraditsuk — 67070501012 — GitHub: @Finyakginshabu

## Pull Requests I authored (reviewed by my partner) (Norawit)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| https://github.com/PingSupichaya/toktickit/pull/36 | lab3-sprint-specification | All the specification and test plans include the right scope. |
| https://github.com/PingSupichaya/toktickit/pull/44 | feature/lab3-migration-seed | Migration and seeding pipeline complete. Everything works perfectly. |
| https://github.com/PingSupichaya/toktickit/pull/45 | feature/real-auth | Authentication and mandatory first-login password change test passed including all backend files (API and Auth test files). |
| https://github.com/PingSupichaya/toktickit/pull/46 | feature/lab3-req-regression | Found a bug with resolved can be clicked after the requester click problem is resolved. |
| https://github.com/PingSupichaya/toktickit/pull/47 | feature/lab3-ticket-queue | Ticket queue, API behavior and UI layouts are passed cleanly. |
| https://github.com/PingSupichaya/toktickit/pull/48 | feature/lab3-ticket-ops | All acceptance criteria and Definition of Done in IT staff ticket operations test passed cleanly. |
| https://github.com/PingSupichaya/toktickit/pull/50 | feature/lab3-manage-user | Mobile’s UI losts hamburger navigation. Now, I have brought it back before the next issue. |
| https://github.com/PingSupichaya/toktickit/pull/30 | feature/create-ticket | The Create Ticket page implementation aligns well with the UI specifications and passes all acceptance criteria and CreateTicketForm.test.tsx passes cleanly. |
| https://github.com/PingSupichaya/toktickit/pull/31 | feature/my-tickets | All functional requirements and test cases passed smoothly. Web page can be improved by adding container spacing. |
| https://github.com/PingSupichaya/toktickit/pull/33 | feature/e2e-testing | Everything meets the lab requirements and acceptance criteria |

### Lab3 sprint specification and test plan

**Reviewer comment I received:**

**Approved:**

> I have reviewed all the Lab 3 specification and test plans, This is a solid and complete! Correctly includes the right scope and you know the drill! Role-Based Authorization and Security are great and I saw the IT staff workflow. Approved to proceed with implementation!

**How I responded:**

> I’m feeling really ready to start implementing😆 Thanks a lot for the review kubbb!

### Lab3-Feature/Database Migration & Seed

**Reviewer comment I received:**

**Approved:**

> I have checked out the branch locally, verified the Prisma migration history, and tested the seeding pipeline. Everything works perfectly according to the Lab 3 Data Specification Kub!

**How I responded:**

> Thanks for reviewing me kub!

### Lab3-Feature/Login Screen and Authentication

**Reviewer comment I received:**

**Approved:**

> Tested the Auth Foundation and mandatory First-Login Password Change implementation locally. All linked tests and acceptance criteria pass cleanly! I saw mustChangePassword = true also mustChangePassword = false after changing the password. All backend API/Auth test files and frontend auth component tests pass without issues.
>
> Solid security implementation! Approved kubbb.

**How I responded:**

> Happy to see you can login and change password. Thank you for testing both frontend and backend too.

### Lab3-Feature/Requester Regression

**Reviewer comment I received:**

**Requested changes:**

> Found a bug with the 'Problem Appears Resolved' button:
> After clicking the button, the Public Comment 'The Requester indicated the problem appears resolved.' is posted correctly. However, when refreshing the page or re-opening the ticket, the button still appears and can be clicked again, causing identical duplicate Public Comments to be created repeatedly. Per ui-spec.md §6.1, it states: 'After it is posted the button hides.' Could you please update the logic to hide the button after the signal has been submitted? Thanks!

**How I responded:**

> Oh! I just noticed that problem. I think my server doesn't record when the problem is resolved. Now I add the record of problem resolve, please check this feature again😆.

**Approved:**

> I have pulled the latest changes and verified locally. Re-entering or refreshing the ticket page now properly hides the button, preventing duplicate system comments. Great work!

**How I responded:**

> Thanks for noticing this problem and rechecking this feature with me.

### Lab3-Feature/IT staff Ticket Queue

**Reviewer comment I received:**

**Approved:**

> Tested the IT Staff Ticket Queue implementation locally across unit tests, API behavior, and responsive UI layouts. All acceptance criteria (AC-08) and Definition of Done requirements pass cleanly! Great job on implementing a robust, responsive support queue! Let's go next kubbbb!

**How I responded:**

> Thank you for testing and reviewing me kubbb.

### Lab3-Feature/Ticket operations and Comment sessions for IT staff

**Reviewer comment I received:**

**Approved:**

> Tested the IT Staff ticket operations, status matrix enforcement, and comment/note security isolation locally. All acceptance criteria and Definition of Done requirements pass cleanly!
> All backend API suites and UI component tests passed without issues. Excellent implementation of the IT Staff workflow kub!

**How I responded:**

> Finally, IT staff session is complete. Thanks for review kub!

### Lab3-Feature/Administrator user management

**Reviewer comment I received:**

**Requested changes:**

> Everything looks good so far! However, you might forgot to deal with mobile's UI. There isn't a hamburger menu appear in navigation bar. Please fix that before getting to next issue kub.

**How I responded:**

> Oh! I think I forget to check client for mobile scale. thank you for notice this issue!

**Approved:**

> Now everything looks good! Hamburger menu is back! great work kubb. Let's move on!

**How I responded:**

> Yesss. Next time I will not forget my hamburger. Thank you for review naa.

### Lab3-Feature/Close all remaining test

**Reviewer comment I received:**

**Requested changes:**

> I ran npx playwright test with both server and client running, but 4 E2E tests are still failing due to implementation mismatches:
>
> Login Error Text Mismatch (E2E-01):
> On `e2e/lab-03/authentication.spec.ts, line 114-115.
> The test expects the exact string "Invalid email or password", but the UI renders "Unable to sign in. Please try again." Please update the login error message on the frontend/auth handler to match "Invalid email or password".
>
> Login Redirect / Logout Button Failure (E2E-04, E2E-09, E2E-11):
> Playwright times out waiting for [data-testid="logout-btn"] after logging in fixture users. I guess this one you might want to ensure the seed database is properly reset with npx prisma migrate reset and that users are correctly authenticated without being blocked or redirected incorrectly.
>
> Please address these text assertions and DB fixture issues so all 11 E2E tests can pass kub!

**e2e/lab-03/authentication.spec.ts:**

> The test expects the exact string "Invalid email or password", but the UI renders `"Unable to sign in. Please try again."
>
> Please make sure you update the login error message on the frontend/auth handler to match "Invalid email or password"

**How I responded:**

> I double-checked by running the Playwright tests, and all 11 tests passed. I’d like you to test it again. I’ve also updated the README with the latest instructions, so you can follow the document when testing. If it still error, please notice me again😆.

**Approved:**

> Thanks for providing me an update instruction! I have added some .env.example to my local env and E2E passed cleanly! Great effort on lab 3 kub Gj!

**How I responded:**

> Thanks for reviewing me until the end of lab3 kubb.

## Pull Requests I reviewed for my partner (Chawin)

### docs(lab-03): add Sprint 3 specifications and test plan

**My comment (Requested changes):**

> Based on my review of the lab sheet, I recommend adding the following items. If I misunderstood anything, please let me know.
>
> 1. `api-spec.md` — Add the Attachment endpoints (upload/download/soft-remove) and replace the client-provided `requesterId` with the authenticated identity instead. Lab Sheet Section 6 explicitly requires the Lab 2 Attachment API to continue working.
>
> 2. `specification.md` — Add an Authorization Matrix table (Role × Endpoint × Ownership). Lab Sheet Section 4.3 explicitly requires a complete authorization matrix, and Part 2 grading also requires evidence of this.
>
> 3. `specification.md` — Resolve the conflict regarding Admin access to `ticket-ops`. The assumption states that Admins do not have access, while `api-spec.md` grants them access. These should be aligned; otherwise, the authorization matrix will be internally inconsistent.
>
> 4. `tests.md` — Add unit tests. There are currently no unit tests, but Lab Sheet Section 10 explicitly requires them.
>
> 5. `tests.md` — Add migration/regression tests for Attachments, including upload, the 5-file limit, soft removal, and blocked downloads returning `410`. There are currently no tests covering these cases, even though BR-18 specifies them and the lab sheet emphasizes regression evidence in Part 3.

**Partner's response:**

> Thanks for the review! I've checked all points against the lab sheet, and you're completely correct. I've updated the specifications, API contract, and test matrix to address every item raised.

**My comment (Approved):**

> Great job kub! All the documentation is well-structured and aligned with the Lab 3 Sheet requirements. Everything is clear, consistent, and ready for implementation.

**Partner's response:**

> Thanks for the review :P <3

### feat: auth and user migration

**My comment (Requested changes):**

> I see that you added the new models to Prisma, but it looks like the Prisma migration for the Lab 3 database is missing. Please resolve this issue soon. I’ll wait for your changes😆.

**Partner's response:**

> Oof, thank you for pointing that out to me. And
> I've already added the migration for Lab 3. Please try again ><

**My comment (Approved):**

> Nice work! Everything looks good now, and you’ve fixed the issues from the previous review. The database migration and schema changes are working properly, and the authentication, password change flow, and attachment features also work as expected.

**Partner's response:**

> Thanks for the review :P <3

### feat(auth): IT staff ticket queue, role-based nav

**My comment:**

> Everything in this issue is working as expected, and the role-based navigation is complete for each user role. I noticed one small thing: when an IT Staff opens a ticket detail, there is a “Back to My Tickets” button that takes them to the My Tickets page. If this is required, then everything is fine. If not, please fix the button or navigation so they match. Overall, great job!

**Partner's response:**

> Thanks for the review :P Yes, that's just a placeholder since the IT staff ticket operations aren't implemented yet, but it will be fixed in an upcoming issue. Thanks again <3

### feat(staff): implement staff ticket ops, discussions, and requester resolution

**My comment:**

> Great work! 👍 Everything in this issue is working well, including the ticket operations, status transitions, public comments, internal notes, and the requester resolution flow. I also checked the related tests, and everything passed successfully.

**Partner's response:**

> Thanks for the review :P <3

### feat(admin): implement user management, password resets, and safety g…

**My comment:**

> Everything is working fine, including user creation, editing, activation/deactivation, password reset, and the Administrator safety rules. And the related tests passed successfully. The User Management screen and all the main functions look complete. Nice job kub!

**Partner's response:**

> Thanks for the review :P <3

### test(e2e): execute playwright suite, capture visual evidence, and rel…

**My comment:**

> Everything looks good to me, I tested the main E2E flows and checked the responsive layouts, and all the tests are passing. The features are working smoothly.

**Partner's response:**

> Thanks for the review :P <3
