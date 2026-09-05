# Lab 2 UI Specification

---

## 1. Design Philosophy

### Principles
- **Clarity:** Information hierarchy is clear; important actions are prominent.
- **Efficiency:** Common tasks require minimal steps; forms are straightforward.
- **Feedback:** System state is always visible; every action produces immediate feedback.
- **Consistency:** Patterns repeat across screens; similar things look similar.
- **Accessibility:** Color is never the only indicator; text is readable; focus is always visible.
- **Responsiveness:** Layouts adapt gracefully from mobile to desktop.

---

## 2. Color Tokens

All color values below are fixed for Lab 2. The coding agent must reference these tokens by name; do not introduce any unlisted color.

### Brand

| Token | Hex | Intended Use |
|-------|-----|-------------|
| `color-primary` | `#006B3C` | App header background, primary buttons, strong emphasis |
| `color-primary-hover` | `#0B7A46` | Hover state of primary buttons, active nav links, focus rings |
| `color-pale-green` | `#EAF6EF` | Selected items, success backgrounds, subtle section fill |

### Neutral

| Token | Hex | Intended Use |
|-------|-----|-------------|
| `color-bg-page` | `#F5F7F6` | Page canvas |
| `color-bg-surface` | `#FFFFFF` | Cards, modals, dropdowns |
| `color-text-primary` | `#1A3A2E` | Body copy, headings |
| `color-text-secondary` | `#5A6F65` | Labels, metadata, helper text |
| `color-border` | `#D1D9D6` | Default borders |
| `color-border-input` | `#C0C8C4` | Editable input borders |
| `color-text-disabled` | `#9AA5A0` | Disabled text |
| `color-bg-disabled` | `#F0F0F0` | Disabled button backgrounds |

### Form Field

| Token | Hex | Intended Use |
|-------|-----|-------------|
| `color-bg-editable` | `#FFFFFF` | Editable input background |
| `color-bg-readonly` | `#F9F9F7` | Read-only input background |
| `color-border-focus` | `#0B7A46` | Input focus ring |

### Feedback

| Token | Hex | Intended Use |
|-------|-----|-------------|
| `color-error` | `#C41E3A` | Error text, error border, danger button background |
| `color-error-bg` | `#FDF0F2` | Error alert background |
| `color-error-hover` | `#A01828` | Danger button hover |
| `color-warning` | `#F59E0B` | Warning text, amber badge |
| `color-warning-bg` | `#FEF3C7` | Warning alert background |
| `color-success` | `#006B3C` | Success text, success badge (`= color-primary`) |
| `color-info` | `#2563EB` | Info alert border and icon |
| `color-info-bg` | `#EFF6FF` | Info alert background |

---

## 3. Typography

### Font Family

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### Scale

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Page title (H1) | 28px / 1.75rem | 700 Bold | 1.2 |
| Section title (H2) | 24px / 1.5rem | 600 Semibold | 1.2 |
| Subsection (H3) | 20px / 1.25rem | 600 Semibold | 1.2 |
| Body | 16px / 1rem | 400 Regular | 1.6 |
| Label / metadata | 14px / 0.875rem | 400 Regular | 1.4 |
| Caption / hint | 12px / 0.75rem | 400 Regular | 1.4 |
| Button | 16px / 1rem | 500 Medium | — |
| Input | 16px / 1rem | 400 Regular | — |

---

## 4. Spacing System

Base unit: 4 px.

| Token | Value |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |

---

## 5. Elevation and Border Radius

### Shadows

```css
/* Card (default) */
box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);

/* Card (hover/focus) */
box-shadow: 0 4px 6px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06);

/* Modal */
box-shadow: 0 10px 25px rgba(0,0,0,0.20), 0 5px 10px rgba(0,0,0,0.12);
```

### Border Radius

| Usage | Value |
|-------|-------|
| Buttons, badges, inputs | 4px |
| Cards, dropdowns | 8px |
| Modals, panels | 12px |

