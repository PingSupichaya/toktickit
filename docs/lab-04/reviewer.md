# Lab 4 — Peer Review Record

**Author:** Supichaya Limwatanasamut — 67070501087 — GitHub: @PingSupichaya

**Peer reviewer:**
- Norawit Mahaprom — 67070501026 — GitHub: @NxNxmm
- Chawin Chinpraditsuk — 67070501012 — GitHub: @Finyakginshabu

## Pull Requests I authored (reviewed by my partner) (Norawit)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| https://github.com/PingSupichaya/toktickit/pull/54 | lab4/sprint-specification | initial engineering contract covers the full handout scope. |
| https://github.com/PingSupichaya/toktickit/pull/63 | lab4/sprint-specification | missing contract points filled in after the second check. |
| https://github.com/PingSupichaya/toktickit/pull/64 | feature/lab4-migration-seed | migration preserves data, seed idempotent with 0/1/N coverage. |
| https://github.com/PingSupichaya/toktickit/pull/65 | feature/lab4-action-taken-api | Actions Taken endpoints, validation, and concurrency pass. |
| https://github.com/PingSupichaya/toktickit/pull/66 | feature/lab4-action-taken-ui | tab, read-only view, form, and conflict banner pass UI/E2E. |
| https://github.com/PingSupichaya/toktickit/pull/67 | feature/lab4-ticket-workflow | resolution gate and versioned PATCH pass API/UI/E2E. |
| https://github.com/PingSupichaya/toktickit/pull/68 | feature/lab4-requester-dashboard | own-scoped metrics, drill-down, and empty states pass. |
| https://github.com/PingSupichaya/toktickit/pull/69 | feature/lab4-staff-dashboard | queue metrics match DB queries, drill-downs and admin strip pass. |
| https://github.com/PingSupichaya/toktickit/pull/70 | feature/lab4-final-hardening | after 2 request-changes rounds — E2E navigation fixed, all suites green. |

### Lab4-Initial sprint specification

**Reviewer comment I received:**

**Requested changes:**

> Overall, the documents are super detailed, well-structured, and clearly thought through! But I noticed a couple of minor points that we might need to adjust to align with the Lab 4 sheet.
>
> 1. Administrator Dashboard Metrics on both api-spec.md and specification.md - Right now, the spec reuses the IT Staff Dashboard for Administrators without adding user stats. However, section 4.6 of the brief sheet requires the Administrator dashboard to include concise user-account stats such as counts for active Requesters, IT Staff, and Admins.
>
> 2. Action Date/Time Field on both ui-spec.md and specification.md - The spec currently sets the Action Date/Time automatically on the backend via createdAt but from brief sheet in section 8.3 mentions "Action Date/Time" as a field for Actions Taken. I think maybe we should allow a datetime-local picker on the UI (defaulting to current time, blocking future dates) so IT Staff can log actions that happened earlier.
>
> Everything else looks awesome! Please let me know your thought and I shall approve this PR kubbb.

**Approved:**

> I have reviewed the initial Lab 4 engineering contract. `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` follow the lab sheet, field names match the planned Prisma models, and test IDs trace to the acceptance criteria. Approved to proceed kub!

**How I responded:**

> Thanks for checking the correctness and detail across the four files kub! Let's moving on to the migration next.

### Lab4-Edit sprint specification

**Reviewer comment I received:**

**Left a comment:**

> After I checked again, overall your Lab 4 specification is very well detailed. I only found 3 main things you might want to adjust before we start coding:
>
> Dashboard Metrics: In Section 4.6 of the brief sheet, 'recently updated Tickets' is listed as a Requester metric. You currently have closed instead. You might want to include recentlyUpdated or explain the trade-off in D-10.
>
> HTTP Status: Using 409 for the resolution gate (RESOLUTION_NOT_ALLOWED) overloads 409 (which is normally for STALE_UPDATE concurrency). Consider using 422 Unprocessable Entity for domain rule rejections so the client doesn't confuse a concurrency clash with missing work actions.
>
> Follow-Up Validation: Rejecting with 400 when someone unchecks follow-up but leaves text in the note field might be a bit brittle in the UI; consider having the backend auto-clear it to null instead of throwing an error.
>
> Clock skew: 60s for actionAt future check might be tight if client/server clocks drift by a minute or two. 3–5 minutes is safer.
>
> Aside from that, your spec looks ready for implementation. Please let me know what are your thought and we can discuss again together. I won't approve or merge yet na kub.

**How I responded:**

