# Lab 2 — Peer Review Record

**Author:** Supichaya Limwatanasamut — 67070501087 — GitHub: @PingSupichaya  
**Peer reviewer:** 
> Chawin Chinpraditsuk — 67070501012 — GitHub: @Finyakginshabu  
> Norawit Mahaprom — 67070501026 — GitHub: @NxNxmm  
> Noppawit Tanmanee — 67070501082 — GitHub: @FakeKase

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| PR #30 | feature/create-ticket | Works and meets the criteria |
| PR #31 | feature/my-tickets | Everything works, meets the criteria |
| PR #32 | feature/ticket-detail | Works correctly, all criteria met |
| PR #34 | feature/e2e-testing | E2E evidence and docs complete, all criteria met |

### feature/create-ticket
Reviewer comment I received:  
    **Chawin:** Tested the create-ticket flow locally; server and client tests pass and the API returns the expected 201 with a valid TKT-###### number. Meets all criteria.  
**How I responded**:  
    Thanks <3

### feature/my-tickets
Reviewer comment I received:  
    **Chawin:** Checked the search, filter, sort, and pagination on the My Tickets screen against a requester with data. Everything works and matches the ui-spec.  
**How I responded**:  
    Thanks for the review!

### feature/ticket-detail
Reviewer comment I received:  
    **Chawin:** Verified the detail page is read-only, attachment soft-removal shows the reason and a muted row, and ownership blocks the wrong requester with a 403 screen. All criteria met.  
**How I responded**:  
    Thanks <3

### feature/e2e-testing
Reviewer comment I received:  
    **Chawin:** Reviewed the root Playwright setup, the `requester-ticket-flow.spec.ts` covering the full create → detail → attachment and ownership flows, and the committed screenshots under `artifacts/lab-02/screenshots/`. All 5 E2E tests pass and docs (tests/reviewer/ai_use) are consistent. DoD fully met.  
**How I responded**:  
    Thanks for the thorough review!

## Pull Requests I reviewed for my partner
### Chawin — feature/lab2-create-ticket
My comment:  
    1. Server and client tests pass and the ticket is created with the correct TKT-###### format. Please add E2E screenshot evidence before merge.  
    2. E2E evidence added and the ui-spec checklist passes. All criteria met, great job!
Partner's response:  
    Added the screenshots, thanks for the review <3

### Norawit — feature/lab2-ticket-detail
My comment:  
    Local run works; detail page read-only and the removed attachment row shows muted style with the reason. All criteria met. Nice work!
Partner's response:  
    -

### Noppawit — feature/lab2-search-and-pagination
My comment:  
    Tested search and pagination against seeded data — behaviour matches the ui-spec. Please make sure the E2E screenshots are committed too.
Partner's response:  
    Screenshots committed. Thanks!