---

## 6. Button Hierarchy

Every button state must be visually distinct. The coding agent must implement all six states.

### 6.1 Primary Button

| State | Background | Text | Border | Cursor |
|-------|-----------|------|--------|--------|
| Default | `#006B3C` | White | none | pointer |
| Hover | `#0B7A46` | White | none | pointer |
| Focus | `#006B3C` | White | 2px outline `#0B7A46`, 2px offset | pointer |
| Disabled | `#C0C8C4` | `#9AA5A0` | none | not-allowed |
| Busy (loading) | `#006B3C` | White | none | not-allowed |

**Busy state:** Replace button label with a 16 px inline spinner (white) + "Submitting…" text. The button is `disabled` and pointer-events are none. The form must also be fully disabled while the primary action button is busy.

### 6.2 Secondary Button

| State | Background | Text | Border | Cursor |
|-------|-----------|------|--------|--------|
| Default | White | `#006B3C` | 1px solid `#006B3C` | pointer |
| Hover | `#EAF6EF` | `#006B3C` | 1px solid `#006B3C` | pointer |
| Focus | White | `#006B3C` | 2px outline `#0B7A46`, 2px offset | pointer |
| Disabled | White | `#9AA5A0` | 1px solid `#C0C8C4` | not-allowed |

### 6.3 Danger (Destructive) Button

| State | Background | Text | Border | Cursor |
|-------|-----------|------|--------|--------|
| Default | `#C41E3A` | White | none | pointer |
| Hover | `#A01828` | White | none | pointer |
| Focus | `#C41E3A` | White | 2px outline `#C41E3A`, 2px offset | pointer |
| Disabled | `#C0C8C4` | `#9AA5A0` | none | not-allowed |

### 6.4 Ghost / Tertiary Button

| State | Background | Text | Border | Cursor |
|-------|-----------|------|--------|--------|
| Default | Transparent | `#0B7A46` | none | pointer |
| Hover | `#EAF6EF` | `#0B7A46` | none | pointer |
| Focus | Transparent | `#0B7A46` | 2px outline `#0B7A46`, 2px offset | pointer |

**Sizing:** Primary and Secondary — padding 12px 24px. Ghost — padding 8px 16px. All — border-radius 4px.

### Automated Assertion Targets for Buttons

- Primary submit button has `data-testid="submit-btn"` and `disabled` attribute when form is invalid or submitting.
- Busy state button has `data-testid="submit-btn-busy"` and `aria-busy="true"`.
- Danger remove button has `data-testid="remove-attachment-btn"`.
- Cancel / secondary buttons have `data-testid="cancel-btn"`.

---

## 7. Form Controls

### 7.1 Text Input States

| State | Background | Border | Text |
|-------|-----------|--------|------|
| Default (editable) | `#FFFFFF` | 1px solid `#C0C8C4` | `#1A3A2E` |
| Focus | `#FFFFFF` | 2px solid `#0B7A46` | `#1A3A2E` |
| Read-only | `#F9F9F7` | 1px solid `#D1D9D6` | `#5A6F65`; cursor: default |
| Invalid | `#FFFFFF` | 2px solid `#C41E3A` | `#1A3A2E` |
| Disabled | `#F9F9F7` | 1px solid `#D1D9D6` | `#9AA5A0`; cursor: not-allowed |

All inputs: padding 12px 16px; border-radius 4px; font 16px Regular.  
Placeholder text: `#9AA5A0`.

### 7.2 Textarea

Same as Text Input with min-height 120px; resize: vertical only. Character counter always visible.

### 7.3 Select / Dropdown

Same appearance as Text Input. Chevron-down icon (`#5A6F65`) right-aligned. Dropdown menu: white background, 1px solid `#C0C8C4` border, card shadow, 4px border-radius. Item padding 12px 16px; hover background `#EAF6EF`; selected item shows checkmark + `#EAF6EF` background.

