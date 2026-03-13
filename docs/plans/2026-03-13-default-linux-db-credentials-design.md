# Default Linux/DB Credentials Design

**Date:** 2026-03-13

**Goal:** Pre-fill the Linux SSH form and MySQL connection form with the requested default username/password values so users do not need to type them manually on first use.

## Context

The current frontend leaves the Linux SSH username/password and the MySQL username/password empty by default.

The relevant entry points are:
- `frontend/src/pages/LinuxConfigPage.jsx`
- `frontend/src/pages/DBConfigPage.jsx`

The backend already accepts whatever credentials the frontend submits, so the requested behavior can be delivered entirely in the frontend as long as the forms are initialized with the desired values.

## Approaches Considered

### 1. Update the two pages directly

Hardcode the requested defaults in each page's local state/constants.

Pros:
- Smallest immediate change
- Fast to implement

Cons:
- Duplicates credential defaults in multiple places
- Harder to test and maintain if defaults change again

### 2. Extract shared default helpers and reuse them

Move the requested default credential values and form builders into a small shared frontend module, then have both pages import those helpers.

Pros:
- Single source of truth
- Easy to cover with lightweight `node:test` tests
- Keeps page components smaller

Cons:
- Slightly more setup than direct inline edits

### 3. Add backend fallback defaults

Keep frontend defaults and also have the backend fill missing values when credentials are absent.

Pros:
- Stronger defense if a future client omits fields

Cons:
- Larger behavioral change
- Not required for the current request
- Risks coupling frontend UX defaults with server-side persistence rules

## Decision

Use approach 2.

We will keep the scope to the frontend, but avoid scattering hardcoded defaults by extracting a shared defaults module. This gives us a minimal change set with a clean test seam.

## Design

### Default values

Linux SSH:
- username: `menu`
- password: `M2ei#a$19!`

MySQL:
- username: `root`
- password: `N0mur@4$99!`

### Frontend behavior

- Linux page should initialize the SSH form with the requested username/password while preserving the existing host/IP and port behavior.
- DB config page should initialize the MySQL form with the requested username/password while preserving the existing host/IP, port, database type, and database name defaults.
- When loading a saved DB connection from the backend:
  - keep using the saved host/port/database/type values
  - prefer the saved username when present
  - fall back to the requested default username when the backend returns an empty username
  - keep password input empty when a saved encrypted password already exists, because the current UI uses `password_set` to represent that state

## Testing

- Add lightweight unit tests for the shared defaults helpers using the repo's existing `node:test` pattern.
- Verify the DB helper returns the requested MySQL defaults.
- Verify the Linux helper returns the requested SSH defaults.

## Risks

- Pre-filled credentials are visible in the frontend source, so this change intentionally trades secrecy for operator convenience. That matches the explicit request.
- Existing saved DB passwords should continue to respect the current `password_set` behavior; we should not auto-inject a visible password into the edit form after loading a saved connection.
