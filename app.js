/* ==========================================================
   Medora Hospital Dashboard — data, screens and interactions
   ========================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const later = (fn, ms = 60) => setTimeout(fn, ms);

/* ---------- Helpers ---------- */
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmtK = n => n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(n));
const money = n => 'PKR ' + fmt(n);
const sum = a => a.reduce((x, y) => x + y, 0);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtTime = h => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
const initials = n => n.replace(/^Dr\.\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('');
const PALETTE = ['#1e6bff', '#173a9e', '#1b1c21', '#4f8dff', '#0ea5e9', '#6366f1'];
const colorFor = s => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

function countUp(el, to, { prefix = '', suffix = '', decimals = 0, dur = 1200, format, from } = {}) {
  if (!el) return;
  const start0 = from ?? el._val ?? 0;
  el._val = to;
  const start = performance.now();
  cancelAnimationFrame(el._raf);
  const step = now => {
    const t = Math.max(0, Math.min(1, (now - start) / dur));
    const v = start0 + (to - start0) * (1 - Math.pow(1 - t, 4));
    el.textContent = prefix + (format ? format(v) : decimals ? v.toFixed(decimals) : fmt(v)) + suffix;
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map(h => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return '#' + pa.map((c, i) => Math.round(c + (pb[i] - c) * t).toString(16).padStart(2, '0')).join('');
}

// Deterministic random so generated schedules stay stable per date
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sparkSVG(pts, w = 60, h = 22) {
  const max = Math.max(...pts), min = Math.min(...pts);
  const p = pts.map((v, i) => `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`);
  return `<svg viewBox="0 0 ${w} ${h}"><path d="M${p.join(' L')}"/></svg>`;
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast(`${filename} downloaded`);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
}

/* ==========================================================
   Dummy data
   ========================================================== */
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const DEPTS = ['Cardiology', 'Neurology', 'Pediatrics'];

const ADMISSIONS = {
  Weekly: {
    cols: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    full: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    rows: [[9, 31, 58, 62, 44, 70, 12], [14, 61, 30, 68, 55, 24, 59], [52, 66, 11, 36, 71, 28, 8]],
  },
  Monthly: {
    cols: ['A', 'M', 'J', 'J', 'A', 'S', 'O'],
    full: ['April', 'May', 'June', 'July', 'August', 'September', 'October'],
    rows: [[212, 248, 301, 186, 320, 342, 298], [140, 196, 254, 288, 172, 310, 276], [266, 180, 122, 230, 291, 205, 318]],
  },
  Yearly: {
    cols: ['20', '21', '22', '23', '24', '25', '26'],
    full: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'],
    rows: [[2410, 2780, 3120, 3390, 3610, 3880, 3240], [1820, 2050, 2330, 2710, 2960, 3220, 2950], [2990, 2610, 2840, 3070, 3350, 3560, 3010]],
  },
};

const SOURCES = ['Walk-in', 'Referral', 'Online', 'Emergency'];
const SOURCE_DATA = {
  'Sort by Week':  { range: '7 Days',    values: [1860, 1340, 2910, 2050],      trend: [1, -1, 1, -1], growth: 6.2,  label: 'better than last week' },
  'Sort by Month': { range: '30 Days',   values: [7700, 5600, 12000, 8300],     trend: [1, -1, 1, -1], growth: 18.4, label: 'better than last month' },
  'Sort by Year':  { range: '12 Months', values: [88400, 61200, 142600, 97100], trend: [1, 1, 1, -1],  growth: 32.9, label: 'better than last year' },
};

const OCCUPANCY = {
  'For Week':  { all: { pct: 82, total: 500, note: 'Occupancy is 4% higher than last week' },
                 icu: { pct: 91, total: 64,  note: 'ICU is near capacity — 6 beds free' } },
  'For Month': { all: { pct: 76, total: 500, note: 'Occupancy is 2% lower than last month' },
                 icu: { pct: 87, total: 64,  note: 'ICU averaged 8 free beds this month' } },
};
const WARDS = [
  ['General Ward', 212, 240], ['Intensive Care (ICU)', 58, 64], ['Maternity', 41, 52],
  ['Pediatrics', 38, 48], ['Cardiac Care', 34, 40], ['Surgical Ward', 29, 56],
];

const TODAY_METRICS = [
  { label: 'Today<br/>Revenue',  value: 2384500, prefix: 'PKR ', suffix: '',   trend: 12, spark: [8, 10, 9, 13, 12, 15, 14, 18] },
  { label: 'Today<br/>Admitted', value: 186,   prefix: '',   suffix: ' pts', trend: 8,  spark: [5, 7, 6, 9, 8, 7, 10, 11] },
  { label: 'Avg. ER<br/>Wait',   value: 23,    prefix: '',   suffix: ' min', trend: -5, spark: [14, 12, 13, 10, 11, 9, 10, 8] },
];

/* Analytics */
const KPI_MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const A_KPIS = [
  { label: 'Avg. Length of Stay', icon: 'i-clock', value: 4.2, decimals: 1, suffix: ' days', trend: -6, inverse: true, dark: true, spark: [5.1, 4.9, 4.8, 4.6, 4.7, 4.4, 4.3, 4.2] },
  { label: 'Readmission Rate', icon: 'i-activity', value: 8.4, decimals: 1, suffix: '%', trend: -1.2, inverse: true, spark: [10.2, 9.8, 9.9, 9.1, 8.9, 8.7, 8.6, 8.4] },
  { label: 'Patient Satisfaction', icon: 'i-heart', value: 92, suffix: '%', trend: 3, spark: [86, 87, 88, 88, 90, 89, 91, 92] },
  { label: 'Discharges', icon: 'i-user', value: 1126, scale: true, trend: 9, spark: [880, 920, 990, 950, 1040, 1010, 1090, 1126] },
];
const TREND = {
  'Last 12 Months': {
    labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    adm: [1180, 1095, 1240, 1310, 1275, 1360, 1420, 1385, 1290, 1340, 1405, 1284],
    dis: [1120, 1060, 1190, 1250, 1230, 1300, 1370, 1340, 1260, 1290, 1350, 1126],
  },
  'Previous Year': {
    labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    adm: [1090, 1010, 1150, 1205, 1170, 1240, 1300, 1280, 1190, 1225, 1290, 1210],
    dis: [1050, 990, 1110, 1160, 1140, 1200, 1260, 1250, 1170, 1190, 1240, 1150],
  },
};
const PATIENT_FACTOR = { 'All Patients': 1, Inpatients: .62, Outpatients: .38 };
const GENDER = [['Female', 54, '#1e6bff'], ['Male', 44, '#173a9e'], ['Other', 2, '#a9c9ff']];
const GENDER_TOTAL = 12480;
const AGE_GROUPS = [['0–17', 1840], ['18–34', 2960], ['35–49', 3120], ['50–64', 2580], ['65+', 1980]];
const AGE_COLORS = ['#1b1c21', '#173a9e', '#1e6bff', '#4f8dff', '#a9c9ff'];
const DIAGNOSES = [['Hypertension', 1420, 8], ['Type 2 Diabetes', 1180, 5], ['Respiratory Infection', 960, -12], ['Fractures & Trauma', 740, 3], ['Cardiac Arrhythmia', 610, 6]];

/* Billing */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REVENUE = {
  '2026': { vals: [59.4, 55.4, 66.1, 68.3, 70.3, 73.4, 69.4, 75.9, 80.1, 81.8, null, null], forecast: [, , , , , , , , , , 85.4, 89.0], current: 9 },
  '2025': { vals: [52.6, 49.3, 57.4, 59.9, 61.6, 64.7, 63.3, 66.6, 70.0, 71.7, 73.4, 78.7], current: -1, trend: 9.8 },
};
const CLAIMS = [['Approved', 412, '#1e6bff'], ['Pending', 48, '#a9c9ff'], ['Rejected', 14, '#1b1c21']];
const INSURERS = [['State Life', 128, 14, 4], ['Jubilee Health', 96, 11, 3], ['Adamjee Insurance', 74, 9, 2], ['EFU Health', 62, 8, 3], ['Sehat Card', 52, 6, 2]];
const PAYMENTS = [['Insurance', 58, '#1e6bff'], ['Card', 24, '#173a9e'], ['Cash', 12, '#1b1c21'], ['JazzCash / Easypaisa', 6, '#a9c9ff']];
const INVOICES = [
  { id: 'INV-24081', patient: 'Ayesha Khan',  dept: 'Cardiology',  date: '22 Oct 2026', amount: 118500, status: 'Paid',    payer: 'State Life' },
  { id: 'INV-24080', patient: 'Bilal Ahmed',  dept: 'Orthopedics', date: '22 Oct 2026', amount: 356000, status: 'Pending', payer: 'Jubilee Health' },
  { id: 'INV-24079', patient: 'Sara Iqbal',   dept: 'Pediatrics',  date: '21 Oct 2026', amount: 24000, status: 'Paid',    payer: 'Self-pay' },
  { id: 'INV-24078', patient: 'Usman Tariq',  dept: 'Neurology',   date: '21 Oct 2026', amount: 221500, status: 'Overdue', payer: 'EFU Health' },
  { id: 'INV-24077', patient: 'Hina Raza',    dept: 'Maternity',   date: '20 Oct 2026', amount: 148000, status: 'Paid',    payer: 'Sehat Card' },
  { id: 'INV-24076', patient: 'Umar Farooq',  dept: 'Emergency',   date: '20 Oct 2026', amount: 60000, status: 'Pending', payer: 'Self-pay' },
  { id: 'INV-24075', patient: 'Zainab Ali',   dept: 'Radiology',   date: '19 Oct 2026', amount: 41500, status: 'Paid',    payer: 'Adamjee Insurance' },
  { id: 'INV-24074', patient: 'Faisal Mehmood',  dept: 'Cardiology',  date: '18 Oct 2026', amount: 268000, status: 'Overdue', payer: 'State Life' },
];

/* Pharmacy */
const DISPENSE = {
  labels: ['Antibiotics', 'Analgesics', 'Cardiac', 'Insulin'],
  cols: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  full: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  rows: [[42, 118, 96, 131, 104, 122, 58], [88, 164, 152, 171, 149, 160, 92], [21, 64, 71, 58, 69, 62, 26], [12, 38, 41, 35, 44, 39, 15]],
};
const MEDS = [
  { name: 'Amoxicillin 500mg',  form: 'Capsule',  cat: 'Antibiotics', stock: 1240, reorder: 400,  expiry: 'Mar 2027', supplier: 'Ferozsons Laboratories' },
  { name: 'Paracetamol 500mg',  form: 'Tablet',   cat: 'Analgesics',  stock: 3820, reorder: 1000, expiry: 'Jan 2028', supplier: 'Getz Pharma' },
  { name: 'Atorvastatin 20mg',  form: 'Tablet',   cat: 'Cardiac',     stock: 310,  reorder: 500,  expiry: 'Aug 2027', supplier: 'Searle Pakistan' },
  { name: 'Insulin Glargine',   form: 'Pen',      cat: 'Endocrine',   stock: 64,   reorder: 150,  expiry: 'Nov 2026', supplier: 'Highnoon Laboratories' },
  { name: 'Metformin 500mg',    form: 'Tablet',   cat: 'Endocrine',   stock: 2150, reorder: 600,  expiry: 'Jun 2028', supplier: 'Martin Dow' },
  { name: 'Ceftriaxone 1g',     form: 'Injection', cat: 'Antibiotics', stock: 180, reorder: 250,  expiry: 'Nov 2026', supplier: 'Sami Pharmaceuticals' },
  { name: 'Omeprazole 20mg',    form: 'Capsule',  cat: 'Gastro',      stock: 1460, reorder: 400,  expiry: 'Nov 2026', supplier: 'Getz Pharma' },
  { name: 'Salbutamol Inhaler', form: 'Inhaler',  cat: 'Respiratory', stock: 42,   reorder: 120,  expiry: 'Feb 2027', supplier: 'Ferozsons Laboratories' },
];
const EXPIRING = [
  { name: 'Amoxicillin 500mg', batch: 'A-2291',  days: 6,  qty: 240 },
  { name: 'Insulin Glargine',  batch: 'IG-118',  days: 12, qty: 36 },
  { name: 'Paracetamol IV 1g', batch: 'P-7745',  days: 19, qty: 120 },
  { name: 'Ceftriaxone 1g',    batch: 'C-3302',  days: 24, qty: 80 },
  { name: 'Omeprazole 20mg',   batch: 'O-5520',  days: 28, qty: 300 },
];
const CATEGORIES = [['Antibiotics', 412], ['Analgesics', 368], ['Cardiac', 296], ['Endocrine', 241], ['Respiratory', 188]];
const P_KPIS = [
  { label: 'Total Medicines', icon: 'i-pill', value: () => 1842, trend: 4, spark: [1700, 1720, 1750, 1760, 1790, 1810, 1830, 1842] },
  { label: 'Low Stock Items', icon: 'i-alert', value: () => 23 - state.orderedCount, trend: 5, inverse: true, spark: [14, 16, 15, 18, 19, 21, 22, 23] },
  { label: 'Expiring ≤ 30 Days', icon: 'i-clock', value: () => state.expCount, trend: -8, inverse: true, spark: [52, 49, 50, 47, 45, 44, 43, 41] },
  { label: 'Prescriptions Today', icon: 'i-file', value: () => 318, trend: 11, dark: true, spark: [240, 262, 251, 280, 274, 296, 305, 318] },
];

/* Calendar */
const DOCTORS = [
  { name: 'Dr. Hira Malik',  spec: 'Cardiology',  status: 'available' },
  { name: 'Dr. Ahmed Raza',   spec: 'Neurology',   status: 'surgery' },
  { name: 'Dr. Ayesha Noor',  spec: 'Pediatrics',  status: 'available' },
  { name: 'Dr. Imran Shah',   spec: 'Orthopedics', status: 'break' },
  { name: 'Dr. Fatima Zahid', spec: 'Gynecology',  status: 'off' },
];
const STATUS_LABEL = { available: 'Available', surgery: 'In Surgery', break: 'On Break', off: 'Off Duty' };
const PATIENTS = ['Ali Hassan', 'Maryam Javed', 'Hamza Qureshi', 'Sana Mirza', 'Usman Tariq', 'Hina Raza', 'Bilal Ahmed', 'Noor Fatima',
  'Zain Abbas', 'Areeba Khan', 'Saad Iqbal', 'Mehwish Ali', 'Danish Butt', 'Kiran Shah', 'Owais Siddiqui', 'Rabia Anwar'];
const APPT_TYPES = { consultation: 'Consultation', checkup: 'Check-up', followup: 'Follow-up', surgery: 'Surgery' };

const NOTIFS = [
  { icon: 'i-heart', bg: '#fee2e2', fg: '#ef4444', t: 'Code Blue — Ward 4B', s: 'Response team dispatched · 2 min ago', go: 'dashboard', unread: true },
  { icon: 'i-file', bg: '#dbeafe', fg: '#1e6bff', t: 'Lab results ready', s: '14 new results for review · 18 min ago', go: 'analytics', unread: true },
  { icon: 'i-user', bg: '#dcfce7', fg: '#16a34a', t: 'Dr. Ahmed checked in', s: 'Neurology shift started · 1 h ago', go: 'calendar', unread: true },
];

/* ---------- State ---------- */
const state = {
  screen: 'dashboard',
  period: 'Weekly', dept: 'All Departments', sort: 'Sort by Month', source: 'All Sources', occ: 'For Week', icu: false, today: 0,
  view: 'Default View', autoRefresh: true, calm: false,
  aRange: 'Last 12 Months', aType: 'All Patients',
  billYear: '2026', billFilter: 'All Invoices', invoices: INVOICES.map(i => ({ ...i })), dues: { amt: 3595000, count: 34 }, reminded: false,
  stockFilter: 'All Items', meds: MEDS.map(m => ({ ...m, ordered: false })), orderedCount: 0, expiring: EXPIRING.map(e => ({ ...e })), expCount: 41,
  selDate: new Date(TODAY), calMonth: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), calDoctor: 'All Doctors',
  booked: {}, apptStatus: {}, weekAppts: {},
  notifs: NOTIFS.map(n => ({ ...n })),
  applied: false, pro: false,
  modalCSV: null,
};

/* ==========================================================
   Shared chart pieces
   ========================================================== */
function renderMatrix(el, { labels, cols, full, rows, unit }, replay) {
  const max = Math.max(...rows.flat());
  const level = v => { const r = v / max; return r < .25 ? 0 : r < .55 ? 1 : r < .8 ? 2 : 3; };
  const build = replay || !el.children.length;
  if (build) {
    let html = '';
    rows.forEach((r, i) => {
      html += `<span class="rl" data-row="${i}">${labels[i]}</span>`;
      r.forEach((_, j) => { html += `<span class="dot" data-row="${i}" data-col="${j}" style="--dl:${250 + (i * 7 + j) * 30}ms"></span>`; });
    });
    html += '<span></span>' + cols.map(c => `<span class="cl">${c}</span>`).join('');
    el.innerHTML = html;
    requestAnimationFrame(() => $$('.dot', el).forEach(d => d.classList.add('in')));
  } else {
    $$('.cl', el).forEach((c, j) => (c.textContent = cols[j]));
  }
  $$('.dot', el).forEach(d => {
    const i = +d.dataset.row, j = +d.dataset.col, v = rows[i][j];
    d.className = d.className.replace(/\bl\d\b/g, '').trim() + ' l' + level(v);
    d.style.transitionDelay = build ? '' : `${(i * 7 + j) * 25}ms`;
    d.dataset.tip = `<b>${labels[i]}</b> · ${full[j]}<br/>${fmt(v)} ${unit}`;
  });
}

const TICKS = 34;
function buildGauge(svg) {
  const cx = 100, cy = 104, r1 = 64, r2 = 92;
  let html = '';
  for (let i = 0; i < TICKS; i++) {
    const a = Math.PI - (i / (TICKS - 1)) * Math.PI;
    html += `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy - r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy - r2 * Math.sin(a)).toFixed(1)}" style="stroke:#e8eaef"/>`;
  }
  svg.innerHTML = html;
}
function setGauge(svg, pct, replay) {
  const lines = $$('line', svg);
  if (replay) {
    lines.forEach(l => { l.style.transition = 'none'; l.style.stroke = '#e8eaef'; });
    svg.getBoundingClientRect();
    lines.forEach(l => (l.style.transition = ''));
  }
  const active = Math.round((pct / 100) * TICKS);
  later(() => lines.forEach((ln, i) => {
    const t = active > 1 ? i / (active - 1) : 0;
    const color = t < .55 ? mix('173a9e', '1e6bff', t / .55) : mix('1e6bff', 'a9c9ff', (t - .55) / .45);
    ln.style.transitionDelay = `${i * 22}ms`;
    ln.style.stroke = i < active ? color : '#e8eaef';
  }));
}

function kpiCards(el, defs, prefix) {
  el.innerHTML = defs.map((k, i) => {
    const good = k.inverse ? k.trend < 0 : k.trend > 0;
    return `<article class="card kpi stagger ${k.dark ? 'dark-kpi' : ''}" style="--d:${i + 1}" data-expand="kpi-${prefix}-${i}">
      <div class="kpi-head"><span class="label">${k.label}</span><span class="kpi-ic"><svg><use href="#${k.icon}"/></svg></span></div>
      <div class="val" data-kv="${i}">0</div>
      <div class="kpi-foot"><span class="trend-chip ${good ? 'up' : 'down'}">${k.trend > 0 ? '▲' : '▼'} ${Math.abs(k.trend)}%</span><span class="spark">${sparkSVG(k.spark, 70, 26)}</span></div>
    </article>`;
  }).join('');
}

/* ==========================================================
   Screen: Dashboard
   ========================================================== */
const dotsEl = $('#dots');
const barsEl = $('#bars');
const occGauge = $('#gauge');

function renderDots(replay = false) {
  const d = ADMISSIONS[state.period];
  renderMatrix(dotsEl, { labels: DEPTS, ...d, unit: 'admissions' }, replay);
  countUp($('#admTotal'), sum(d.rows.flat()), replay ? { from: 0 } : {});
  applyDeptFilter();
}

function applyDeptFilter() {
  const idx = DEPTS.indexOf(state.dept);
  dotsEl.classList.toggle('filtered', idx >= 0);
  $$('[data-row]', dotsEl).forEach(el => {
    const match = idx < 0 || +el.dataset.row === idx;
    el.classList.toggle('dim', !match);
    if (el.classList.contains('rl')) el.classList.toggle('hl', idx >= 0 && match);
  });
}

function renderBars(replay = false) {
  const d = SOURCE_DATA[state.sort];
  const max = Math.max(...d.values);
  const total = sum(d.values);

  if (!barsEl.children.length) {
    barsEl.innerHTML = SOURCES.map((s, i) => `
      <div class="bar-col" data-i="${i}">
        <span class="chip"><svg><use href="#i-up-right"/></svg><em></em></span>
        <div class="bar k${i}"></div>
      </div>`).join('');
  }
  if (replay) {
    $$('.bar', barsEl).forEach(b => { b.style.transition = 'none'; b.style.height = '0'; });
    $$('.chip', barsEl).forEach(c => c.classList.remove('in'));
    barsEl.getBoundingClientRect();
    $$('.bar', barsEl).forEach(b => (b.style.transition = ''));
  }

  $$('.bar-col', barsEl).forEach((col, i) => {
    const chip = $('.chip', col);
    $('em', chip).textContent = fmtK(d.values[i]);
    $('use', chip).setAttribute('href', d.trend[i] > 0 ? '#i-up-right' : '#i-down-left');
    col.dataset.tip = `<b>${SOURCES[i]}</b><br/>${fmt(d.values[i])} visits · ${Math.round(d.values[i] / total * 100)}% share`;
    col.classList.toggle('dim', state.source !== 'All Sources' && state.source !== SOURCES[i]);
    setTimeout(() => {
      $('.bar', col).style.height = (d.values[i] / max) * 74 + 6 + '%';
      chip.classList.add('in');
    }, 250 + i * 120);
  });

  $('#rangePill').textContent = d.range;
  $('.growth small').textContent = d.label;
  countUp($('#visitsTotal'), total, { format: fmtK, ...(replay ? { from: 0 } : {}) });
  countUp($('#growth'), d.growth, { prefix: '+', suffix: '%', decimals: 1, ...(replay ? { from: 0 } : {}) });
  $('#dashLine').classList.remove('in');
  setTimeout(positionDashLine, 1500);
}

function positionDashLine() {
  if (state.screen !== 'dashboard') return;
  const line = $('#dashLine');
  const chart = $('#chart').getBoundingClientRect();
  const g = $('.growth strong').getBoundingClientRect();
  const chips = $$('.chip', barsEl);
  if (!chips.length) return;
  const tallest = chips.reduce((a, c) => (c.getBoundingClientRect().top < a.getBoundingClientRect().top ? c : a));
  const c = tallest.getBoundingClientRect();
  const left = g.right - chart.left + 10;
  const width = c.left - chart.left - left - 6;
  if (width < 12) { line.style.display = 'none'; return; }
  Object.assign(line.style, { display: '', left: left + 'px', top: (c.top + c.height / 2 - chart.top) + 'px', width: width + 'px' });
  requestAnimationFrame(() => line.classList.add('in'));
}

function renderGauge(replay = false) {
  const d = OCCUPANCY[state.occ][state.icu ? 'icu' : 'all'];
  setGauge(occGauge, d.pct, replay);
  countUp($('#occVal'), d.pct, { suffix: '%', ...(replay ? { from: 0 } : {}) });
  $('#occSub').textContent = `${Math.round(d.total * d.pct / 100)} / ${d.total} ${state.icu ? 'ICU beds' : 'beds'}`;
  $('#occNote').textContent = d.note;
  $('#icuToggle').checked = state.icu;
}

function renderToday() {
  const d = TODAY_METRICS[state.today];
  const label = $('#todayLabel');
  label.innerHTML = d.label;
  label.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'ease-out' });
  countUp($('#todayVal'), d.value, { prefix: d.prefix, suffix: d.suffix, from: 0 });
  const tr = $('#todayTrend');
  tr.className = 'trend ' + (d.trend >= 0 ? 'up' : 'down');
  tr.firstChild.textContent = Math.abs(d.trend) + '% ';
  $('#spark').innerHTML = sparkSVG(d.spark);
}