### 7.4 Radio Buttons (Priority)

Size 20 × 20px. Default border: 2px solid `#C0C8C4`. Checked border + fill: `#006B3C`. Focus: 2px outline `#0B7A46`, 2px offset. Label: 16px Regular `#1A3A2E`, margin-left 8px. Horizontal on desktop; vertical on mobile.

### 7.5 Required-Field Marker

- Required fields are marked with a red asterisk `*` immediately after the label text: e.g. **Category \***.
- Asterisk color: `#C41E3A`.
- All asterisks must be accompanied by a legend or `aria-required="true"` on the input.
- Automated check: every required field `<input>` / `<select>` / `<textarea>` must have `aria-required="true"` and its label must contain `*`.

### 7.6 Validation Message Placement

- Error message appears **immediately below the field** (not in a tooltip, not at the top of the form alone).
- Font: 14px Regular `#C41E3A`.
- Optional leading exclamation icon (same color).
- `role="alert"` or `aria-live="polite"` so screen readers announce the error.
- Automated check: error message element has `data-testid="error-{fieldName}"`.

### 7.7 Character Counter

- Position: bottom-right of input or textarea.
- Format: `"45 / 200 characters"`.
- Default color: `#5A6F65`.
- Near limit (≥ 90 % used): `#F59E0B` (amber).
- Over limit: `#C41E3A` (red).
- Automated check: element has `data-testid="counter-{fieldName}"`.

---

## 8. Badge Rules

### Status Badge (Current Status)

| Value | Background | Text | Additional |
|-------|-----------|------|------------|
| NEW | `#EAF6EF` | `#006B3C` | — |

Font: 12px Medium (500), uppercase. Padding: 4px 8px. Border-radius: 4px.  
Non-color indicator: label text is always uppercase ("NEW"). Screen reader reads the text.

### Requested Priority Badge

| Value | Background | Text |
|-------|-----------|------|
| LOW | `#F0F0F0` | `#5A6F65` |
| MEDIUM | `#FEF3C7` | `#92400E` |
| HIGH | `#FDF0F2` | `#C41E3A` |

Font: 12px Medium (500), uppercase. Padding: 4px 8px. Border-radius: 4px.  
Non-color indicator: the text value itself ("LOW", "MEDIUM", "HIGH") distinguishes priority without relying on color.

### Automated Assertion Targets for Badges

- Status badge: `data-testid="status-badge"` with `data-value="NEW"`.
- Priority badge: `data-testid="priority-badge"` with `data-value="LOW|MEDIUM|HIGH"`.

---

## 9. Attachment States

Each attachment row in the Ticket Detail Attachments card must render one of the following five states.

| State | Visual Treatment | Download | Preview | Remove |
|-------|-----------------|---------|---------|--------|
| **Active** | Normal row; filename is a clickable download link | ✅ Enabled | ✅ Enabled | ✅ Enabled (ghost danger button) |
| **Uploading** | Row shows filename + progress bar (green fill); "Cancel" ghost button | ❌ | ❌ | ❌ |
| **Upload Failed** | Row shows filename + red error text "Upload failed. Try again."; "Retry" ghost button + "Remove" ghost | ❌ | ❌ | ✅ (removes pending row) |
| **Removed** | Row rendered in muted style (`color-text-disabled`); "Removed" badge (gray, `#9AA5A0` text on `#F0F0F0`); removal date and reason shown below filename; **Download and Preview actions are disabled and hidden** | ❌ | ❌ | ❌ |
| **Unavailable** (file missing from storage) | Row shows filename + amber warning badge "Unavailable"; Download disabled | ❌ | ❌ | ✅ |

