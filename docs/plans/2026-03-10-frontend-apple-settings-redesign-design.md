# Frontend Apple Settings Redesign Design

## Goal

Upgrade the current frontend from a collection of inconsistent admin-style pages into a unified, high-density product experience inspired by macOS System Settings.

This redesign focuses on the following goals:

- Unify the visual language across the entire frontend, not just one module.
- Preserve the current high information density and operational efficiency.
- Allow selective interaction polish without changing business workflows.
- Build a maintainable foundation through design tokens, base components, and shared page shells.

## Non-Goals

- Do not redesign business flows.
- Do not introduce highly branded visual experiments unrelated to the macOS-inspired direction.
- Do not reduce information density for forms, lists, or operations pages.
- Do not rewrite backend APIs or core business logic in the first phase.

## Design Direction

### Chosen Approach

Use a design-system-first, page-by-page migration approach:

- Create a shared token system and reusable UI primitives.
- Normalize the global shell, feedback patterns, and page structure.
- Migrate pages gradually into the new Apple-like system.

This keeps the current information architecture and business logic intact while improving visual consistency and product quality.

### Rejected Alternatives

#### Option 1: Visual Skin Only

Only replace colors, radii, buttons, and input styling without changing shared structure.

Why it was rejected:

- It can make the UI cleaner, but not truly System Settings-like.
- Pages would still feel assembled from unrelated parts.
- Maintenance would keep drifting over time.

#### Option 3: Strong Brand-Driven Rebuild

Push the redesign further with heavy glassmorphism, aggressive motion, and more expressive layouts.

Why it was rejected:

- It drifts away from the quiet macOS settings feel.
- It risks harming dense operations workflows.
- It raises implementation and regression risk.

## Product Principles

### 1. Quiet Hierarchy

The interface should feel calm, stable, and ordered. Hierarchy should come from spacing, gray scale, grouping, and subtle status treatment instead of loud colors, thick borders, or heavy cards.

### 2. Dense but Breathable

Information density should remain high, but the interface should feel easier to scan because of consistent control heights, spacing, line rhythm, and grouped structure.

### 3. One System, Many Pages

Users should feel that login pages, workspace pages, list pages, Linux/DB pages, and help pages all belong to the same product system.

### 4. Emphasis Is Earned

High-emphasis colors should only be used for important meaning:

- Blue for primary actions, selected state, and in-progress state.
- Green for success and healthy state.
- Red for danger, failure, and destructive actions.
- Orange for warnings.

Everything else should rely mostly on a controlled gray-scale system.

## Visual System

### Color Tokens

Create a shared semantic color layer instead of page-level hard-coded values:

- `bg.canvas`: page background with a very light neutral tint
- `bg.surface`: primary white surface
- `bg.surfaceMuted`: secondary muted surface
- `bg.surfaceDisabled`: disabled surface
- `border.subtle`: light separator and border color
- `text.primary`: primary text
- `text.secondary`: secondary text
- `text.tertiary`: helper text and metadata
- `text.disabled`: disabled text
- `accent.blue`: primary accent
- `accent.green`: success accent
- `accent.red`: danger accent
- `accent.orange`: warning accent

Rules:

- Do not let pages define their own unrelated blue and gray values.
- Token usage, not page-level overrides, should drive the visual system.

### Radius Tokens

Use three global corner-radius levels:

- `radius.sm = 8`
- `radius.md = 10`
- `radius.lg = 14`

Suggested usage:

- Buttons, fields, and small badges use `sm`.
- Sections, list rows, and light panels use `md`.
- Important modals and larger surfaces use `lg`.

### Spacing Tokens

Keep the spacing system compact to preserve density:

- `4 / 8 / 12 / 16 / 20 / 24`

Rules:

- All pages and components should use the same spacing scale.
- Consistent internal spacing should create the feeling of a coherent system.

### Typography

Typography should stay restrained. The important part is consistency across:

- Page titles
- Section titles
- Field labels
- Supporting text
- Metadata

The Apple-like feel should come from stable size, weight, and gray-scale usage, not dramatic typography.

### Shadow and Border

- Use very light shadows only for subtle elevation.
- Rely mostly on soft borders and separators.
- Replace heavy card styling with lighter grouped surfaces.

### Motion

Limit motion to system-level transitions:

- hover
- focus
- section expand/collapse
- toast entrance/exit
- modal entrance/exit

Keep durations in the 120ms to 220ms range.

## Interaction System

### Global Rules

- Primary actions should appear in stable locations within each page type.
- Destructive actions should follow one shared confirmation pattern.
- Loading, success, error, and empty states should share one feedback language.
- Search, filtering, tabbing, and mode switching should use consistent interaction models.

### Business Flow Constraint

It is acceptable to improve visual grouping, action placement, and feedback details, but business flow order and core user paths must not change.

## Component System

### Required Base Components

Build the following base components for the new system:

1. `PageShell`
2. `SectionGroup`
3. `Toolbar`
4. `Button`
5. `Field`
6. `SegmentedControl`
7. `InsetList`
8. `StatusBadge`
9. `Modal`
10. `Feedback`

### Component Responsibilities

#### PageShell

Provides the outer page structure, including:

- page padding
- title area
- subtitle and metadata
- top action area
- content rhythm

#### SectionGroup

Replaces the current heavy-card approach with a System Settings-like grouped container.

