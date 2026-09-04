# Lab 2 UI Specification

## Overview
This specification defines the user interface design, Zen Green theme, reusable components, navigation, and responsive behavior for the Requester Ticketing System.

## Design Philosophy

### Principles
- **Clarity:** Information hierarchy is clear; important actions are prominent
- **Efficiency:** Common tasks require minimal steps; forms are straightforward
- **Feedback:** System state is always visible; actions provide immediate feedback
- **Consistency:** Patterns repeat across screens; similar things look similar
- **Accessibility:** Color is not the only indicator; text is readable; focus is visible
- **Responsiveness:** Layouts adapt gracefully from desktop to mobile

## Zen Green Theme

### Color Palette

#### Primary Colors
- **Primary Green:** `#006B3C`
  - Usage: App header background, primary action buttons, strong emphasis
  - Text on primary: White `#FFFFFF`
- **Secondary Green:** `#0B7A46`
  - Usage: Active tabs, focus accents, links, hover states on primary actions
  - Text on secondary: White `#FFFFFF`
- **Pale Green:** `#EAF6EF`
  - Usage: Selected items, success backgrounds, subtle section emphasis
  - Text on pale green: Dark text

#### Neutral Colors
- **Page Background:** `#F5F7F6` (quiet near-white)
- **Surface/Cards:** White `#FFFFFF` with subtle border `#E0E0E0` and shadow
- **Text Primary:** `#1A3A2E` (dark charcoal-green, comfortable reading)
- **Text Secondary:** `#5A6F65` (muted for labels and metadata)
- **Border:** `#D1D9D6` (soft neutral)
- **Disabled Text:** `#9AA5A0` (clearly disabled but readable)

#### Form Colors
- **Editable Field Background:** White `#FFFFFF`
- **Editable Field Border:** `#C0C8C4` (neutral, clear)
- **Editable Field Border (Focus):** `#0B7A46` (secondary green)
- **Read-Only Field Background:** `#F9F9F7` (soft gray-green, warm ivory shading)
- **Read-Only Field Border:** `#D1D9D6`

#### Feedback Colors
- **Error:** `#C41E3A` (dark red)
  - Background: `#FDF0F2` (pale red)
  - Border: `#C41E3A`
  - Usage: Validation errors, critical messages
- **Warning:** `#F59E0B` (amber)
  - Background: `#FEF3C7` (pale yellow)
  - Border: `#F59E0B`
  - Usage: Warnings, cautions, non-critical alerts
- **Success:** `#006B3C` (primary green)
  - Background: `#EAF6EF` (pale green)
  - Border: `#006B3C`
  - Usage: Success confirmations, positive feedback
- **Info:** `#2563EB` (blue)
  - Background: `#EFF6FF` (pale blue)
  - Border: `#2563EB`
  - Usage: Informational messages, tips

### Typography

#### Font Family
- **Primary:** System font stack for performance and native feel
  ```css
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  ```

#### Font Sizes and Weights
- **Heading 1 (Page Title):** 28px / 1.75rem, Bold (700)
- **Heading 2 (Section Title):** 24px / 1.5rem, Semibold (600)
- **Heading 3 (Subsection):** 20px / 1.25rem, Semibold (600)
- **Body Text:** 16px / 1rem, Regular (400)
- **Small Text (Metadata, Labels):** 14px / 0.875rem, Regular (400)
- **Tiny Text (Hints, Captions):** 12px / 0.75rem, Regular (400)
- **Button Text:** 16px / 1rem, Medium (500)
- **Input Text:** 16px / 1rem, Regular (400)

#### Line Height
- **Headings:** 1.2
- **Body Text:** 1.6
- **Labels and Small Text:** 1.4

### Spacing System
Use consistent spacing based on 4px base unit:

- **Space-1:** 4px
- **Space-2:** 8px
- **Space-3:** 12px
- **Space-4:** 16px
- **Space-5:** 20px
- **Space-6:** 24px
- **Space-8:** 32px
- **Space-10:** 40px
- **Space-12:** 48px
- **Space-16:** 64px