function renderDashboard(replay) {
  renderDots(replay);
  renderBars(replay);
  renderGauge(replay);
  renderToday();
}

// Live revenue ticker
setInterval(() => {
  if (!state.autoRefresh || state.today !== 0 || state.screen !== 'dashboard') return;
  const el = $('#todayVal');
  countUp(el, el._val + Math.round(Math.random() * 12000 + 1500), { prefix: 'PKR ', dur: 800 });
  el.animate([{ color: '#1e6bff' }, { color: 'inherit' }], { duration: 900 });
}, 4500);

/* ==========================================================
   Screen: Analytics
   ========================================================== */
const pf = () => PATIENT_FACTOR[state.aType];

function renderAnalytics() {
  kpiCards($('#aKpis'), A_KPIS, 'a');
  A_KPIS.forEach((k, i) => countUp($(`#aKpis [data-kv="${i}"]`), k.scale ? k.value * pf() : k.value, { decimals: k.decimals || 0, suffix: k.suffix || '', from: 0 }));
  renderLine();
  renderDonut();
  renderAges();
  renderDiagnoses();
}

function smoothPath(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const LC = { W: 640, H: 230, l: 40, r: 12, t: 12, b: 26 };
function renderLine() {
  const svg = $('#lineChart');
  const d = TREND[state.aRange];
  const adm = d.adm.map(v => Math.round(v * pf()));
  const dis = d.dis.map(v => Math.round(v * pf()));
  const { W, H, l, r, t, b } = LC;
  const maxY = Math.ceil((Math.max(...adm, ...dis) * 1.15) / 100) * 100;
  const x = i => l + (i * (W - l - r)) / (adm.length - 1);
  const y = v => t + (1 - v / maxY) * (H - t - b);
  const pa = adm.map((v, i) => [x(i), y(v)]);
  const pd = dis.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(pa);
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = (maxY / 4) * k, yy = y(v);
    grid += `<line class="grid" x1="${l}" x2="${W - r}" y1="${yy}" y2="${yy}"/><text x="${l - 8}" y="${yy + 3}" text-anchor="end">${fmtK(v)}</text>`;
  }
  const xl = d.labels.map((m, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${m}</text>`).join('');
  svg.innerHTML = `
    <defs><clipPath id="lcClip"><rect class="clip-rect" x="${l}" y="0" width="${W - l - r + 8}" height="${H}"/></clipPath></defs>
    ${grid}${xl}
    <g clip-path="url(#lcClip)">
      <path class="area" d="${line} L${x(adm.length - 1)},${H - b} L${l},${H - b} Z"/>
      <path class="l-dis" d="${smoothPath(pd)}"/>
      <path class="l-adm" d="${line}"/>
    </g>
    <line class="guide" y1="${t}" y2="${H - b}"/>
    <circle class="pt d" r="4"/><circle class="pt a" r="4.5"/>
    <rect class="hit" x="${l}" y="0" width="${W - l - r}" height="${H}" fill="transparent"/>`;
  svg._data = { adm, dis, labels: d.labels, pa, pd };
  countUp($('#netFlow'), sum(adm) - sum(dis), { prefix: '+', from: 0 });
}

$('#lineChart').addEventListener('mousemove', e => {
  const svg = e.currentTarget, d = svg._data;
  if (!d) return;
  const rect = svg.getBoundingClientRect();
  const sx = rect.width / LC.W, sy = rect.height / LC.H;
  const px = (e.clientX - rect.left) / sx;
  const i = Math.max(0, Math.min(d.adm.length - 1, Math.round(((px - LC.l) / (LC.W - LC.l - LC.r)) * (d.adm.length - 1))));
  const [ax, ay] = d.pa[i], [, dy] = d.pd[i];
  $('.guide', svg).setAttribute('x1', ax); $('.guide', svg).setAttribute('x2', ax);
  $('.pt.a', svg).setAttribute('cx', ax); $('.pt.a', svg).setAttribute('cy', ay);
  $('.pt.d', svg).setAttribute('cx', ax); $('.pt.d', svg).setAttribute('cy', dy);
  svg.classList.add('hovering');
  tip.innerHTML = `<b>${d.labels[i]}</b><br/>Admissions ${fmt(d.adm[i])}<br/>Discharges ${fmt(d.dis[i])}`;
  tip.style.left = rect.left + ax * sx + 'px';
  tip.style.top = rect.top + ay * sy - 6 + 'px';
  tip.classList.add('show');
});
$('#lineChart').addEventListener('mouseleave', e => { e.currentTarget.classList.remove('hovering'); tip.classList.remove('show'); });

function renderDonut() {
  const svg = $('#donut');
  const R = 48, C = 2 * Math.PI * R;
  const total = Math.round(GENDER_TOTAL * pf());
  let off = 0, html = `<circle class="track" cx="60" cy="60" r="${R}"/>`;
  const segs = GENDER.map(([name, pct, color]) => {
    const len = Math.max(0, (pct / 100) * C - 3);
    const s = { len, off, name, pct, color };
    off += (pct / 100) * C;
    return s;
  });
  segs.forEach(s => {
    html += `<circle class="seg" cx="60" cy="60" r="${R}" style="stroke:${s.color};stroke-dasharray:0 ${C};stroke-dashoffset:${-s.off}"
      data-tip="<b>${s.name}</b><br/>${fmt(total * s.pct / 100)} patients · ${s.pct}%"/>`;
  });
  svg.innerHTML = html;
  later(() => $$('.seg', svg).forEach((c, i) => (c.style.strokeDasharray = `${segs[i].len} ${C}`)), 120);
  countUp($('#donutTotal'), total, { from: 0 });
  $('#donutLegend').innerHTML = GENDER.map(([n, p, c]) => `<li><i style="background:${c}"></i><span>${n}</span><b>${p}% <span class="muted">· ${fmtK(total * p / 100)}</span></b></li>`).join('');
}

function renderAges() {
  const vals = AGE_GROUPS.map(([, v]) => Math.round(v * pf()));
  const max = Math.max(...vals);
  $('#ageBars').innerHTML = AGE_GROUPS.map(([g], i) => `
    <div class="hrow" data-tip="<b>Age ${g}</b><br/>${fmt(vals[i])} patients · ${Math.round(vals[i] / sum(vals) * 100)}%">
      <span class="lab">${g}</span>
      <div class="htrack"><div class="hfill" style="background:${AGE_COLORS[i]}"></div></div>
      <span class="val">${fmtK(vals[i])}</span>
    </div>`).join('');
  later(() => $$('#ageBars .hfill').forEach((f, i) => (f.style.width = (vals[i] / max) * 100 + '%')), 150);
}

function renderDiagnoses() {
  const vals = DIAGNOSES.map(([, v]) => Math.round(v * pf()));
  const max = Math.max(...vals);
  $('#diagList').innerHTML = DIAGNOSES.map(([n, , tr], i) => `
    <li>
      <span class="rank">${i + 1}</span>
      <div><div class="nm">${n}</div><div class="meter"><i style="background:${AGE_COLORS[i]}"></i></div></div>
      <span class="cnt">${fmt(vals[i])}<small class="${tr > 0 ? 'up' : 'down'}">${tr > 0 ? '▲' : '▼'} ${Math.abs(tr)}%</small></span>
    </li>`).join('');
  later(() => $$('#diagList .meter i').forEach((m, i) => (m.style.width = (vals[i] / max) * 100 + '%')), 150);
}

/* ==========================================================
   Screen: Billing
   ========================================================== */
const claimsGauge = $('#claimsGauge');

function renderBilling() {
  renderRevenue();
  const total = sum(CLAIMS.map(c => c[1]));
  const rate = Math.round(CLAIMS[0][1] / total * 100);
  setGauge(claimsGauge, rate, true);
  countUp($('#claimsVal'), rate, { suffix: '%', from: 0 });
  $('#claimList').innerHTML = CLAIMS.map(([n, v, c]) => `<li><i style="background:${c}"></i><span>${n}</span><b>${fmt(v)}</b></li>`).join('');
  renderInvoices();
  renderDues(true);
  $('#payBar').innerHTML = PAYMENTS.map(([n, p, c]) => `<i style="background:${c}" data-tip="<b>${n}</b> · ${p}%"></i>`).join('');
  later(() => $$('#payBar i').forEach((s, i) => (s.style.width = PAYMENTS[i][1] + '%')), 150);
  $('#payList').innerHTML = PAYMENTS.map(([n, p, c]) => `<li style="border-color:${c}">${n}<b>${p}%</b></li>`).join('');
}

function renderRevenue() {
  const y = REVENUE[state.billYear];
  const vals = y.vals, fc = y.forecast || [];
  const all = vals.map((v, i) => v ?? fc[i] ?? 0);
  const max = Math.max(...all);
  const peak = y.current >= 0 ? y.current : all.indexOf(Math.max(...vals));
  $('#revBars').innerHTML = MONTHS.map((m, i) => {
    const isFc = vals[i] == null;
    const cls = isFc ? 'fc' : i === peak ? 'k2' : 'k3';
    const tipTxt = isFc ? `<b>${m} ${state.billYear}</b><br/>Forecast PKR ${fc[i].toFixed(1)}M` : `<b>${m} ${state.billYear}</b><br/>Revenue PKR ${vals[i].toFixed(1)}M`;
    return `<div class="vcol ${i === peak ? 'cur' : ''}" data-tip="${tipTxt}">
      <div class="vtrack">${i === peak ? `<span class="chip"><svg><use href="#i-up-right"/></svg>PKR ${all[i].toFixed(1)}M</span>` : ''}<div class="bar ${cls}" data-h="${(all[i] / max) * 82}"></div></div>
      <span class="vlab">${m}</span></div>`;
  }).join('');
  later(() => $$('#revBars .bar').forEach((b, i) => setTimeout(() => (b.style.height = b.dataset.h + '%'), i * 50)), 100);
  later(() => $$('#revBars .chip').forEach(c => c.classList.add('in')), 900);

  const ytd = sum(vals.filter(v => v != null));
  countUp($('#revTotal'), ytd, { prefix: 'PKR ', suffix: 'M', decimals: 1, from: 0 });
  let growth;
  if (state.billYear === '2026') {
    const n = vals.filter(v => v != null).length;
    growth = (ytd / sum(REVENUE['2025'].vals.slice(0, n)) - 1) * 100;
    $('#revSub').textContent = 'collected year to date';
  } else {
    growth = y.trend;
    $('#revSub').textContent = 'total collected in 2025';
  }
  $('#revTrend').textContent = `+${growth.toFixed(1)}% vs last year`;
}

const STATUS_CLASS = { Paid: 'paid', Pending: 'pending', Overdue: 'overdue' };
function renderInvoices() {
  const q = $('#invSearch').value.trim().toLowerCase();
  const rows = state.invoices.filter(inv =>
    (state.billFilter === 'All Invoices' || inv.status === state.billFilter) &&
    (!q || `${inv.id} ${inv.patient} ${inv.dept}`.toLowerCase().includes(q)));
  $('#invBody').innerHTML = rows.length ? rows.map((inv, i) => `
    <tr class="click" data-inv="${inv.id}" style="--rd:${i * 40}ms">
      <td><b>${inv.id}</b></td>
      <td><span class="who"><span class="ini" style="background:${colorFor(inv.patient)}">${initials(inv.patient)}</span>${inv.patient}</span></td>
      <td>${inv.dept}</td>
      <td>${inv.date}</td>
      <td class="r">${money(inv.amount)}</td>
      <td><span class="st ${STATUS_CLASS[inv.status]}">${inv.status}</span></td>
    </tr>`).join('') : `<tr class="empty"><td colspan="6">No invoices match your filter</td></tr>`;
}

function renderDues(replay) {
  countUp($('#duesVal'), state.dues.amt, { prefix: 'PKR ', ...(replay ? { from: 0 } : {}) });
  $('.dues .tag').innerHTML = `<b>${state.dues.count}</b> unpaid invoices · oldest 62 days`;
}

$('#invSearch').addEventListener('input', renderInvoices);
$('#invBody').addEventListener('click', e => {
  const tr = e.target.closest('[data-inv]');
  if (tr) invoiceModal(tr.dataset.inv);
});

function invoiceModal(id) {
  const inv = state.invoices.find(i => i.id === id);
  openModal(`
    <h3>${inv.id}</h3>
    <p class="m-sub">Invoice for ${inv.patient}</p>
    <div class="kv">
      <div><small>Patient</small><b>${inv.patient}</b></div>
      <div><small>Department</small><b>${inv.dept}</b></div>
      <div><small>Date</small><b>${inv.date}</b></div>
      <div><small>Payer</small><b>${inv.payer}</b></div>
      <div><small>Amount</small><b>${money(inv.amount)}</b></div>
      <div><small>Status</small><b><span class="st ${STATUS_CLASS[inv.status]}">${inv.status}</span></b></div>
    </div>
    <div class="m-actions">
      <button class="btn-sec" data-action="downloadInvoice" data-id="${inv.id}">Download</button>
      ${inv.status !== 'Paid' ? `<button class="join" data-action="payInvoice" data-id="${inv.id}">Mark as Paid <span><svg><use href="#i-check"/></svg></span></button>` : ''}
    </div>`);
}

$('#remindBtn').addEventListener('click', async e => {
  const btn = e.currentTarget;
  if (state.reminded) return toast(`Reminders were already sent to ${state.dues.count} patients today`);
  btn.disabled = true;
  btn.innerHTML = 'Sending… <span><i class="spin"></i></span>';
  await sleep(1400);
  state.reminded = true;
  btn.disabled = false;
  btn.classList.add('done');
  btn.innerHTML = 'Reminders Sent <span><svg><use href="#i-check"/></svg></span>';
  toast(`Payment reminders sent to ${state.dues.count} patients`);
});

/* ==========================================================
   Screen: Pharmacy
   ========================================================== */
function renderPharmacy() {
  kpiCards($('#pKpis'), P_KPIS, 'p');
  P_KPIS.forEach((k, i) => countUp($(`#pKpis [data-kv="${i}"]`), k.value(), { from: 0 }));
  renderMatrix($('#pMatrix'), { ...DISPENSE, unit: 'units dispensed' }, true);
  renderExpiry();
  renderInventory();
  const max = Math.max(...CATEGORIES.map(c => c[1]));
  const colors = ['k0', 'k1', 'k2', 'k3', 'k2'];
  $('#catBars').innerHTML = CATEGORIES.map(([n, v], i) => `
    <div class="vcol ${i === 0 ? 'cur' : ''}" data-tip="<b>${n}</b><br/>${v} items in store">
      <div class="vtrack"><span class="chip">${v}</span><div class="bar ${colors[i]}" data-h="${(v / max) * 80}"></div></div>
      <span class="vlab">${n.slice(0, 6)}</span></div>`).join('');
  later(() => $$('#catBars .bar').forEach((b, i) => setTimeout(() => (b.style.height = b.dataset.h + '%'), i * 90)), 120);
  later(() => $$('#catBars .chip').forEach(c => c.classList.add('in')), 800);
}

function updatePKpi(i) {
  countUp($(`#pKpis [data-kv="${i}"]`), P_KPIS[i].value(), { dur: 600 });
}

function renderExpiry() {
  const list = [...state.expiring].sort((a, b) => a.days - b.days).slice(0, 3);
  countUp($('#expCount'), state.expCount, { dur: 700 });
  $('#expList').innerHTML = list.length ? list.map(e => `
    <li><div>${e.name}<small>Batch ${e.batch} · ${e.qty} units</small></div>
    <span class="days ${e.days < 10 ? '' : e.days < 20 ? 'mid' : 'far'}">${e.days} days</span></li>`).join('')
    : '<li class="none">No critical batches — all clear</li>';
}

const MED_CLASS = { 'In Stock': 'ok', Low: 'low', Critical: 'critical', Ordered: 'ordered' };
const medStatus = m => m.ordered ? 'Ordered' : m.stock < m.reorder * .5 ? 'Critical' : m.stock < m.reorder ? 'Low' : 'In Stock';

function renderInventory() {
  const q = $('#medSearch').value.trim().toLowerCase();
  const rows = state.meds.filter(m => {
    const st = medStatus(m);
    return (state.stockFilter === 'All Items' || st === state.stockFilter) && (!q || `${m.name} ${m.cat}`.toLowerCase().includes(q));
  });
  $('#medBody').innerHTML = rows.length ? rows.map((m, i) => {
    const st = medStatus(m);
    const pct = Math.min(100, (m.stock / (m.reorder * 3)) * 100);
    const color = st === 'Critical' ? '#ef4444' : st === 'Low' ? '#f59e0b' : '#1e6bff';
    return `<tr class="click" data-med="${m.name}" style="--rd:${i * 40}ms">
      <td><b>${m.name}</b><span class="sub">${m.form} · ${m.supplier}</span></td>
      <td>${m.cat}</td>
      <td><div class="meter"><i style="background:${color}" data-w="${pct}"></i></div><span class="sub">${fmt(m.stock)} / min ${fmt(m.reorder)}</span></td>
      <td>${m.expiry}</td>
      <td><span class="st ${MED_CLASS[st]}">${st}</span></td>
      <td class="r">${st === 'Low' || st === 'Critical' ? `<button class="mini-btn" data-reorder="${m.name}">Reorder</button>` : ''}</td>
    </tr>`;
  }).join('') : `<tr class="empty"><td colspan="6">No medicines match your filter</td></tr>`;
  later(() => $$('#medBody .meter i').forEach(i => (i.style.width = i.dataset.w + '%')), 100);
}

function reorderMed(name) {
  const m = state.meds.find(x => x.name === name);
  if (!m || m.ordered) return;
  m.ordered = true;
  state.orderedCount++;
  renderInventory();
  updatePKpi(1);
  toast(`Purchase order sent to ${m.supplier} for ${m.name}`, {
    action: 'Undo', ms: 4000,
    onAction: () => { m.ordered = false; state.orderedCount--; renderInventory(); updatePKpi(1); },
  });
}

$('#medSearch').addEventListener('input', renderInventory);
$('#medBody').addEventListener('click', e => {
  const btn = e.target.closest('[data-reorder]');
  if (btn) return reorderMed(btn.dataset.reorder);
  const tr = e.target.closest('[data-med]');
  if (!tr) return;
  const m = state.meds.find(x => x.name === tr.dataset.med);
  const st = medStatus(m);
  openModal(`
    <h3>${m.name}</h3>
    <p class="m-sub">${m.form} · ${m.cat}</p>
    <div class="kv">
      <div><small>In stock</small><b>${fmt(m.stock)} units</b></div>
      <div><small>Reorder level</small><b>${fmt(m.reorder)} units</b></div>
      <div><small>Supplier</small><b>${m.supplier}</b></div>
      <div><small>Expiry</small><b>${m.expiry}</b></div>
      <div><small>Status</small><b><span class="st ${MED_CLASS[st]}">${st}</span></b></div>
      <div><small>Days of supply</small><b>${Math.max(1, Math.round(m.stock / (m.reorder / 30)))} days</b></div>
    </div>
    <div class="m-actions">
      <button class="btn-sec" data-action="close">Close</button>
      ${st === 'Low' || st === 'Critical' ? `<button class="join" data-action="reorder" data-id="${m.name}">Reorder Now <span><svg><use href="#i-up-right"/></svg></span></button>` : ''}
    </div>`);
});

$('#reviewBtn').addEventListener('click', reviewBatches);
function reviewBatches() {
  const list = [...state.expiring].sort((a, b) => a.days - b.days);
  openModal(`
    <h3>Expiring Batches</h3>
    <p class="m-sub">${state.expCount} batches expire within 30 days. Action the most urgent ones below.</p>
    <ul class="m-list" id="batchList">
      ${list.length ? list.map(e => `
        <li data-batch="${e.batch}">
          <div><b>${e.name}</b><small>Batch ${e.batch} · ${e.qty} units · expires in ${e.days} days</small></div>
          <div class="btns">
            <button class="mini-btn ghost-btn" data-action="batch" data-id="${e.batch}" data-kind="returned to supplier">Return</button>
            <button class="mini-btn danger" data-action="batch" data-id="${e.batch}" data-kind="marked for disposal">Dispose</button>
          </div>
        </li>`).join('') : '<li>All urgent batches have been handled.</li>'}
    </ul>`, true);
}

/* ==========================================================
   Screen: Calendar
   ========================================================== */
const HOUR_PX = 46;
const weekStart = d => { const s = new Date(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); s.setHours(0, 0, 0, 0); return s; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => ymd(a) === ymd(b);

function genAppointments(date) {
  if (date.getDay() === 0) return [];
  const r = rng(date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate());
  const end = date.getDay() === 6 ? 13 : 17;
  const out = [];
  let t = 8 + (r() < .5 ? 0 : .5), i = 0;
  while (true) {
    const surg = r() < .18;
    const dur = surg ? (r() < .5 ? 1.5 : 2) : [.5, 1, 1][Math.floor(r() * 3)];
    if (t + dur > end) break;
    const type = surg ? 'surgery' : ['consultation', 'consultation', 'checkup', 'followup'][Math.floor(r() * 4)];
    out.push({
      id: `${ymd(date)}-${i++}`, date: ymd(date), start: t, dur, type,
      doctor: DOCTORS[Math.floor(r() * 4)].name,
      patient: PATIENTS[Math.floor(r() * PATIENTS.length)],
      room: surg ? `OT-${1 + Math.floor(r() * 3)}` : `Room ${100 + Math.floor(r() * 40)}`,
    });
    t += dur + [0, .5, .5, 1][Math.floor(r() * 4)];
  }
  return out;
}
const apptsFor = date => [...genAppointments(date), ...(state.booked[ymd(date)] || [])]
  .filter(a => state.apptStatus[a.id] !== 'cancelled')
  .sort((a, b) => a.start - b.start);

function renderCalendar() {
  renderMiniCal();
  renderDocs();
  renderWeek();
}

function renderMiniCal(dir = 0) {
  const m = state.calMonth;
  $('#monthLabel').textContent = m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const start = weekStart(m);
  const ws = ymd(weekStart(state.selDate));
  const we = ymd(addDays(weekStart(state.selDate), 6));
  let html = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<span class="wd">${d}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const k = ymd(d);
    const cls = [
      d.getMonth() !== m.getMonth() && 'out',
      sameDay(d, TODAY) && 'today',
      sameDay(d, state.selDate) && 'sel',
      k >= ws && k <= we && 'inweek',
      apptsFor(d).some(a => a.type === 'surgery') && 'has',
    ].filter(Boolean).join(' ');
    html += `<button class="${cls}" data-date="${k}" title="${d.toDateString()}">${d.getDate()}</button>`;
  }
  const el = $('#miniCal');
  el.innerHTML = html;
  if (dir) {
    el.style.setProperty('--dir', dir * 14 + 'px');
    el.classList.remove('slide'); void el.offsetWidth; el.classList.add('slide');
  }
}

function renderDocs() {
  const onDuty = DOCTORS.filter(d => d.status !== 'off').length;
  $('#dutyCount').textContent = `${onDuty} of ${DOCTORS.length} on duty`;
  $('#docList').innerHTML = DOCTORS.map(d => `
    <li class="${state.calDoctor === d.name ? 'on' : ''}" data-doc="${d.name}" title="Show only ${d.name}'s appointments">
      <span class="ini" style="background:${colorFor(d.name)}">${initials(d.name)}</span>
      <span class="info"><b>${d.name}</b><small>${d.spec}</small></span>
      <span class="status ${d.status}">${STATUS_LABEL[d.status]}</span>
    </li>`).join('');
}

function renderWeek() {
  const ws = weekStart(state.selDate);
  const days = Array.from({ length: 6 }, (_, i) => addDays(ws, i));
  const opt = { month: 'short', day: 'numeric' };
  $('#weekLabel').textContent = `${days[0].toLocaleDateString('en-US', opt)} – ${days[5].toLocaleDateString('en-US', opt)}, ${days[5].getFullYear()}`;

  let head = '<span></span>', cols = '';
  let times = '<div class="times">';
  for (let h = 8; h <= 17; h++) times += `<span style="top:${(h - 8) * HOUR_PX}px">${fmtTime(h)}</span>`;
  times += '</div>';

  state.weekAppts = {};
  let total = 0, surgeries = 0, done = 0, ai = 0;
  days.forEach(d => {
    const isToday = sameDay(d, TODAY);
    head += `<div class="dh ${isToday ? 'today' : ''} ${sameDay(d, state.selDate) ? 'sel' : ''}">${d.toLocaleDateString('en-US', { weekday: 'short' })}<b>${d.getDate()}</b></div>`;
    let blocks = '';
    apptsFor(d).forEach(a => {
      state.weekAppts[a.id] = a;
      total++;
      if (a.type === 'surgery') surgeries++;
      const isDone = state.apptStatus[a.id] === 'done';
      if (isDone) done++;
      const dim = state.calDoctor !== 'All Doctors' && a.doctor !== state.calDoctor;
      blocks += `<button class="appt ${a.type} ${isDone ? 'done' : ''} ${dim ? 'dim' : ''}" data-appt="${a.id}"
        style="top:${(a.start - 8) * HOUR_PX + 1}px;height:${a.dur * HOUR_PX - 3}px;--ad:${150 + ai++ * 25}ms">
        <b>${a.patient}</b>${a.dur >= 1 ? `<small>${fmtTime(a.start)} · ${a.doctor.replace('Dr. ', 'Dr ')}</small>` : ''}</button>`;
    });
    if (isToday) {
      const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
      if (h >= 8 && h <= 17) blocks += `<span class="now-line" style="top:${(h - 8) * HOUR_PX}px"></span>`;
    }
    cols += `<div class="day ${isToday ? 'today' : ''}">${blocks}</div>`;
  });
  $('#sched').innerHTML = head + times + cols;
  $('#schedStats').innerHTML = `
    <span><b>${total}</b>Appointments</span>
    <span><b>${surgeries}</b>Surgeries</span>
    <span><b>${done}</b>Completed</span>
    <span><b>${DOCTORS.filter(d => d.status !== 'off').length}</b>Doctors on duty</span>`;
}

function selectDate(d, dir = 0) {
  state.selDate = d;
  const monthChanged = d.getMonth() !== state.calMonth.getMonth() || d.getFullYear() !== state.calMonth.getFullYear();
  if (monthChanged) state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  renderMiniCal(monthChanged ? dir || 1 : 0);
  renderWeek();
}

$('#miniCal').addEventListener('click', e => {
  const b = e.target.closest('[data-date]');
  if (!b) return;
  const [y, m, d] = b.dataset.date.split('-').map(Number);
  selectDate(new Date(y, m - 1, d));
});
$('#monthPrev').addEventListener('click', () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1); renderMiniCal(-1); });
$('#monthNext').addEventListener('click', () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1); renderMiniCal(1); });
$('#weekPrev').addEventListener('click', () => selectDate(addDays(state.selDate, -7), -1));
$('#weekNext').addEventListener('click', () => selectDate(addDays(state.selDate, 7), 1));
$('#weekToday').addEventListener('click', () => { selectDate(new Date(TODAY)); toast('Jumped to this week'); });

