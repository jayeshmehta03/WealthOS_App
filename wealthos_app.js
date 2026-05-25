/**
 * WealthOS — Personal Finance Dashboard
 * Main application logic
 * 
 * Architecture: IIFE module pattern to avoid global pollution.
 * Sections: Data & State → Utilities → DOM Helpers → Toast →
 *           File Import → Export → Charts → Navigation → LocalStorage → Init
 */
;(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────
  // ─── DATA & STATE ───────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  const STORAGE_KEY = 'wealthos_portfolio';

  /** @type {Array<Object>} Default holdings data */
  const DEFAULT_HOLDINGS = [
    { name: 'UTI Nifty 50 Index', category: 'Large Cap · Index', value: 512400, invested: 390000, xirr: 13.2, sip: 15000, color: '#4f9cf9' },
    { name: 'Parag Parikh Flexi Cap', category: 'Flexi Cap · Active', value: 684200, invested: 420000, xirr: 18.4, sip: 20000, color: '#a78bfa' },
    { name: 'HDFC Nifty Midcap 150', category: 'Mid Cap · Index', value: 342600, invested: 216000, xirr: 16.1, sip: 12000, color: '#52c89c' },
    { name: 'Invesco India Smallcap', category: 'Small Cap · Active', value: 208400, invested: 108000, xirr: 22.3, sip: 9000, color: '#f97373' },
    { name: 'Nippon Smallcap 250 Index', category: 'Small Cap · Index', value: 138800, invested: 72000, xirr: 19.7, sip: 6000, color: '#f5a623' },
    { name: 'PPF', category: 'Debt · PPF', value: 496200, invested: 450000, xirr: 7.1, sip: 12500, color: '#5a5550' },
    { name: 'NPS (Tier I)', category: 'Debt / Equity · NPS', value: 357400, invested: 300000, xirr: 10.4, sip: 10000, color: '#5a5550' },
  ];

  /** @type {Array<Object>} Default goals data */
  const DEFAULT_GOALS = [
    { id: 'g1', name: 'Retirement Corpus', targetAmount: 108000000, currentAmount: 5520000, targetYear: 2043, monthlySIP: 45000, priority: 'medium', color: '#4f9cf9', category: 'Retirement' },
    { id: 'g2', name: 'Child Education', targetAmount: 7100000, currentAmount: 910000, targetYear: 2035, monthlySIP: 8000, priority: 'high', color: '#f5a623', category: 'Education' },
    { id: 'g3', name: 'Emergency Fund', targetAmount: 400000, currentAmount: 240000, targetYear: null, monthlySIP: 10000, priority: 'low', color: '#52c89c', category: 'Safety Net' },
    { id: 'g4', name: 'Home Purchase', targetAmount: 4000000, currentAmount: 170000, targetYear: 2031, monthlySIP: 0, priority: 'high', color: '#a78bfa', category: 'Lifestyle' },
    { id: 'g5', name: 'Car Upgrade', targetAmount: 1500000, currentAmount: 320000, targetYear: 2028, monthlySIP: 15000, priority: 'low', color: '#f97373', category: 'Lifestyle' },
    { id: 'g6', name: 'Vacation Fund', targetAmount: 500000, currentAmount: 125000, targetYear: 2027, monthlySIP: 12000, priority: 'low', color: '#52c89c', category: 'Lifestyle' },
  ];

  const GOALS_STORAGE_KEY = 'wealthos_goals';

  /** Application state */
  const state = {
    holdings: [],
    goals: [],
    insurance: [],
    goalFundMap: {},
    currentScenario: 'bull',
    importStep: 1,
    importData: null,
    columnMapping: {},
  };

  /** Chart.js instances */
  const charts = {
    allocDonut: null,
    growthChart: null,
    projChart: null,
  };

  // ─────────────────────────────────────────────────────────────────
  // ─── UTILITIES ──────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /**
   * Format number as Indian currency string
   * @param {number} n - Value in rupees
   * @returns {string} Formatted string like "₹68.4L" or "₹9.2 Cr"
   */
  function fmtINR(n) {
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(1) + ' Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  /**
   * Format number with commas (Indian style)
   * @param {number} n 
   * @returns {string}
   */
  function fmtNum(n) {
    return n.toLocaleString('en-IN');
  }

  /**
   * Safely parse a numeric value from string
   * @param {string|number} val 
   * @returns {number}
   */
  function parseNum(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(String(val).replace(/[₹,%\s]/g, '').replace(/,/g, '')) || 0;
  }

  /**
   * Get XIRR display class based on value
   * @param {number} xirr 
   * @returns {string}
   */
  function xirrClass(xirr) {
    if (xirr >= 15) return 'xirr-high';
    if (xirr >= 10) return 'xirr-mid';
    return 'xirr-low';
  }

  /**
   * Debounce function calls
   * @param {Function} fn 
   * @param {number} delay 
   * @returns {Function}
   */
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Compute corpus projection over N years
   * @param {number} cagr - Annual return %
   * @param {number} stepup - Annual SIP step-up %
   * @param {number} years - Total years
   * @param {number} startCorpus - Current corpus value
   * @param {number} monthlySIP - Monthly SIP amount
   * @param {number} inflation - Inflation rate %
   * @returns {{labels: number[], nominalData: number[], realData: number[], investedData: number[]}}
   */
  function computeCorpus(cagr, stepup, years, startCorpus, monthlySIP, inflation) {
    const labels = [], nominalData = [], realData = [], investedData = [];
    let corpus = startCorpus, sip = monthlySIP, totalInvested = startCorpus;

    for (let y = 0; y <= years; y++) {
      labels.push(2026 + y);
      const deflator = Math.pow(1 + inflation / 100, y);
      nominalData.push(Math.round(corpus));
      realData.push(Math.round(corpus / deflator));
      investedData.push(Math.round(totalInvested));
      if (y < years) {
        if (y > 0) sip = sip * (1 + stepup / 100);
        corpus = corpus * (1 + cagr / 100) + sip * 12 * (1 + cagr / 200);
        totalInvested += sip * 12;
      }
    }
    return { labels, nominalData, realData, investedData };
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── DOM HELPERS ────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /** Shortcut for querySelector */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /**
   * Create an HTML element with attributes and children
   * @param {string} tag 
   * @param {Object} attrs 
   * @param {...(string|Node)} children 
   * @returns {HTMLElement}
   */
  function el(tag, attrs = {}, ...children) {
    const elem = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style' && typeof v === 'object') {
        Object.assign(elem.style, v);
      } else if (k.startsWith('on')) {
        elem.addEventListener(k.slice(2).toLowerCase(), v);
      } else {
        elem.setAttribute(k, v);
      }
    });
    children.forEach(c => {
      if (typeof c === 'string') elem.innerHTML += c;
      else if (c) elem.appendChild(c);
    });
    return elem;
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── TOAST NOTIFICATIONS ────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /**
   * Show a toast notification
   * @param {string} message - Notification text
   * @param {'success'|'error'|'info'} type - Toast type
   * @param {number} duration - Duration in ms (default 4000)
   */
  function toast(message, type = 'info', duration = 4000) {
    const container = $('#toastContainer');
    const icons = { success: 'ti-check', error: 'ti-x', info: 'ti-info-circle' };
    const toastEl = el('div', { class: `toast toast-${type}` },
      `<i class="ti ${icons[type]}"></i><span>${message}</span>`
    );
    container.appendChild(toastEl);
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(30px)';
      toastEl.style.transition = 'all 0.3s ease';
      setTimeout(() => toastEl.remove(), 300);
    }, duration);
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── FILE IMPORT (CSV / XLSX) ───────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /**
   * Parse CSV text into array of objects
   * @param {string} text - Raw CSV text
   * @returns {Array<Object>}
   */
  function parseCSV(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) throw new Error('CSV must have at least a header and one data row');

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle quoted fields
      const values = [];
      let current = '', inQuote = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { values.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      values.push(current.trim());

      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      rows.push(row);
    }
    return rows;
  }

  /**
   * Parse Excel file using SheetJS
   * @param {ArrayBuffer} buffer - File content
   * @returns {Array<Object>}
   */
  function parseExcel(buffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS library not loaded. Please refresh the page.');
    }
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Detect CAS format (has Summary, MF_Holdings, Demat sheets)
    const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());
    const isCAS = sheetNames.includes('mf_holdings') || sheetNames.includes('summary');

    if (isCAS) {
      return parseCASExcel(workbook);
    }

    // Default: read first sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    if (rows.length === 0) throw new Error('Excel file is empty or has no readable data');
    return rows;
  }

  /**
   * Parse CAS-format Excel (from CAS-to-Excel converter)
   * Merges MF_Holdings + Demat sheets into a unified holdings format
   * @param {Object} workbook - SheetJS workbook
   * @returns {Array<Object>} Normalized rows
   */
  function parseCASExcel(workbook) {
    const holdings = [];

    // Parse MF_Holdings sheet
    const mfSheet = workbook.Sheets['MF_Holdings'] || workbook.Sheets['mf_holdings'];
    if (mfSheet) {
      const mfRows = XLSX.utils.sheet_to_json(mfSheet, { defval: '' });
      mfRows.forEach(row => {
        const name = row['Scheme Name'] || row['scheme name'] || '';
        const value = parseFloat(row['Valuation (₹)'] || row['Valuation'] || row['Current Value'] || 0);
        const invested = parseFloat(row['Invested (₹)'] || row['Invested'] || row['Cost'] || 0);
        const pl = parseFloat(row['P/L %'] || row['Returns %'] || 0);
        const type = row['Type'] || row['type'] || row['Category'] || 'Equity';
        const units = parseFloat(row['Units'] || row['units'] || 0);
        const nav = parseFloat(row['NAV'] || row['nav'] || 0);

        if (name && value > 0) {
          holdings.push({
            'Fund Name': name,
            'Current Value': value,
            'Invested': invested,
            'Category': mapCASType(type),
            'XIRR %': pl,
            'Units': units,
            'NAV': nav,
            'Monthly SIP': 0,
            '_source': 'MF',
          });
        }
      });
    }

    // Parse Demat sheet
    const dematSheet = workbook.Sheets['Demat'] || workbook.Sheets['demat'];
    if (dematSheet) {
      const dematRows = XLSX.utils.sheet_to_json(dematSheet, { defval: '' });
      dematRows.forEach(row => {
        const name = row['Security'] || row['security'] || row['ISIN'] || '';
        const value = parseFloat(row['Value (₹)'] || row['Value'] || row['Market Value'] || 0);
        const units = parseFloat(row['Units'] || row['units'] || row['Quantity'] || 0);

        if (name && value > 0) {
          holdings.push({
            'Fund Name': name,
            'Current Value': value,
            'Invested': value, // Demat doesn't always have cost
            'Category': classifyDematSecurity(name),
            'XIRR %': 0,
            'Units': units,
            'NAV': units > 0 ? (value / units) : 0,
            'Monthly SIP': 0,
            '_source': 'Demat',
          });
        }
      });
    }

    if (holdings.length === 0) throw new Error('No holdings found in CAS file');
    return holdings;
  }

  /**
   * Map CAS Type codes to human-readable categories
   * @param {string} type - CAS type like LIQUID, FLEXI_CAP, INDEX, etc.
   * @returns {string} Readable category
   */
  function mapCASType(type) {
    const t = (type || '').toUpperCase().trim();
    const map = {
      'LIQUID': 'Debt · Liquid',
      'FLEXI_CAP': 'Flexi Cap · Active',
      'ARBITRAGE': 'Hybrid · Arbitrage',
      'INDEX': 'Index Fund',
      'ELSS': 'Equity · ELSS',
      'SMALL_CAP': 'Small Cap · Active',
      'HYBRID': 'Hybrid · Dynamic',
      'LARGE_CAP': 'Large Cap · Active',
      'MID_CAP': 'Mid Cap · Active',
      'DEBT': 'Debt · Fund',
      'GILT': 'Debt · Gilt',
      'MONEY_MARKET': 'Debt · Money Market',
      'BALANCED': 'Hybrid · Balanced',
    };
    return map[t] || (t ? t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : 'Equity');
  }

  /**
   * Classify a demat security by its name
   * @param {string} name - Security name
   * @returns {string} Category
   */
  function classifyDematSecurity(name) {
    const n = (name || '').toUpperCase();
    if (n.includes('GOLD') || n.includes('SGB') || n.includes('SOVEREIGN GOLD')) return 'Gold · ETF/SGB';
    if (n.includes('BOND') || n.includes('BHARAT BOND') || n.includes('GSEC')) return 'Debt · Bond ETF';
    if (n.includes('NASDAQ') || n.includes('S&P') || n.includes('INTERNATIONAL')) return 'Equity · International';
    if (n.includes('NIFTY NEXT 50') || n.includes('JUNIOR')) return 'Equity · Nifty Next 50';
    if (n.includes('NIFTY 50') || n.includes('NIFTYBEES')) return 'Equity · Nifty 50 ETF';
    if (n.includes('MIDCAP') || n.includes('MID CAP')) return 'Equity · Mid Cap ETF';
    if (n.includes('SMALLCAP') || n.includes('SMALL CAP')) return 'Equity · Small Cap ETF';
    if (n.includes('ETF') || n.includes('BEES')) return 'Equity · ETF';
    if (n.includes('REIT') || n.includes('INVIT')) return 'Real Estate · REIT';
    return 'Equity · Demat';
  }

  /**
   * Auto-detect column mapping from headers
   * @param {string[]} headers - Column headers from file
   * @returns {Object} Mapping of required fields to header names
   */
  function autoMapColumns(headers) {
    const mapping = { name: '', value: '', invested: '', sip: '', category: '', xirr: '' };
    const lower = headers.map(h => h.toLowerCase().trim());

    // Name field
    const namePatterns = ['fund name', 'name', 'fund', 'scheme', 'scheme name', 'instrument'];
    mapping.name = headers[lower.findIndex(h => namePatterns.some(p => h.includes(p)))] || headers[0];

    // Value field
    const valuePatterns = ['current value', 'valuation', 'market value', 'value', 'current', 'nav value', 'amount'];
    mapping.value = headers[lower.findIndex(h => valuePatterns.some(p => h.includes(p)))] || '';

    // Invested
    const investedPatterns = ['invested', 'cost', 'purchase', 'buy value', 'investment'];
    mapping.invested = headers[lower.findIndex(h => investedPatterns.some(p => h.includes(p)))] || '';

    // SIP
    const sipPatterns = ['sip', 'monthly', 'monthly sip', 'sip amount'];
    mapping.sip = headers[lower.findIndex(h => sipPatterns.some(p => h.includes(p)))] || '';

    // Category
    const catPatterns = ['category', 'cat', 'type', 'fund type', 'asset class'];
    mapping.category = headers[lower.findIndex(h => catPatterns.some(p => h.includes(p)))] || '';

    // XIRR
    const xirrPatterns = ['xirr', 'return', 'returns', 'cagr', 'annualized'];
    mapping.xirr = headers[lower.findIndex(h => xirrPatterns.some(p => h.includes(p)))] || '';

    return mapping;
  }

  /**
   * Handle file selection (from input or drag-drop)
   * @param {File} file 
   */
  function handleFileUpload(file) {
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast('Unsupported file format. Please use CSV or Excel (.xlsx)', 'error');
      return;
    }

    toast(`Reading ${file.name}...`, 'info', 2000);

    const reader = new FileReader();
    reader.onerror = () => toast('Failed to read file', 'error');

    reader.onload = (e) => {
      try {
        let rows;
        if (ext === 'csv') {
          rows = parseCSV(e.target.result);
        } else {
          rows = parseExcel(new Uint8Array(e.target.result));
        }

        if (rows.length === 0) {
          toast('No data found in file', 'error');
          return;
        }

        state.importData = rows;
        const headers = Object.keys(rows[0]);
        state.columnMapping = autoMapColumns(headers);

        // Move to Step 2
        setWizardStep(2);
        renderColumnMapping(headers, rows);

        const isCASFile = rows.length > 0 && rows[0].hasOwnProperty('_source');
        if (isCASFile) {
          const mfCount = rows.filter(r => r._source === 'MF').length;
          const dematCount = rows.filter(r => r._source === 'Demat').length;
          toast(`CAS imported: ${mfCount} MF schemes + ${dematCount} demat holdings`, 'success');
        } else {
          toast(`Found ${rows.length} records in ${file.name}`, 'success');
        }

      } catch (err) {
        toast(`Parse error: ${err.message}`, 'error');
        console.error('Import error:', err);
      }
    };

    if (ext === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  /**
   * Update wizard step indicator
   * @param {number} step - Step number (1-4)
   */
  function setWizardStep(step) {
    state.importStep = step;
    $$('.wizard-step').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.remove('active', 'completed');
      if (s === step) el.classList.add('active');
      else if (s < step) el.classList.add('completed');
    });
  }

  /**
   * Render column mapping UI (Step 2)
   * @param {string[]} headers - File headers
   * @param {Array<Object>} rows - Parsed data rows
   */
  function renderColumnMapping(headers, rows) {
    const content = $('#wizardContent');
    const fields = [
      { key: 'name', label: 'Fund Name', required: true },
      { key: 'value', label: 'Current Value', required: true },
      { key: 'invested', label: 'Amount Invested', required: false },
      { key: 'sip', label: 'Monthly SIP', required: false },
      { key: 'category', label: 'Category', required: false },
      { key: 'xirr', label: 'XIRR %', required: false },
    ];

    let html = '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:500;margin-bottom:10px">Map your file columns to WealthOS fields:</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

    fields.forEach(f => {
      const options = headers.map(h =>
        `<option value="${h}" ${state.columnMapping[f.key] === h ? 'selected' : ''}>${h}</option>`
      ).join('');
      html += `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0">
          <label style="font-size:12px;color:var(--text2);min-width:120px">${f.label}${f.required ? ' *' : ''}</label>
          <select data-field="${f.key}" style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:5px 8px;font-size:12px;color:var(--text);outline:none">
            <option value="">— Skip —</option>
            ${options}
          </select>
        </div>`;
    });
    html += '</div></div>';

    // Preview
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em">Preview (first 5 rows)</div>';
    html += '<div class="import-preview"><table><thead><tr>';
    headers.slice(0, 6).forEach(h => { html += `<th>${h}</th>`; });
    html += '</tr></thead><tbody>';
    rows.slice(0, 5).forEach(row => {
      html += '<tr>';
      headers.slice(0, 6).forEach(h => { html += `<td>${row[h] || ''}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Actions
    html += `<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
      <button class="btn" id="wizardBack">← Back</button>
      <button class="btn btn-accent" id="wizardConfirm">Validate & Import →</button>
    </div>`;

    content.innerHTML = html;

    // Event listeners
    $('#wizardBack').addEventListener('click', () => {
      setWizardStep(1);
      resetWizardContent();
    });

    $('#wizardConfirm').addEventListener('click', () => {
      // Read mapping from selects
      content.querySelectorAll('select[data-field]').forEach(sel => {
        state.columnMapping[sel.dataset.field] = sel.value;
      });

      if (!state.columnMapping.name || !state.columnMapping.value) {
        toast('Fund Name and Current Value are required fields', 'error');
        return;
      }

      importAndApply();
    });
  }

  /**
   * Apply imported data to holdings
   */
  function importAndApply() {
    const m = state.columnMapping;
    const colors = ['#4f9cf9', '#a78bfa', '#52c89c', '#f97373', '#f5a623', '#5a5550', '#c8f97a'];

    try {
      const newHoldings = state.importData.map((row, i) => ({
        name: String(row[m.name] || 'Unknown Fund').trim(),
        category: m.category ? String(row[m.category] || 'Uncategorized').trim() : 'Uncategorized',
        value: parseNum(row[m.value]),
        invested: m.invested ? parseNum(row[m.invested]) : 0,
        xirr: m.xirr ? parseNum(row[m.xirr]) : 0,
        sip: m.sip ? parseNum(row[m.sip]) : 0,
        color: colors[i % colors.length],
      })).filter(h => h.name && h.value > 0);

      if (newHoldings.length === 0) {
        toast('No valid holdings found. Check your column mapping.', 'error');
        return;
      }

      state.holdings = newHoldings;
      saveToStorage();
      renderHoldings();
      updateDashboardMetrics();

      setWizardStep(4);
      $('#wizardContent').innerHTML = `
        <div style="text-align:center;padding:32px;color:var(--teal)">
          <i class="ti ti-check" style="font-size:36px;display:block;margin-bottom:10px"></i>
          <div style="font-size:16px;font-weight:500;margin-bottom:6px">Import Successful!</div>
          <div style="font-size:12px;color:var(--text2)">${newHoldings.length} funds imported. Total corpus: ${fmtINR(newHoldings.reduce((s, h) => s + h.value, 0))}</div>
          <button class="btn" style="margin-top:16px" id="wizardViewHoldings">View Holdings →</button>
        </div>`;

      $('#wizardViewHoldings').addEventListener('click', () => showSection('holdings'));
      toast(`${newHoldings.length} funds imported successfully!`, 'success');

    } catch (err) {
      toast(`Import failed: ${err.message}`, 'error');
      console.error('Import apply error:', err);
    }
  }

  /** Reset wizard content to initial state */
  function resetWizardContent() {
    $('#wizardContent').innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">
        <i class="ti ti-upload" style="font-size:28px;display:block;margin-bottom:8px"></i>
        Upload a file above to begin. Template: <a href="#" id="downloadTemplate" style="color:var(--blue)">Download CSV template</a>
      </div>`;
    $('#downloadTemplate').addEventListener('click', downloadTemplate);
  }

  /** Generate and download CSV template */
  function downloadTemplate(e) {
    if (e) e.preventDefault();
    const csv = 'Fund Name,Current Value,Invested,Monthly SIP,Category,XIRR %\n'
      + 'UTI Nifty 50 Index,512400,390000,15000,Large Cap · Index,13.2\n'
      + 'Parag Parikh Flexi Cap,684200,420000,20000,Flexi Cap · Active,18.4\n'
      + 'HDFC Midcap 150,342600,216000,12000,Mid Cap · Index,16.1\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wealthos_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('Template downloaded!', 'success', 2000);
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── EXPORT ─────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /** Export current holdings to CSV file */
  function exportToCSV() {
    if (state.holdings.length === 0 && state.goals.length === 0 && (!state.insurance || state.insurance.length === 0)) {
      toast('No data to export', 'info');
      return;
    }

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Holdings ──
    if (state.holdings.length > 0) {
      const holdingsData = state.holdings.map(h => ({
        'Fund Name': h.name,
        'Category': h.category,
        'Current Value (₹)': h.value,
        'Invested (₹)': h.invested,
        'Gain (₹)': h.value - h.invested,
        'XIRR %': h.xirr,
        'Monthly SIP (₹)': h.sip,
        'Units': h.units || '',
        'NAV': h.nav || '',
      }));
      const wsHoldings = XLSX.utils.json_to_sheet(holdingsData);
      XLSX.utils.book_append_sheet(wb, wsHoldings, 'Holdings');
    }

    // ── Sheet 2: Goals ──
    if (state.goals.length > 0) {
      const goalsData = state.goals.map(g => ({
        'Goal Name': g.name,
        'Category': g.category || '',
        'Priority': g.priority,
        'Target Amount (₹)': g.targetAmount,
        'Current Amount (₹)': g.currentAmount,
        'Progress %': g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
        'Target Year': g.targetYear || 'Ongoing',
        'Monthly SIP (₹)': g.monthlySIP,
      }));
      const wsGoals = XLSX.utils.json_to_sheet(goalsData);
      XLSX.utils.book_append_sheet(wb, wsGoals, 'Goals');
    }

    // ── Sheet 3: Insurance ──
    if (state.insurance && state.insurance.length > 0) {
      const freqLabels = { annual: 'Annual', half_yearly: 'Half-Yearly', quarterly: 'Quarterly', monthly: 'Monthly' };
      const insData = state.insurance.map(p => ({
        'Policy Name': p.name,
        'Type': INSURANCE_TYPE_LABELS[p.type] || p.type,
        'Sum Assured (₹)': parseNum(p.sumAssured),
        'Annual Premium (₹)': parseNum(p.annualPremium),
        'Premium Frequency': freqLabels[p.premiumFreq] || 'Annual',
        'Policy Number': p.policyNumber || '',
        'Start Date': p.startDate || '',
        'Renewal Date': p.endDate || '',
        'Cover Till': p.coverTill || '',
        'Nominee': p.nominee || '',
        'Covered Members': p.coveredMembers || '',
        'Notes': p.notes || '',
      }));
      const wsInsurance = XLSX.utils.json_to_sheet(insData);
      XLSX.utils.book_append_sheet(wb, wsInsurance, 'Insurance');
    }

    // ── Sheet 4: Goal-Fund Allocation ──
    if (state.goalFundMap && Object.keys(state.goalFundMap).length > 0) {
      const allocRows = [];
      Object.entries(state.goalFundMap).forEach(([holdingName, mapping]) => {
        if (mapping.goalId) {
          const goal = state.goals.find(g => g.id === mapping.goalId);
          allocRows.push({
            'Holding': holdingName,
            'Assigned Goal': goal ? goal.name : mapping.goalId,
            'Allocation %': mapping.pct || 100,
          });
        }
      });
      if (allocRows.length > 0) {
        const wsAlloc = XLSX.utils.json_to_sheet(allocRows);
        XLSX.utils.book_append_sheet(wb, wsAlloc, 'Goal Allocation');
      }
    }

    // ── Generate & Download ──
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealthos_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported to Excel (Holdings, Goals, Insurance, Allocation)', 'success');
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── CHARTS ─────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /** Render the allocation donut chart */
  function renderAllocDonut() {
    const ctx = document.getElementById('allocDonut');
    if (!ctx) return;

    const totalValue = state.holdings.reduce((s, h) => s + h.value, 0);
    const labels = state.holdings.map(h => h.name);
    const data = state.holdings.map(h => totalValue ? +((h.value / totalValue) * 100).toFixed(1) : 0);
    const colors = state.holdings.map(h => h.color);

    const chartData = {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 4,
      }],
    };

    if (charts.allocDonut) {
      charts.allocDonut.data = chartData;
      charts.allocDonut.update('active');
    } else {
      charts.allocDonut = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => c.label + ': ' + c.parsed + '%' } },
          },
        },
      });
    }
  }

  /** Render the growth chart on dashboard */
  function renderGrowthChart() {
    const ctx = document.getElementById('growthChart');
    if (!ctx) return;

    const totalCorpus = state.holdings.reduce((s, h) => s + h.value, 0) || 6840000;
    const totalSIP = state.holdings.reduce((s, h) => s + h.sip, 0) || 105000;

    const scenarios = {
      bull: { cagr: 15, color: '#52c89c', label: 'Bull (15% CAGR)' },
      base: { cagr: 12, color: '#4f9cf9', label: 'Base (12% CAGR)' },
      bear: { cagr: 8, color: '#f97373', label: 'Bear (8% CAGR)' },
    };

    const s = scenarios[state.currentScenario];
    const { labels, nominalData, realData, investedData } = computeCorpus(s.cagr, 10, 17, totalCorpus, totalSIP, 6);
    const final = nominalData[nominalData.length - 1];
    const finalReal = realData[realData.length - 1];
    const finalInvested = investedData[investedData.length - 1];

    // Summary cards
    const summaryEl = $('#scenarioSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="background:var(--bg3);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Corpus (nominal)</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:500;color:${s.color}">${fmtINR(final)}</div></div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Today's money</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:500">${fmtINR(finalReal)}</div></div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Total invested</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:500">${fmtINR(finalInvested)}</div></div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Wealth created</div><div style="font-family:var(--font-mono);font-size:16px;font-weight:500;color:var(--accent)">${fmtINR(final - finalInvested)}</div></div>`;
    }

    // Chart
    const chartData = {
      labels,
      datasets: [
        { label: 'Corpus (nominal)', data: nominalData, borderColor: s.color, backgroundColor: s.color + '18', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
        { label: 'Real value', data: realData, borderColor: s.color + '88', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0, borderDash: [4, 3], borderWidth: 1.5 },
        { label: 'Invested', data: investedData, borderColor: '#5a5550', backgroundColor: 'transparent', fill: false, tension: 0.2, pointRadius: 0, borderDash: [5, 4], borderWidth: 1 },
      ],
    };

    const chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmtINR(c.raw) } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { maxTicksLimit: 8, color: '#5a5550', font: { family: 'DM Mono', size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtINR(v), color: '#5a5550', font: { family: 'DM Mono', size: 10 } } },
      },
    };

    if (charts.growthChart) {
      charts.growthChart.data = chartData;
      charts.growthChart.update('active');
    } else {
      charts.growthChart = new Chart(ctx, { type: 'line', data: chartData, options: chartOpts });
    }

    // Legend
    const legendEl = $('#chartLegend');
    if (legendEl) {
      legendEl.innerHTML = `
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:2px;background:${s.color};display:inline-block"></span>${s.label}</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:2px;background:${s.color}88;display:inline-block;border-top:1px dashed ${s.color}88"></span>Inflation-adjusted</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:2px;background:#5a5550;display:inline-block"></span>Total invested</span>`;
    }
  }

  /** Render standalone projection page chart */
  function renderProjection() {
    const cagr = parseFloat($('#cagrProj')?.value) || 12;
    const stepup = parseFloat($('#stepupProj')?.value) || 10;
    const retireYear = parseInt($('#retireProj')?.value) || 2043;
    const infl = parseFloat($('#inflProj')?.value) || 6;
    const years = Math.max(1, retireYear - 2026);
    state._assumedCAGR = cagr;

    // Clamp year to 4-digit valid range
    if (retireYear < 2026 || retireYear > 2070) return;

    const ctx = document.getElementById('projChart');
    if (!ctx) return;

    const totalCorpus = state.holdings.reduce((s, h) => s + h.value, 0) || 6840000;
    const computedSIP = state.holdings.reduce((s, h) => s + h.sip, 0) || 105000;

    // Compute equity/debt split from holdings (equity+debt = 100%)
    let equityVal = 0, debtVal = 0;
    state.holdings.forEach(h => {
      const ac = getAssetClass(h);
      if (ac === 'debt' || ac === 'gold') debtVal += h.value;
      else equityVal += h.value;
    });
    const totalVal = equityVal + debtVal || 1;
    const equityPct = Math.round((equityVal / totalVal) * 100);
    const debtPct = 100 - equityPct;

    // Populate snapshot fields (only set if user hasn't manually edited)
    const corpusEl = $('#projCurrentCorpus');
    if (corpusEl) corpusEl.textContent = fmtINR(totalCorpus);
    const sipEl = $('#projMonthlySIP');
    if (sipEl && !sipEl._userEdited) sipEl.value = computedSIP;
    const eqEl = $('#projEquityPct');
    if (eqEl && !eqEl._userEdited) eqEl.value = equityPct;
    const dtEl = $('#projDebtPct');
    if (dtEl && !dtEl._userEdited) dtEl.value = debtPct;

    // Use editable SIP value for projection
    const totalSIP = parseFloat($('#projMonthlySIP')?.value) || computedSIP;

    const bull = computeCorpus(Math.min(cagr + 3, 20), stepup, years, totalCorpus, totalSIP, infl);
    const base = computeCorpus(cagr, stepup, years, totalCorpus, totalSIP, infl);
    const bear = computeCorpus(Math.max(cagr - 4, 4), stepup, years, totalCorpus, totalSIP, infl);

    const fb = bull.realData[bull.realData.length - 1];
    const fm = base.realData[base.realData.length - 1];
    const fw = bear.realData[bear.realData.length - 1];

    const summaryEl = $('#projSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="background:rgba(82,200,156,0.08);border:1px solid rgba(82,200,156,0.2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--teal);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Bull · ${cagr + 3}% CAGR</div><div style="font-family:var(--font-mono);font-size:18px;font-weight:500;color:var(--teal)">${fmtINR(fb)}</div></div>
        <div style="background:rgba(79,156,249,0.08);border:1px solid rgba(79,156,249,0.2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--blue);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Base · ${cagr}% CAGR</div><div style="font-family:var(--font-mono);font-size:18px;font-weight:500;color:var(--blue)">${fmtINR(fm)}</div></div>
        <div style="background:rgba(249,115,115,0.08);border:1px solid rgba(249,115,115,0.2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--red);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Bear · ${Math.max(cagr - 4, 4)}% CAGR</div><div style="font-family:var(--font-mono);font-size:18px;font-weight:500;color:var(--red)">${fmtINR(fw)}</div></div>`;
    }

    const chartData = {
      labels: base.labels,
      datasets: [
        { label: 'Bull', data: bull.realData, borderColor: '#52c89c', backgroundColor: 'rgba(82,200,156,0.05)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
        { label: 'Base', data: base.realData, borderColor: '#4f9cf9', backgroundColor: 'rgba(79,156,249,0.07)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
        { label: 'Bear', data: bear.realData, borderColor: '#f97373', backgroundColor: 'rgba(249,115,115,0.04)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
      ],
    };

    const chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + fmtINR(c.raw) } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { maxTicksLimit: 8, color: '#5a5550', font: { family: 'DM Mono', size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtINR(v), color: '#5a5550', font: { family: 'DM Mono', size: 10 } } },
      },
    };

    if (charts.projChart) {
      charts.projChart.data = chartData;
      charts.projChart.update('active');
    } else {
      charts.projChart = new Chart(ctx, { type: 'line', data: chartData, options: chartOpts });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── HOLDINGS RENDERING ─────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /** Render holdings table from state */
  function renderHoldings() {
    const tbody = $('#holdingsBody');
    const footer = $('#holdingsFooter');
    if (!tbody) return;

    const totalValue = state.holdings.reduce((s, h) => s + h.value, 0);
    const totalInvested = state.holdings.reduce((s, h) => s + h.invested, 0);
    const totalSIP = state.holdings.reduce((s, h) => s + h.sip, 0);

    tbody.innerHTML = state.holdings.map(h => {
      const gain = h.value - h.invested;
      const weight = totalValue ? ((h.value / totalValue) * 100).toFixed(1) : 0;
      const barWidth = Math.min(100, (weight / 30) * 100); // scale to max 30%

      return `<tr>
        <td style="padding-left:18px"><div class="fund-name">${h.name}</div><div class="fund-cat">${h.category}</div></td>
        <td>₹${fmtNum(h.value)}</td>
        <td style="color:var(--text2)">₹${fmtNum(h.invested)}</td>
        <td><span style="color:${gain >= 0 ? 'var(--teal)' : 'var(--red)'}">${gain >= 0 ? '+' : ''}₹${fmtNum(Math.abs(gain))}</span></td>
        <td><span class="xirr-chip ${xirrClass(h.xirr)}">${h.xirr.toFixed(1)}%</span></td>
        <td>₹${fmtNum(h.sip)}</td>
        <td><div style="display:flex;align-items:center;gap:6px"><div style="width:40px;height:3px;background:var(--bg4);border-radius:2px"><div style="width:${barWidth}%;height:100%;background:${h.color};border-radius:2px"></div></div><span style="font-family:var(--font-mono);font-size:11px">${weight}%</span></div></td>
      </tr>`;
    }).join('');

    if (footer) {
      const weightedXIRR = totalInvested > 0
        ? state.holdings.reduce((s, h) => s + h.xirr * h.invested, 0) / totalInvested
        : 0;
      footer.innerHTML = `
        <span>${state.holdings.length} instruments · ₹${fmtNum(totalInvested)} invested</span>
        <span>Total corpus: ₹${fmtNum(totalValue)} · Overall XIRR: <span style="color:var(--teal)">${weightedXIRR.toFixed(1)}%</span></span>`;
    }
  }

  /** Update dashboard metrics based on current holdings */
  function updateDashboardMetrics() {
    const totalValue = state.holdings.reduce((s, h) => s + h.value, 0);
    const totalSIP = state.holdings.reduce((s, h) => s + h.sip, 0);
    const totalInvested = state.holdings.reduce((s, h) => s + h.invested, 0);
    const weightedXIRR = totalInvested > 0
      ? state.holdings.reduce((s, h) => s + h.xirr * h.invested, 0) / totalInvested
      : 0;

    // Projection params (use state cache or defaults)
    const cagr = state._assumedCAGR || 12;
    const stepup = parseFloat($('#stepupProj')?.value) || 10;
    const retireYear = parseInt($('#retireProj')?.value) || 2043;
    const infl = parseFloat($('#inflProj')?.value) || 6;
    const years = Math.max(1, retireYear - 2026);

    // Compute projected corpus (base scenario, inflation-adjusted)
    const sipForProjection = totalSIP || 105000;
    const projected = computeCorpus(cagr, stepup, years, totalValue || 6840000, sipForProjection, infl);
    const projectedCorpus = projected.realData[projected.realData.length - 1];

    // Target = sum of all goals
    const target = state.goals.reduce((s, g) => s + (g.targetAmount || 0), 0) || 108000000;
    const gap = target - projectedCorpus;

    // Compute total SIP required across all goals
    const totalGoalSIP = state.goals.reduce((s, g) => s + (g.monthlySIP || 0), 0);

    // ── Render dashboard metric cards ──
    const metricsEl = $('#dashboardMetrics');
    if (metricsEl) {
      metricsEl.innerHTML = `
        <div class="metric-card primary">
          <div class="metric-label">Total Corpus</div>
          <div class="metric-value accent">${fmtINR(totalValue)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Monthly SIP</div>
          <div class="metric-value">${fmtINR(sipForProjection)}</div>
          <div class="metric-sub" style="font-family:var(--font-mono);color:var(--text3)">${fmtINR(totalGoalSIP)} required for all goals</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Projected Corpus</div>
          <div class="metric-value">${fmtINR(projectedCorpus)}</div>
          <div class="metric-sub" style="font-family:var(--font-mono);color:var(--text3)">${fmtINR(target)} target <span class="infl-notice"><i class="ti ti-trending-up" style="font-size:9px"></i>${infl}% infl.</span></div>
          ${gap > 0 ? `<div class="metric-delta"><span class="delta-neg">${fmtINR(gap)} gap</span></div>` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">Portfolio XIRR</div>
          <div class="metric-value" style="color:var(--teal)">${weightedXIRR.toFixed(1)}%</div>
          <div class="metric-sub" style="font-family:var(--font-mono);color:var(--text3)">Nifty 50: 12.2% (10Y CAGR)</div>
        </div>`;
    }

    // Update last updated timestamp
    const now = new Date();
    const updated = $('#lastUpdated');
    if (updated) {
      updated.textContent = `Last updated: ${now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} · ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Re-render charts
    renderAllocDonut();
    renderGrowthChart();
    renderDashboardGoalProgress();
  }

  /**
   * Render the goal progress bars on the dashboard (reads from state.goals)
   */
  function renderDashboardGoalProgress() {
    const container = $('#dashboardGoalProgress');
    if (!container) return;

    const assumedReturn = (state._assumedCAGR || 12) / 100;

    // Show top goals (sorted by priority then by gap)
    const goalsToShow = [...state.goals]
      .sort((a, b) => {
        const pOrder = { high: 0, medium: 1, low: 2 };
        return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
      })
      .slice(0, 5); // Show top 5 on dashboard

    container.innerHTML = goalsToShow.map((g, idx) => {
      const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
      const pctRound = Math.round(pct);
      const gap = g.targetAmount - g.currentAmount;
      const yearLabel = g.targetYear ? g.targetYear : 'Ongoing';

      // Bar color based on progress
      let barColor = g.color || 'var(--blue)';
      if (pct < 15) barColor = 'var(--red)';
      else if (pct < 40) barColor = 'var(--amber)';
      else if (pct >= 75) barColor = 'var(--teal)';

      // Compute SIP required to reach goal on time
      let statusText = '✓ Achieved';
      if (gap > 0) {
        const yearsLeft = g.targetYear ? Math.max(0.5, g.targetYear - new Date().getFullYear()) : 10;
        const monthsLeft = Math.round(yearsLeft * 12);
        const monthlyRate = Math.pow(1 + assumedReturn, 1 / 12) - 1;
        const fvCurrent = g.currentAmount * Math.pow(1 + assumedReturn, yearsLeft);
        const remaining = g.targetAmount - fvCurrent;
        const sipRequired = remaining > 0
          ? Math.round(remaining * monthlyRate / (Math.pow(1 + monthlyRate, monthsLeft) - 1))
          : 0;
        statusText = sipRequired > 0 ? `SIP: ${fmtINR(sipRequired)}/mo` : '✓ On track';
      }
      let statusStyle = gap > 0 ? (pct < 25 && g.priority === 'high' ? 'color:var(--red)' : 'color:var(--amber)') : 'color:var(--teal)';

      return `<div class="goal-row" ${idx === goalsToShow.length - 1 ? 'style="margin-bottom:0"' : ''}>
        <div class="goal-meta">
          <div class="goal-name">${g.name}<span style="font-size:10px;color:var(--text3);margin-left:6px;font-family:var(--font-mono)">${yearLabel}</span></div>
          <div class="goal-numbers">${fmtINR(g.currentAmount)} / ${fmtINR(g.targetAmount)}</div>
        </div>
        <div class="goal-bar-wrap"><div class="goal-bar-fill" style="width:${pctRound}%;background:${barColor}"></div></div>
        <div class="goal-footer"><span>${pctRound}% funded</span><span style="${statusStyle}">${statusText}</span></div>
      </div>`;
    }).join('');
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── NAVIGATION ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  const SECTION_TITLES = {
    dashboard: 'Dashboard', holdings: 'Holdings', allocation: 'Allocation',
    performance: 'Performance', goals: 'Goals', projection: 'Projection',
    rebalancing: 'Rebalancing', fire: 'FIRE Tracker', insurance: 'Insurance Tracker', import: 'Import Data',
    tax: 'Tax Planner', networth: 'Net Worth',
  };

  /**
   * Switch to a section
   * @param {string} id - Section ID (without "section-" prefix)
   */
  function showSection(id) {
    $$('.section').forEach(s => s.classList.remove('active'));
    $$('.nav-item').forEach(n => n.classList.remove('active'));

    const section = $(`#section-${id}`);
    if (section) section.classList.add('active');

    const navBtn = $(`.nav-item[data-section="${id}"]`);
    if (navBtn) navBtn.classList.add('active');

    const title = $('#pageTitle');
    if (title) title.textContent = SECTION_TITLES[id] || id;

    // Trigger chart renders on section switch
    if (id === 'projection') setTimeout(renderProjection, 50);
    if (id === 'goals') setTimeout(renderGoals, 50);
    if (id === 'allocation') setTimeout(renderGoalAllocation, 50);
    if (id === 'rebalancing') setTimeout(renderRebalancing, 50);
    if (id === 'dashboard') {
      setTimeout(renderGrowthChart, 50);
      setTimeout(renderAllocDonut, 50);
      setTimeout(updateDashboardMetrics, 50);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── LOCAL STORAGE ──────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /** Save current holdings to localStorage */
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.holdings));
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(state.goals));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }

  /** Load holdings from localStorage (falls back to defaults) */
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.holdings = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('localStorage load failed:', e);
    }
    state.holdings = [...DEFAULT_HOLDINGS];
  }

  /** Load goals from localStorage (falls back to defaults) */
  function loadGoalsFromStorage() {
    try {
      const saved = localStorage.getItem(GOALS_STORAGE_KEY);
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) { state.goals = parsed; return; } }
    } catch (e) { console.warn('Goals load failed:', e); }
    state.goals = [...DEFAULT_GOALS];
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── GOALS MODULE ──────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  let editingGoalId = null;

  /**
   * Generate a unique ID for new goals
   * @returns {string}
   */
  function generateGoalId() {
    return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /**
   * Render all goal cards into the goals grid
   */
  function renderGoals() {
    const grid = $('#goalsGrid');
    const alertsEl = $('#goalsAlerts');
    if (!grid) return;

    // Render alerts for under-funded goals
    const urgentGoals = state.goals.filter(g => {
      const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
      return pct < 25 && g.priority === 'high';
    });

    if (alertsEl) {
      alertsEl.innerHTML = urgentGoals.map(g => {
        const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
        return `<div class="alert alert-warn" style="margin-bottom:10px">
          <i class="ti ti-alert-triangle"></i>
          <div class="alert-text">
            <strong>${g.name} is under-funded</strong>
            <span>At ${pct}%, this goal needs urgent attention. ${g.monthlySIP > 0 ? `Current SIP: ${fmtINR(g.monthlySIP)}/mo.` : 'No SIP allocated yet.'} Consider increasing contributions.</span>
          </div>
        </div>`;
      }).join('');
    }

    // Render goal cards
    grid.innerHTML = state.goals.map(g => {
      const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
      const pctRound = Math.round(pct);
      const gap = g.targetAmount - g.currentAmount;
      const yearLabel = g.targetYear ? g.targetYear : 'Ongoing';
      const timeLeft = g.targetYear ? `${g.targetYear - new Date().getFullYear()} yrs left` : 'No deadline';

      // Determine bar color based on progress
      let barColor = g.color || 'var(--blue)';
      if (pct < 20) barColor = 'var(--red)';
      else if (pct < 40) barColor = 'var(--amber)';
      else if (pct >= 80) barColor = 'var(--teal)';

      return `<div class="goal-card" data-goal-id="${g.id}">
        <div class="goal-card-header">
          <div>
            <div class="goal-card-title">${g.name}</div>
            <div class="goal-card-year"><i class="ti ti-calendar" style="font-size:11px"></i> ${yearLabel} · <span class="goal-card-priority priority-${g.priority}">${g.priority}</span></div>
          </div>
          <div class="goal-card-actions">
            <button title="Edit" data-goal-edit="${g.id}"><i class="ti ti-pencil"></i></button>
            <button title="Delete" data-goal-delete="${g.id}"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div class="goal-card-amounts">
          <div class="goal-card-current">${fmtINR(g.currentAmount)}</div>
          <div class="goal-card-target">/ ${fmtINR(g.targetAmount)}</div>
        </div>
        <div class="goal-card-bar"><div class="goal-card-bar-fill" style="width:${pctRound}%;background:${barColor}"></div></div>
        <div class="goal-card-footer">
          <span>${pctRound}% funded</span>
          <span>${gap > 0 ? fmtINR(gap) + ' gap' : '✓ Achieved!'}</span>
        </div>
        ${g.monthlySIP > 0 ? `<div class="goal-card-sip"><i class="ti ti-repeat" style="font-size:11px;margin-right:4px"></i>SIP: ${fmtINR(g.monthlySIP)}/mo · ${timeLeft}</div>` : `<div class="goal-card-sip" style="color:var(--text3)"><i class="ti ti-alert-circle" style="font-size:11px;margin-right:4px"></i>No SIP allocated · ${timeLeft}</div>`}
      </div>`;
    }).join('');
  }

  /**
   * Open the goal modal for adding or editing
   * @param {Object|null} goal - Goal to edit, or null for new
   */
  function openGoalModal(goal) {
    editingGoalId = goal ? goal.id : null;
    const modal = $('#goalModal');
    const title = $('#goalModalTitle');
    const form = $('#goalForm');
    if (!modal || !form) return;

    title.textContent = goal ? 'Edit Goal' : 'Add New Goal';

    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Goal Name</label>
        <input class="form-input" id="goalFieldName" type="text" placeholder="e.g. Retirement Corpus" value="${goal ? goal.name : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Target Amount (₹)</label>
          <input class="form-input" id="goalFieldTarget" type="number" min="0" placeholder="e.g. 10000000" value="${goal ? goal.targetAmount : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Current Amount (₹)</label>
          <input class="form-input" id="goalFieldCurrent" type="number" min="0" placeholder="e.g. 500000" value="${goal ? goal.currentAmount : '0'}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Target Year</label>
          <input class="form-input" id="goalFieldYear" type="number" min="2024" max="2070" placeholder="e.g. 2035" value="${goal && goal.targetYear ? goal.targetYear : ''}">
          <div class="form-hint">Leave blank for ongoing goals</div>
        </div>
        <div class="form-group">
          <label class="form-label">Monthly SIP (₹)</label>
          <input class="form-input" id="goalFieldSIP" type="number" min="0" placeholder="e.g. 10000" value="${goal ? goal.monthlySIP : '0'}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-input form-select" id="goalFieldPriority">
            <option value="low" ${goal && goal.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${goal && goal.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${goal && goal.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-input form-select" id="goalFieldCategory">
            <option value="Retirement" ${goal && goal.category === 'Retirement' ? 'selected' : ''}>Retirement</option>
            <option value="Education" ${goal && goal.category === 'Education' ? 'selected' : ''}>Education</option>
            <option value="Lifestyle" ${goal && goal.category === 'Lifestyle' ? 'selected' : ''}>Lifestyle</option>
            <option value="Safety Net" ${goal && goal.category === 'Safety Net' ? 'selected' : ''}>Safety Net</option>
            <option value="Investment" ${goal && goal.category === 'Investment' ? 'selected' : ''}>Investment</option>
            <option value="Other" ${goal && goal.category === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>
    `;

    modal.classList.add('active');
    setTimeout(() => $('#goalFieldName')?.focus(), 100);
  }

  /**
   * Close the goal modal
   */
  function closeGoalModal() {
    const modal = $('#goalModal');
    if (modal) modal.classList.remove('active');
    editingGoalId = null;
  }

  /**
   * Save a goal (add or update)
   */
  function saveGoal() {
    const name = $('#goalFieldName')?.value.trim();
    const targetAmount = parseFloat($('#goalFieldTarget')?.value) || 0;
    const currentAmount = parseFloat($('#goalFieldCurrent')?.value) || 0;
    const targetYear = $('#goalFieldYear')?.value ? parseInt($('#goalFieldYear').value) : null;
    const monthlySIP = parseFloat($('#goalFieldSIP')?.value) || 0;
    const priority = $('#goalFieldPriority')?.value || 'medium';
    const category = $('#goalFieldCategory')?.value || 'Other';

    if (!name) { toast('Please enter a goal name', 'error'); return; }
    if (targetAmount <= 0) { toast('Target amount must be greater than 0', 'error'); return; }

    const colors = ['#4f9cf9', '#a78bfa', '#52c89c', '#f97373', '#f5a623', '#c8f97a'];

    if (editingGoalId) {
      // Update existing goal
      const idx = state.goals.findIndex(g => g.id === editingGoalId);
      if (idx >= 0) {
        state.goals[idx] = { ...state.goals[idx], name, targetAmount, currentAmount, targetYear, monthlySIP, priority, category };
        toast(`"${name}" updated`, 'success');
      }
    } else {
      // Add new goal
      const newGoal = {
        id: generateGoalId(),
        name, targetAmount, currentAmount, targetYear, monthlySIP, priority, category,
        color: colors[state.goals.length % colors.length],
      };
      state.goals.push(newGoal);
      toast(`"${name}" added to goals`, 'success');
    }

    saveToStorage();
    renderGoals();
    renderGoalAllocation();
    closeGoalModal();
  }

  /**
   * Delete a goal by ID (with confirmation)
   * @param {string} id
   */
  function deleteGoal(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    if (!confirm(`Delete "${goal.name}"? This cannot be undone.`)) return;

    state.goals = state.goals.filter(g => g.id !== id);
    saveToStorage();
    renderGoals();
    renderGoalAllocation();
    toast(`"${goal.name}" deleted`, 'info');
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── AUTO ALLOCATE ─────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /**
   * Smart allocation rules:
   * - Equity (Large/Flexi/Mid/Small Cap) → long-term goals (Retirement, Education, Lifestyle with >5yr horizon)
   * - Debt (PPF, Liquid, Short Term) → short-term goals (Emergency Fund, goals <3yr away)
   * - NPS → Retirement only
   * - Gold/Hybrid → medium-term goals
   * Priority: High-priority goals get allocated first
   */

  /**
   * Determine the asset class of a holding
   * @param {Object} holding
   * @returns {string} 'equity' | 'debt' | 'hybrid' | 'gold'
   */
  function getAssetClass(holding) {
    const cat = (holding.category || '').toLowerCase();
    if (cat.includes('international') || cat.includes('nasdaq') || cat.includes('us ') || cat.includes('s&p')) return 'international';
    if (cat.includes('gold')) return 'gold';
    if (cat.includes('debt') || cat.includes('ppf') || cat.includes('liquid') || cat.includes('short term') || cat.includes('bond') || cat.includes('fd') || cat.includes('saving') || cat.includes('money market') || cat.includes('epf') || cat.includes('ssy')) return 'debt';
    if (cat.includes('hybrid') || cat.includes('balanced') || cat.includes('nps')) return 'hybrid';
    return 'equity';
  }

  /**
   * Determine the time horizon for a goal
   * @param {Object} goal
   * @returns {string} 'short' (<3yr) | 'medium' (3-7yr) | 'long' (>7yr) | 'ongoing'
   */
  function getGoalHorizon(goal) {
    if (!goal.targetYear) return 'ongoing';
    const yearsLeft = goal.targetYear - new Date().getFullYear();
    if (yearsLeft <= 3) return 'short';
    if (yearsLeft <= 7) return 'medium';
    return 'long';
  }

  /**
   * Auto-suggest which goal each holding should map to
   * @returns {Array<{holdingIdx: number, goalId: string, pct: number, reason: string}>}
   */
  function computeAutoAllocation() {
    const allocations = [];

    // Sort goals by priority (high first) then by gap (largest first)
    const sortedGoals = [...state.goals].sort((a, b) => {
      const pOrder = { high: 0, medium: 1, low: 2 };
      if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
      const gapA = a.targetAmount - a.currentAmount;
      const gapB = b.targetAmount - b.currentAmount;
      return gapB - gapA;
    });

    state.holdings.forEach((h, idx) => {
      const assetClass = getAssetClass(h);
      const horizon = assetClass === 'debt' ? 'short' : assetClass === 'equity' ? 'long' : 'medium';

      // Find best matching goal
      let bestGoal = null;
      let reason = '';

      for (const g of sortedGoals) {
        const goalHorizon = getGoalHorizon(g);
        const goalCat = (g.category || '').toLowerCase();

        // NPS → Retirement
        if (h.category && h.category.toLowerCase().includes('nps') && goalCat === 'retirement') {
          bestGoal = g; reason = 'NPS → Retirement'; break;
        }
        // PPF → Safety Net or Retirement
        if (h.category && h.category.toLowerCase().includes('ppf') && (goalCat === 'safety net' || goalCat === 'retirement')) {
          bestGoal = g; reason = 'PPF → ' + g.category; break;
        }
        // Debt → short-term / ongoing goals
        if (assetClass === 'debt' && (goalHorizon === 'short' || goalHorizon === 'ongoing')) {
          bestGoal = g; reason = 'Debt → Short-term goal'; break;
        }
        // Equity → long-term goals
        if (assetClass === 'equity' && (goalHorizon === 'long' || goalHorizon === 'medium')) {
          bestGoal = g; reason = 'Equity → Long-term goal'; break;
        }
        // Hybrid/Gold → medium-term
        if ((assetClass === 'hybrid' || assetClass === 'gold') && goalHorizon === 'medium') {
          bestGoal = g; reason = assetClass + ' → Medium-term goal'; break;
        }
      }

      // Fallback: assign to highest-priority unfunded goal
      if (!bestGoal && sortedGoals.length > 0) {
        bestGoal = sortedGoals[0];
        reason = 'Fallback → highest priority';
      }

      allocations.push({
        holdingIdx: idx,
        goalId: bestGoal ? bestGoal.id : '',
        pct: 100,
        reason,
      });
    });

    return allocations;
  }

  /**
   * Open the auto-allocate modal with suggested allocations
   */
  function openAllocModal() {
    const modal = $('#allocModal');
    const body = $('#allocModalBody');
    if (!modal || !body) return;

    const allocations = computeAutoAllocation();
    state._pendingAllocations = allocations;

    const goalOptions = state.goals.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    body.innerHTML = `
      <div class="alloc-hint">
        <i class="ti ti-bulb" style="margin-right:6px"></i>
        Smart allocation maps each holding to the best-fit goal based on asset class, time horizon, and priority. You can override any assignment below.
      </div>
      <table class="alloc-table">
        <thead>
          <tr>
            <th>Holding</th>
            <th style="width:120px">Value</th>
            <th style="width:160px">Assign to Goal</th>
            <th style="width:70px">%</th>
          </tr>
        </thead>
        <tbody>
          ${allocations.map((a, i) => {
            const h = state.holdings[a.holdingIdx];
            return `<tr>
              <td>
                <div class="alloc-fund-name">${h.name}</div>
                <div class="alloc-fund-cat">${h.category} <span class="alloc-badge" style="background:var(--bg4);color:var(--text2);margin-left:4px">${a.reason}</span></div>
              </td>
              <td class="alloc-fund-value">${fmtINR(h.value)}</td>
              <td>
                <select class="alloc-goal-select" data-alloc-idx="${i}">
                  <option value="">— Unassigned —</option>
                  ${goalOptions.replace(`value="${a.goalId}"`, `value="${a.goalId}" selected`)}
                </select>
              </td>
              <td><input type="number" class="alloc-pct-input" data-alloc-pct-idx="${i}" min="0" max="100" value="${a.pct}"></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="alloc-summary" id="allocSummary"></div>
    `;

    updateAllocSummary();

    // Listen for changes to update summary
    body.addEventListener('change', updateAllocSummary);
    body.addEventListener('input', updateAllocSummary);

    modal.classList.add('active');
  }

  /**
   * Update the allocation summary showing total per goal
   */
  function updateAllocSummary() {
    const summary = $('#allocSummary');
    if (!summary) return;

    const goalTotals = {};
    state.goals.forEach(g => { goalTotals[g.id] = { name: g.name, amount: 0 }; });

    const selects = $$('.alloc-goal-select');
    const pctInputs = $$('.alloc-pct-input');

    selects.forEach((sel, i) => {
      const goalId = sel.value;
      const pct = parseFloat(pctInputs[i]?.value) || 0;
      const holdingIdx = parseInt(sel.dataset.allocIdx);
      const holdingValue = state.holdings[holdingIdx]?.value || 0;
      const allocated = holdingValue * (pct / 100);
      if (goalId && goalTotals[goalId]) {
        goalTotals[goalId].amount += allocated;
      }
    });

    const rows = Object.values(goalTotals)
      .filter(g => g.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map(g => `<div class="alloc-summary-row"><span class="label">${g.name}</span><span class="value">${fmtINR(g.amount)}</span></div>`)
      .join('');

    const totalAllocated = Object.values(goalTotals).reduce((s, g) => s + g.amount, 0);
    const totalPortfolio = state.holdings.reduce((s, h) => s + h.value, 0);

    summary.innerHTML = `
      <div class="alloc-summary-row" style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border)">
        <span class="label" style="font-weight:500;color:var(--text)">Goal</span>
        <span class="value" style="color:var(--text)">Allocated</span>
      </div>
      ${rows || '<div style="font-size:11px;color:var(--text3);padding:4px 0">No allocations yet</div>'}
      <div class="alloc-summary-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        <span class="label" style="font-weight:500">Total Allocated</span>
        <span class="value" style="color:var(--accent)">${fmtINR(totalAllocated)} / ${fmtINR(totalPortfolio)}</span>
      </div>
    `;
  }

  /**
   * Apply the allocation — updates goal.currentAmount based on mapped holdings
   */
  function applyAllocation() {
    const selects = $$('.alloc-goal-select');
    const pctInputs = $$('.alloc-pct-input');

    // Reset goal current amounts to 0 before recalculating
    const goalAmounts = {};
    const goalFunds = {}; // Track which funds are in which goal
    state.goals.forEach(g => { goalAmounts[g.id] = 0; });
    state.goals.forEach(g => { goalFunds[g.id] = []; });

    selects.forEach((sel, i) => {
      const goalId = sel.value;
      const pct = parseFloat(pctInputs[i]?.value) || 0;
      const holdingIdx = parseInt(sel.dataset.allocIdx);
      const holdingValue = state.holdings[holdingIdx]?.value || 0;
      const allocated = holdingValue * (pct / 100);
      if (goalId && goalAmounts.hasOwnProperty(goalId)) {
        goalAmounts[goalId] += allocated;
        goalFunds[goalId].push({
          holdingIdx,
          name: state.holdings[holdingIdx]?.name || '',
          category: state.holdings[holdingIdx]?.category || '',
          holdingValue,
          allocatedValue: Math.round(allocated),
          pct,
        });
      }
    });

    // Update goal currentAmount and store linked holdings
    state.goals.forEach(g => {
      if (goalAmounts[g.id] > 0) {
        g.currentAmount = Math.round(goalAmounts[g.id]);
      }
    });

    // Store the fund mapping in state and localStorage
    state.goalFundMap = goalFunds;
    try { localStorage.setItem('wealthos_goal_fund_map', JSON.stringify(goalFunds)); } catch (e) {}

    saveToStorage();
    renderGoals();
    renderGoalAllocation();
    closeAllocModal();
    toast('Holdings allocated to goals successfully!', 'success');
  }

  /**
   * Close the auto-allocate modal
   */
  function closeAllocModal() {
    const modal = $('#allocModal');
    if (modal) modal.classList.remove('active');
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── GOAL-WISE ALLOCATION VIEW ────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get the goal-fund mapping (which holdings are tagged to which goals).
   * Loads from localStorage if available, otherwise returns empty mapping.
   * @returns {Object} Map of goalId → Array of fund objects
   */
  function getGoalFundMapping() {
    // Use in-memory state first
    if (state.goalFundMap && Object.keys(state.goalFundMap).length > 0) {
      return state.goalFundMap;
    }
    // Fall back to localStorage
    try {
      const saved = localStorage.getItem('wealthos_goal_fund_map');
      if (saved) {
        state.goalFundMap = JSON.parse(saved);
        return state.goalFundMap;
      }
    } catch (e) {}
    return {};
  }

  /**
   * Render the goal-wise allocation section as tiles (one per goal)
   */
  function renderGoalAllocation() {
    const container = $('#goalAllocTiles');
    if (!container) return;

    const totalPortfolio = state.holdings.reduce((s, h) => s + h.value, 0);

    // Get the goal-fund mapping from the last auto-allocation
    const goalFundMap = getGoalFundMapping();

    // Define ideal asset allocation targets per goal horizon
    const IDEAL_ALLOC = {
      long:    { equity: 60, debt: 15, gold: 10, international: 10, hybrid: 5 },   // >7yr
      medium:  { equity: 40, debt: 30, gold: 10, international: 10, hybrid: 10 },  // 3-7yr
      short:   { equity: 10, debt: 60, gold: 10, international: 5, hybrid: 15 },   // <3yr
      ongoing: { equity: 20, debt: 50, gold: 10, international: 5, hybrid: 15 },   // no deadline
    };

    const ASSET_LABELS = { equity: 'Equity', debt: 'Debt', gold: 'Gold', international: 'US / Intl', hybrid: 'Hybrid' };
    const ASSET_COLORS = { equity: '#4f9cf9', debt: '#5a5550', gold: '#f5a623', international: '#a78bfa', hybrid: '#52c89c' };

    container.innerHTML = state.goals.map(g => {
      const yearsLeft = g.targetYear ? Math.max(0, g.targetYear - new Date().getFullYear()) : null;
      const tagged = g.currentAmount;
      const fundsPct = tagged > 0 ? ((tagged / totalPortfolio) * 100).toFixed(1) : '0.0';

      // Future value of current amount (assuming 12% CAGR)
      const cagr = 0.12;
      const fv = yearsLeft ? tagged * Math.pow(1 + cagr, yearsLeft) : tagged;

      // SIP required to fill the gap
      const gap = Math.max(0, g.targetAmount - fv);
      const monthlyRate = cagr / 12;
      const months = yearsLeft ? yearsLeft * 12 : 1;
      const sipRequired = gap > 0 && months > 0 ? (gap * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1) : 0;

      // Progress bar
      const progress = g.targetAmount > 0 ? Math.min(100, (tagged / g.targetAmount) * 100) : 0;
      let barColor = g.color || 'var(--blue)';
      if (progress < 20) barColor = 'var(--red)';
      else if (progress < 50) barColor = 'var(--amber)';
      else if (progress >= 80) barColor = 'var(--teal)';

      // Get funds assigned to this goal
      const assignedFunds = goalFundMap[g.id] || [];
      const goalTotal = assignedFunds.reduce((s, f) => s + f.allocatedValue, 0);

      // Compute asset-class breakdown for this goal
      const horizon = getGoalHorizon(g);
      const idealAlloc = IDEAL_ALLOC[horizon] || IDEAL_ALLOC.medium;

      // Actual allocation by asset class within this goal
      const actualByClass = { equity: 0, debt: 0, gold: 0, international: 0, hybrid: 0 };
      assignedFunds.forEach(f => {
        const holding = state.holdings[f.holdingIdx];
        if (holding) {
          const cls = getAssetClass(holding);
          actualByClass[cls] = (actualByClass[cls] || 0) + f.allocatedValue;
        }
      });

      // Convert to percentages
      const actualPctByClass = {};
      Object.keys(actualByClass).forEach(cls => {
        actualPctByClass[cls] = goalTotal > 0 ? (actualByClass[cls] / goalTotal) * 100 : 0;
      });

      // Rebalance recommendations
      const rebalActions = Object.keys(idealAlloc).map(cls => {
        const ideal = idealAlloc[cls];
        const actual = actualPctByClass[cls] || 0;
        const drift = actual - ideal;
        const driftAmt = goalTotal > 0 ? (drift / 100) * goalTotal : 0;
        return { cls, ideal, actual, drift, driftAmt };
      }).filter(a => Math.abs(a.drift) > 5); // Only show significant drifts

      return `<div class="goal-tile">
        <div class="goal-tile-header">
          <div class="goal-tile-title">
            <span class="dot" style="background:${g.color}"></span>
            ${g.name}
            <span style="margin-left:auto;font-size:10px;font-family:var(--font-mono);color:var(--text3)">${g.targetYear || 'Ongoing'}</span>
          </div>
          <div class="goal-tile-metrics">
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Target</div>
              <div class="goal-tile-metric-value">${fmtINR(g.targetAmount)}</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Time Left</div>
              <div class="goal-tile-metric-value">${yearsLeft !== null ? yearsLeft + ' yrs' : '—'}</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Tagged</div>
              <div class="goal-tile-metric-value accent">${fmtINR(tagged)}</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Future Value</div>
              <div class="goal-tile-metric-value ${fv >= g.targetAmount ? 'teal' : 'warn'}">${fmtINR(Math.round(fv))}</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">SIP Required</div>
              <div class="goal-tile-metric-value ${sipRequired > 0 ? 'warn' : 'teal'}">${sipRequired > 0 ? fmtINR(Math.round(sipRequired)) + '/mo' : '✓ On track'}</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Progress</div>
              <div class="goal-tile-metric-value">${progress.toFixed(0)}%</div>
            </div>
          </div>
          <div class="goal-tile-bar"><div class="goal-tile-bar-fill" style="width:${progress.toFixed(0)}%;background:${barColor}"></div></div>
        </div>
        <div class="goal-tile-body">
          ${goalTotal > 0 ? `
            <!-- FUND LIST (TOP) -->
            <div class="goal-tile-fund-header" style="background:var(--bg3)">
              <span class="col-name">Fund</span>
              <span class="col-val">Value</span>
              <span class="col-pct">Actual %</span>
              <span class="col-ideal">Ideal %</span>
            </div>
            ${assignedFunds.map(f => {
              const actualPct = goalTotal > 0 ? ((f.allocatedValue / goalTotal) * 100).toFixed(1) : '0.0';
              const idealEqualPct = assignedFunds.length > 0 ? (100 / assignedFunds.length).toFixed(1) : '0.0';
              return `<div class="goal-tile-fund-row">
                <div class="goal-tile-fund-name">
                  <div class="name">${f.name}</div>
                  <div class="cat">${f.category}</div>
                </div>
                <div class="goal-tile-fund-val">${fmtINR(f.allocatedValue)}</div>
                <div class="goal-tile-fund-pct">${actualPct}%</div>
                <div class="goal-tile-fund-ideal">${idealEqualPct}%</div>
              </div>`;
            }).join('')}

            <!-- ASSET TYPE BREAKDOWN (BOTTOM) -->
            <div class="goal-tile-fund-header" style="background:var(--bg3);border-top:2px solid var(--border2)">
              <span class="col-name">Asset Type</span>
              <span class="col-val">Value</span>
              <span class="col-pct">Actual %</span>
              <span class="col-ideal">Ideal %</span>
              <span class="col-ideal">Drift</span>
            </div>
            ${Object.keys(ASSET_LABELS).map(cls => {
              const val = actualByClass[cls] || 0;
              const actual = actualPctByClass[cls] || 0;
              const ideal = idealAlloc[cls] || 0;
              const drift = actual - ideal;
              const driftColor = Math.abs(drift) < 5 ? 'var(--teal)' : drift > 0 ? 'var(--red)' : 'var(--amber)';
              return `<div class="goal-tile-fund-row">
                <div class="goal-tile-fund-name">
                  <div class="name" style="display:flex;align-items:center;gap:6px">
                    <span style="width:6px;height:6px;border-radius:2px;background:${ASSET_COLORS[cls]}"></span>
                    ${ASSET_LABELS[cls]}
                  </div>
                </div>
                <div class="goal-tile-fund-val">${val > 0 ? fmtINR(val) : '—'}</div>
                <div class="goal-tile-fund-pct">${actual.toFixed(1)}%</div>
                <div class="goal-tile-fund-ideal">${ideal}%</div>
                <div class="goal-tile-fund-ideal" style="color:${driftColor};font-weight:500">${drift > 0 ? '+' : ''}${drift.toFixed(1)}%</div>
              </div>`;
            }).join('')}

            <!-- REBALANCE SUGGESTION -->
            ${rebalActions.length > 0 ? `
              <div style="padding:10px 18px;border-top:1px solid var(--border2);background:var(--bg3)">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);margin-bottom:6px;font-weight:500">Rebalance Suggestion</div>
                ${rebalActions.map(a => {
                  const action = a.drift > 0 ? 'Reduce' : 'Increase';
                  const icon = a.drift > 0 ? 'arrow-down' : 'arrow-up';
                  const color = a.drift > 0 ? 'var(--red)' : 'var(--teal)';
                  return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px">
                    <i class="ti ti-${icon}" style="color:${color};font-size:12px"></i>
                    <span style="color:var(--text2)">${action} <strong style="color:var(--text)">${ASSET_LABELS[a.cls]}</strong> by ${Math.abs(a.drift).toFixed(0)}%</span>
                    <span style="margin-left:auto;font-family:var(--font-mono);color:${color};font-size:10px">${a.driftAmt > 0 ? '+' : ''}${fmtINR(Math.abs(Math.round(a.driftAmt)))}</span>
                  </div>`;
                }).join('')}
              </div>
            ` : goalTotal > 0 ? `
              <div style="padding:10px 18px;border-top:1px solid var(--border);text-align:center;font-size:11px;color:var(--teal)">
                <i class="ti ti-check" style="margin-right:4px"></i>Balanced — no rebalancing needed
              </div>
            ` : ''}
          ` : `<div class="goal-tile-empty"><i class="ti ti-link-off" style="font-size:16px;display:block;margin-bottom:4px"></i>No funds tagged. Use Auto Allocate in Goals.</div>`}
        </div>
      </div>`;
    }).join('');
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── EDIT ALLOCATION (MANUAL) ──────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /**
   * Open the edit allocation modal — shows each holding with a dropdown
   * to assign/reassign it to a goal, with % slider
   */
  function openEditAllocModal() {
    const modal = $('#editAllocModal');
    const body = $('#editAllocModalBody');
    if (!modal || !body) return;

    const goalFundMap = getGoalFundMapping();

    // Build a reverse map: holdingIdx → { goalId, pct }
    const holdingAssignments = {};
    Object.entries(goalFundMap).forEach(([goalId, funds]) => {
      funds.forEach(f => {
        holdingAssignments[f.holdingIdx] = { goalId, pct: f.pct || 100 };
      });
    });

    const goalOptions = state.goals.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    body.innerHTML = `
      <div class="alloc-hint" style="margin-bottom:12px">
        <i class="ti ti-info-circle" style="margin-right:6px"></i>
        Assign each holding to a goal and set what % of that holding goes towards it.
      </div>
      <table class="alloc-table">
        <thead>
          <tr>
            <th>Holding</th>
            <th style="width:100px">Value</th>
            <th style="width:170px">Goal</th>
            <th style="width:60px">%</th>
          </tr>
        </thead>
        <tbody>
          ${state.holdings.map((h, i) => {
            const assignment = holdingAssignments[i] || { goalId: '', pct: 100 };
            return `<tr>
              <td>
                <div class="alloc-fund-name">${h.name}</div>
                <div class="alloc-fund-cat">${h.category}</div>
              </td>
              <td class="alloc-fund-value">${fmtINR(h.value)}</td>
              <td>
                <select class="alloc-goal-select" data-edit-idx="${i}">
                  <option value="">— None —</option>
                  ${goalOptions.replace(`value="${assignment.goalId}"`, `value="${assignment.goalId}" selected`)}
                </select>
              </td>
              <td><input type="number" class="alloc-pct-input" data-edit-pct-idx="${i}" min="0" max="100" value="${assignment.pct}"></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

    modal.classList.add('active');
  }

  /**
   * Save manual allocation edits
   */
  function saveEditAllocation() {
    const selects = $$('#editAllocModalBody .alloc-goal-select');
    const pctInputs = $$('#editAllocModalBody .alloc-pct-input');

    const goalFunds = {};
    const goalAmounts = {};
    state.goals.forEach(g => { goalFunds[g.id] = []; goalAmounts[g.id] = 0; });

    selects.forEach((sel, i) => {
      const goalId = sel.value;
      const pct = parseFloat(pctInputs[i]?.value) || 0;
      const h = state.holdings[i];
      if (!goalId || !h) return;
      const allocated = Math.round(h.value * (pct / 100));
      goalFunds[goalId].push({ holdingIdx: i, name: h.name, category: h.category, holdingValue: h.value, allocatedValue: allocated, pct });
      goalAmounts[goalId] += allocated;
    });

    // Update goal currentAmounts
    state.goals.forEach(g => { if (goalAmounts[g.id] > 0) g.currentAmount = goalAmounts[g.id]; });

    // Save mapping
    state.goalFundMap = goalFunds;
    try { localStorage.setItem('wealthos_goal_fund_map', JSON.stringify(goalFunds)); } catch (e) {}

    saveToStorage();
    renderGoals();
    renderGoalAllocation();
    closeEditAllocModal();
    toast('Allocation updated!', 'success');
  }

  /**
   * Close the edit allocation modal
   */
  function closeEditAllocModal() {
    const modal = $('#editAllocModal');
    if (modal) modal.classList.remove('active');
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── ADD MANUAL ASSET (PF, NPS, PPF, GOLD, ETC.) ──────────────
  // ─────────────────────────────────────────────────────────────────

  /** Predefined asset types with default categories and expected returns */
  const ASSET_PRESETS = [
    { label: 'EPF (Employee PF)', category: 'Debt · EPF', defaultXirr: 8.25 },
    { label: 'PPF', category: 'Debt · PPF', defaultXirr: 7.1 },
    { label: 'NPS (Tier I)', category: 'Retirement · NPS', defaultXirr: 10.0 },
    { label: 'NPS (Tier II)', category: 'Retirement · NPS', defaultXirr: 9.5 },
    { label: 'Physical Gold', category: 'Gold · Physical', defaultXirr: 11.0 },
    { label: 'Sovereign Gold Bond (SGB)', category: 'Gold · SGB', defaultXirr: 12.5 },
    { label: 'Fixed Deposit', category: 'Debt · FD', defaultXirr: 7.0 },
    { label: 'Real Estate', category: 'Real Estate', defaultXirr: 8.0 },
    { label: 'Savings Account', category: 'Debt · Savings', defaultXirr: 3.5 },
    { label: 'SSY (Sukanya Samriddhi)', category: 'Debt · SSY', defaultXirr: 8.2 },
    { label: 'Crypto', category: 'Alternative · Crypto', defaultXirr: 0 },
    { label: 'Other', category: 'Other', defaultXirr: 0 },
  ];

  /**
   * Open the Add Asset modal with a form for manual entry
   */
  function openAssetModal() {
    const modal = $('#assetModal');
    const form = $('#assetForm');
    if (!modal || !form) return;

    const presetOptions = ASSET_PRESETS.map(p => `<option value="${p.label}">${p.label}</option>`).join('');

    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Asset Type</label>
        <select class="form-input form-select" id="assetPreset">
          ${presetOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Name / Description</label>
        <input class="form-input" id="assetName" type="text" placeholder="e.g. My EPF - Company XYZ" value="">
        <div class="form-hint">Optional. Defaults to the asset type if left blank.</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Current Value (₹)</label>
          <input class="form-input" id="assetValue" type="number" min="0" placeholder="e.g. 500000" required>
        </div>
        <div class="form-group">
          <label class="form-label">Total Invested (₹)</label>
          <input class="form-input" id="assetInvested" type="number" min="0" placeholder="e.g. 400000">
          <div class="form-hint">Leave blank if same as current value</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Monthly Contribution (₹)</label>
          <input class="form-input" id="assetSIP" type="number" min="0" placeholder="e.g. 10000" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">Expected Return % (p.a.)</label>
          <input class="form-input" id="assetReturn" type="number" step="0.1" placeholder="e.g. 8.25" value="${ASSET_PRESETS[0].defaultXirr}">
        </div>
      </div>
    `;

    // Update default return when preset changes
    form.querySelector('#assetPreset').addEventListener('change', (e) => {
      const preset = ASSET_PRESETS.find(p => p.label === e.target.value);
      if (preset) {
        const retInput = form.querySelector('#assetReturn');
        if (retInput) retInput.value = preset.defaultXirr;
      }
    });

    modal.classList.add('active');
    setTimeout(() => form.querySelector('#assetValue')?.focus(), 100);
  }

  /**
   * Save the manually entered asset as a holding
   */
  function saveAsset() {
    const presetLabel = $('#assetPreset')?.value || '';
    const preset = ASSET_PRESETS.find(p => p.label === presetLabel) || ASSET_PRESETS[ASSET_PRESETS.length - 1];
    const name = ($('#assetName')?.value.trim()) || preset.label;
    const value = parseFloat($('#assetValue')?.value) || 0;
    const invested = parseFloat($('#assetInvested')?.value) || value;
    const sip = parseFloat($('#assetSIP')?.value) || 0;
    const xirr = parseFloat($('#assetReturn')?.value) || preset.defaultXirr;

    if (value <= 0) { toast('Please enter the current value', 'error'); return; }

    const colors = ['#5a5550', '#f5a623', '#52c89c', '#a78bfa', '#4f9cf9', '#f97373', '#c8f97a'];

    state.holdings.push({
      name,
      category: preset.category,
      value,
      invested,
      xirr,
      sip,
      color: colors[state.holdings.length % colors.length],
    });

    saveToStorage();
    renderHoldings();
    updateDashboardMetrics();
    closeAssetModal();
    toast(`${name} added to holdings (${fmtINR(value)})`, 'success');
  }

  /**
   * Close the asset modal
   */
  function closeAssetModal() {
    const modal = $('#assetModal');
    if (modal) modal.classList.remove('active');
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── GOAL-WISE REBALANCING ─────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  /**
   * Render goal-wise rebalancing suggestions.
   * For each goal, shows:
   * - Current allocation vs ideal (based on target proportions)
   * - Which funds are over/under-weight within the goal
   * - Suggested actions (buy more, reduce, switch)
   */
  function renderRebalancing() {
    const container = $('#rebalTiles');
    const alertsEl = $('#rebalAlerts');
    if (!container) return;

    const goalFundMap = getGoalFundMapping();
    const totalPortfolio = state.holdings.reduce((s, h) => s + h.value, 0);
    const totalTarget = state.goals.reduce((s, g) => s + g.targetAmount, 0);

    // Calculate how much SHOULD go to each goal (proportional to target)
    const goalIdealAmounts = {};
    state.goals.forEach(g => {
      goalIdealAmounts[g.id] = totalTarget > 0 ? totalPortfolio * (g.targetAmount / totalTarget) : 0;
    });

    // Summary alerts
    let needsRebal = false;
    const alertsList = [];

    state.goals.forEach(g => {
      const ideal = goalIdealAmounts[g.id] || 0;
      const actual = g.currentAmount || 0;
      const driftPct = ideal > 0 ? ((actual - ideal) / ideal) * 100 : 0;
      if (Math.abs(driftPct) > 15) {
        needsRebal = true;
        alertsList.push({ goal: g, driftPct, actual, ideal });
      }
    });

    if (alertsEl) {
      if (needsRebal) {
        alertsEl.innerHTML = `<div class="alert alert-warn" style="margin-bottom:14px"><i class="ti ti-refresh-alert"></i><div class="alert-text"><strong>${alertsList.length} goal(s) need rebalancing</strong><span>${alertsList.map(a => `${a.goal.name} (${a.driftPct > 0 ? '+' : ''}${a.driftPct.toFixed(0)}% drift)`).join(', ')}</span></div></div>`;
      } else {
        alertsEl.innerHTML = Object.keys(goalFundMap).length > 0
          ? `<div class="alert alert-success" style="margin-bottom:14px"><i class="ti ti-check"></i><div class="alert-text"><strong>Portfolio is balanced</strong><span>All goals are within acceptable drift thresholds (±15%).</span></div></div>`
          : `<div class="alert alert-info" style="margin-bottom:14px"><i class="ti ti-info-circle"></i><div class="alert-text"><strong>No allocation set</strong><span>Use Auto Allocate in the Goals or Allocation section to map your holdings to goals first.</span></div></div>`;
      }
    }

    // Render one tile per goal with rebalancing actions
    container.innerHTML = state.goals.map(g => {
      const idealAmt = goalIdealAmounts[g.id] || 0;
      const actualAmt = g.currentAmount || 0;
      const diff = actualAmt - idealAmt;
      const driftPct = idealAmt > 0 ? ((diff) / idealAmt) * 100 : 0;
      const funds = goalFundMap[g.id] || [];
      const goalTotal = funds.reduce((s, f) => s + f.allocatedValue, 0);

      // Generate actions per fund
      let actionsHtml = '';
      if (funds.length === 0) {
        actionsHtml = `<div class="goal-tile-empty"><i class="ti ti-link-off" style="font-size:16px;display:block;margin-bottom:4px"></i>No funds allocated. Run Auto Allocate first.</div>`;
      } else {
        // Ideal equal-weight per fund
        const idealPerFund = goalTotal / funds.length;
        actionsHtml = funds.map(f => {
          const fundDiff = f.allocatedValue - idealPerFund;
          const fundDriftPct = idealPerFund > 0 ? ((fundDiff) / idealPerFund) * 100 : 0;
          let action, icon, amtClass;

          if (fundDriftPct > 20) {
            action = 'Over-weight — consider reducing';
            icon = 'sell';
            amtClass = 'color:var(--red)';
          } else if (fundDriftPct < -20) {
            action = 'Under-weight — consider adding';
            icon = 'buy';
            amtClass = 'color:var(--teal)';
          } else {
            action = 'Within range — hold';
            icon = 'hold';
            amtClass = 'color:var(--text2)';
          }

          return `<div class="rebal-action">
            <div class="rebal-action-icon ${icon}"><i class="ti ti-${icon === 'buy' ? 'arrow-up' : icon === 'sell' ? 'arrow-down' : 'minus'}"></i></div>
            <div class="rebal-action-text">
              <strong>${f.name}</strong>
              <span>${f.category} · ${action}</span>
            </div>
            <div class="rebal-action-amount" style="${amtClass}">${fundDiff > 0 ? '+' : ''}${fmtINR(Math.round(fundDiff))}</div>
          </div>`;
        }).join('');
      }

      // Goal status badge
      const statusClass = Math.abs(driftPct) < 15 ? 'teal' : driftPct > 0 ? 'red' : 'amber';
      const statusLabel = Math.abs(driftPct) < 15 ? 'Balanced' : driftPct > 0 ? 'Over-allocated' : 'Under-allocated';

      return `<div class="goal-tile">
        <div class="goal-tile-header">
          <div class="goal-tile-title">
            <span class="dot" style="background:${g.color}"></span>
            ${g.name}
            <span style="margin-left:auto;font-size:10px;padding:2px 8px;border-radius:4px;background:var(--${statusClass}-bg);color:var(--${statusClass})">${statusLabel}</span>
          </div>
          <div class="goal-tile-metrics" style="grid-template-columns:repeat(4,1fr)">
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Ideal Allocation</div>
              <div class="goal-tile-metric-value">${fmtINR(Math.round(idealAmt))}</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Actual</div>
              <div class="goal-tile-metric-value">${fmtINR(Math.round(actualAmt))}</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Drift</div>
              <div class="goal-tile-metric-value ${statusClass}">${driftPct > 0 ? '+' : ''}${driftPct.toFixed(1)}%</div>
            </div>
            <div class="goal-tile-metric">
              <div class="goal-tile-metric-label">Action Needed</div>
              <div class="goal-tile-metric-value" style="color:var(--${statusClass})">${diff > 0 ? 'Reduce ' + fmtINR(Math.abs(Math.round(diff))) : diff < 0 ? 'Add ' + fmtINR(Math.abs(Math.round(diff))) : '—'}</div>
            </div>
          </div>
        </div>
        <div class="goal-tile-body">${actionsHtml}</div>
      </div>`;
    }).join('');
  }

  /**
   * Initialize goals event listeners
   */
  function initGoals() {
    // Add Goal button
    const btnAdd = $('#btnAddGoal');
    if (btnAdd) btnAdd.addEventListener('click', () => openGoalModal(null));

    // Auto Allocate button
    const btnAlloc = $('#btnAutoAllocate');
    if (btnAlloc) btnAlloc.addEventListener('click', openAllocModal);

    // Alloc modal close/cancel/apply
    const allocClose = $('#allocModalClose');
    const allocCancel = $('#allocModalCancel');
    const allocApply = $('#allocModalApply');
    if (allocClose) allocClose.addEventListener('click', closeAllocModal);
    if (allocCancel) allocCancel.addEventListener('click', closeAllocModal);
    if (allocApply) allocApply.addEventListener('click', applyAllocation);
    const allocModal = $('#allocModal');
    if (allocModal) allocModal.addEventListener('click', (e) => { if (e.target === allocModal) closeAllocModal(); });

    // Modal close
    const modalClose = $('#goalModalClose');
    const modalCancel = $('#goalModalCancel');
    if (modalClose) modalClose.addEventListener('click', closeGoalModal);
    if (modalCancel) modalCancel.addEventListener('click', closeGoalModal);

    // Close on backdrop click
    const modal = $('#goalModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeGoalModal(); });

    // Close on Escape
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal?.classList.contains('active')) closeGoalModal(); });

    // Form submit
    const form = $('#goalForm');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); saveGoal(); });

    // Event delegation for edit/delete buttons on goal cards
    const grid = $('#goalsGrid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-goal-edit]');
        if (editBtn) {
          const goal = state.goals.find(g => g.id === editBtn.dataset.goalEdit);
          if (goal) openGoalModal(goal);
          return;
        }
        const deleteBtn = e.target.closest('[data-goal-delete]');
        if (deleteBtn) {
          deleteGoal(deleteBtn.dataset.goalDelete);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── INSURANCE TRACKER MODULE ─────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  const INSURANCE_STORAGE_KEY = 'wealthos_insurance';

  const INSURANCE_TYPE_LABELS = {
    term_life: 'Term Life',
    health: 'Health',
    super_topup: 'Super Top-up',
    critical_illness: 'Critical Illness',
    personal_accident: 'Personal Accident',
    motor: 'Motor',
    home: 'Home',
    travel: 'Travel',
    ulip: 'ULIP / Endowment',
    other: 'Other',
  };

  /** Load insurance policies from localStorage */
  function loadInsuranceFromStorage() {
    try {
      const saved = localStorage.getItem(INSURANCE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) { state.insurance = parsed; return; }
      }
    } catch (e) { console.warn('Insurance load failed:', e); }
    state.insurance = [];
  }

  /** Save insurance policies to localStorage */
  function saveInsuranceToStorage() {
    try {
      localStorage.setItem(INSURANCE_STORAGE_KEY, JSON.stringify(state.insurance));
    } catch (e) { console.warn('Insurance save failed:', e); }
  }

  /** Calculate days until a date */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  }

  /** Render insurance summary metrics */
  function renderInsuranceMetrics() {
    const policies = state.insurance || [];
    
    let lifeCover = 0;
    let healthCover = 0;
    let totalPremium = 0;
    
    policies.forEach(p => {
      const cover = parseNum(p.sumAssured);
      const prem = parseNum(p.annualPremium);
      
      let annualPrem = prem;
      if (p.premiumFreq === 'half_yearly') annualPrem = prem * 2;
      else if (p.premiumFreq === 'quarterly') annualPrem = prem * 4;
      else if (p.premiumFreq === 'monthly') annualPrem = prem * 12;
      totalPremium += annualPrem;

      if (p.type === 'term_life') lifeCover += cover;
      if (['health', 'super_topup', 'critical_illness'].includes(p.type)) healthCover += cover;
    });

    const elLife = $('#insLifeCover');
    const elHealth = $('#insHealthCover');
    const elPrem = $('#insAnnualPremium');
    const elCount = $('#insPolicyCount');

    if (elLife) elLife.textContent = policies.length ? fmtINR(lifeCover) : '—';
    if (elHealth) elHealth.textContent = policies.length ? fmtINR(healthCover) : '—';
    if (elPrem) elPrem.textContent = policies.length ? fmtINR(totalPremium) : '—';
    if (elCount) elCount.textContent = policies.length;
  }

  /** Render renewal alerts */
  function renderInsuranceAlerts() {
    const container = $('#insuranceAlerts');
    if (!container) return;
    container.innerHTML = '';

    const policies = state.insurance || [];
    const upcoming = policies.filter(p => {
      const days = daysUntil(p.endDate);
      return days !== null && days >= 0 && days <= 60;
    }).sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));

    if (upcoming.length > 0) {
      upcoming.forEach(p => {
        const days = daysUntil(p.endDate);
        const urgency = days <= 15 ? 'alert-warn' : 'alert-info';
        const icon = days <= 15 ? 'ti-alert-triangle' : 'ti-clock';
        container.innerHTML += `
          <div class="alert ${urgency}" style="margin-bottom:10px">
            <i class="ti ${icon}"></i>
            <div class="alert-text">
              <strong>${p.name} — renewal in ${days} day${days !== 1 ? 's' : ''}</strong>
              <span>Premium: ${fmtINR(parseNum(p.annualPremium))} · Expires: ${new Date(p.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>`;
      });
    }

    const lifeCover = policies.filter(p => p.type === 'term_life').reduce((s, p) => s + parseNum(p.sumAssured), 0);
    if (policies.length > 0 && lifeCover === 0) {
      container.innerHTML += `
        <div class="alert alert-warn" style="margin-bottom:10px">
          <i class="ti ti-alert-triangle"></i>
          <div class="alert-text"><strong>No term life insurance found</strong><span>Consider adding a term plan with 10-15× annual income coverage.</span></div>
        </div>`;
    }
  }

  /** Render insurance policy cards */
  function renderInsuranceCards() {
    const container = $('#insuranceCards');
    if (!container) return;

    const policies = state.insurance || [];
    if (policies.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--text3)">
          <i class="ti ti-shield-off" style="font-size:40px;display:block;margin-bottom:12px;opacity:0.4"></i>
          <div style="font-size:14px;margin-bottom:6px">No insurance policies added yet</div>
          <div style="font-size:12px">Click <strong>Add Policy</strong> to track your life, health & general insurance.</div>
        </div>`;
      return;
    }

    container.innerHTML = policies.map(p => {
      const days = daysUntil(p.endDate);
      const renewalWarn = (days !== null && days >= 0 && days <= 60)
        ? `<div class="ins-renewal-warn"><i class="ti ti-clock"></i>Renews in ${days} day${days !== 1 ? 's' : ''}</div>`
        : '';
      const expired = (days !== null && days < 0)
        ? `<div class="ins-renewal-warn" style="color:var(--red)"><i class="ti ti-alert-circle"></i>Expired ${Math.abs(days)} days ago</div>`
        : '';

      const startStr = p.startDate ? new Date(p.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';
      const endStr = p.endDate ? new Date(p.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const freqLabel = { annual: 'Annual', half_yearly: 'Half-Yearly', quarterly: 'Quarterly', monthly: 'Monthly' }[p.premiumFreq] || 'Annual';

      return `
        <div class="ins-card" data-ins-id="${p.id}">
          <div class="ins-card-actions">
            <button data-ins-edit="${p.id}" title="Edit"><i class="ti ti-pencil"></i></button>
            <button data-ins-delete="${p.id}" title="Delete"><i class="ti ti-trash"></i></button>
          </div>
          <div class="ins-card-header">
            <span class="ins-card-type ins-type-${p.type}">${INSURANCE_TYPE_LABELS[p.type] || p.type}</span>
          </div>
          <div class="ins-card-name">${p.name}</div>
          <div class="ins-card-cover">${fmtINR(parseNum(p.sumAssured))}</div>
          <div class="ins-card-details">
            <div><div class="ins-card-detail-label">Premium</div><div class="ins-card-detail-value">${fmtINR(parseNum(p.annualPremium))} · ${freqLabel}</div></div>
            <div><div class="ins-card-detail-label">Policy #</div><div class="ins-card-detail-value">${p.policyNumber || '—'}</div></div>
            <div><div class="ins-card-detail-label">Start</div><div class="ins-card-detail-value">${startStr}</div></div>
            <div><div class="ins-card-detail-label">Renewal</div><div class="ins-card-detail-value">${endStr}</div></div>
            <div><div class="ins-card-detail-label">Cover Till</div><div class="ins-card-detail-value">${p.coverTill ? new Date(p.coverTill).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</div></div>
            <div><div class="ins-card-detail-label">Nominee</div><div class="ins-card-detail-value">${p.nominee || '—'}</div></div>
          </div>
          ${p.coveredMembers ? `<div class="ins-card-members" style="margin-top:10px"><i class="ti ti-users"></i>${p.coveredMembers}</div>` : ''}
          ${p.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:6px;font-style:italic">${p.notes}</div>` : ''}
          ${renewalWarn}${expired}
        </div>`;
    }).join('');
  }

  /** Open insurance modal for add/edit */
  function openInsuranceModal(policyId) {
    const modal = $('#insuranceModal');
    const title = $('#insuranceModalTitle');
    const form = $('#insuranceForm');
    if (!modal || !form) return;

    form.reset();
    state._editInsuranceId = null;

    if (policyId) {
      const p = (state.insurance || []).find(x => x.id === policyId);
      if (p) {
        state._editInsuranceId = policyId;
        title.textContent = 'Edit Insurance Policy';
        $('#insPolicyType').value = p.type;
        $('#insPolicyName').value = p.name;
        $('#insSumAssured').value = p.sumAssured;
        $('#insAnnualPrem').value = p.annualPremium;
        $('#insStartDate').value = p.startDate || '';
        $('#insEndDate').value = p.endDate || '';
        $('#insPolicyNumber').value = p.policyNumber || '';
        $('#insPremiumFreq').value = p.premiumFreq || 'annual';
        $('#insCoveredMembers').value = p.coveredMembers || '';
        $('#insCoverTill').value = p.coverTill || '';
        $('#insNominee').value = p.nominee || '';
        $('#insNotes').value = p.notes || '';
      }
    } else {
      title.textContent = 'Add Insurance Policy';
    }

    modal.classList.add('active');
  }

  /** Close insurance modal */
  function closeInsuranceModal() {
    const modal = $('#insuranceModal');
    if (modal) modal.classList.remove('active');
    state._editInsuranceId = null;
  }

  /** Save insurance form */
  function saveInsuranceForm() {
    const type = $('#insPolicyType').value;
    const name = $('#insPolicyName').value.trim();
    const sumAssured = $('#insSumAssured').value.trim();
    const annualPremium = $('#insAnnualPrem').value.trim();

    if (!type || !name || !sumAssured || !annualPremium) {
      toast('Please fill in all required fields', 'error');
      return;
    }

    // Validate numeric fields
    if (parseNum(sumAssured) <= 0) {
      toast('Sum Assured must be a positive number', 'error'); return;
    }
    if (parseNum(annualPremium) <= 0) {
      toast('Annual Premium must be a positive number', 'error'); return;
    }

    const policy = {
      id: state._editInsuranceId || ('ins_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      type,
      name,
      sumAssured,
      annualPremium,
      startDate: $('#insStartDate').value || null,
      endDate: $('#insEndDate').value || null,
      policyNumber: $('#insPolicyNumber').value.trim() || null,
      premiumFreq: $('#insPremiumFreq').value || 'annual',
      coveredMembers: $('#insCoveredMembers').value.trim() || null,
      coverTill: $('#insCoverTill').value || null,
      nominee: $('#insNominee').value.trim() || null,
      notes: $('#insNotes').value.trim() || null,
    };

    if (!state.insurance) state.insurance = [];

    if (state._editInsuranceId) {
      const idx = state.insurance.findIndex(p => p.id === state._editInsuranceId);
      if (idx >= 0) state.insurance[idx] = policy;
    } else {
      state.insurance.push(policy);
    }

    saveInsuranceToStorage();
    renderInsuranceMetrics();
    renderInsuranceAlerts();
    renderInsuranceCards();
    closeInsuranceModal();
    toast(state._editInsuranceId ? 'Policy updated' : 'Policy added', 'success');
  }

  /** Delete insurance policy */
  function deleteInsurancePolicy(policyId) {
    if (!confirm('Delete this insurance policy?')) return;
    state.insurance = (state.insurance || []).filter(p => p.id !== policyId);
    saveInsuranceToStorage();
    renderInsuranceMetrics();
    renderInsuranceAlerts();
    renderInsuranceCards();
    toast('Policy deleted', 'info');
  }

  /** Initialize insurance module event listeners */
  function initInsurance() {
    loadInsuranceFromStorage();
    renderInsuranceMetrics();
    renderInsuranceAlerts();
    renderInsuranceCards();

    const btnAdd = $('#btnAddInsurance');
    if (btnAdd) btnAdd.addEventListener('click', () => openInsuranceModal(null));

    const btnClose = $('#insuranceModalClose');
    const btnCancel = $('#insuranceModalCancel');
    if (btnClose) btnClose.addEventListener('click', closeInsuranceModal);
    if (btnCancel) btnCancel.addEventListener('click', closeInsuranceModal);

    const form = $('#insuranceForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveInsuranceForm();
      });
    }

    const cardsContainer = $('#insuranceCards');
    if (cardsContainer) {
      cardsContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-ins-edit]');
        if (editBtn) { openInsuranceModal(editBtn.dataset.insEdit); return; }
        const delBtn = e.target.closest('[data-ins-delete]');
        if (delBtn) { deleteInsurancePolicy(delBtn.dataset.insDelete); return; }
      });
    }

    const modal = $('#insuranceModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeInsuranceModal();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ─── INIT ───────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────

  function init() {
    // Load data
    loadFromStorage();
    loadGoalsFromStorage();
    renderHoldings();
    renderGoals();
    initGoals();
    initInsurance();

    // ── Navigation (event delegation) ──
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('.nav-item[data-section]');
      if (navBtn) {
        showSection(navBtn.dataset.section);
        return;
      }
      // "All goals" and similar card-action links
      const cardAction = e.target.closest('.card-action[data-section]');
      if (cardAction) {
        showSection(cardAction.dataset.section);
        return;
      }
    });

    // ── Scenario tabs (event delegation) ──
    const scenTabs = $('#scenarioTabs');
    if (scenTabs) {
      scenTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.stab[data-scenario]');
        if (!btn) return;
        state.currentScenario = btn.dataset.scenario;
        scenTabs.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        renderGrowthChart();
      });
    }

    // ── File import ──
    const importZone = $('#importZone');
    const fileIn = $('#fileIn');

    if (importZone && fileIn) {
      // Click to upload
      importZone.addEventListener('click', () => fileIn.click());

      // File input change
      fileIn.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileUpload(e.target.files[0]);
        e.target.value = ''; // Reset so same file can be re-selected
      });

      // Drag & Drop
      importZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        importZone.classList.add('dragover');
      });
      importZone.addEventListener('dragleave', () => {
        importZone.classList.remove('dragover');
      });
      importZone.addEventListener('drop', (e) => {
        e.preventDefault();
        importZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
      });
    }

    // ── Download template ──
    const tmplLink = $('#downloadTemplate');
    if (tmplLink) tmplLink.addEventListener('click', downloadTemplate);

    // ── Export button ──
    const btnExport = $('#btnExport');
    if (btnExport) btnExport.addEventListener('click', exportToCSV);

    // ── Add Asset button ──
    const btnAddAsset = $('#btnAddAsset');
    if (btnAddAsset) btnAddAsset.addEventListener('click', openAssetModal);

    // ── Asset modal close/cancel/save ──
    const assetClose = $('#assetModalClose');
    const assetCancel = $('#assetModalCancel');
    if (assetClose) assetClose.addEventListener('click', closeAssetModal);
    if (assetCancel) assetCancel.addEventListener('click', closeAssetModal);
    const assetForm = $('#assetForm');
    if (assetForm) assetForm.addEventListener('submit', (e) => { e.preventDefault(); saveAsset(); });
    const assetModal = $('#assetModal');
    if (assetModal) assetModal.addEventListener('click', (e) => { if (e.target === assetModal) closeAssetModal(); });

    // ── Refresh allocation button ──
    const btnRefreshAlloc = $('#btnRefreshAlloc');
    if (btnRefreshAlloc) btnRefreshAlloc.addEventListener('click', renderGoalAllocation);

    // ── Rebalancing recalculate button ──
    const btnRebalRefresh = $('#btnRebalRefresh');
    if (btnRebalRefresh) btnRebalRefresh.addEventListener('click', renderRebalancing);

    // ── Auto Allocate from allocation tab ──
    const btnAllocAuto2 = $('#btnAllocAutoFromTab');
    if (btnAllocAuto2) btnAllocAuto2.addEventListener('click', openAllocModal);

    // ── Edit Allocation button ──
    const btnEditAlloc = $('#btnEditAlloc');
    if (btnEditAlloc) btnEditAlloc.addEventListener('click', openEditAllocModal);

    // ── Edit Alloc modal close/cancel/save ──
    const editAllocClose = $('#editAllocModalClose');
    const editAllocCancel = $('#editAllocModalCancel');
    const editAllocSave = $('#editAllocModalSave');
    if (editAllocClose) editAllocClose.addEventListener('click', closeEditAllocModal);
    if (editAllocCancel) editAllocCancel.addEventListener('click', closeEditAllocModal);
    if (editAllocSave) editAllocSave.addEventListener('click', saveEditAllocation);
    const editAllocModal = $('#editAllocModal');
    if (editAllocModal) editAllocModal.addEventListener('click', (e) => { if (e.target === editAllocModal) closeEditAllocModal(); });

    // ── Import button (topbar) ──
    const btnImport = $('#btnImport');
    if (btnImport) btnImport.addEventListener('click', () => showSection('import'));

    // ── Projection inputs (debounced) ──
    const projInputs = ['cagrProj', 'stepupProj', 'retireProj', 'inflProj', 'projMonthlySIP', 'projEquityPct', 'projDebtPct'];
    const debouncedProj = debounce(renderProjection, 200);
    projInputs.forEach(id => {
      const input = $(`#${id}`);
      if (input) {
        input.addEventListener('input', (e) => {
          // Mark snapshot fields as user-edited so renderProjection won't overwrite them
          if (['projMonthlySIP', 'projEquityPct', 'projDebtPct'].includes(id)) {
            e.target._userEdited = true;
          }
          // Sync equity + debt = 100%
          if (id === 'projEquityPct') {
            const dtInput = $('#projDebtPct');
            if (dtInput) { dtInput.value = 100 - (parseFloat(e.target.value) || 0); dtInput._userEdited = true; }
          } else if (id === 'projDebtPct') {
            const eqInput = $('#projEquityPct');
            if (eqInput) { eqInput.value = 100 - (parseFloat(e.target.value) || 0); eqInput._userEdited = true; }
          }
          debouncedProj();
        });
      }
    });

    // ── Holdings search ──
    const searchInput = $('#holdingsSearch');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase();
        const rows = $$('#holdingsBody tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? '' : 'none';
        });
      }, 150));
    }

    // ── Initial chart renders ──
    renderAllocDonut();
    renderGrowthChart();
    updateDashboardMetrics();
    showSection('dashboard');
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