### Elevation and Shadows

#### Card Shadow
```css
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
```

#### Card Shadow (Hover)
```css
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
```

#### Modal Shadow
```css
box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2), 0 5px 10px rgba(0, 0, 0, 0.12);
```

### Border Radius
- **Small (Buttons, Badges, Inputs):** 4px
- **Medium (Cards, Dropdowns):** 8px
- **Large (Modals, Panels):** 12px

## Reusable Components

### Button Component

#### Primary Button
- **Background:** `#006B3C` (primary green)
- **Text:** White `#FFFFFF`, 16px, Medium (500)
- **Padding:** 12px 24px
- **Border Radius:** 4px
- **Hover:** Background `#0B7A46` (secondary green)
- **Focus:** Outline `#0B7A46` 2px with 2px offset
- **Disabled:** Background `#C0C8C4`, text `#9AA5A0`, no hover, cursor not-allowed

#### Secondary Button
- **Background:** White `#FFFFFF`
- **Text:** `#006B3C` (primary green), 16px, Medium (500)
- **Border:** 1px solid `#006B3C`
- **Padding:** 12px 24px
- **Border Radius:** 4px
- **Hover:** Background `#EAF6EF` (pale green)
- **Focus:** Outline `#0B7A46` 2px with 2px offset
- **Disabled:** Border `#C0C8C4`, text `#9AA5A0`, no hover, cursor not-allowed

#### Danger Button (for destructive actions like remove attachment)
- **Background:** `#C41E3A` (error red)
- **Text:** White `#FFFFFF`, 16px, Medium (500)
- **Padding:** 12px 24px
- **Border Radius:** 4px
- **Hover:** Background darker red `#A01828`
- **Focus:** Outline `#C41E3A` 2px with 2px offset

#### Ghost/Text Button
- **Background:** Transparent
- **Text:** `#0B7A46` (secondary green), 16px, Medium (500)
- **Padding:** 8px 16px
- **Hover:** Background `#EAF6EF` (pale green)
- **Focus:** Outline `#0B7A46` 2px with 2px offset

### Input Component

#### Text Input
- **Background:** White `#FFFFFF`
- **Border:** 1px solid `#C0C8C4`
- **Border (Focus):** 2px solid `#0B7A46` (secondary green)
- **Border Radius:** 4px
- **Padding:** 12px 16px
- **Font:** 16px, Regular (400)
- **Placeholder:** `#9AA5A0`
- **Disabled:** Background `#F9F9F7`, border `#D1D9D6`, text `#9AA5A0`

#### Text Input (Read-Only)
- **Background:** `#F9F9F7` (soft gray-green)
- **Border:** 1px solid `#D1D9D6`
- **Text:** `#5A6F65` (secondary text)
- **Cursor:** default (not text)

#### Text Input (Error State)
- **Border:** 2px solid `#C41E3A` (error red)
- **Background:** White
- **Focus Border:** 2px solid `#C41E3A`

#### Error Message
- **Text:** `#C41E3A` (error red), 14px
- **Display:** Immediately below input field
- **Icon:** Optional red exclamation icon

#### Character Counter
- **Text:** `#5A6F65` (secondary text), 12px
- **Position:** Bottom right of text area or input
- **Format:** "45 / 200 characters"
- **Color (near limit):** `#F59E0B` (warning amber) when 90%+ used
- **Color (over limit):** `#C41E3A` (error red) when over limit

### Textarea Component
Same as Text Input, but:
- **Min Height:** 120px
- **Resize:** Vertical only
- **Character counter:** Always visible

### Select/Dropdown Component
- **Appearance:** Same as Text Input
- **Dropdown Icon:** Chevron-down, `#5A6F65`, right-aligned
- **Dropdown Menu:**
  - Background: White
  - Border: 1px solid `#C0C8C4`
  - Shadow: Card shadow
  - Border Radius: 4px