**Removed attachment display rules (mandatory):**
- Soft-removed attachments are **always shown** on the Ticket Detail screen as read-only metadata rows. They are never hidden.
- The row must include: original filename (plain text, not a link), file size, upload date, "Removed" badge, removal date, and removal reason (if provided).
- Download link and Preview button must be absent or have `disabled` attribute and `aria-disabled="true"`.
- Muted row background: `#F9F9F7`; text color: `#9AA5A0`.
- Automated check: removed row has `data-testid="attachment-removed-{id}"` and no `<a>` download link.

**Upload zone:**
- Shown only when active attachment count < 5.
- Hidden (or replaced by "Maximum attachments reached" message) when count = 5.
- Drag-and-drop zone: 2px dashed `#C0C8C4` border; background `#F9F9F7`; hover/dragover: 2px dashed `#0B7A46`, background `#EAF6EF`; padding 32px; border-radius 8px.
- Allowed types label: "JPG, PNG, WEBP, PDF (max 5 MB)".

---

## 10. Form Lifecycle States

The Create Ticket form must correctly implement all six states below. The coding agent must handle each; tests must assert the correct state.

| State | UI Behaviour |
|-------|-------------|
| **Initial** | All required fields empty; submit button disabled; no error messages visible |
| **Loading (reference data)** | Category and Related System dropdowns show skeleton/spinner while fetching; submit button disabled |
| **Validation (client-side)** | On blur, invalid fields show red border + inline error message below field; submit button remains disabled until all required fields are valid |
| **Submitting** | Submit button enters Busy state (inline spinner + "Submitting…"); entire form is disabled; no second submission possible |
| **Success** | Success alert banner appears at top: "Ticket TKT-XXXXXX created successfully." Navigate to Ticket Detail after 1–2 s or on user dismiss |
| **Failure (server error)** | Error alert banner at top with safe message; form re-enabled; all user-entered data preserved; retry possible |

---

## 11. Application Shell and Navigation

### App Header

**Desktop (≥ 768 px):**
- Height: 64px; background `#006B3C`.
- Left: "TokTickIT" logotype (white, 20px Bold) + nav links "My Tickets" and "Create Ticket" (white, 16px Medium, margin-left 32px each).
- Active page indicator: 3px underline `#EAF6EF`, 4px below text. Inactive hover: underline appears.
- Right: Requester display (white, 14px, flex column, align-end) — "Logged in as: [Name]" / email — plus "Switch Requester" ghost button (white border, white text, hover pale-green background).
- Padding: 0 24px.

**Mobile (< 768 px):**
- Height: 56px; background `#006B3C`.
- Logo left; hamburger icon right (white, 44 × 44px tap target).
- Tapping hamburger opens full-screen overlay (background `#006B3C`); nav links stacked, 20px, padding 16px, full-width; active link background `#0B7A46`; close ✕ top-right; requester info + "Switch Requester" at bottom.

### Development Mode Banner
- Below header; background `#FEF3C7`; text `#92400E`, 14px; content "⚠️ DEVELOPMENT MODE — Not Real Authentication"; padding 8px 24px; border-bottom 1px solid `#F59E0B`.

### Breadcrumb (Ticket Detail only)
- Below header, above page title; 14px `#5A6F65`; separator "/"; link color `#0B7A46`, underline on hover; current page `#1A3A2E`, no link.

---

## 12. Screen Layouts

### 12.1 Requester Selection Screen

Centered card on `#F5F7F6`. Card: white, max-width 400px, padding 32px, border-radius 12px, card shadow.

- "TokTickIT" title: `#006B3C`, 28px Bold, centered.
- Subtitle: "Select a Requester (Development Mode)", 16px `#5A6F65`, centered.
- Info alert: "This is a testing mechanism, not real authentication."
- Dropdown label "Select Requester"; display format "Name (email)".
- Primary "Continue" button, full-width.
- **Loading state:** Spinner centered inside card.
- **Error state:** Error alert + "Retry" secondary button.

### 12.2 Create Ticket Screen

Single column, max-width 800px, centered on page.

**Form fields (stacked, gap `space-6`):**