$('#docList').addEventListener('click', e => {
  const li = e.target.closest('[data-doc]');
  if (!li) return;
  state.calDoctor = state.calDoctor === li.dataset.doc ? 'All Doctors' : li.dataset.doc;
  renderDocs();
  renderWeek();
  updateFilterLabel();
});

$('#sched').addEventListener('click', e => {
  const b = e.target.closest('[data-appt]');
  if (b) apptModal(b.dataset.appt);
});

function apptModal(id) {
  const a = state.weekAppts[id];
  const st = state.apptStatus[id] === 'done' ? 'Completed' : 'Scheduled';
  const date = new Date(a.date + 'T00:00');
  openModal(`
    <h3>${APPT_TYPES[a.type]}</h3>
    <p class="m-sub">${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · ${fmtTime(a.start)} – ${fmtTime(a.start + a.dur)}</p>
    <div class="kv">
      <div><small>Patient</small><b>${a.patient}</b></div>
      <div><small>Doctor</small><b>${a.doctor}</b></div>
      <div><small>Location</small><b>${a.room}</b></div>
      <div><small>Status</small><b><span class="st ${st === 'Completed' ? 'done' : 'scheduled'}">${st}</span></b></div>
    </div>
    <div class="m-actions">
      <button class="btn-sec danger" data-action="cancelAppt" data-id="${id}">Cancel Appointment</button>
      ${st === 'Scheduled' ? `<button class="join" data-action="completeAppt" data-id="${id}">Mark Completed <span><svg><use href="#i-check"/></svg></span></button>` : ''}
    </div>`);
}