- **Dropdown Item:**
  - Padding: 12px 16px
  - Hover: Background `#EAF6EF` (pale green)
  - Selected: Background `#EAF6EF`, checkmark icon
  - Font: 16px, Regular

### Radio Button / Checkbox Component
- **Size:** 20px × 20px
- **Border:** 2px solid `#C0C8C4`
- **Border (Checked):** 2px solid `#006B3C` (primary green)
- **Fill (Checked):** `#006B3C` (primary green)
- **Focus:** Outline `#0B7A46` 2px with 2px offset
- **Label:** 16px, Regular, `#1A3A2E`, margin-left 8px

### Badge Component

#### Status Badge (NEW)
- **NEW:** Background `#EAF6EF` (pale green), text `#006B3C` (primary green)
- **Font:** 12px, Medium (500), uppercase
- **Padding:** 4px 8px
- **Border Radius:** 4px
- **Optional:** Small colored dot indicator

#### Priority Badge
- **LOW:** Background `#F0F0F0` (light gray), text `#5A6F65`
- **MEDIUM:** Background `#FEF3C7` (pale yellow), text `#92400E` (dark amber)
- **HIGH:** Background `#FDF0F2` (pale red), text `#C41E3A` (error red)
- **Font:** 12px, Medium (500), uppercase
- **Padding:** 4px 8px
- **Border Radius:** 4px

### Card Component
- **Background:** White `#FFFFFF`
- **Border:** 1px solid `#E0E0E0`
- **Border Radius:** 8px
- **Shadow:** Card shadow
- **Padding:** 24px
- **Hover (if clickable):** Card shadow (hover), border `#0B7A46`

### Loading Component

#### Spinner
- **Size:** 40px × 40px (default), smaller variants available
- **Color:** `#0B7A46` (secondary green)
- **Animation:** Smooth rotation
- **Usage:** Centered in container with optional "Loading..." text below

#### Skeleton Loading
- **Background:** `#E0E0E0` animated shimmer to `#F0F0F0`
- **Usage:** Placeholder for content while loading (ticket cards, list items)

### Empty State Component
- **Icon:** Relevant illustration or icon in `#C0C8C4` (muted)
- **Heading:** 20px, Semibold, `#1A3A2E`
- **Message:** 16px, Regular, `#5A6F65`
- **Action Button:** Primary button for main action (e.g., "Create Your First Ticket")
- **Padding:** 64px vertical, centered

### Error State Component
- **Icon:** Error icon in `#C41E3A` (error red)
- **Heading:** 20px, Semibold, `#1A3A2E`
- **Message:** 16px, Regular, `#5A6F65`, safe error description
- **Action Button:** Primary button "Retry" or secondary button "Go Back"
- **Padding:** 64px vertical, centered

### Banner/Alert Component
- **Success Alert:**
  - Background: `#EAF6EF` (pale green)
  - Border-left: 4px solid `#006B3C` (primary green)
  - Icon: Checkmark in `#006B3C`
  - Text: `#1A3A2E`
- **Error Alert:**
  - Background: `#FDF0F2` (pale red)
  - Border-left: 4px solid `#C41E3A` (error red)
  - Icon: Exclamation in `#C41E3A`
  - Text: `#1A3A2E`
- **Warning Alert:**
  - Background: `#FEF3C7` (pale yellow)
  - Border-left: 4px solid `#F59E0B` (amber)
  - Icon: Warning triangle in `#F59E0B`
  - Text: `#1A3A2E`
- **Info Alert:**
  - Background: `#EFF6FF` (pale blue)
  - Border-left: 4px solid `#2563EB` (blue)
  - Icon: Info circle in `#2563EB`
  - Text: `#1A3A2E`
- **Padding:** 16px
- **Border Radius:** 4px
- **Dismissible:** Optional close button in top-right

### File Upload Component
- **Drag-and-Drop Zone:**
  - Border: 2px dashed `#C0C8C4`
  - Border (hover/dragover): 2px dashed `#0B7A46` (secondary green)
  - Background: `#F9F9F7`
  - Background (hover/dragover): `#EAF6EF` (pale green)
  - Padding: 32px
  - Border Radius: 8px
  - Icon: Upload icon `#5A6F65`
  - Text: "Drag files here or click to browse"
  - Allowed types displayed: "JPG, PNG, WEBP, PDF (max 5MB)"
