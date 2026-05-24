# WealthOS — Architecture & Module Reference

## Overview

WealthOS is a client-side SPA (Single Page Application) built as two files:

- **`wealthos_dashboard.html`** — Static HTML structure + CSS. Zero inline JavaScript.
- **`wealthos_app.js`** — All application logic in an IIFE (Immediately Invoked Function Expression) to prevent global pollution.

```
┌─────────────────────────────────────────────────────────────┐
│  wealthos_dashboard.html                                     │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │   Sidebar   │  │            Main Content              │  │
│  │   (nav)     │  │  ┌──────────────────────────────┐    │  │
│  │             │  │  │  Section: Dashboard           │    │  │
│  │  Dashboard  │  │  │  Section: Holdings            │    │  │
│  │  Holdings   │  │  │  Section: Allocation          │    │  │
│  │  Allocation │  │  │  Section: Goals               │    │  │
│  │  Goals      │  │  │  Section: Rebalancing         │    │  │
│  │  Projection │  │  │  Section: Projection          │    │  │
│  │  ...        │  │  │  Section: ...                 │    │  │
│  │             │  │  └──────────────────────────────┘    │  │
│  └─────────────┘  └──────────────────────────────────────┘  │
│                                                              │
│  Modals: goalModal, allocModal, editAllocModal, assetModal   │
│  Toast container                                             │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  wealthos_app.js  (IIFE — zero globals)                      │
│                                                              │
│  State: { holdings[], goals[], goalFundMap{}, ... }          │
│  Charts: { allocDonut, growthChart, projChart }              │
│                                                              │
│  Modules (17 sections):                                      │
│    DATA → UTILITIES → DOM → TOAST → IMPORT → EXPORT →       │
│    CHARTS → HOLDINGS → NAVIGATION → STORAGE → GOALS →       │
│    AUTO_ALLOCATE → ALLOCATION_VIEW → EDIT_ALLOC →            │
│    ADD_ASSET → REBALANCING → INIT                            │
└─────────────────────────────────────────────────────────────┘
```

## State Management

All application state lives in a single `state` object:

```js
const state = {
  holdings: [],       // Array of holding objects
  goals: [],          // Array of goal objects
  goalFundMap: {},    // { goalId: [{ holdingIdx, name, category, holdingValue, allocatedValue, pct }] }
  currentScenario: 'bull',  // 'bull' | 'base' | 'bear'
  importStep: 1,      // 1-4 wizard step
  importData: null,    // Parsed rows during import
  columnMapping: {},   // Column header → field mapping
};
```

### Holding Object
```js
{
  name: 'UTI Nifty 50 Index',
  category: 'Large Cap · Index',  // Used by getAssetClass()
  value: 512400,                   // Current market value (₹)
  invested: 390000,                // Total cost (₹)
  xirr: 13.2,                     // Annualized return (%)
  sip: 15000,                      // Monthly SIP (₹)
  color: '#4f9cf9',                // Chart color
}
```

### Goal Object
```js
{
  id: 'g1',
  name: 'Retirement Corpus',
  targetAmount: 108000000,         // Target (₹)
  currentAmount: 5520000,          // Currently allocated (₹)
  targetYear: 2043,                // null for ongoing goals
  monthlySIP: 45000,               // Dedicated SIP (₹)
  priority: 'medium',             // 'high' | 'medium' | 'low'
  color: '#4f9cf9',
  category: 'Retirement',         // Retirement | Education | Lifestyle | Safety Net | Investment | Other
}
```

## Module Reference

### DATA & STATE
- `DEFAULT_HOLDINGS[]` — 7 default mutual fund holdings
- `DEFAULT_GOALS[]` — 6 default financial goals
- `ASSET_PRESETS[]` — 12 manual asset types (EPF, PPF, NPS, Gold, etc.)
- `STORAGE_KEY`, `GOALS_STORAGE_KEY` — localStorage keys

### UTILITIES
| Function | Purpose |
|----------|---------|
| `fmtINR(num)` | Format as Indian currency (₹1.2L, ₹5.4Cr) |
| `fmtNum(num)` | Format with Indian comma separators |
| `parseNum(val)` | Parse string/number (handles commas, ₹ symbol) |
| `xirrClass(xirr)` | Returns CSS class for XIRR coloring |
| `debounce(fn, ms)` | Standard debounce utility |
| `computeCorpus(principal, sip, cagr, years)` | Future value calculator |

