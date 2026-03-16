/**
 * Ledger — Personal Finance Tracker
 * Handles: transactions, budgets, charts, localStorage
 */

/* =========================================
   CATEGORIES CONFIG
   ========================================= */
const CATEGORIES = {
  income: [
    { id: 'salary', label: 'Salary', emoji: '💼' },
    { id: 'freelance', label: 'Freelance', emoji: '💻' },
    { id: 'investment', label: 'Investment', emoji: '📈' },
    { id: 'business', label: 'Business', emoji: '🏢' },
    { id: 'gift', label: 'Gift', emoji: '🎁' },
    { id: 'other-inc', label: 'Other', emoji: '💰' },
  ],
  expense: [
    { id: 'food', label: 'Food & Dining', emoji: '🍔' },
    { id: 'transport', label: 'Transport', emoji: '🚗' },
    { id: 'housing', label: 'Housing', emoji: '🏠' },
    { id: 'health', label: 'Health', emoji: '💊' },
    { id: 'entertainment', label: 'Entertainment', emoji: '🎮' },
    { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
    { id: 'utilities', label: 'Utilities', emoji: '⚡' },
    { id: 'education', label: 'Education', emoji: '📚' },
    { id: 'travel', label: 'Travel', emoji: '✈️' },
    { id: 'other-exp', label: 'Other', emoji: '📦' },
  ]
};

/* =========================================
   STATE
   ========================================= */
const State = {
  transactions: [],  // All transactions
  budgets: [],       // Budget goals per category
  charts: {},        // Chart.js instances
  filterMonth: '',   // Currently selected filter month (YYYY-MM)
  filterType: 'all', // all | income | expense
  filterCategory: '', // category id or ''
  txType: 'income',  // Current modal type
};

/* =========================================
   LOCALSTORAGE
   ========================================= */
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

function loadData() {
  State.transactions = LS.get('ledger_tx') || [];
  State.budgets = LS.get('ledger_budgets') || [];
}
function saveData() {
  LS.set('ledger_tx', State.transactions);
  LS.set('ledger_budgets', State.budgets);
}

/* =========================================
   INIT
   ========================================= */
function init() {
  loadData();
  seedDemoData();
  populateYearSelect();
  populateMonthFilter();
  populateCategoryChips();
  renderAll();
  bindEvents();
}

/** Seed demo transactions on first visit */
function seedDemoData() {
  if (State.transactions.length > 0) return;

  const now = new Date();
  const demos = [
    { type: 'income', desc: 'Monthly Salary', amount: 5500, category: 'salary', date: fmt(now, -5) },
    { type: 'income', desc: 'Freelance Project', amount: 1200, category: 'freelance', date: fmt(now, -10) },
    { type: 'expense', desc: 'Rent Payment', amount: 1400, category: 'housing', date: fmt(now, -1) },
    { type: 'expense', desc: 'Groceries', amount: 240, category: 'food', date: fmt(now, -3) },
    { type: 'expense', desc: 'Netflix & Spotify', amount: 28, category: 'entertainment', date: fmt(now, -2) },
    { type: 'expense', desc: 'Gym Membership', amount: 55, category: 'health', date: fmt(now, -7) },
    { type: 'expense', desc: 'Internet Bill', amount: 80, category: 'utilities', date: fmt(now, -4) },
    { type: 'expense', desc: 'Uber rides', amount: 65, category: 'transport', date: fmt(now, -6) },
    { type: 'income', desc: 'Stock Dividends', amount: 320, category: 'investment', date: fmt(now, -14) },
    { type: 'expense', desc: 'Online Course', amount: 99, category: 'education', date: fmt(now, -8) },
  ];

  demos.forEach(d => {
    State.transactions.push({ id: uid(), ...d, note: '' });
  });

  // Default budgets
  State.budgets = [
    { category: 'food', limit: 400 },
    { category: 'transport', limit: 150 },
    { category: 'entertainment', limit: 100 },
  ];

  saveData();
}

function fmt(date, offsetDays = 0) {
  const d = new Date(date);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

/* =========================================
   RENDER ALL
   ========================================= */
function renderAll() {
  updateBalance();
  buildMonthlyChart();
  buildCategoryCharts();
  renderTransactions();
  renderSavingsGauge();
  renderBudgetList();
  renderTopExpenses();
}

/* =========================================
   BALANCE TOTALS
   ========================================= */
function updateBalance() {
  const income = State.transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const expense = State.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('totalBalance').textContent = formatMoney(balance);
  document.getElementById('totalIncome').textContent = formatMoney(income);
  document.getElementById('totalExpenses').textContent = formatMoney(expense);

  // Balance color
  const el = document.getElementById('totalBalance');
  el.style.color = balance >= 0 ? '#22c55e' : '#f43f5e';
}

/* =========================================
   CHARTS
   ========================================= */
const CHART_OPTS = {
  textColor: '#7a9e90',
  gridColor: 'rgba(255,255,255,0.05)',
};

function destroyChart(id) {
  if (State.charts[id]) { State.charts[id].destroy(); delete State.charts[id]; }
}

/** Monthly income vs expense bar chart */
function buildMonthlyChart() {
  destroyChart('monthly');
  const ctx = document.getElementById('monthlyChart').getContext('2d');

  const year = document.getElementById('yearSelect').value || new Date().getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const incomeData = Array(12).fill(0);
  const expenseData = Array(12).fill(0);

  State.transactions.forEach(tx => {
    const d = new Date(tx.date);
    if (d.getFullYear() !== parseInt(year)) return;
    const m = d.getMonth();
    if (tx.type === 'income') incomeData[m] += tx.amount;
    else expenseData[m] += tx.amount;
  });

  State.charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 6, borderWidth: 0 },
        { label: 'Expenses', data: expenseData, backgroundColor: 'rgba(244,63,94,0.7)', borderRadius: 6, borderWidth: 0 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: CHART_OPTS.textColor, font: { family: 'Raleway' } } } },
      scales: {
        x: { ticks: { color: CHART_OPTS.textColor }, grid: { color: CHART_OPTS.gridColor } },
        y: { ticks: { color: CHART_OPTS.textColor, callback: v => '$' + v.toLocaleString() }, grid: { color: CHART_OPTS.gridColor }, beginAtZero: true },
      }
    }
  });
}