- **File List Item:**
  - Filename, file size, content type icon
  - Remove button (small ghost/danger button)
  - Progress bar during upload
  - Success checkmark when complete
  - Error indicator if upload fails

### Pagination Component
- **Container:** Flex row, centered, spacing 8px
- **Page Button:**
  - Size: 40px × 40px
  - Border: 1px solid `#C0C8C4`
  - Background: White
  - Text: `#5A6F65`, 14px
  - Hover: Background `#EAF6EF`, border `#0B7A46`
  - Active: Background `#006B3C`, text White, no border
  - Disabled: Background `#F0F0F0`, text `#9AA5A0`, no hover
- **Previous/Next Buttons:** Text buttons with arrow icons
- **Page Size Selector:** Dropdown, right-aligned

### Modal/Dialog Component
- **Overlay:** Semi-transparent black `rgba(0, 0, 0, 0.5)`, covers full viewport
- **Modal Container:**
  - Background: White
  - Border Radius: 12px
  - Shadow: Modal shadow
  - Max Width: 600px (default), larger for complex forms
  - Padding: 32px
  - Centered vertically and horizontally
- **Header:**
  - Title: 24px, Semibold
  - Close button: Top-right, ghost button with X icon
- **Body:** Scrollable if content overflows
- **Footer:**
  - Flex row, right-aligned
  - Primary and secondary action buttons
  - Spacing: 16px between buttons

## Application Navigation

### App Header

**Desktop (>= 768px):**
- **Height:** 64px
- **Background:** `#006B3C` (primary green)
- **Layout:** Flex row, space-between, aligned center
- **Left Section:**
  - TokTickIT logo/text: White, 20px, Bold
  - Navigation links: White, 16px, Medium, margin-left 32px each
    - "My Tickets"
    - "Create Ticket"
  - **Active Page Indication:** Underline with `#EAF6EF`, 3px, 4px below text
  - **Hover:** Underline appears
- **Right Section:**
  - Development Requester display: White, 14px, flex column, align-end
    - "Logged in as: [Name]"
    - Email in smaller, slightly transparent text
  - "Switch Requester" button: Secondary style adapted for dark background (white border, white text, hover pale green background)
- **Padding:** 0 24px

**Mobile (< 768px):**
- **Height:** 56px
- **Background:** `#006B3C` (primary green)
- **Layout:**
  - Top row: Logo/text (white), hamburger menu button (white icon, right-aligned)
  - When menu open: Full-screen overlay with navigation links stacked vertically
- **Mobile Menu:**
  - Background: `#006B3C`
  - Links: White, 20px, padding 16px, full-width, tap highlight
  - Active: Background `#0B7A46`
  - Close button: Top-right, X icon
  - Requester info at bottom: Name, email, "Switch Requester" button

### Development Mode Indicator
- **Position:** Below app header (or top of page if header is sticky)
- **Background:** `#FEF3C7` (pale yellow/warning)
- **Text:** `#92400E` (dark amber), 14px
- **Content:** "⚠️ DEVELOPMENT MODE - Not Real Authentication"
- **Padding:** 8px 24px
- **Border-bottom:** 1px solid `#F59E0B`

### Breadcrumb (Optional for Detail Screens)
- **Position:** Below header, above page title
- **Text:** `#5A6F65`, 14px
- **Separator:** "/" or chevron-right, `#9AA5A0`
- **Links:** `#0B7A46` (secondary green), underline on hover
- **Current Page:** `#1A3A2E`, no link

## Screen Layouts

### 1. Requester Selection Screen

**Purpose:** Development testing mechanism to select which requester is "logged in."