### DOM HELPERS
| Function | Purpose |
|----------|---------|
| `$(sel)` | `document.querySelector` shorthand |
| `$$(sel)` | `document.querySelectorAll` shorthand |
| `el(tag, attrs, children)` | Create DOM element |

### TOAST NOTIFICATIONS
| Function | Purpose |
|----------|---------|
| `toast(message, type, duration)` | Show toast (type: 'success'/'error'/'info') |

### FILE IMPORT
| Function | Purpose |
|----------|---------|
| `parseCSV(text)` | Parse CSV string → array of objects |
| `parseExcel(buffer)` | Parse Excel → detects CAS format or generic |
| `parseCASExcel(workbook)` | Parse CDSL CAS multi-sheet format |
| `mapCASType(type)` | Convert CAS type codes → readable categories |
| `classifyDematSecurity(name)` | Classify demat securities by name patterns |
| `autoMapColumns(headers)` | Auto-detect column mapping from header names |
| `handleFileUpload(file)` | Main entry point for file processing |
| `setWizardStep(step)` | Update wizard UI (1-4) |
| `renderColumnMapping(headers, rows)` | Show mapping UI in step 2 |
| `importAndApply()` | Apply mapped data to state.holdings |
| `downloadTemplate()` | Generate sample CSV for download |

### EXPORT
| Function | Purpose |
|----------|---------|
| `exportToCSV()` | Export holdings as CSV download |

### CHARTS
| Function | Purpose |
|----------|---------|
| `renderAllocDonut()` | Dashboard allocation pie chart |
| `renderGrowthChart()` | Dashboard growth projection line chart |
| `renderProjection()` | Projection section detailed calculator |

### HOLDINGS RENDERING
| Function | Purpose |
|----------|---------|
| `renderHoldings()` | Render holdings table rows |
| `updateDashboardMetrics()` | Refresh all dashboard numbers + charts |
| `renderDashboardGoalProgress()` | Render goal bars on dashboard |

### NAVIGATION
| Function | Purpose |
|----------|---------|
| `showSection(id)` | Switch visible section, trigger renders |
| `SECTION_TITLES{}` | Map of section ID → display title |

### LOCAL STORAGE
| Function | Purpose |
|----------|---------|
| `saveToStorage()` | Persist holdings + goals to localStorage |
| `loadFromStorage()` | Load holdings from localStorage |
| `loadGoalsFromStorage()` | Load goals from localStorage |

### GOALS MODULE
| Function | Purpose |
|----------|---------|
| `generateGoalId()` | Create unique goal ID |
| `renderGoals()` | Render goal cards in Goals section |
| `openGoalModal(goal)` | Open add/edit modal |
| `closeGoalModal()` | Close goal modal |
| `saveGoal()` | Save new or updated goal |
| `deleteGoal(id)` | Delete with confirmation |

### AUTO ALLOCATE
| Function | Purpose |
|----------|---------|
| `getAssetClass(holding)` | Classify: equity/debt/gold/international/hybrid |
| `getGoalHorizon(goal)` | Classify: short/medium/long/ongoing |
| `computeAutoAllocation()` | Smart matching algorithm |
| `openAllocModal()` | Open auto-allocate modal |
| `updateAllocSummary()` | Live summary of allocation totals |
| `applyAllocation()` | Commit allocation + save mapping |
| `closeAllocModal()` | Close modal |

### GOAL-WISE ALLOCATION VIEW
| Function | Purpose |
|----------|---------|
| `getGoalFundMapping()` | Retrieve saved goal→fund map |
| `renderGoalAllocation()` | Render allocation tiles (fund list + asset types + rebal) |

**Ideal allocation targets** (defined in `IDEAL_ALLOC`):
```js
{
  long:    { equity: 60, debt: 15, gold: 10, international: 10, hybrid: 5 },
  medium:  { equity: 40, debt: 30, gold: 10, international: 10, hybrid: 10 },
  short:   { equity: 10, debt: 60, gold: 10, international: 5, hybrid: 15 },
  ongoing: { equity: 20, debt: 50, gold: 10, international: 5, hybrid: 15 },
}
```

