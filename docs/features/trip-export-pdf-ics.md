# Trip Itinerary PDF & ICS Export — Specification & Implementation Plan

`STATUS: IMPLEMENTED`

- **Owner Service**: `apps/web/tripsense`
- **Affected Components**: `apps/web/tripsense`
- **Date**: 2026-10-12
- **Related Plans**: `feature-priority-roadmap.md` (Item B04), `manage-trip-itinerary/index.md`

---

## 1. Goal & Requirements

### 1.1 Problem Statement
Travelers planning itineraries on TripSense need to export their schedules to carry with them offline and integrate into personal calendar apps (Google Calendar, Apple iCal, Microsoft Outlook):
1. **iCalendar (.ics)**: Standard RFC 5545 calendar file containing master trip event and individual day activity events with time slots, location names, and notes.
2. **Printable View / PDF**: Clean, high-resolution printable layout using browser native `@media print` engine (`window.print()`) that hides web chrome (navbars, sidebar, chat widgets, action buttons, maps) and formats day-by-day itineraries cleanly on A4 paper with full Vietnamese font support.
3. Accessible from both private trip management (`TripDetailScreen`) and public shared trips (`SharedTripDetailView`).

### 1.2 In-Scope & Out-of-Scope
- **In-Scope**:
  - RFC 5545 compliant `.ics` generator and client-side download utility with zero external dependencies.
  - Interactive preview and print modal `PrintItineraryDialog`.
  - Export menu integration in `TripDetailScreen` and `SharedTripDetailView`.
  - 100% EN/VI translations.
- **Out-of-Scope**:
  - Server-side PDF rendering daemon (headless Chrome/Puppeteer microservice). Browser-native vector print covers this with zero backend overhead.

---

## 2. Architecture

- Client-side pure utility `export-itinerary.ts`.
- Dialog modal with printable media stylesheet in `PrintItineraryDialog.tsx`.

---

## 3. Verification Evidence

- **iCalendar (.ics) Generator**:
  - RFC 5545 compliant syntax with CRLF, timezone, master VEVENT, and day-by-day activity VEVENTs.
  - Unit tests in `export-itinerary.test.ts`.
- **Print / PDF Preview Component**:
  - `PrintItineraryDialog.tsx` with clean responsive layout, print-specific styles (`break-inside-avoid`), and download action.
  - Component tests in `print-itinerary-dialog.test.tsx`.
- **Integrations**:
  - `TripDetailScreen.tsx`: Export button and dropdown menu item.
  - `SharedTripDetailView.tsx`: One-click `.ics` download button on public frozen itineraries.
- **Localization**:
  - Full EN/VI parity in `en.json` and `vi.json`.