**Layout (Centered Card):**
- **Container:** Centered vertically and horizontally on page background `#F5F7F6`
- **Card:** White, 400px max-width, padding 32px, border-radius 12px, card shadow
- **Logo/Title:** "TokTickIT" in `#006B3C`, 28px, Bold, centered, margin-bottom 16px
- **Subtitle:** "Select a Requester (Development Mode)", 16px, `#5A6F65`, centered, margin-bottom 24px
- **Development Warning:** Info alert box with text: "This is a testing mechanism, not real authentication"
- **Requester Dropdown:**
  - Label: "Select Requester", 14px, `#5A6F65`
  - Select component with list of active requesters
  - Display format: "Name (email)"
  - Margin-bottom 24px
- **Submit Button:** Primary button "Continue", full-width
- **Loading State:** Spinner if requesters are loading
- **Error State:** Error alert if loading fails, "Retry" button

### 2. Create Ticket Screen

**Layout (Single Column, Max Width 800px):**
- **Page Title:** "Create Ticket", H1, margin-bottom 32px
- **Form Card:** White card, padding 32px
- **Form Fields (stacked vertically, spacing 24px):**
  1. **Requester (Read-Only):**
     - Label: "Requester"
     - Read-only input with selected requester name and email
  2. **Category (Required):**
     - Label: "Category *"
     - Select dropdown with active categories
     - Error message space below
  3. **Related System (Required):**
     - Label: "Related System *"
     - Select dropdown with active related systems
     - Error message space below
  4. **Summary (Required):**
     - Label: "Summary *"
     - Text input, max 200 characters
     - Character counter below
     - Error message space below
  5. **Description (Required):**
     - Label: "Description *"
     - Textarea, min 20, max 2000 characters
     - Character counter below
     - Error message space below
  6. **Requested Priority (Required):**
     - Label: "Requested Priority *"
     - Radio buttons for LOW, MEDIUM, HIGH (horizontal on desktop, vertical on mobile)
     - Error message space below
  7. **Attachments (Optional):**
     - Label: "Attachments (Optional, max 5)"
     - File upload component (drag-and-drop zone)
     - List of selected files below with remove option
     - Allowed types and max size displayed
- **Form Actions:**
  - Primary button "Submit Ticket"
  - Secondary button "Cancel" (returns to My Tickets or clears form with confirmation)
  - Spacing 16px between buttons
  - Align left on desktop, stacked full-width on mobile
- **Loading State:** Disable form and show spinner overlay during submission
- **Success State:** Navigate to Ticket Detail or show success banner and clear form
- **Error State:** Show error banner at top of form, preserve data, enable retry

### 3. My Tickets Screen

**Layout (Full Width with Max 1200px):**
- **Page Title:** "My Tickets", H1, margin-bottom 24px
- **Action Bar (Flex Row, space-between):**
  - Left: Search input (300px on desktop)
  - Right: Primary button "Create Ticket"
- **Filter and Sort Bar (Flex Row, wrap):**
  - Filter dropdowns: Category, Related System, Status, Priority
  - Sort dropdown: "Sort by Ticket Date (Newest)" or "Ticket Number"
  - "Clear Filters" text button (appears when filters active)
  - Spacing: 16px between elements
- **Ticket Count:** "Showing X of Y tickets", 14px, `#5A6F65`, margin-bottom 16px
- **Ticket List:**
  - Stacked cards, spacing 16px
  - Each ticket card (clickable):
    - **Layout:** Flex row (desktop), column (mobile)
    - **Left Section:**
      - Ticket Number: 18px, Semibold, `#1A3A2E`
      - Summary: 16px, Regular, `#1A3A2E`, truncate if too long
      - Metadata row (flex, spacing 16px):
        - Category badge
        - Related System (text with icon)
        - Requested Priority badge
        - Ticket Date (formatted)
        - Attachment count (if > 0): "📎 X attachments"
    - **Right Section:**
      - Status badge (NEW)
    - **Hover:** Card shadow (hover), border `#0B7A46`
- **Empty State:** When no tickets exist or no search results
  - Empty state component
  - Message: "No tickets found" or "You haven't created any tickets yet"
  - Primary button "Create Your First Ticket"
