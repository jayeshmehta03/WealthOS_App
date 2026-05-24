# Changelog

## v1.0.0 — 2026-05-25

### Initial Release

#### Core Features
- **Holdings Table** — sortable, searchable, color-coded by category
- **Dashboard** — auto-refreshing metrics, goal progress, growth charts
- **Import Wizard** — 4-step flow (Upload → Map Columns → Validate → Confirm)
- **CAS Excel Import** — auto-detects CDSL CAS format (MF_Holdings + Demat sheets)
- **CSV Import** — generic import with auto column mapping
- **Export to CSV** — one-click portfolio download
- **localStorage Persistence** — data survives page refreshes

#### Goals Module
- Add/Edit/Delete goals with modal form
- 6 goal categories: Retirement, Education, Lifestyle, Safety Net, Investment, Other
- Priority levels: High, Medium, Low
- Progress bars with color-coded status
- Auto-generated alerts for under-funded high-priority goals

#### Allocation System
- **Auto Allocate** — smart matching based on asset class, horizon, and priority
- **Manual Edit** — full control via modal with per-fund goal assignment + % slider
- **Goal Tiles** — each goal shows:
  - Header: Target, Time Left, Tagged Amount, Future Value (12% CAGR), SIP Required, Progress
  - Fund List: name, category, value, actual %, ideal %
  - Asset Type Breakdown: Equity, Debt, Gold, US/Intl, Hybrid with ideal vs actual %
  - Rebalance Suggestions: drift-based buy/sell/hold per asset class

#### Rebalancing
- Goal-wise rebalancing page
- Ideal vs Actual per goal with drift %
- Per-fund action items (over-weight/under-weight/hold)
- Summary alerts for goals needing attention

#### Add Manual Assets
- 12 preset types: EPF, PPF, NPS Tier I/II, Physical Gold, SGB, FD, Real Estate, Savings, SSY, Crypto, Other
- Auto-fills expected return based on asset type
- Monthly contribution tracking

#### Other Sections
- Performance metrics (XIRR, benchmark, alpha)
- Projection calculator (CAGR, step-up, inflation)
- Tax Planner (LTCG, ELSS lock-in)
- Net Worth overview
- FIRE Tracker

### Technical
- Single HTML + JS architecture (no build step)
- IIFE module pattern (zero global pollution)
- Event delegation for dynamic content
- Chart.js for visualizations
- SheetJS for Excel parsing
- Responsive design (collapses sidebar on mobile)
- Toast notification system
- Debounced inputs for performance