### EDIT ALLOCATION (MANUAL)
| Function | Purpose |
|----------|---------|
| `openEditAllocModal()` | Open editor with current assignments |
| `saveEditAllocation()` | Save manual changes |
| `closeEditAllocModal()` | Close modal |

### ADD MANUAL ASSET
| Function | Purpose |
|----------|---------|
| `openAssetModal()` | Open form with preset selector |
| `saveAsset()` | Add to holdings + save |
| `closeAssetModal()` | Close modal |

### GOAL-WISE REBALANCING
| Function | Purpose |
|----------|---------|
| `renderRebalancing()` | Render rebalancing tiles with actions |

### INIT
| Function | Purpose |
|----------|---------|
| `init()` | Bootstrap: load data, render, attach events |
| `initGoals()` | Attach all goal/allocation event listeners |

## Event Flow

```
Page Load
  → init()
    → loadFromStorage() + loadGoalsFromStorage()
    → renderHoldings()
    → renderGoals()
    → initGoals() (attaches all event listeners)
    → renderAllocDonut() + renderGrowthChart()
    → updateDashboardMetrics() → renderDashboardGoalProgress()
    → showSection('dashboard')

Import CAS File
  → handleFileUpload(file)
    → parseExcel(buffer)
      → detects CAS → parseCASExcel(workbook)
        → reads MF_Holdings sheet → mapCASType()
        → reads Demat sheet → classifyDematSecurity()
    → autoMapColumns(headers)
    → setWizardStep(2) → renderColumnMapping()
    → [user confirms] → importAndApply()
      → state.holdings = newHoldings
      → saveToStorage() + renderHoldings() + updateDashboardMetrics()

Auto Allocate
  → openAllocModal()
    → computeAutoAllocation() (smart matching)
    → render table with dropdowns
  → [user clicks Apply]
    → applyAllocation()
      → updates state.goals[].currentAmount
      → saves goalFundMap to localStorage
      → renderGoals() + renderGoalAllocation()

Navigate to Section
  → showSection(id)
    → hide all .section, show #section-{id}
    → triggers: renderGoalAllocation / renderRebalancing / updateDashboardMetrics / etc.
```

## CSS Architecture

All styles are in `<style>` within the HTML file. Key conventions:

- **BEM-lite** naming: `.goal-tile-header`, `.goal-tile-metric-label`
- **CSS Variables** for theming (`:root` block)
- **Utility classes**: `.accent`, `.warn`, `.teal` for color states
- **Responsive**: `@media (max-width: 900px)` — hides sidebar, stacks columns

### Key CSS Classes
| Class | Purpose |
|-------|---------|
| `.layout` | 2-column grid (sidebar + main) |
| `.section` | Page sections (display:none, .active → display:block) |
| `.card` | Standard content card |
| `.metric-card` | Dashboard metric tile |
| `.goal-tile` | Allocation/rebalancing goal tile |
| `.goal-tile-fund-row` | Row in fund/asset list |
| `.modal-overlay` | Full-screen modal backdrop |
| `.btn` / `.btn-accent` | Button styles |
| `.alert-*` | Alert banners (warn/info/success) |

## Known Limitations

1. **No backend** — all data is in localStorage; clearing browser data loses everything
2. **No real XIRR calculation** — uses P/L % from CAS as approximation
3. **Single-user** — no auth, no sync across devices
4. **Static ideal allocations** — hardcoded targets (configurable in code but not UI)
5. **No transaction history** — only current snapshot, no historical tracking
6. **Chart.js hidden section** — charts must render after section becomes visible (setTimeout pattern)

## Future Enhancements (Roadmap)

- [ ] Transaction-level import from CAS PDF
- [ ] Real XIRR computation from transaction dates
- [ ] Custom ideal allocation targets per goal (UI editor)
- [ ] Data export/import as JSON for backup
- [ ] Multi-device sync via cloud storage
- [ ] Mutual fund NAV API integration for live updates
- [ ] Tax harvesting optimizer
- [ ] Insurance gap analysis