/** Expense by category donut */
function buildCategoryCharts() {
  destroyChart('expCat');
  destroyChart('incCat');

  const expCtx = document.getElementById('expCategoryChart').getContext('2d');
  const incCtx = document.getElementById('incCategoryChart').getContext('2d');

  const expMap = {}, incMap = {};
  State.transactions.forEach(tx => {
    const map = tx.type === 'expense' ? expMap : incMap;
    const cat = getCatLabel(tx.type, tx.category);
    map[cat] = (map[cat] || 0) + tx.amount;
  });

  const colors = ['#f43f5e','#f97316','#fbbf24','#22c55e','#06b6d4','#7c5cfc','#e066ff','#10b981','#64748b','#ef4444'];

  function makeDonut(ctx, dataMap, key) {
    const labels = Object.keys(dataMap);
    const vals = Object.values(dataMap);
    State.charts[key] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: vals.length ? vals : [1],
          backgroundColor: labels.length ? colors.slice(0, labels.length) : ['#1e293b'],
          borderColor: 'transparent', hoverOffset: 8 }]
      },
      options: {
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { color: CHART_OPTS.textColor, font: { size: 11, family: 'Raleway' }, padding: 10 } } }
      }
    });
  }

  makeDonut(expCtx, expMap, 'expCat');
  makeDonut(incCtx, incMap, 'incCat');
}

/** Savings gauge (doughnut) */
function renderSavingsGauge() {
  destroyChart('savings');
  const ctx = document.getElementById('savingsGauge').getContext('2d');

  const income = State.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = State.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const rate = income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;
  const remaining = 100 - rate;

  document.getElementById('savingsRate').textContent = rate + '%';

  const tip = rate >= 50 ? '🔥 Excellent! You\'re saving more than half your income!'
    : rate >= 20 ? '👍 Good job! Aim for 50%+ savings rate.'
    : rate >= 0 ? '⚠️ Consider reducing expenses to save more.'
    : '🚨 Expenses exceed income. Time to cut back!';
  document.getElementById('savingsTip').textContent = tip;

  State.charts.savings = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [Math.max(rate, 0), Math.max(remaining, 0)],
        backgroundColor: [rate >= 20 ? '#10b981' : '#f43f5e', '#161d2b'],
        borderColor: 'transparent',
      }]
    },
    options: {
      cutout: '75%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    }
  });
}

/* =========================================
   TRANSACTION TABLE
   ========================================= */