| # | Field | Type | Required | Notes |
|---|-------|------|----------|-------|
| 1 | Requester | Read-only input | — | Shows selected requester name + email |
| 2 | Category | Select | ✱ | Active categories from API |
| 3 | Related System | Select | ✱ | Active related systems from API |
| 4 | Summary | Text input | ✱ | 10–200 chars; character counter |
| 5 | Description | Textarea | ✱ | 20–2000 chars; character counter |
| 6 | Requested Priority | Radio group | ✱ | LOW / MEDIUM / HIGH |
| 7 | Attachments | File upload zone | Optional | Max 5; JPG, PNG, WEBP, PDF; max 5 MB each |

Required fields are marked ✱ in the label (see Section 7.5).

**Form actions (desktop: left-aligned row; mobile: stacked full-width):**
- Primary "Submit Ticket" (`data-testid="submit-btn"`)
- Secondary "Cancel" (`data-testid="cancel-btn"`)

**State transitions:** see Section 10.

### 12.3 My Tickets Screen

Full width, max-width 1200px.

**Controls row 1 (flex, space-between):**
- Left: Search input (min 240px, max 360px on desktop); `data-testid="search-input"`; debounce 300ms; placeholder "Search tickets…".
- Right: Primary "Create Ticket" button.

**Controls row 2 (flex, wrap, gap `space-4`):**
- Filter dropdowns: Category (`data-testid="filter-category"`), Related System, Status, Priority.
- Sort dropdown: `data-testid="sort-control"`.
- "Clear Filters" ghost button (visible only when any filter or search is active); `data-testid="clear-filters-btn"`.

**Ticket count line:** "Showing X of Y tickets" — 14px `#5A6F65`.

**Ticket list:**
Each card is clickable and navigates to Ticket Detail.
- Desktop / tablet: flex row — left section (number + summary + metadata) and right section (status badge).
- Mobile: stacked column; metadata items wrap.
- Ticket Number: 18px Semibold `#1A3A2E`; `data-testid="ticket-number"`.
- Summary: 16px Regular, single-line truncate with ellipsis.
- Metadata row: Category badge, Related System text, Priority badge, date, attachment count ("📎 N").
- Card hover: shadow upgrade + border `#0B7A46`.

**Empty states:**

| Condition | Heading | Message | Action |
|-----------|---------|---------|--------|
| No tickets at all | "No Tickets Yet" | "You haven't created any tickets." | Primary "Create Your First Ticket" |
| Search / filter returns nothing | "No Results" | "No tickets match your search or filters." | Ghost "Clear Filters" |

Both must use the EmptyState component; `data-testid="empty-state"`.

**Pagination:** bottom, margin-top `space-8`; `data-testid="pagination"`. Page size selector right-aligned.

**Loading state:** Skeleton cards (shimmer) fill the list area.

### 12.4 Ticket Detail Screen

Single column, max-width 900px.

**Ticket Information Card (white card, padding 32px):**
- 2-column grid (desktop), 1-column (mobile) for read-only fields:
  - Ticket Number, Ticket Date, Requester, Category, Related System, Requested Priority (badge), Current Status (badge).
- Below grid: Summary (18px Semibold) and Description (16px Regular, preserve line-breaks).

**Attachments Card (white card, padding 32px):**
- Section title: "Attachments (N active)" — `data-testid="attachment-count"`.
- Attachment rows: see Section 9 for all five states.
- **Soft-removed rows are always rendered** — never hidden. They appear below active rows in muted styling with "Removed" badge, removal date, and reason. Download and Preview are absent / `disabled` + `aria-disabled="true"`.
- Upload zone: shown when active count < 5. Hidden / replaced by "Maximum attachments reached" when count = 5.
- Empty state: "No attachments yet" when the ticket has no attachments at all.

**States:**
- Loading: skeleton for both cards.
- Ownership failure (403): ErrorState component with "You do not have permission to view this ticket." + Secondary "Back to My Tickets" button.
- Not found (404): ErrorState with "Ticket not found." + Secondary "Back to My Tickets".

