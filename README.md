# WealthOS — Personal Finance Dashboard

A single-page financial planning tool for Indian investors. Tracks mutual fund holdings, demat assets, manual assets (PF/NPS/PPF/Gold), goal-based planning, allocation analysis, and rebalancing recommendations.

## 📁 Project Structure

```
wealthos/
├── wealthos_dashboard.html   # HTML structure + CSS (913 lines)
├── wealthos_app.js           # All application logic (2303 lines)
├── README.md                 # This file
├── ARCHITECTURE.md           # Detailed architecture & module docs
└── sample_portfolio.csv      # Sample CSV for testing import
```

## 🚀 Quick Start

1. Open `wealthos_dashboard.html` in any modern browser (Chrome/Edge/Firefox)
2. No server required — runs entirely client-side
3. Data persists via `localStorage`

## 🔗 CDN Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [Chart.js](https://www.chartjs.org/) | 4.4.1 | Donut charts, growth projections |
| [SheetJS (xlsx)](https://sheetjs.com/) | 0.20.1 | Excel file parsing for CAS import |
| [Tabler Icons](https://tabler.io/icons) | 2.44.0 | Icon font (200+ icons used) |
| [Google Fonts](https://fonts.google.com/) | — | Syne (display), DM Mono (monospace) |

## ✨ Features

### Holdings Management
- **Import from CAS Excel** — auto-detects CDSL CAS format (MF_Holdings + Demat sheets)
- **CSV/XLSX import** — generic import with 4-step wizard (Upload → Map → Validate → Confirm)
- **Add Manual Assets** — EPF, PPF, NPS, Physical Gold, SGB, FD, Real Estate, Savings, SSY, Crypto
- **Export to CSV** — download portfolio as spreadsheet
- **Live search** — filter holdings by name

### Goal-Based Planning
- **CRUD goals** — add, edit, delete with priority levels (High/Medium/Low)
- **Goal categories** — Retirement, Education, Lifestyle, Safety Net, Investment, Other
- **Progress tracking** — funded %, gap amount, progress bars
- **SIP calculator** — computes monthly SIP needed to reach goal on time (12% CAGR assumed)

### Allocation & Rebalancing
- **Auto Allocate** — smart mapping of holdings to goals based on:
  - Asset class (equity → long-term, debt → short-term, NPS → retirement)
  - Goal priority (high-priority goals get allocated first)
  - Time horizon matching
- **Manual Edit** — override any allocation via modal editor
- **Goal-wise tiles** showing:
  - Fund list (name, category, value, actual %, ideal %)
  - Asset-type breakdown (Equity, Debt, Gold, US/Intl, Hybrid)
  - Ideal vs Actual % based on time horizon
  - Drift detection with color coding
  - Rebalance suggestions (buy/sell/hold per asset class)
- **Ideal allocation targets** (time-horizon based):
  | Horizon | Equity | Debt | Gold | US/Intl | Hybrid |
  |---------|--------|------|------|---------|--------|
  | Long (>7yr) | 60% | 15% | 10% | 10% | 5% |
  | Medium (3-7yr) | 40% | 30% | 10% | 10% | 10% |
  | Short (<3yr) | 10% | 60% | 10% | 5% | 15% |
  | Ongoing | 20% | 50% | 10% | 5% | 15% |

### Dashboard
- **Auto-refreshes** on every navigation — always shows current data
- **Metrics** — Total Corpus, Monthly SIP, Portfolio XIRR, Holdings count
- **Goal Progress** — dynamic bars for top 5 goals by priority
- **Growth projection** — Bull/Base/Bear scenarios with Chart.js
- **Asset allocation donut** — visual portfolio split

### Other Sections
- **Performance** — XIRR, benchmark CAGR, alpha
- **Projection** — future value calculator with SIP step-up
- **Tax Planner** — LTCG tracking, ELSS lock-in calendar
- **Net Worth** — total assets view
- **FIRE Tracker** — financial independence calculator

## 💾 Data Storage

All data persists in browser `localStorage`:

| Key | Contents |
|-----|----------|
| `wealthos_portfolio` | Holdings array |
| `wealthos_goals` | Goals array |
| `wealthos_goal_fund_map` | Goal → Fund allocation mapping |

To reset: `localStorage.clear()` in browser console, then refresh.

## 📥 CAS Import Format

The tool auto-detects CDSL CAS Excel files with these sheets:

### Sheet: `Summary`
| Row | Value |
|-----|-------|
| CAS Type | CDSL |
| Period | 2025-04-01 to 2026-03-31 |
| Total Schemes | 17 |
| Total Invested | 4588784.86 |
| Current Valuation | 5477234.21 |

### Sheet: `MF_Holdings`
| Column | Description |
|--------|-------------|
| Scheme Name | Full fund name |
| Type | LIQUID, FLEXI_CAP, INDEX, ELSS, SMALL_CAP, HYBRID, ARBITRAGE |
| Invested (₹) | Total cost |
| Valuation (₹) | Current market value |
| P/L % | Returns percentage |
| Units | Quantity held |
| NAV | Net asset value per unit |

### Sheet: `Demat`
| Column | Description |
|--------|-------------|
| Security | ETF/Bond/SGB name |
| Units | Quantity |
| Value (₹) | Current market value |

## 🛠️ Development

### Design System
- **Dark theme** — `#0d0d0d` background, `#f2ede8` text
- **Accent** — `#c8f97a` (lime green)
- **Semantic colors** — Blue (info), Amber (warn), Red (error), Teal (success), Purple (accent)
- **Fonts** — Syne (headings), DM Mono (numbers), System (body)
- **Spacing** — 6/10/14px border-radius variants

### Adding a New Section
1. Add nav item in HTML: `<button class="nav-item" data-section="mysection">...</button>`
2. Add section div: `<div id="section-mysection" class="section">...</div>`
3. Add to `SECTION_TITLES` object in JS
4. Add render trigger in `showSection()` if needed

### Adding a New Asset Type
Add to `ASSET_PRESETS` array in `wealthos_app.js`:
```js
{ label: 'My Asset', category: 'Category · SubType', defaultXirr: 8.0 }
```

## 📋 Browser Support

- Chrome 90+ ✓
- Edge 90+ ✓
- Firefox 88+ ✓
- Safari 14+ ✓
- No IE11 support (uses ES2020 features)

## 📄 License

Personal project — not licensed for redistribution.