$('#bookBtn').addEventListener('click', () => {
  const ws = weekStart(state.selDate);
  const days = Array.from({ length: 6 }, (_, i) => addDays(ws, i));
  const selKey = state.selDate.getDay() === 0 ? ymd(days[0]) : ymd(state.selDate);
  const slots = [];
  for (let h = 8; h < 17; h += .5) slots.push(h);
  openModal(`
    <h3>Book Appointment</h3>
    <p class="m-sub">Add a new appointment to the weekly schedule.</p>
    <form data-form="book" novalidate>
      <div class="field"><label>Patient name</label><input name="patient" placeholder="e.g. Ali Hassan" autocomplete="off"/><span class="msg"></span></div>
      <div class="form-grid">
        <div class="field"><label>Doctor</label><select name="doctor">${DOCTORS.filter(d => d.status !== 'off').map(d => `<option ${state.calDoctor === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}</select></div>
        <div class="field"><label>Type</label><select name="type">${Object.entries(APPT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label>Day</label><select name="date">${days.map(d => `<option value="${ymd(d)}" ${ymd(d) === selKey ? 'selected' : ''}>${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</option>`).join('')}</select></div>
        <div class="field"><label>Duration</label><select name="dur"><option value="0.5">30 min</option><option value="1" selected>1 hour</option><option value="1.5">1.5 hours</option><option value="2">2 hours</option></select></div>
      </div>
      <div class="field"><label>Start time</label><select name="start">${slots.map(h => `<option value="${h}">${fmtTime(h)}</option>`).join('')}</select><span class="msg"></span></div>
      <div class="m-actions"><button type="button" class="btn-sec" data-action="close">Cancel</button><button class="join" type="submit">Book Appointment <span><svg><use href="#i-check"/></svg></span></button></div>
    </form>`);
  later(() => $('#modal input[name="patient"]').focus(), 300);
});

/* ==========================================================
   Router
   ========================================================== */
const SCREENS = {
  dashboard: { title: 'Hospital Overview', a: 'Overview', b: 'All Reports', render: () => renderDashboard(true) },
  analytics: { title: 'Patient Analytics', a: 'Analytics', b: 'Patient Insights', render: renderAnalytics },
  billing:   { title: 'Billing & Claims', a: 'Finance', b: 'Billing', render: renderBilling },
  pharmacy:  { title: 'Pharmacy Stock', a: 'Pharmacy', b: 'Inventory', render: renderPharmacy },
  calendar:  { title: 'Doctor Schedule', a: 'Calendar', b: 'Weekly Schedule', render: renderCalendar },
};

const indicator = $('#tabIndicator');
function moveIndicator(btn) {
  if (!btn) return;
  indicator.style.width = btn.offsetWidth + 'px';
  indicator.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
}

function showScreen(name, first = false) {
  if (!SCREENS[name]) name = 'dashboard';
  if (name === state.screen && !first) return;
  state.screen = name;
  const s = SCREENS[name];
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.screen === name));
  moveIndicator($('.tab.active'));
  const title = $('#pageTitle');
  title.textContent = s.title;
  title.classList.remove('swap'); void title.offsetWidth; title.classList.add('swap');
  $('#crumbA').textContent = s.a;
  $('#crumbB').textContent = s.b;
  $$('.screen').forEach(sc => sc.classList.toggle('active', sc.dataset.screen === name));
  $$('.side-item[data-go]').forEach(i => i.classList.toggle('active', i.dataset.go === name));
  closeMenu();
  tip.classList.remove('show');
  s.render();
  updateFilterLabel();
  history.replaceState(null, '', '#' + name);
  if (!first) window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('.tab').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));
window.addEventListener('hashchange', () => showScreen(location.hash.slice(1)));

/* ==========================================================
   Sidebar
   ========================================================== */
$('#overviewToggle').addEventListener('click', e => {
  const btn = e.currentTarget;
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', open);
  $('#submenu').classList.toggle('open', open);
});

$('.sidebar').addEventListener('click', e => {
  const item = e.target.closest('.side-item');
  if (!item) return;
  $$('.side-item').forEach(s => s.classList.remove('active'));
  item.classList.add('active');
  if (item.dataset.go) showScreen(item.dataset.go);
  else if (item.closest('#deptList')) deptModal(item.textContent.trim());
});

const EXTRA_DEPTS = ['Radiology', 'Oncology', 'Orthopedics', 'Maternity'];
$('#addDept').addEventListener('click', () => {
  const name = EXTRA_DEPTS.shift();
  if (!name) return toast('All departments are already added');
  const b = document.createElement('button');
  b.className = 'side-item new';
  b.innerHTML = `<svg><use href="#i-cross"/></svg>${name}`;
  $('#deptList').appendChild(b);
  toast(`${name} department added to sidebar`);
});

function deptModal(name) {
  const r = rng([...name].reduce((a, c) => a + c.charCodeAt(0), 0));
  const beds = 30 + Math.floor(r() * 50), occ = Math.floor(beds * (.6 + r() * .35));
  const head = DOCTORS[Math.floor(r() * DOCTORS.length)].name;
  const action = name === 'Emergency Ward' ? ['goEmergency', 'View Emergency Patients']
    : name === 'Intensive Care' ? ['goIcu', 'Show ICU Occupancy']
    : ['goCalendar', 'View Doctor Schedule'];
  openModal(`
    <h3>${name}</h3>
    <p class="m-sub">Live department summary · Head: ${head}</p>
    <div class="kv">
      <div><small>Beds occupied</small><b>${occ} / ${beds}</b></div>
      <div><small>Occupancy</small><b>${Math.round(occ / beds * 100)}%</b></div>
      <div><small>Patients today</small><b>${20 + Math.floor(r() * 60)}</b></div>
      <div><small>Staff on shift</small><b>${8 + Math.floor(r() * 20)}</b></div>
    </div>
    <div class="m-actions">
      <button class="btn-sec" data-action="close">Close</button>
      <button class="join" data-action="${action[0]}">${action[1]} <span><svg><use href="#i-up-right"/></svg></span></button>
    </div>`);
}

/* ==========================================================
   Dropdown menus
   ========================================================== */
const dd = $('#dropdown');
let ddAnchor = null;

function setLabel(name, v) { $$(`[data-dd="${name}"] span`).forEach(s => (s.textContent = v)); }

const FILTERS = {
  dashboard: { title: 'DEPARTMENT', key: 'dept', items: ['All Departments', ...DEPTS], after: applyDeptFilter },
  analytics: { title: 'PATIENT TYPE', key: 'aType', items: Object.keys(PATIENT_FACTOR), after: renderAnalytics },
  billing:   { title: 'INVOICE STATUS', key: 'billFilter', items: ['All Invoices', 'Paid', 'Pending', 'Overdue'], after: renderInvoices },
  pharmacy:  { title: 'STOCK STATUS', key: 'stockFilter', items: ['All Items', 'In Stock', 'Low', 'Critical', 'Ordered'], after: renderInventory },
  calendar:  { title: 'DOCTOR', key: 'calDoctor', items: ['All Doctors', ...DOCTORS.map(d => d.name)], after: () => { renderDocs(); renderWeek(); } },
};
function updateFilterLabel() {
  const f = FILTERS[state.screen];
  const v = state[f.key];
  setLabel('filter', v.startsWith('All') ? 'Filter' : v);
}

function setView(v) {
  state.view = v;
  setLabel('view', v);
  const app = $('#app');
  app.classList.toggle('compact', v === 'Compact View');
  app.classList.toggle('focus', v === 'Focus View');
  setTimeout(() => { moveIndicator($('.tab.active')); positionDashLine(); }, 550);
}

function menuDef(name) {
  switch (name) {
    case 'period':  return { items: Object.keys(ADMISSIONS), current: state.period, pick: v => { state.period = v; setLabel(name, v); renderDots(); } };
    case 'sort':    return { items: Object.keys(SOURCE_DATA), current: state.sort, pick: v => { state.sort = v; setLabel(name, v); renderBars(); } };
    case 'sources': return { items: ['All Sources', ...SOURCES], current: state.source, pick: v => { state.source = v; setLabel(name, v); renderBars(); } };
    case 'occ':     return { items: Object.keys(OCCUPANCY), current: state.occ, pick: v => { state.occ = v; setLabel(name, v); renderGauge(); } };
    case 'aRange':  return { items: Object.keys(TREND), current: state.aRange, pick: v => { state.aRange = v; setLabel(name, v); renderLine(); } };
    case 'billYear':return { items: Object.keys(REVENUE).reverse(), current: state.billYear, pick: v => { state.billYear = v; setLabel(name, v); renderRevenue(); } };
    case 'view':    return { title: 'LAYOUT', items: ['Default View', 'Compact View', 'Focus View'], current: state.view, pick: v => { setView(v); toast(`Switched to ${v}`); } };
    case 'filter': {
      const f = FILTERS[state.screen];
      return { title: f.title, items: f.items, current: state[f.key], pick: v => { state[f.key] = v; updateFilterLabel(); f.after(); toast(v.startsWith('All') ? 'Filter cleared' : `Filtered by ${v}`); } };
    }
    case 'export':  return { title: 'EXPORT ' + SCREENS[state.screen].title.toUpperCase(), items: ['Download CSV', 'Print / Save as PDF'], pick: v => v === 'Download CSV' ? exportCSV() : setTimeout(() => window.print(), 200) };
    case 'more':    return { items: ['Refresh data', 'Download CSV', 'Copy share link'], pick: v => {
      if (v === 'Refresh data') { renderBars(true); toast('Patient sources refreshed'); }
      else if (v === 'Download CSV') downloadCSV('patient-sources.csv', sourcesCSV());
      else copyText(location.href).then(() => toast('Share link copied to clipboard'));
    } };
    case 'settings': return {
      title: 'SETTINGS',
      toggles: { 'Auto-refresh live data': state.autoRefresh, 'Reduce animations': state.calm, 'Compact density': state.view === 'Compact View' },
      items: ['Auto-refresh live data', 'Reduce animations', 'Compact density'],
      extra: ['Reset all filters'],
      pick: v => {
        if (v === 'Auto-refresh live data') { state.autoRefresh = !state.autoRefresh; toast(`Live data ${state.autoRefresh ? 'resumed' : 'paused'}`); }
        if (v === 'Reduce animations') { state.calm = !state.calm; document.body.classList.toggle('calm', state.calm); toast(`Animations ${state.calm ? 'reduced' : 'restored'}`); }
        if (v === 'Compact density') setView(state.view === 'Compact View' ? 'Default View' : 'Compact View');
        if (v === 'Reset all filters') resetFilters();
      },
    };
    case 'profile': return { items: ['My profile', 'My shift schedule', 'Sign out'], pick: v => {
      if (v === 'My profile') profileModal();
      if (v === 'My shift schedule') { state.calDoctor = 'Dr. Hira Malik'; showScreen('calendar'); renderDocs(); renderWeek(); updateFilterLabel(); toast('Showing your appointments'); }
      if (v === 'Sign out') openModal(`
        <h3>Sign out?</h3><p class="m-sub">You will need to sign in again to view hospital data.</p>
        <div class="m-actions"><button class="btn-sec" data-action="close">Stay signed in</button><button class="join" data-action="signOut">Sign out <span><svg><use href="#i-up-right"/></svg></span></button></div>`);
    } };
  }
}

function openMenu(anchor, html) {
  if (ddAnchor === anchor && dd.classList.contains('open')) return closeMenu();
  closeMenu();
  dd.innerHTML = html;
  ddAnchor = anchor;
  anchor.classList.add('open');
  const r = anchor.getBoundingClientRect();
  dd.style.top = r.bottom + window.scrollY + 8 + 'px';
  dd.style.left = Math.max(12, Math.min(r.left + window.scrollX, window.innerWidth - dd.offsetWidth - 12)) + 'px';
  requestAnimationFrame(() => dd.classList.add('open'));
}
function closeMenu() {
  dd.classList.remove('open');
  ddAnchor?.classList.remove('open');
  ddAnchor = null;
}

function openNamedMenu(anchor, name) {
  const m = menuDef(name);
  const item = v => {
    const tog = m.toggles && v in m.toggles;
    return `<button class="dd-item ${tog && m.toggles[v] ? 'on' : ''} ${v === m.current ? 'sel' : ''}" data-v="${v}">${v}${tog ? '<span class="sw"></span>' : '<svg class="tick"><use href="#i-check"/></svg>'}</button>`;
  };
  const html = (m.title ? `<div class="dd-title">${m.title}</div>` : '') + m.items.map(item).join('') +
    (m.extra ? '<div class="dd-sep"></div>' + m.extra.map(item).join('') : '');
  openMenu(anchor, html);
  dd.onclick = e => {
    const it = e.target.closest('.dd-item');
    if (!it) return;
    const v = it.dataset.v;
    if (m.toggles && v in m.toggles) { it.classList.toggle('on'); m.pick(v); return; }
    $$('.dd-item', dd).forEach(x => x.classList.toggle('sel', x === it));
    setTimeout(() => { closeMenu(); m.pick(v); }, 130);
  };
}

document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-dd]');
  if (trigger) { e.stopPropagation(); return openNamedMenu(trigger, trigger.dataset.dd); }
  const exp = e.target.closest('[data-expand]');
  if (exp) return expand(exp.dataset.expand);
  if (!e.target.closest('#dropdown') && !e.target.closest('#bellBtn, #settingsBtn, #profileBtn')) closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); closeModal(); } });
window.addEventListener('resize', () => { closeMenu(); moveIndicator($('.tab.active')); positionDashLine(); });

$('#settingsBtn').addEventListener('click', e => openNamedMenu(e.currentTarget, 'settings'));
$('#profileBtn').addEventListener('click', e => openNamedMenu(e.currentTarget, 'profile'));

function resetFilters() {
  Object.assign(state, { dept: 'All Departments', source: 'All Sources', aType: 'All Patients', billFilter: 'All Invoices', stockFilter: 'All Items', calDoctor: 'All Doctors' });
  setLabel('sources', 'All Sources');
  $('#invSearch').value = '';
  $('#medSearch').value = '';
  SCREENS[state.screen].render();
  updateFilterLabel();
  toast('All filters have been reset');
}

/* ---------- Notifications ---------- */
function updateBadge() {
  const n = state.notifs.filter(x => x.unread).length;
  const b = $('#bellBadge');
  b.textContent = n;
  b.classList.toggle('hide', n === 0);
}
function renderNotifs() {
  dd.innerHTML = '<div class="dd-title">NOTIFICATIONS</div>' + state.notifs.map((n, i) => `
    <div class="notif ${n.unread ? 'unread' : ''}" data-n="${i}"><i style="background:${n.bg};color:${n.fg}"><svg><use href="#${n.icon}"/></svg></i>
    <div><b>${n.t}</b><small>${n.s}</small></div></div>`).join('') +
    `<div class="dd-foot"><span class="muted">${state.notifs.filter(x => x.unread).length} unread</span><button data-markall>Mark all as read</button></div>`;
}
$('#bellBtn').addEventListener('click', e => {
  openMenu(e.currentTarget, '');
  renderNotifs();
  dd.onclick = ev => {
    if (ev.target.closest('[data-markall]')) {
      state.notifs.forEach(n => (n.unread = false));
      renderNotifs(); updateBadge();
      return toast('All notifications marked as read');
    }
    const it = ev.target.closest('[data-n]');
    if (!it) return;
    const n = state.notifs[+it.dataset.n];
    n.unread = false;
    updateBadge();
    closeMenu();
    showScreen(n.go);
  };
});
// A new alert arrives a little after load
setTimeout(() => {
  state.notifs.unshift({ icon: 'i-pill', bg: '#fef3c7', fg: '#b45309', t: 'Low stock: Salbutamol Inhaler', s: 'Only 42 units left · just now', go: 'pharmacy', unread: true });
  updateBadge();
  $('#bellBtn').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(0)' }], { duration: 600 });
  toast('Low stock alert: Salbutamol Inhaler', { action: 'View', ms: 5000, onAction: () => showScreen('pharmacy') });
}, 30000);

/* ==========================================================
   Detail views (↗ buttons and KPI cards)
   ========================================================== */
function modalTable(title, sub, headers, rows, csvName) {
  state.modalCSV = { name: csvName, rows: [headers, ...rows] };
  openModal(`
    <h3>${title}</h3><p class="m-sub">${sub}</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>${headers.map((h, i) => `<th class="${i ? 'r' : ''}">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, j) => `<tr style="--rd:${j * 30}ms">${r.map((c, i) => `<td class="${i ? 'r' : ''}">${typeof c === 'number' ? fmt(c) : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="m-actions"><button class="btn-sec" data-action="close">Close</button><button class="join" data-action="csv">Download CSV <span><svg><use href="#i-export"/></svg></span></button></div>`, true);
}

function expand(key) {
  if (key.startsWith('kpi-')) {
    const [, p, i] = key.split('-');
    const k = (p === 'a' ? A_KPIS : P_KPIS)[+i];
    return modalTable(k.label, 'Monthly history for the last 8 months', ['Month', k.label], KPI_MONTHS.map((m, j) => [m, k.decimals ? k.spark[j].toFixed(1) + (k.suffix || '') : k.spark[j]]), `${k.label.toLowerCase().replace(/[^a-z]+/g, '-')}.csv`);
  }
  switch (key) {
    case 'admissions': {
      const d = ADMISSIONS[state.period];
      return modalTable(`Patient Admissions · ${state.period}`, 'Admissions per department', ['Department', ...d.full.map(f => f.slice(0, 3)), 'Total'],
        d.rows.map((r, i) => [DEPTS[i], ...r, sum(r)]), `admissions-${state.period.toLowerCase()}.csv`);
    }
    case 'occupancy':
      return modalTable('Bed Occupancy by Ward', 'Current occupied beds across all wards', ['Ward', 'Occupied', 'Capacity', 'Occupancy'],
        WARDS.map(([w, o, c]) => [w, o, c, Math.round(o / c * 100) + '%']), 'bed-occupancy.csv');
    case 'trend': {
      const d = TREND[state.aRange];
      return modalTable(`Admissions vs Discharges`, state.aRange, ['Month', 'Admissions', 'Discharges', 'Net'],
        d.labels.map((m, i) => [m, Math.round(d.adm[i] * pf()), Math.round(d.dis[i] * pf()), Math.round((d.adm[i] - d.dis[i]) * pf())]), 'admissions-vs-discharges.csv');
    }
    case 'gender': {
      const total = Math.round(GENDER_TOTAL * pf());
      return modalTable('Patients by Gender', state.aType, ['Gender', 'Patients', 'Share'], GENDER.map(([n, p]) => [n, Math.round(total * p / 100), p + '%']), 'patients-by-gender.csv');
    }
    case 'revenue': {
      const y = REVENUE[state.billYear];
      return modalTable(`Revenue ${state.billYear}`, 'Monthly revenue (forecast where not yet closed)', ['Month', 'Revenue', 'Type'],
        MONTHS.map((m, i) => [m, 'PKR ' + (y.vals[i] ?? y.forecast?.[i] ?? 0).toFixed(1) + 'M', y.vals[i] == null ? 'Forecast' : 'Actual']), `revenue-${state.billYear}.csv`);
    }
    case 'claims':
      return modalTable('Insurance Claims by Provider', 'Claims submitted this quarter', ['Provider', 'Approved', 'Pending', 'Rejected'], INSURERS, 'insurance-claims.csv');
    case 'dispensing':
      return modalTable('Dispensing Activity', 'Units dispensed this week', ['Category', ...DISPENSE.full.map(f => f.slice(0, 3)), 'Total'],
        DISPENSE.rows.map((r, i) => [DISPENSE.labels[i], ...r, sum(r)]), 'dispensing-activity.csv');
  }
}

/* ---------- Export ---------- */
function sourcesCSV() {
  const d = SOURCE_DATA[state.sort];
  return [['Source', 'Visits', 'Period'], ...SOURCES.map((s, i) => [s, d.values[i], d.range])];
}
function exportCSV() {
  const rows = [];
  const s = state.screen;
  if (s === 'dashboard') {
    const a = ADMISSIONS[state.period];
    rows.push([`Patient Admissions (${state.period})`], ['Department', ...a.full], ...a.rows.map((r, i) => [DEPTS[i], ...r]), []);
    rows.push(...sourcesCSV(), []);
    rows.push(['Ward', 'Occupied', 'Capacity'], ...WARDS);
  } else if (s === 'analytics') {
    const d = TREND[state.aRange];
    rows.push(['Month', 'Admissions', 'Discharges'], ...d.labels.map((m, i) => [m, Math.round(d.adm[i] * pf()), Math.round(d.dis[i] * pf())]), []);
    rows.push(['Age group', 'Patients'], ...AGE_GROUPS.map(([g, v]) => [g, Math.round(v * pf())]), []);
    rows.push(['Diagnosis', 'Patients'], ...DIAGNOSES.map(([n, v]) => [n, Math.round(v * pf())]));
  } else if (s === 'billing') {
    rows.push(['Invoice', 'Patient', 'Department', 'Date', 'Amount (PKR)', 'Status', 'Payer'], ...state.invoices.map(i => [i.id, i.patient, i.dept, i.date, i.amount, i.status, i.payer]), []);
    const y = REVENUE[state.billYear];
    rows.push(['Month', `Revenue ${state.billYear} (PKR M)`], ...MONTHS.map((m, i) => [m, y.vals[i] ?? '']));
  } else if (s === 'pharmacy') {
    rows.push(['Medicine', 'Category', 'Stock', 'Reorder level', 'Expiry', 'Status', 'Supplier'], ...state.meds.map(m => [m.name, m.cat, m.stock, m.reorder, m.expiry, medStatus(m), m.supplier]), []);
    rows.push(['Expiring batch', 'Medicine', 'Units', 'Days left'], ...state.expiring.map(e => [e.batch, e.name, e.qty, e.days]));
  } else {
    rows.push(['Date', 'Start', 'End', 'Patient', 'Doctor', 'Type', 'Location', 'Status'],
      ...Object.values(state.weekAppts).map(a => [a.date, fmtTime(a.start), fmtTime(a.start + a.dur), a.patient, a.doctor, APPT_TYPES[a.type], a.room, state.apptStatus[a.id] === 'done' ? 'Completed' : 'Scheduled']));
  }
  downloadCSV(`${s}-report-${ymd(TODAY)}.csv`, rows);
}

/* ==========================================================
   Tooltip, toasts, modal
   ========================================================== */
const tip = $('#tooltip');
document.addEventListener('mouseover', e => {
  if (e.target.closest('.line-chart')) return;
  const t = e.target.closest('[data-tip]');
  if (!t) return tip.classList.remove('show');
  const anchor = (t.classList.contains('bar-col') ? $('.bar', t) : t.classList.contains('vcol') ? $('.bar', t) : t).getBoundingClientRect();
  tip.innerHTML = t.dataset.tip;
  tip.style.left = anchor.left + anchor.width / 2 + 'px';
  tip.style.top = anchor.top + 'px';
  tip.classList.add('show');
});

function toast(msg, { action, onAction, ms = 2600 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="ti"><svg><use href="#i-check"/></svg></span><span>${msg}</span>${action ? `<button>${action}</button>` : ''}`;
  $('#toasts').appendChild(el);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  if (action) el.querySelector('button').onclick = () => { onAction(); kill(); };
  setTimeout(kill, ms);
  return el;
}

const modal = $('#modal');
function openModal(html, wide = false) {
  closeMenu();
  $('#modalBody').innerHTML = html;
  $('.modal-card', modal).classList.toggle('wide', wide);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}
function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}
$('#modalClose').addEventListener('click', closeModal);

const ACTIONS = {
  close: closeModal,
  csv: () => downloadCSV(state.modalCSV.name, state.modalCSV.rows),
  payInvoice: el => {
    const inv = state.invoices.find(i => i.id === el.dataset.id);
    inv.status = 'Paid';
    state.dues.amt -= inv.amount;
    state.dues.count--;
    renderInvoices();
    renderDues();
    closeModal();
    toast(`${inv.id} marked as paid — ${money(inv.amount)} received`);
  },
  downloadInvoice: el => {
    const i = state.invoices.find(x => x.id === el.dataset.id);
    downloadCSV(`${i.id}.csv`, [['Invoice', 'Patient', 'Department', 'Date', 'Payer', 'Amount (PKR)', 'Status'], [i.id, i.patient, i.dept, i.date, i.payer, i.amount, i.status]]);
  },
  reorder: el => { reorderMed(el.dataset.id); closeModal(); },
  batch: el => {
    const batch = el.dataset.id;
    const e = state.expiring.find(x => x.batch === batch);
    state.expiring = state.expiring.filter(x => x.batch !== batch);
    state.expCount--;
    const li = el.closest('li');
    li.classList.add('gone');
    setTimeout(() => li.remove(), 350);
    renderExpiry();
    updatePKpi(2);
    toast(`${e.name} (${batch}) ${el.dataset.kind}`);
  },
  cancelAppt: el => {
    const id = el.dataset.id, a = state.weekAppts[id];
    state.apptStatus[id] = 'cancelled';
    closeModal();
    renderWeek(); renderMiniCal();
    toast(`Appointment with ${a.patient} cancelled`, {
      action: 'Undo', ms: 4500,
      onAction: () => { delete state.apptStatus[id]; renderWeek(); renderMiniCal(); },
    });
  },
  completeAppt: el => {
    const a = state.weekAppts[el.dataset.id];
    state.apptStatus[el.dataset.id] = 'done';
    closeModal();
    renderWeek();
    toast(`${a.patient}'s appointment marked completed`);
  },
  goEmergency: () => { closeModal(); showScreen('dashboard'); state.source = 'Emergency'; setLabel('sources', 'Emergency'); renderBars(); toast('Highlighting emergency patient sources'); },
  goIcu: () => { closeModal(); showScreen('dashboard'); state.icu = true; renderGauge(); toast('Showing ICU occupancy'); },
  goCalendar: () => { closeModal(); showScreen('calendar'); },
  startTrial: () => {
    state.pro = true;
    $('.promo-text').innerHTML = '<strong>Pro trial<br/>active</strong><small>14 days remaining</small>';
    closeModal();
    toast('Medora Pro trial activated for 14 days');
  },
  endTrial: () => {
    state.pro = false;
    $('.promo-text').innerHTML = '<strong>Unlock full<br/>version</strong><small>20+ clinical metrics</small>';
    closeModal();
    toast('Pro trial cancelled');
  },
  signOut: () => {
    closeModal();
    let o = $('#signout');
    if (!o) {
      o = document.createElement('div');
      o.id = 'signout';
      o.className = 'signout';
      o.innerHTML = `<div class="modal-card"><div class="big-check"><svg><use href="#i-check"/></svg></div>
        <h3>You've been signed out</h3><p class="m-sub">Your session has ended securely.</p>
        <div class="m-actions"><button class="join" id="signInBtn">Sign in as Dr. Hira Malik <span><svg><use href="#i-up-right"/></svg></span></button></div></div>`;
      document.body.appendChild(o);
      o.querySelector('#signInBtn').onclick = () => { o.classList.remove('open'); toast('Welcome back, Dr. Hira!'); };
    }
    requestAnimationFrame(() => o.classList.add('open'));
  },
};

modal.addEventListener('click', e => {
  if (e.target === modal) return closeModal();
  const a = e.target.closest('[data-action]');
  if (a && ACTIONS[a.dataset.action]) ACTIONS[a.dataset.action](a);
});

function fieldError(form, name, msg) {
  const f = form.elements[name].closest('.field');
  f.classList.remove('err'); void f.offsetWidth;
  f.classList.add('err');
  $('.msg', f).textContent = msg;
  form.elements[name].focus();
}

const FORMS = {
  book: form => {
    $$('.field', form).forEach(f => { f.classList.remove('err'); const m = $('.msg', f); if (m) m.textContent = ''; });
    const patient = form.elements.patient.value.trim();
    if (patient.length < 3) return fieldError(form, 'patient', 'Please enter the patient’s full name');
    const date = form.elements.date.value, start = +form.elements.start.value, dur = +form.elements.dur.value;
    const [y, m, d] = date.split('-').map(Number);
    const day = new Date(y, m - 1, d);
    const end = day.getDay() === 6 ? 13 : 17;
    if (start + dur > end) return fieldError(form, 'start', `Appointments must end by ${fmtTime(end)} on this day`);
    const clash = apptsFor(day).find(a => start < a.start + a.dur && a.start < start + dur);
    if (clash) return fieldError(form, 'start', `Clashes with ${clash.patient} (${fmtTime(clash.start)}–${fmtTime(clash.start + clash.dur)})`);
    const type = form.elements.type.value;
    (state.booked[date] ||= []).push({
      id: `${date}-b${Date.now()}`, date, start, dur, type, patient, doctor: form.elements.doctor.value,
      room: type === 'surgery' ? 'OT-1' : `Room ${100 + Math.floor(Math.random() * 40)}`,
    });
    state.selDate = day;
    closeModal();
    renderWeek(); renderMiniCal();
    toast(`Booked ${patient} on ${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${fmtTime(start)}`);
  },
  apply: form => {
    $$('.field', form).forEach(f => { f.classList.remove('err'); const m = $('.msg', f); if (m) m.textContent = ''; });
    if (form.elements.name.value.trim().length < 3) return fieldError(form, 'name', 'Please enter your full name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value.trim())) return fieldError(form, 'email', 'Please enter a valid email address');
    state.applied = form.elements.area.value;
    const btn = $('#joinBtn');
    btn.classList.add('done');
    btn.innerHTML = 'Applied <span><svg><use href="#i-check"/></svg></span>';
    $('#modalBody').innerHTML = `<div class="center"><div class="big-check"><svg><use href="#i-check"/></svg></div>
      <h3>Application submitted</h3><p class="m-sub">We'll email ${form.elements.email.value.trim()} about the ${form.elements.area.value} track within 3 working days.</p>
      <div class="m-actions"><button class="join" data-action="close">Done <span><svg><use href="#i-check"/></svg></span></button></div></div>`;
    toast('Research program application submitted');
  },
};
modal.addEventListener('submit', e => {
  e.preventDefault();
  FORMS[e.target.dataset.form]?.(e.target);
});

/* ==========================================================
   Remaining controls
   ========================================================== */
$('#joinBtn').addEventListener('click', () => {
  if (state.applied) return openModal(`<div class="center"><div class="big-check"><svg><use href="#i-check"/></svg></div>
    <h3>You're enrolled</h3><p class="m-sub">Your ${state.applied} research application is under review.</p>
    <div class="m-actions"><button class="join" data-action="close">Got it <span><svg><use href="#i-check"/></svg></span></button></div></div>`);
  openModal(`
    <h3>Medical Research Program</h3>
    <p class="m-sub">Staff receive a 15% research grant, protected study hours and senior mentorship.</p>
    <div class="stat-row">
      <div class="stat"><b>42</b><small>Open seats</small></div>
      <div class="stat"><b>6 mo</b><small>Duration</small></div>
      <div class="stat"><b>+15%</b><small>Grant</small></div>
    </div>
    <form data-form="apply" novalidate>
      <div class="field"><label>Full name</label><input name="name" value="Dr. Hira Malik"/><span class="msg"></span></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="hira.malik@medora.pk"/><span class="msg"></span></div>
      <div class="field"><label>Research track</label><select name="area"><option>Cardiology</option><option>Neurology</option><option>Pediatrics</option><option>Public Health</option></select></div>
      <div class="m-actions"><button class="join" type="submit">Apply Now <span><svg><use href="#i-up-right"/></svg></span></button></div>
    </form>`);
});

$('#promoCard').addEventListener('click', () => {
  if (state.pro) return openModal(`
    <h3>Medora Pro trial</h3><p class="m-sub">Your trial is active with 14 days remaining. All 20+ clinical metrics are unlocked.</p>
    <div class="m-actions"><button class="btn-sec danger" data-action="endTrial">Cancel trial</button><button class="join" data-action="close">Keep Pro <span><svg><use href="#i-check"/></svg></span></button></div>`);
  openModal(`
    <h3>Unlock Medora Pro</h3>
    <p class="m-sub">Get readmission risk scoring, surgery throughput, staff utilisation and real-time pharmacy alerts.</p>
    <div class="stat-row">
      <div class="stat"><b>20+</b><small>Metrics</small></div>
      <div class="stat"><b>24/7</b><small>Monitoring</small></div>
      <div class="stat"><b>AI</b><small>Forecasts</small></div>
    </div>
    <div class="m-actions"><button class="btn-sec" data-action="close">Maybe later</button><button class="join" data-action="startTrial">Start Free Trial <span><svg><use href="#i-up-right"/></svg></span></button></div>`);
});

function profileModal() {
  openModal(`
    <div class="who" style="gap:14px;margin-bottom:6px"><span class="avatar" style="width:56px;height:56px"><svg style="width:56px;height:58px"><use href="#doctor"/></svg></span>
    <div><h3 style="margin:0">Dr. Hira Malik</h3><p class="m-sub" style="margin:0">Consultant Cardiologist</p></div></div>
    <div class="kv">
      <div><small>Department</small><b>Cardiology</b></div>
      <div><small>Employee ID</small><b>MED-0412</b></div>
      <div><small>Email</small><b>hira.malik@medora.pk</b></div>
      <div><small>Phone</small><b>+92 300 1234567</b></div>
      <div><small>Shift</small><b>08:00 – 17:00</b></div>
      <div><small>Patients this week</small><b>${Object.values(state.weekAppts).filter(a => a.doctor === 'Dr. Hira Malik').length || 18}</b></div>
    </div>
    <div class="m-actions"><button class="btn-sec" data-action="close">Close</button></div>`);
}

const reportCard = $('#reportCard');
$('#reportOpen').addEventListener('click', () => {
  const d = SOURCE_DATA[state.sort];
  openModal(`
    <h3>Monthly Medical Report</h3>
    <p class="m-sub">${TODAY.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} summary across all departments.</p>
    <div class="stat-row">
      <div class="stat"><b>${fmt(sum(ADMISSIONS[state.period].rows.flat()))}</b><small>Admissions</small></div>
      <div class="stat"><b>${$('#occVal').textContent}</b><small>Bed occupancy</small></div>
      <div class="stat"><b>${fmtK(sum(d.values))}</b><small>Patient visits</small></div>
    </div>
    <div class="m-actions"><button class="btn-sec" data-action="close">Close</button><button class="join" data-action="dashCsv">Download Report <span><svg><use href="#i-export"/></svg></span></button></div>`);
});
ACTIONS.dashCsv = () => { closeModal(); exportCSV(); };

$('#reportPrint').addEventListener('click', () => {
  $('#reportProgress i').animate([{ width: '0%' }, { width: '100%' }], { duration: 1400, easing: 'cubic-bezier(.22,1,.36,1)' })
    .onfinish = () => window.print();
});

$('#reportClose').addEventListener('click', () => {
  reportCard.classList.remove('back');
  reportCard.classList.add('hidden-card');
  toast('Report card hidden', {
    action: 'Undo', ms: 4000,
    onAction: () => { reportCard.classList.remove('hidden-card'); reportCard.classList.add('back'); },
  });
});

$('#todaySwap').addEventListener('click', e => {
  e.currentTarget.classList.toggle('flip');
  state.today = (state.today + 1) % TODAY_METRICS.length;
  renderToday();
});

$('#icuToggle').addEventListener('change', e => {
  state.icu = e.target.checked;
  renderGauge();
  toast(state.icu ? 'Showing ICU occupancy' : 'Showing all wards');
});

/* ---------- Ripple on press ---------- */
document.addEventListener('pointerdown', e => {
  const host = e.target.closest('.pill, .circle, .join, .side-main, .dd-item, .mini-btn, .btn-sec');
  if (!host) return;
  const r = host.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  const s = document.createElement('span');
  s.className = 'ripple';
  Object.assign(s.style, { width: size + 'px', height: size + 'px', left: e.clientX - r.left - size / 2 + 'px', top: e.clientY - r.top - size / 2 + 'px' });
  host.appendChild(s);
  setTimeout(() => s.remove(), 650);
});

/* ---------- Portfolio case-study notice ---------- */
const SEEN_KEY = 'medora-case-study-seen';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

function caseStudyModal() {
  openModal(`
    <span class="cs-eyebrow"><svg><use href="#i-lock"/></svg>PORTFOLIO CASE STUDY</span>
    <h3>Medora — Hospital Management Dashboard</h3>
    <p class="m-sub">Designed and developed by Malik Fahad Awan for a private healthcare client.
      The client's name and real data are confidential, so this public version runs on dummy data.
      The design, screens and interactions match the product delivered to the client.</p>
    <div class="cs-grid">
      <div class="cs-box"><h5><i style="background:#22c55e"></i>Same as delivered</h5>
        <ul><li>UI design &amp; layout</li><li>All 5 screens</li><li>Charts &amp; animations</li><li>Interactions &amp; workflows</li></ul></div>
      <div class="cs-box"><h5><i style="background:#f59e0b"></i>Replaced with dummy data</h5>
        <ul><li>Patients &amp; doctors</li><li>Revenue &amp; invoices</li><li>Pharmacy stock</li><li>Client branding</li></ul></div>
    </div>
    <div class="cs-meta"><span>UI/UX Design</span><span>Front-end Development</span><span>HTML · CSS · JavaScript</span><span>Responsive</span></div>
    <div class="m-actions"><button class="join" data-action="close">Explore the Live Demo <span><svg><use href="#i-up-right"/></svg></span></button></div>`, true);
  store.set(SEEN_KEY, '1');
}

$('#caseOpen').addEventListener('click', caseStudyModal);
$('#caseClose').addEventListener('click', () => {
  const bar = $('#caseBar');
  bar.classList.add('gone');
  setTimeout(() => (bar.style.display = 'none'), 350);
});
// ?shot hides the first-visit popup (used to capture the link preview image)
if (!store.get(SEEN_KEY) && !location.search.includes('shot')) setTimeout(caseStudyModal, 900);

/* ---------- Boot ---------- */
buildGauge(occGauge);
buildGauge(claimsGauge);
updateBadge();
document.addEventListener('animationend', e => {
  if (e.animationName === 'rise') e.target.classList.remove('reveal');
});
requestAnimationFrame(() => {
  document.body.classList.add('ready');
  showScreen(location.hash.slice(1) || 'dashboard', true);
});
document.fonts?.ready.then(() => moveIndicator($('.tab.active')));