### 12.5 Switch Requester Dialog

Modal (max-width 480px):
- Title "Switch Requester"; requester dropdown; Primary "Switch" + Secondary "Cancel"; spinner overlay during switch.

---

## 13. Responsive Behavior

### Breakpoints

| Name | Width |
|------|-------|
| Mobile | < 768px |
| Tablet | 768px – 1023px |
| Desktop | ≥ 1024px |

### Adaptation Rules

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Navigation | Horizontal in header | Horizontal in header | Hamburger overlay |
| Create Ticket form | Labels + full-width inputs in single column | Same as desktop | Full-width; touch targets ≥ 44px |
| Priority radio group | Horizontal | Horizontal | Vertical |
| My Tickets filters | Single horizontal row | Wrapping row | Collapsed panel or stacked |
| Ticket card | Flex row (metadata inline) | Flex row | Stacked column |
| Ticket Detail fields | 2-column grid | 2-column grid | 1-column |
| Buttons (form actions) | Inline row, left-aligned | Inline row | Full-width stacked |
| Modals | Centered, max-width 600px | Centered, max-width 600px | Full-screen (small margin) |

### Touch Targets
All interactive elements on mobile: minimum 44 × 44px; spacing between targets ≥ 8px; input font ≥ 16px (prevents iOS zoom).

---

## 14. Accessibility

### Focus States
- 2px outline `#0B7A46`, 2px offset on all interactive elements.
- Focus order follows logical reading order (top → bottom, left → right).
- Skip-to-main-content link as first focusable element in the page.

### Color Contrast (WCAG AA)
| Pairing | Ratio | Result |
|---------|-------|--------|
| `#006B3C` on white | 6.2:1 | Pass |
| `#C41E3A` on white | 5.8:1 | Pass |
| `#5A6F65` on white | 4.6:1 | Pass |
| White on `#006B3C` | 6.2:1 | Pass |

### Non-Color Indicators
- Validation errors: red border + icon + text (3 independent cues).
- Required fields: asterisk `*` in label + `aria-required="true"`.
- Status: uppercase text badge ("NEW").
- Priority: text value ("LOW", "MEDIUM", "HIGH") in badge.
- Focus: outline shape (not color alone).

### ARIA and Screen-Reader Support
- All `<input>`, `<select>`, `<textarea>` have associated `<label>` (for/id pair) or `aria-label`.
- Validation error elements: `role="alert"` or `aria-live="polite"`.
- Busy button: `aria-busy="true"`, `aria-label` includes "…loading".
- Removed attachment rows: `aria-label` includes "Removed attachment: [filename]".
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title.
- Loading spinners: `role="status"`, `aria-label="Loading"`.

### Keyboard Navigation
- Tab: logical order; Esc: closes modals / dropdowns; Enter: submits focused form or activates button; Arrow keys: navigate radio groups and dropdowns.

---

## 15. Animation and Transitions

| Element | Duration | Easing |
|---------|----------|--------|
| Button hover / focus | 150ms | ease |
| Input focus ring | 150ms | ease |
| Card hover shadow | 200ms | ease |
| Modal open / close | 200ms | ease |
| Dropdown open / close | 150ms | ease |
| Page content fade-in (optional) | 200ms | ease |
| Skeleton shimmer | 2s infinite | ease-in-out |
| Upload progress bar | real-time | linear |

---

## 16. Automated Assertion Targets

The following `data-testid` values must be present on their respective elements so unit and E2E tests can target them without relying on CSS classes or text content.