> In Requester Dashboard Metric, I already have recently update and resolved. but I added closed for keep final history of tickets and prevent old Tickets disappear from counts. FYI the closed can be dropped :P
>
> As for the other points, I have considered the issues and already fixed everything. Thank you again for helping me edit the engineering contract.

**Approved:**

> I reviewed everything again and found that you fixed all the main points! Everything is consistent across all 4 documents now, I think you are ready for implementation kub!

**How I responded:**

> Thank you for helping me double check the specification. I think I'm really ready for implements the migration.

### Lab4-Feature/Prisma migration and seeding

**Reviewer comment I received:**

**Approved:**

> I have verified the Lab 4 Prisma migration and idempotent seed suite locally. All migration requirements, data integrity checks, and test scenarios on both automation and manual pass cleanly! Gj kubb

**How I responded:**

> Thanks for review kub! Happy to see that all migration and seed pass cleanly😆.

### Lab4-Feature/Action taken API

**Reviewer comment I received:**

**Approved:**

> Verified the Actions Taken API implementation, validation helpers, and test suites locally. All contract requirements, business rules and security guards pass cleanly! Great work on backend validation and concurrency kub!

**How I responded:**

> Thank you for verifying the validation locally kub! Glad that there is no request change eiei.

### Lab4-Feature/Action taken session

**Reviewer comment I received:**

**Approved:**

> Verified the Actions Taken UI components, conditional validations, session role restrictions, optimistic concurrency conflict handling (`409 STALE_UPDATE`), and Playwright E2E flows locally. All checklist requirements, UI tests and E2E specs pass cleanly kub!

**How I responded:**

> Thanks for checking the role restrictions and the conflict flow kub!

### Lab4-Feature/Ticket workflow with resolution gate & concurrency

**Reviewer comment I received:**

**Approved:**

> Verified the backend Resolution Gate enforcement, advisory requester indicator behavior, UI status dropdown hints, and automated test suites locally. All acceptance criteria and test specs also pass cleanly! Let's go next kubbbb

**How I responded:**

> Let's gooo, thanks for verifying the gate enforcement kub!

### Lab4-Feature/Requester dashboard

**Reviewer comment I received:**

**Requested changes:**

> Overall the implementation on backend api-spec and tests is really LGTM kub! Every tests pass cleanly. However, in my opinion I think the UI on dashboard isn't that functional. Maybe you could've adjust the layout to be more visible, more compact by reduce the blank space also the `Quick Actions` is really too far from usage kub. I hope you consider make some changes on UI.

**How I responded:**

> Ummm.. thank you for your opinion. I think it can be more better layout too. Now I have edited the dashboard layout so you can re-review.

**Approved:**

> Great job! Now your UI is usable and suite more Zen Green Theme! Nicely design kubbb

**How I responded:**

> Thanks for the UI feedback, the dashboard looks much better now kub!

### Lab4-Feature/IT staff and Administrator dashboard

**Reviewer comment I received:**

**Approved:**

> Verified the Staff & Admin Dashboard API implementation, active metric calculations, role-based response enhancements, UI layout, and query drill-down links locally. All acceptance criteria, API tests and UI tests pass cleanly! Excellent work kubbb

**How I responded:**

> Thank you for verifying the metrics and drill-downs locally kub! Excellent review as always.

### Lab4-Feature/Final hardening & regression

**Reviewer comment I received:**

**Requested changes:**

> Verified on automated test and UI from latest in local! However, I ran the Playwright E2E suites for both `e2e/lab-03/` and `e2e/lab-04/`, but several key flows (`E2E-11`, `E2E-04`, `E2E-01`, `E2E-02`) failed with `90000ms Timeout Exceeded` or `Element not found` errors. In Lab 4, successful logins land on `/dashboard` by default. However, the E2E test specs and helper functions like `openStaffTicket` and `openQueueTicket` assume the browser lands directly on the Ticket Queue or My Tickets page. Please update the E2E helper navigation so we can get all E2E tests passing cleanly kub!

**How I responded:**

> Oh, I separated some of the test files into Issue 9, but I think I should move all the test files into this issue so that we can clearly meet the full regression criteria. Now its ready to review! please help me review this issue again.

**Requested changes:**

> After I tried run e2e test on locally, I found 2-3 missing spots kub. `requester-regression.spec.ts:120` still clicks `create-ticket-btn`, `staff-ticket-flow.spec.ts:178` still expects `queue-table` right after login, and both lab-04 helpers still fill `queue-search-input` without navigating from `/dashboard` first. Playwright fails to find these elements and exceeds the timeout.