- **Pagination:** Pagination component at bottom, margin-top 32px
- **Loading State:** Skeleton loading for ticket cards

### 4. Ticket Detail Screen

**Layout (Single Column, Max Width 900px):**
- **Breadcrumb:** "My Tickets / TKT-000042"
- **Page Title:**
  - Ticket Number (H1) + Status Badge
- **Ticket Information Card:** White card, padding 32px, margin-bottom 24px
  - **Section: Ticket Details**
    - Grid layout (2 columns on desktop, 1 on mobile)
    - Read-only fields:
      - Ticket Number
      - Ticket Date (formatted)
      - Requester (name and email)
      - Category
      - Related System
      - Requested Priority (badge)
      - Current Status (badge)
  - **Section: Description**
    - Summary: 18px, Semibold, margin-bottom 8px
    - Description: 16px, Regular, preserve line breaks
- **Attachments Card:** White card, padding 32px
  - **Section Title:** "Attachments (X active)"
  - **Attachment List:**
    - Each attachment (not removed):
      - Flex row, align-center, spacing 16px
      - File icon (based on type)
      - Filename (clickable link to download)
      - File size
      - Uploaded date
      - Actions: "Download" button (ghost), "Remove" button (ghost danger)
    - When 5 active attachments: Display message "Maximum attachments reached"
  - **Upload Section (if < 5 active):**
    - File upload component
    - Upload button (primary small)
  - **Empty State:** "No attachments" message if none
  - **Removed Attachments (optional view):** Show removed attachments in muted styling with removed date and reason
- **Loading State:** Skeleton loading for ticket details
- **Error State:** Error state component if ticket not found or ownership check fails
- **Ownership Failure:** Error message "You do not have permission to view this ticket" with button to return to My Tickets

### 5. Switch Requester Dialog

**Modal Dialog:**
- **Title:** "Switch Requester"
- **Requester Dropdown:** Select component with active requesters
- **Actions:**
  - Primary button "Switch"
  - Secondary button "Cancel"
- **Loading:** Disable form during switch, show spinner

## Responsive Behavior

### Breakpoints
- **Mobile:** < 768px
- **Tablet:** 768px - 1024px
- **Desktop:** >= 1024px

### Responsive Adaptations

#### Navigation
- **Desktop:** Horizontal navigation in header
- **Mobile:** Hamburger menu with full-screen overlay

#### Form Layouts
- **Desktop:** Labels left-aligned, inputs full-width within form container
- **Tablet:** Same as desktop
- **Mobile:** Full-width inputs, stacked vertically, increased touch targets (min 44px height)

#### Ticket List
- **Desktop:** Multi-column layout within cards, compact metadata
- **Tablet:** Same as desktop, slightly reduced spacing
- **Mobile:** Single-column cards, stacked metadata, larger touch targets

#### Ticket Detail
- **Desktop:** 2-column grid for read-only fields
- **Tablet:** 2-column grid with reduced spacing
- **Mobile:** Single-column layout, full-width fields

#### Filter and Sort
- **Desktop:** Horizontal row, all visible
- **Tablet:** Wrap to multiple rows if needed
- **Mobile:** Collapse to expandable filter panel or stacked layout

#### Buttons
- **Desktop:** Inline with appropriate widths
- **Mobile:** Full-width for primary actions, stacked vertically

#### Modals
- **Desktop:** Centered, max-width 600px
- **Mobile:** Full-screen or near full-screen with small margin

### Touch Targets
- All interactive elements on mobile must be at least 44px × 44px for comfortable touch
- Increase spacing between interactive elements on mobile
- Use larger font sizes for mobile inputs (16px minimum to prevent zoom)

## Accessibility

### Focus States
- All interactive elements have visible focus indicator (2px outline, `#0B7A46`, 2px offset)
- Focus order follows logical reading order
- Skip to main content link for keyboard navigation