| `data-testid` | Element |
|--------------|---------|
| `submit-btn` | Create Ticket submit button |
| `submit-btn-busy` | Submit button in busy / submitting state |
| `cancel-btn` | Cancel / secondary navigation button |
| `search-input` | My Tickets search field |
| `filter-category` | Category filter dropdown |
| `filter-related-system` | Related System filter dropdown |
| `filter-status` | Status filter dropdown |
| `filter-priority` | Priority filter dropdown |
| `sort-control` | Sort dropdown |
| `clear-filters-btn` | Clear Filters button |
| `pagination` | Pagination container |
| `ticket-number` | Ticket Number text in list card |
| `status-badge` | Status badge (with `data-value`) |
| `priority-badge` | Priority badge (with `data-value`) |
| `empty-state` | Empty state component |
| `error-{fieldName}` | Inline validation error message |
| `counter-{fieldName}` | Character counter for summary / description |
| `attachment-count` | "Attachments (N active)" heading |
| `remove-attachment-btn` | Remove button on active attachment row |
| `attachment-removed-{id}` | Soft-removed attachment row |
| `requester-select` | Requester selection dropdown |
| `continue-btn` | Requester Selection "Continue" button |

Required CSS classes for automated assertion:
- `.field--error` on invalid input wrappers.
- `.field--readonly` on read-only input wrappers.
- `.btn--busy` on the submit button in the submitting state.
- `.attachment--removed` on soft-removed attachment rows.
- `.badge--priority-low`, `.badge--priority-medium`, `.badge--priority-high` on priority badges.

---

## 17. Visual Inspection Checklist and Screenshot Paths

### Screenshot Paths

Playwright saves screenshots to the following paths. The coding agent must configure `playwright.config.ts` to match.

```
artifacts/lab-02/screenshots/
├── create-ticket/
│   ├── desktop-initial.png
│   ├── desktop-validation.png
│   ├── desktop-submitting.png
│   ├── desktop-success.png
│   ├── tablet-initial.png
│   └── mobile-initial.png
├── my-tickets/
│   ├── desktop-with-tickets.png
│   ├── desktop-empty-state.png
│   ├── desktop-no-results.png
│   ├── desktop-search-active.png
│   ├── tablet-with-tickets.png
│   └── mobile-with-tickets.png
└── ticket-detail/
    ├── desktop-full.png
    ├── desktop-attachments-active.png
    ├── desktop-attachments-removed.png
    ├── tablet-full.png
    ├── mobile-full.png
    └── ownership-error.png
```

### Create Ticket — Visual Checklist

- [ ] Page title "Create Ticket" visible at H1 size.
- [ ] Required fields marked with red `*` asterisk after label text.
- [ ] Read-only Requester field has `#F9F9F7` background, visually distinct from editable fields.
- [ ] Editable inputs have white background with `#C0C8C4` border.
- [ ] Focus ring (`#0B7A46`, 2px) visible on keyboard-focused field.
- [ ] Invalid field shows red border + inline error message immediately below.
- [ ] Character counters visible below Summary and Description fields.
- [ ] Counter turns amber at ≥ 90 % of limit; red when over limit.
- [ ] Priority radio buttons horizontal on desktop; vertical on mobile.
- [ ] Submit button disabled (gray) when required fields are empty.
- [ ] Submit button shows inline spinner + "Submitting…" during POST request.
- [ ] No horizontal scroll at any viewport.
- [ ] No clipping of labels or inputs at 375px mobile width.
- [ ] Success banner uses `#EAF6EF` background + `#006B3C` left border.
- [ ] Error banner uses `#FDF0F2` background + `#C41E3A` left border.

### My Tickets — Visual Checklist

- [ ] Page title "My Tickets" visible.
- [ ] Search input, filter dropdowns, and sort control rendered without overlap.
- [ ] "Clear Filters" button appears only when search or a filter is active.
- [ ] Ticket cards render without clipping on any viewport.
- [ ] Mobile cards stack metadata vertically; no unintended horizontal scroll.
- [ ] Priority badge colors match spec: gray / amber / red for LOW / MEDIUM / HIGH.
- [ ] Status badge "NEW" uses pale-green background + primary-green text.
- [ ] Empty state (no tickets) shows illustration + "Create Your First Ticket" button.
- [ ] No-results state (search/filter) shows "No Results" + "Clear Filters" button.
- [ ] Skeleton loading covers list area (not blank white).
- [ ] Pagination controls fully visible; active page button uses `#006B3C` background.
- [ ] Page size selector visible and usable on mobile.
- [ ] Attachment count "📎 N" visible on cards with attachments.