Use it for:

- forms
- lists
- status blocks
- action blocks
- informational sections

#### Toolbar

Standardizes the top action area for:

- back navigation
- title and subtitle
- search
- filters
- primary and secondary actions
- status summary

#### Button

Standardize these variants:

- `primary`
- `secondary`
- `tertiary`
- `danger`
- `icon`

All variants should share height, radius, disabled state, loading state, and focus behavior.

#### Field

Standardize:

- control height
- label layout
- placeholder treatment
- focus ring
- help text
- error text

Cover:

- text
- password
- number
- select
- textarea

#### SegmentedControl

Use this to replace scattered local tabs, mode switches, and source selectors.

#### InsetList

Use this for dense but calm list presentation instead of heavy card stacks or noisy tables.

Use it for:

- device lists
- config lists
- approval lists
- notification lists
- package history lists

#### StatusBadge

Unify all status tags such as:

- online/offline
- success/failure
- enabled/disabled
- pending/approved/rejected
- running/stopped

#### Modal

Unify modal structure:

- title area
- content area
- action footer
- close behavior
- destructive-confirm treatment

#### Feedback

Unify:

- toast
- empty state
- loading state
- progress state
- result message

## Page Models

### 1. Auth Pages

Pages:

- `LoginPage`
- `RegisterPage`

Requirements:

- Feel more like a welcome or system sign-in screen than a legacy admin page.
- Use restrained background treatment.
- Keep a single focused panel for the form.
- Inputs, buttons, and errors should use the shared system.

### 2. Workspace Pages

Pages:

- `WorkspacePage`
- workspace tab panels

Requirements:

- A clear top shell plus grouped content sections.
- Avoid dashboard-style rainbow cards.
- Emphasize grouped tasks and fast scanning.

### 3. Management List Pages

Pages:

- `MobileDevicesPage`
- `AdminUsersPage`
- `BorrowApprovalPage`

Requirements:

- Shared top toolbar for search, filters, and main actions.
- Main content rendered as inset lists or calm data tables.
- Unified row status and row action styling.

### 4. Configuration and Operations Pages

Pages:

- `LinuxConfigPage`
- `DBConfigPage`

Requirements:

- Calm top context area
- segmented or workflow-style grouping in the body
- high density preserved
- fewer isolated cards, more structured grouped sections

### 5. Modal and Detail Views

Pages and components:

- `ConfirmDialog`
- detail modals
- Linux and DB operation modals

Requirements:

- consistent title, body, and action layout
- consistent destructive-confirm pattern
- lighter and calmer visual weight

### 6. Help Pages

Pages:

- `HelpPage`

Requirements:

- feel like in-product documentation
- clear grouping and navigability
- consistent FAQ, code-block, and note styles

## Rollout Strategy

### Phase 1: Foundation

Build the design-system foundation:

- global tokens
- base components
- global shell
- shared feedback system

### Phase 2: Global Shell

Normalize global experience in:

- `App.css`
- page background
- text hierarchy
- toast
- confirm dialog
- base control and scrollbar styling if global

### Phase 3: First-Class Pages

Migrate first:

- `LoginPage`
- `RegisterPage`
- `WorkspacePage`
- `MobileDevicesPage`

Reason:

- highest user visibility
- best early signal for the new system

### Phase 4: Complex Operations Pages

Then migrate:

- `LinuxConfigPage`
- `DBConfigPage`
- Linux subcomponents

Reason:

- these pages have the hardest density and operations requirements
- they should move after the shared system is stable

### Phase 5: Remaining Pages

Finally migrate:

- `AdminUsersPage`
- `BorrowApprovalPage`
- `ProfilePage`
- `HelpPage`
- remaining secondary pages and modals

## Initial Implementation Targets

Suggested first targets:

- `frontend/src/App.css`
- `frontend/src/components/ConfirmDialog.jsx`
- `frontend/src/components/ToastContainer.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/RegisterPage.jsx`
- `frontend/src/pages/WorkspacePage.jsx`
- `frontend/src/pages/MobileDevicesPage.jsx`
- `frontend/src/pages/LinuxConfigPage.jsx`
- `frontend/src/pages/DBConfigPage.jsx`

## Risks

### 1. Inline Style Fragmentation

Many pages define their own local `const styles`. If migration happens page by page without a shared system first, the UI will drift again.

Mitigation:

- create tokens first
- create shared components second
- migrate pages last

### 2. Over-Stylization

Too much glass, motion, or brand-expression would weaken the System Settings direction and hurt dense operational workflows.

Mitigation:

- keep the system restrained
- limit accent usage
- limit motion

### 3. Density Regression

A common failure mode is making the UI look more premium by increasing whitespace too aggressively and reducing information per screen.

Mitigation:

- treat density as a hard requirement
- control control-height and section spacing via tokens

## Testing and Validation

During implementation, verify:

- visual hierarchy is consistent across pages
- key task paths do not change
- dense pages remain easy to scan and operate
- modals, fields, status, and feedback feel unified
- desktop and common laptop widths still support full workflows

## Design Summary

This redesign is not a one-page reskin. It is a full frontend design-system upgrade toward a high-density product experience inspired by macOS System Settings.

The final result should feel:

- unified
- restrained
- dense without being crowded
- more like a calm product system than a generic admin dashboard
- visually improved without changing business workflows
