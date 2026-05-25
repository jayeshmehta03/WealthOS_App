# Changelog

## v1.1.0 — 2026-05-26

### New Features

#### Insurance Tracker
- Full CRUD for insurance policies (add/edit/delete via modal)
- 10 policy types: Term Life, Health, Super Top-up, Critical Illness, Personal Accident, Motor, Home, Travel, ULIP, Other
- Policy card display with type badges, cover amounts, premium, frequency, dates
- Fields: Sum Assured, Annual Premium, Frequency, Policy Number, Start Date, Renewal Date, Cover Till (maturity), Nominee, Covered Members, Notes
- Summary metrics: Life Cover, Health Cover, Annual Premium total, Policy count
- Renewal alerts: 60-day warnings (urgent at ≤15 days), expired policy flagging
- Coverage adequacy check: warns if no term life insurance exists
- Persisted to `localStorage` key: `wealthos_insurance`

#### Multi-Sheet Excel Export
- Export now generates `.xlsx` (was single-tab CSV)
- Sheet 1: Holdings (Fund Name, Category, Value, Invested, Gain, XIRR, SIP, Units, NAV)
- Sheet 2: Goals (Name, Category, Priority, Target, Current, Progress %, Year, SIP)
- Sheet 3: Insurance (Name, Type, Sum Assured, Premium, Frequency, Policy #, Dates, Nominee, Members, Notes)
- Sheet 4: Goal Allocation (Holding → Goal → Allocation %)

#### Enhanced Projection Section
- Current portfolio snapshot row: Total Corpus (display), Monthly SIP (editable), Equity % (editable), Debt % (editable)
- Equity + Debt always sums to 100% — editing one auto-updates the other
- Equity classification: Index funds, Large/Mid/Small/Flexi Cap, International, Hybrid/NPS
- Debt classification: Debt, PPF, Liquid, FD, Bonds, Gold/SGB, EPF, SSY
- All projections now use inflation-adjusted (real) values — chart and summary
- What-if: changing SIP/equity/debt immediately re-runs projection

### Improvements

#### Dashboard Metrics (Fully Dynamic)
- Total Corpus: clean value only (removed estimated gains and absolute returns)
- Monthly SIP: shows current SIP + "required for all goals" below
- Projected Corpus: inflation-adjusted, target = sum of ALL goals (not just retirement)
- Portfolio XIRR: weighted across all holdings (MF + manual), with "Nifty 50: 12.2% (10Y CAGR)" benchmark
- Removed "On track! surplus" message — only shows gap when behind target

#### Goal Progress Cards
- Replaced "₹X gap" with "SIP: ₹X/mo" — shows monthly SIP required to reach goal on time
- Uses PMT formula with FV of current amount growing at assumed CAGR
- Shows "✓ On track" if current amount's growth alone reaches the target
- Shows "✓ Achieved" if fully funded

### Code Quality & Bug Fixes
- **Fixed**: `showToast()` → `toast()` — 5 broken calls that would throw ReferenceError (insurance module + export)
- **Fixed**: Cross-reference safety — `state._assumedCAGR` caches CAGR in state so dashboard/goal-progress don't read DOM inputs from unrendered sections
- **Fixed**: Removed unused variables (monthlyReturn, monthGain, ytdPct, monthsElapsed) from dashboard metrics
- **Added**: Input field validation controls:
  - Retire Year: `step=1`, `min=2026`, `max=2070` (no decimals)
  - Step-up: `step=1`, `max=30`
  - Inflation: `step=0.5`, `max=12`
  - Insurance amounts: `inputmode="numeric"`, positive-number validation on save
  - Year guard in renderProjection (rejects out-of-range values)
- **Added**: Equity/Debt input sync — editing Equity % auto-updates Debt % to 100−value and vice versa

---

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