function getFilteredTx() {
  return State.transactions.filter(tx => {
    if (State.filterType !== 'all' && tx.type !== State.filterType) return false;
    if (State.filterMonth && !tx.date.startsWith(State.filterMonth)) return false;
    if (State.filterCategory && tx.category !== State.filterCategory) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions() {
  const tbody = document.getElementById('txTableBody');
  const empty = document.getElementById('txEmpty');
  const filtered = getFilteredTx();

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(tx => {
    const cat = getCatObj(tx.type, tx.category);
    return `
      <tr>
        <td class="tx-date">${formatDate(tx.date)}</td>
        <td>
          <div style="font-weight:600;font-size:.9rem">${escapeHTML(tx.desc)}</div>
          ${tx.note ? `<div style="font-size:.78rem;color:var(--text-2)">${escapeHTML(tx.note)}</div>` : ''}
        </td>
        <td><span class="tx-cat-badge">${cat ? cat.emoji + ' ' + cat.label : tx.category}</span></td>
        <td><span class="tx-type-badge ${tx.type}">${tx.type}</span></td>
        <td class="text-end"><span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</span></td>
        <td><button class="tx-delete" onclick="deleteTx('${tx.id}')"><i class="bi bi-trash3"></i></button></td>
      </tr>`;
  }).join('');
}

function deleteTx(id) {
  if (!confirm('Delete this transaction?')) return;
  State.transactions = State.transactions.filter(t => t.id !== id);
  saveData();
  renderAll();
  showToast('Transaction deleted', 'error');
}

/* =========================================
   BUDGET LIST
   ========================================= */
function renderBudgetList() {
  const container = document.getElementById('budgetList');

  if (!State.budgets.length) {
    container.innerHTML = `<div class="empty-state" style="padding:1rem"><i class="bi bi-wallet"></i><p>No budgets set</p></div>`;
    return;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  container.innerHTML = State.budgets.map(b => {
    const spent = State.transactions
      .filter(t => t.type === 'expense' && t.category === b.category && t.date.startsWith(currentMonth))
      .reduce((s, t) => s + t.amount, 0);
    const pct = Math.min((spent / b.limit) * 100, 100);
    const over = spent > b.limit;
    const cat = getCatObj('expense', b.category);

    return `
      <div class="budget-item">
        <div class="budget-item-header">
          <span class="budget-item-name">${cat ? cat.emoji + ' ' + cat.label : b.category}</span>
          <span class="budget-item-amounts">${formatMoney(spent)} / ${formatMoney(b.limit)}</span>
        </div>
        <div class="budget-bar">
          <div class="budget-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

/* =========================================
   TOP EXPENSES
   ========================================= */
function renderTopExpenses() {
  const container = document.getElementById('topExpenses');
  const map = {};

  State.transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = getCatLabel('expense', t.category);
    map[cat] = { amount: (map[cat]?.amount || 0) + t.amount, id: t.category };
  });

  const sorted = Object.entries(map).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
  const max = sorted[0]?.[1].amount || 1;

  if (!sorted.length) {
    container.innerHTML = `<div style="color:var(--text-2);font-size:.88rem;text-align:center;padding:1rem">No expenses yet</div>`;
    return;
  }

  container.innerHTML = sorted.map(([label, data]) => {
    const cat = getCatObj('expense', data.id);
    const pct = (data.amount / max) * 100;
    return `
      <div class="top-exp-item">
        <div class="top-exp-icon">${cat?.emoji || '📦'}</div>
        <div class="top-exp-info">
          <div class="top-exp-name">${label}</div>
          <div class="top-exp-bar-wrap"><div class="top-exp-bar" style="width:${pct}%"></div></div>
        </div>
        <div class="top-exp-amount">${formatMoney(data.amount)}</div>
      </div>`;
  }).join('');
}

/* =========================================
   MODAL & FORM
   ========================================= */
let currentModalType = 'income';

function bindEvents() {
  // Open modal with type
  document.querySelectorAll('[data-type]').forEach(btn => {
    if (btn.dataset.bs || btn.closest('.tx-type-toggle')) return; // handled separately
    btn.addEventListener('click', () => setModalType(btn.dataset.type));
  });

  // Open "add income" / "add expense" buttons from nav
  document.querySelector('.btn-add.income').addEventListener('click', () => setModalType('income'));
  document.querySelector('.btn-add.expense').addEventListener('click', () => setModalType('expense'));

  // Type toggle inside modal
  document.getElementById('typeIncome').addEventListener('click', () => setModalType('income'));
  document.getElementById('typeExpense').addEventListener('click', () => setModalType('expense'));

  // Save transaction
  document.getElementById('saveTxBtn').addEventListener('click', saveTx);

  // Filter month
  document.getElementById('filterMonth').addEventListener('change', (e) => {
    State.filterMonth = e.target.value;
    renderTransactions();
  });

  // Filter type
  document.getElementById('filterType').addEventListener('change', (e) => {
    State.filterType = e.target.value;
    renderTransactions();
  });

  // Year select for chart
  document.getElementById('yearSelect').addEventListener('change', buildMonthlyChart);

  // Budget modal
  document.getElementById('addBudgetBtn').addEventListener('click', () => {
    populateBudgetCategorySelect();
    new bootstrap.Modal(document.getElementById('budgetModal')).show();
  });
  document.getElementById('saveBudgetBtn').addEventListener('click', saveBudget);
}

function setModalType(type) {
  currentModalType = type;
  document.getElementById('typeIncome').classList.toggle('active', type === 'income');
  document.getElementById('typeExpense').classList.toggle('active', type === 'expense');
  document.getElementById('txModalTitle').textContent = `Add ${type === 'income' ? 'Income' : 'Expense'}`;
  populateCategorySelect(type);
}

function populateCategorySelect(type) {
  const sel = document.getElementById('txCategory');
  const cats = CATEGORIES[type] || [];
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
}

function saveTx() {
  const desc = document.getElementById('txDesc').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const date = document.getElementById('txDate').value;
  const category = document.getElementById('txCategory').value;
  const note = document.getElementById('txNote').value.trim();

  if (!desc) { showToast('Please enter a description', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
  if (!date) { showToast('Please select a date', 'error'); return; }

  const tx = { id: uid(), type: currentModalType, desc, amount, category, date, note };
  State.transactions.unshift(tx);
  saveData();
  renderAll();

  // Close modal and reset
  bootstrap.Modal.getInstance(document.getElementById('txModal'))?.hide();
  document.getElementById('txDesc').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txNote').value = '';
  document.getElementById('txDate').value = '';

  showToast(`${currentModalType === 'income' ? 'Income' : 'Expense'} added!`, 'success');
}

function saveBudget() {
  const category = document.getElementById('budgetCategory').value;
  const limit = parseFloat(document.getElementById('budgetLimit').value);

  if (!limit || limit <= 0) { showToast('Enter a valid limit', 'error'); return; }

  const existing = State.budgets.findIndex(b => b.category === category);
  if (existing > -1) State.budgets[existing].limit = limit;
  else State.budgets.push({ category, limit });

  saveData();
  renderBudgetList();
  bootstrap.Modal.getInstance(document.getElementById('budgetModal'))?.hide();
  showToast('Budget goal saved!', 'success');
}

function populateBudgetCategorySelect() {
  const sel = document.getElementById('budgetCategory');
  sel.innerHTML = CATEGORIES.expense.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
}

/* =========================================
   FILTER POPULATION
   ========================================= */
function populateYearSelect() {
  const sel = document.getElementById('yearSelect');
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 4; y--) {
    sel.innerHTML += `<option value="${y}" ${y === thisYear ? 'selected' : ''}>${y}</option>`;
  }
}

function populateMonthFilter() {
  const sel = document.getElementById('filterMonth');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  sel.innerHTML = '<option value="">All Months</option>';
  const thisYear = new Date().getFullYear();
  for (let m = 11; m >= 0; m--) {
    const val = `${thisYear}-${String(m + 1).padStart(2, '0')}`;
    sel.innerHTML += `<option value="${val}">${months[m]} ${thisYear}</option>`;
  }
}

function populateCategoryChips() {
  const container = document.getElementById('categoryChips');
  const allCats = [...CATEGORIES.income, ...CATEGORIES.expense];

  container.innerHTML = `<button class="chip active" data-cat="">All</button>` +
    allCats.map(c => `<button class="chip" data-cat="${c.id}">${c.emoji} ${c.label}</button>`).join('');

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      State.filterCategory = chip.dataset.cat;
      renderTransactions();
    });
  });
}

/* =========================================
   HELPERS
   ========================================= */
function getCatObj(type, id) {
  return (CATEGORIES[type] || []).find(c => c.id === id);
}
function getCatLabel(type, id) {
  return getCatObj(type, id)?.label || id;
}
function formatMoney(n) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(str) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}

/* =========================================
   TOAST
   ========================================= */
function showToast(msg, type = 'success') {
  const area = document.getElementById('toastArea');
  const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
  const div = document.createElement('div');
  div.className = `toast-msg ${type}`;
  div.innerHTML = `<i class="bi ${icon}"></i><span>${msg}</span>`;
  area.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }, 3000);
}

/* =========================================
   BOOT
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
  init();
  // Set today's date in modal
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  setModalType('income');
});