**How I responded:**

> These four failures are from specs before the dashboard-navigation update, the reviewed commit 9400947 already routes all helpers through the header nav (gotoQueue/gotoMyTickets), and both suites pass cleanly on it (lab-03 11/11, lab-04 6/6). Please git pull, stop any stale dev servers on :3000/:5174 so Playwright boots the current build, and re-run. If your tests still failed, please notice me

**Approved:**

> Found out that it was my fault on wrong pull on local branch kub 😅! Verified all features, navigation fixes, resolution gates, dashboards, accessibility standards, and complete test suites across the application locally. All Definition of Done checklist items and acceptance criteria pass!

**How I responded:**

> That's fine btw thanks for reviewing all the way through Lab 4 kubb!

## Pull Requests I reviewed for my partner (Chawin)

### docs(lab-04): add Sprint 4 specifications and test plan

https://github.com/Finyakginshabu/toktickit/pull/46

**My comment (Requested changes):**

> Overall, everything looks really good! I just want to ask you to take another look at the missing points mentioned in my comments on the different `.md` files.

**Partner's response:**

> Thanks for catching those. I've checked and updated the contracts to address all your feedback. Everything is ready for review again :D

**My comment (Approved):**

> After I have checked doc files again, I think your engineering contract is ready for implementing. Thanks for resolved all issues, really great job kub!

**Partner's response:**

> Thank you so much very much! :O <3

### feat(api): implement actions taken data models, migration, seed, and rest endpoints

https://github.com/Finyakginshabu/toktickit/pull/47

**My comment (Approved):**

> After I tested in my local, everything in this pr is working well, including the database, seed data. And all actions taken API test passed and working correctly. All the criteria are meet. Great job!

**Partner's response:**

> Thanks for the review :P <3

### feat(client): implement actions taken ticket detail UI, create/edit modal, and requester read-only mode

https://github.com/Finyakginshabu/toktickit/pull/48

**My comment (Requested changes):**

> I see the read only action taken of requester and the create-edit action taken of IT staff... But I have seen in ui-spec that admin has a ticket queue of requesters. I'm not sure if you forgot to add the Ticket Queue navigation for the Administrator role.

**Partner's response:**

> Thanks for pointing that out. I checked ui-spec.md and added the Ticket Queue navigation link for the Administrator role as specified. It's ready for review again :O

**My comment (Approved):**

> Now I can access actions taken via requester's ticket detail in Administrator role. Everything works successfully. Great job! (Optional) For running npm test in client, it still failed 1 test occurs by `client/tests/lab-03/StaffTicketQueue.test.tsx`

**Partner's response:**

> Thanks for the review :P <3

**My comment:**

> All tests in both client and server test passed now. Nice work!

### Feature/lab4 ticket workflow and resolution gate

https://github.com/Finyakginshabu/toktickit/pull/49

**My comment (Requested changes):**

> In the fallback route around `app.ts:842`, I noticed that the Resolution Gate only runs when `expectedVersion !== undefined && isGateRequired`. If the API is called directly without `expectedVersion`, the gate could be bypassed. This may conflict with the "authoritative" requirement in FR-11/BR-09, so backend should always enforce the gate.

**Partner's response:**

> yes yes yes thank you for mention it for me :D

**My comment (Approved):**

> I see it! Now everything has passed and works correctly. Great job!

### feat(dashboard): implement role-specific dashboard endpoints, UI screens

https://github.com/Finyakginshabu/toktickit/pull/50

**My comment (Approved):**

> Everything in this issue is working as expected, and all the related tests are passing successfully. I also checked the dashboards for the different roles. The dashboard session is clean, well organized, and looks really good.

**Partner's response:**

> Thanks for the review :P <3

### test(e2e): complete lab 4 end-to-end suite, accessibility audit, style validation, and visual evidence

https://github.com/Finyakginshabu/toktickit/pull/51

**My comment (Requested changes):**

> I'm not sure if you accidentally uploaded empty files for `TicketWorkflow` and `ResponsiveLayout` in `client/tests/lab-04`. Could you please check them again for me?

**Partner's response:**

> Thanks for catching that. It looks like those files were accidentally committed empty. I've added TicketWorkflow.test.tsx and ResponsiveLayout.test.tsx with the complete test cases.

**My comment (Approved):**

> Great work with your final issue of Lab 4, and everything looks complete. I ran through the E2E tests, regression tests, accessibility, Zen Green styling, responsive layouts, and performance checks, and everything passed successfully.

**Partner's response:**

> yay!, thank you for everything <3