### Color Contrast
- Text on white meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Primary green `#006B3C` on white: 6.2:1 (pass)
- Error red `#C41E3A` on white: 5.8:1 (pass)
- Secondary text `#5A6F65` on white: 4.6:1 (pass)

### Screen Reader Support
- All form inputs have associated labels
- Error messages are announced
- Status changes are announced (loading, success, error)
- Images and icons have alt text or aria-label
- Buttons have descriptive labels

### Keyboard Navigation
- All features accessible via keyboard
- Esc key closes modals and dropdowns
- Enter key submits forms
- Arrow keys navigate dropdowns and radio buttons
- Tab key follows logical order

### Not Relying on Color Alone
- Status indicated by badge text + color
- Priority indicated by badge text + color
- Errors indicated by icon + border + text + color
- Focus indicated by outline + color

## Animation and Transitions

### Subtle Transitions
- Button hover: 150ms ease
- Input focus: 150ms ease
- Card hover: 200ms ease
- Modal open/close: 200ms ease
- Dropdown open/close: 150ms ease

### Loading Animations
- Spinner: Smooth continuous rotation
- Skeleton shimmer: 2s ease-in-out infinite

### Page Transitions
- Minimal or none; instant navigation feels snappiest
- Optional: Subtle fade-in for content (200ms)

## Error and Validation UX

### Inline Validation
- Validate on blur (when user leaves field)
- Show error immediately on blur if invalid
- Clear error immediately when user corrects
- Do not validate on every keystroke (annoying for typing)

### Form Submission Validation
- Validate all fields on submit
- Scroll to and focus first invalid field
- Display all errors inline
- Disable submit button until all errors cleared (or allow submit with validation)

### Success Feedback
- Success banner appears at top of screen
- Auto-dismiss after 5 seconds (or provide close button)
- Navigate to relevant next screen (e.g., Ticket Detail after creation)

### Error Feedback
- Error banner appears at top of screen
- Remains visible until dismissed or corrected
- Provide actionable next steps

## Confirmation Dialogs

### Remove Attachment Confirmation
- **Title:** "Remove Attachment?"
- **Message:** "This will mark '[filename]' as removed. You won't be able to download it."
- **Input:** Optional text area for removal reason
- **Actions:**
  - Danger button "Remove"
  - Secondary button "Cancel"

## Component Reusability

All components defined in this spec should be:
- **Reusable:** Built as independent, parameterized components
- **Consistent:** Use the same component across all screens
- **Maintainable:** Centralized styling, easy to update theme
- **Documented:** Props, variants, and usage examples documented

### Suggested Component Library Structure
```
/components
  /ui
    Button.tsx
    Input.tsx
    Select.tsx
    Textarea.tsx
    Badge.tsx
    Card.tsx
    Modal.tsx
    Alert.tsx
    Spinner.tsx
    EmptyState.tsx
    ErrorState.tsx
    FileUpload.tsx
    Pagination.tsx
  /layout
    AppHeader.tsx
    AppLayout.tsx
  /features
    RequesterSelector.tsx
    TicketCard.tsx
    TicketForm.tsx
    AttachmentList.tsx
    TicketFilters.tsx
```

## Developer Notes

### CSS Approach
- Use CSS-in-JS (styled-components, emotion) or utility-first CSS (Tailwind) for maintainability
- Define theme tokens in central config to apply the fixed Zen Green theme consistently

### State Management
- Form state: React Hook Form or similar for validation and state management
- Global state: Context or Redux for selected requester
- Server state: React Query or SWR for API data fetching and caching

### Testing
- Component tests: Test component rendering, interactions, variants
- Accessibility tests: Automated testing with jest-axe or similar
- Visual regression tests: Screenshot-based tests using Playwright and manual visual inspection

### Performance
- Lazy load screens and heavy components
- Optimize images and file uploads
- Debounce search input to reduce API calls
- Cache reference data (categories, related systems)
- Virtualize long lists if ticket count grows

---

This UI specification provides a comprehensive design system for the Requester Ticketing System. All screens, components, and interactions should follow these guidelines for a consistent, accessible, and polished user experience.