### Ticket Detail — Visual Checklist

- [ ] Breadcrumb "My Tickets / TKT-XXXXXX" displayed.
- [ ] Status badge visible alongside ticket number in page title area.
- [ ] Read-only fields have `#F9F9F7` background, clearly distinct from editable forms.
- [ ] 2-column grid on desktop; 1-column on mobile; no field clipping.
- [ ] Description preserves line breaks.
- [ ] Active attachments: filename is a clickable link; "Download" and "Remove" buttons present.
- [ ] Soft-removed attachments rendered as read-only metadata rows — always visible.
  - "Removed" gray badge visible.
  - Removal date and reason shown.
  - No download link; no preview button.
  - Row has muted `#9AA5A0` text on `#F9F9F7` background.
- [ ] Upload zone hidden / replaced by "Maximum attachments reached" when 5 active attachments exist.
- [ ] Ownership error screen (403) shows error message + "Back to My Tickets" button.
- [ ] No horizontal scroll on any viewport.
- [ ] Skeleton loading visible before data arrives.

### General — Visual Checklist

- [ ] Zen Green header (`#006B3C`) consistent across all screens.
- [ ] Development Mode amber banner visible on every screen.
- [ ] Active nav link has underline indicator; inactive has none.
- [ ] Hamburger menu opens and closes correctly on mobile; tap targets ≥ 44px.
- [ ] No inconsistent field styling (mixed border colors, inconsistent padding).
- [ ] Badge text uppercase, padding consistent across all instances.
- [ ] Modals centered on desktop; full-screen on mobile.
- [ ] Focus rings visible when navigating by keyboard (Tab key) on all interactive elements.

---

## 18. Component Structure Reference

```
/components
  /ui
    Button.tsx          ← primary, secondary, danger, ghost + busy state
    Input.tsx           ← editable, read-only, invalid, disabled
    Select.tsx
    Textarea.tsx        ← with character counter
    Badge.tsx           ← status + priority variants
    Card.tsx
    Modal.tsx
    Alert.tsx           ← success, error, warning, info
    Spinner.tsx
    EmptyState.tsx
    ErrorState.tsx
    FileUpload.tsx      ← upload zone + file list with all 5 states
    Pagination.tsx
  /layout
    AppHeader.tsx
    AppLayout.tsx
  /features
    RequesterSelector.tsx
    TicketCard.tsx
    TicketForm.tsx
    AttachmentList.tsx   ← handles active, uploading, failed, removed, unavailable
    TicketFilters.tsx
```

---

## 19. Developer Notes

### CSS Approach
- Use utility-first CSS (Tailwind) or CSS-in-JS with the token values defined in Section 2.
- Define all color tokens in a central config (`tailwind.config.ts` or `theme.ts`). Do not hard-code hex values in components.
- The Zen Green theme is fixed for Lab 2; no runtime theming required.

### State Management
- Form state: React Hook Form (or equivalent) for validation, dirty-tracking, and submission state.
- Global state: React Context for selected requester.
- Server state: React Query or SWR for API data, caching reference data (categories, related systems).

### Testing
- Component tests: render each component variant; assert `data-testid` presence and CSS class application.
- Playwright E2E: capture screenshots at the paths defined in Section 17; assert no console errors.
- Use `axe-core` or `jest-axe` for automated accessibility checks on rendered components.

### Performance
- Debounce search input 300ms.
- Cache `GET /api/categories` and `GET /api/related-systems` (rarely change).
- Lazy-load screen components; skeleton loading on every async boundary.
