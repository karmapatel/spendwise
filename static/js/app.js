/*
 * Copyright (C) 2026 Karma Patel karmapatel4@gmail.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://gnu.org>.
 */

// Main SpendWise Application Controller
const App = {
  activeTab: 'dashboard',
  currentEditingId: null,
  currentDeleteId: null,
  transactionsPage: 1,
  pageSize: 10,
  currentFilteredTransactions: [],

  async init() {
    // 1. Immediately bind all DOM listeners synchronously on startup
    this.setupEventListeners();

    // 2. Initialize filter and calendar controllers
    FilterManager.init();
    CalendarController.init();

    // Setup filter listeners (refresh active view only)
    FilterManager.onChange(() => {
      if (this.activeTab === 'transactions') this.refreshTransactionsView();
      else if (this.activeTab === 'analytics') this.refreshAnalyticsView();
    });

    // 3. Instant SWR Render: Restore user & dashboard UI in 0ms from localStorage cache
    Auth.initFromCache();
    this.renderDashboardFromCache();

    // 4. Start PWA service worker and health monitoring asynchronously in background
    this.setupMonitoringAndPWA();

    // 5. Fast consolidated bootstrap: single roundtrip for auth check + live dashboard sync
    await this.bootstrapData();
  },

  setupEventListeners() {
    // Fast document-level event delegation: guarantees instant navbar navigation response
    // with zero startup delay or race conditions with network/auth checks
    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) {
        e.preventDefault();
        const target = tabBtn.getAttribute('data-tab-target');
        if (target) this.switchTab(target);
        return;
      }

      const navLink = e.target.closest('aside a[data-path]');
      if (navLink) {
        e.preventDefault();
        const path = navLink.getAttribute('data-path');
        if (path === 'logout') {
          Auth.handleLogout();
        } else if (path) {
          this.switchTab(path);
        }
        return;
      }

      const addBtn = e.target.closest('.btn-open-add-modal');
      if (addBtn) {
        e.preventDefault();
        this.openAddTransactionModal();
        return;
      }
    });

    // Transaction form submission
    const txForm = document.getElementById('transaction-form');
    if (txForm) {
      txForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
    }

    // Auth forms
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        Auth.handleLogin(email, pass);
      });
    }

    const registerForm = document.getElementById('form-register');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        Auth.handleRegister(name, email, pass);
      });
    }

    // Search input debounce
    const searchInput = document.getElementById('ledger-search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          FilterManager.setSearch(e.target.value);
        }, 300);
      });
    }

    // Date range dropdown
    const rangeSelect = document.getElementById('filter-date-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        FilterManager.applyPreset(e.target.value);
      });
    }

    // Category dropdown
    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        FilterManager.setCategory(e.target.value);
      });
    }

    // Method dropdown
    const methodSelect = document.getElementById('filter-method-select');
    if (methodSelect) {
      methodSelect.addEventListener('change', (e) => {
        FilterManager.setPaymentMethod(e.target.value);
      });
    }

    // Type pills
    document.querySelectorAll('[data-type-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type-filter');
        FilterManager.setType(type);
      });
    });

    // Reset filters button
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        FilterManager.reset();
      });
    }

    // Profile Settings Form
    const profileForm = document.getElementById('profile-settings-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('settings-name-input').value;
        const budget = document.getElementById('settings-budget-input').value;
        const currency = document.getElementById('settings-currency-input').value;

        try {
          const res = await API.auth.updateProfile({
            name,
            monthly_budget: budget,
            currency
          });
          Auth.currentUser = res.user;
          Auth.updateUserUI();
          App.showToast('Profile and settings updated!', 'success');
          App.refreshAllViews();
        } catch (err) {
          App.showToast(err.message || 'Failed to update profile', 'error');
        }
      });
    }

    // CSV Export button
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.triggerCsvExport());
    }
  },

  toggleMobileSidebar(show) {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    if (show) {
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
      document.body.classList.add('overflow-hidden', 'lg:overflow-auto');
    } else {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
      document.body.classList.remove('overflow-hidden', 'lg:overflow-auto');
    }
  },

  switchTab(targetId) {
    const validTabs = ['dashboard', 'transactions', 'analytics', 'calendar', 'categories', 'settings'];
    if (!validTabs.includes(targetId)) return;

    this.activeTab = targetId;

    // Auto-close mobile drawer upon selecting any view
    this.toggleMobileSidebar(false);

    // 1. Toggle Tab Container visibility
    validTabs.forEach(id => {
      const container = document.getElementById('tab-' + id);
      if (container) {
        if (id === targetId) {
          container.classList.remove('hidden');
        } else {
          container.classList.add('hidden');
        }
      }
    });

    // 2. Update Top Bar Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const target = btn.getAttribute('data-tab-target');
      if (target === targetId) {
        btn.className = 'tab-btn flex items-center gap-space-xs px-space-base py-space-xs rounded-lg font-title-sm text-title-sm transition-all bg-primary text-on-primary shadow-sm whitespace-nowrap flex-shrink-0';
      } else {
        btn.className = 'tab-btn flex items-center gap-space-xs px-space-base py-space-xs rounded-lg font-title-sm text-title-sm transition-all text-secondary hover:bg-surface-container hover:text-on-surface whitespace-nowrap flex-shrink-0';
      }
    });

    // 3. Update Sidebar Links
    document.querySelectorAll('aside a[data-path]').forEach(link => {
      const path = link.getAttribute('data-path');
      if (path === targetId) {
        link.className = 'flex items-center gap-space-sm px-space-sm py-space-sm rounded-lg font-title-sm text-title-sm bg-primary-container text-on-primary-container font-semibold shadow-sm transition-all';
      } else if (validTabs.includes(path)) {
        link.className = 'flex items-center gap-space-sm px-space-sm py-space-sm rounded-lg font-title-sm text-title-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-all';
      }
    });

    // 4. Trigger specific view logic
    if (targetId === 'calendar') {
      CalendarController.loadMonthData();
    } else if (targetId === 'dashboard') {
      this.refreshDashboardView();
    } else if (targetId === 'transactions') {
      this.refreshTransactionsView();
    } else if (targetId === 'analytics') {
      this.refreshAnalyticsView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // -------------------------------------------------------------
  // Data Refresh & SWR Cache Handlers
  // -------------------------------------------------------------
  applyDashboardData(data) {
    if (!data || !data.stats) return;
    const stats = data.stats;
    const recentTxs = data.recent_transactions || [];
    const curr = stats.currency || (Auth.currentUser && Auth.currentUser.currency) || '₹';

    // Update 4 bento metric cards
    const balanceEl = document.getElementById('dash-current-balance');
    const incomeEl = document.getElementById('dash-month-income');
    const expenseEl = document.getElementById('dash-month-expense');
    const remainingEl = document.getElementById('dash-remaining-budget');
    const remainingCapSub = document.getElementById('dash-remaining-cap-sub');

    if (balanceEl) balanceEl.textContent = `${curr}${Number(stats.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (incomeEl) incomeEl.textContent = `${curr}${Number(stats.period_income || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (expenseEl) expenseEl.textContent = `${curr}${Number(stats.period_expense || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (remainingEl) remainingEl.textContent = `${curr}${Number(stats.remaining_cap || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (remainingCapSub) remainingCapSub.textContent = `${stats.budget_usage_pct || 0}% used`;

    // Update center of donut chart
    const donutTotalEl = document.getElementById('dash-donut-total');
    if (donutTotalEl) donutTotalEl.textContent = `${curr}${Number(stats.period_expense || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

    // Render Donut Chart & Legend
    if (typeof Charts !== 'undefined' && Charts.renderCategoryDonut) {
      Charts.renderCategoryDonut('dash-donut-svg', 'dash-donut-legend', stats.category_breakdown || [], stats.period_expense || 0, curr, false);
    }

    // Render Recent Transactions Table
    this.renderRecentTransactionsTable(recentTxs.slice(0, 5), curr);
  },

  renderDashboardFromCache() {
    try {
      const cached = localStorage.getItem('spendwise_cached_dashboard');
      if (cached) {
        const data = JSON.parse(cached);
        this.applyDashboardData(data);
        return true;
      }
    } catch (e) {
      console.warn('Failed to parse cached dashboard:', e);
    }
    return false;
  },

  clearDashboardUI() {
    try {
      localStorage.removeItem('spendwise_cached_dashboard');
    } catch (e) {}
    const defaultStats = {
      current_balance: 0,
      period_income: 0,
      period_expense: 0,
      remaining_cap: 0,
      budget_usage_pct: 0,
      category_breakdown: []
    };
    this.applyDashboardData({ stats: defaultStats, recent_transactions: [] });
  },

  async bootstrapData() {
    try {
      const res = await API.bootstrap();
      if (res && res.authenticated && res.user) {
        Auth.setCurrentUser(res.user);
        if (res.dashboard) {
          this.applyDashboardData(res.dashboard);
          try {
            localStorage.setItem('spendwise_cached_dashboard', JSON.stringify(res.dashboard));
          } catch (e) {}
        }
        this.setConnectionStatus('connected');
        this.lastHealthCheckTime = Date.now();
        return true;
      } else {
        Auth.setCurrentUser(null);
        return false;
      }
    } catch (err) {
      console.error('[App] Bootstrap error:', err);
      if (!Auth.currentUser) {
        Auth.showAuthModal();
      }
      return false;
    }
  },

  async refreshAllViews() {
    if (!Auth.currentUser) return;
    // Always refresh active view immediately
    if (this.activeTab === 'dashboard') {
      await this.refreshDashboardView();
    } else if (this.activeTab === 'transactions') {
      await this.refreshTransactionsView();
    } else if (this.activeTab === 'analytics') {
      await this.refreshAnalyticsView();
    } else if (this.activeTab === 'calendar') {
      await CalendarController.loadMonthData();
    }

    // Keep dashboard metrics fresh in background if another tab is active
    if (this.activeTab !== 'dashboard') {
      this.refreshDashboardView().catch(() => {});
    }
  },

  async refreshDashboardView() {
    try {
      const now = new Date();
      const start = FilterManager.formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const end = FilterManager.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

      const [stats, recentTxs] = await Promise.all([
        API.transactions.stats({ start_date: start, end_date: end }),
        API.transactions.list({ start_date: start, end_date: end })
      ]);

      const dashboardData = {
        stats: stats,
        recent_transactions: recentTxs
      };
      this.applyDashboardData(dashboardData);
      try {
        localStorage.setItem('spendwise_cached_dashboard', JSON.stringify(dashboardData));
      } catch (e) {}
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    }
  },

  renderRecentTransactionsTable(txs, curr) {
    const tbody = document.getElementById('dash-recent-txs-tbody');
    if (!tbody) return;

    if (!txs || txs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-secondary">
            <div class="flex flex-col items-center justify-center">
              <span class="material-symbols-outlined text-[28px] mb-1 opacity-50">receipt_long</span>
              <span class="font-title-sm text-title-sm text-on-surface font-semibold">No Transactions Recorded Yet</span>
              <p class="font-body-sm text-body-sm text-secondary mt-1 max-w-sm">
                You have not added any transactions for this period. Click <strong>'+ Add Transaction'</strong> to create your first record.
              </p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = txs.map(t => {
      const isExpense = t.type === 'expense';
      return `
        <tr class="hover:bg-surface-container-low/60 transition-colors">
          <td class="py-3 px-space-md text-secondary whitespace-nowrap">${t.date}</td>
          <td class="py-3 px-space-md font-semibold text-on-surface">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg ${isExpense ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed'} flex items-center justify-center">
                <span class="material-symbols-outlined text-[16px]">${isExpense ? 'restaurant' : 'payments'}</span>
              </div>
              <span>${t.merchant}</span>
            </div>
          </td>
          <td class="py-3 px-space-md text-on-surface-variant">${t.category}</td>
          <td class="py-3 px-space-md">
            <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm font-semibold">${t.payment_method}</span>
          </td>
          <td class="py-3 px-space-md text-right font-bold ${isExpense ? 'text-on-surface' : 'text-tertiary'}">
            ${isExpense ? '-' : '+'} ${curr}${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    }).join('');
  },

  async refreshTransactionsView() {
    try {
      const params = FilterManager.getParams();
      const txs = await API.transactions.list(params);
      const stats = await API.transactions.stats({
        start_date: params.start_date,
        end_date: params.end_date
      });

      this.currentFilteredTransactions = txs;
      this.transactionsPage = 1;

      const curr = stats.currency || '₹';

      // Update micro stats
      const netCashEl = document.getElementById('tx-micro-net-cash');
      const inflowEl = document.getElementById('tx-micro-inflow');
      const outflowEl = document.getElementById('tx-micro-outflow');
      const countEl = document.getElementById('tx-micro-count');

      if (netCashEl) {
        const prefix = stats.net_cashflow >= 0 ? '+' : '-';
        netCashEl.textContent = `${prefix}${curr}${Math.abs(stats.net_cashflow).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      }
      if (inflowEl) inflowEl.textContent = `${curr}${stats.period_income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      if (outflowEl) outflowEl.textContent = `${curr}${stats.period_expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      if (countEl) countEl.textContent = `${stats.total_records} Records`;

      this.renderTransactionsTablePage();
    } catch (err) {
      console.error('Error refreshing transactions view:', err);
    }
  },

  renderTransactionsTablePage() {
    const tbody = document.getElementById('ledger-table-tbody');
    const paginationInfo = document.getElementById('ledger-pagination-info');
    const paginationBtns = document.getElementById('ledger-pagination-buttons');

    if (!tbody) return;

    const txs = this.currentFilteredTransactions;
    const curr = (Auth.currentUser && Auth.currentUser.currency) || '₹';

    if (!txs || txs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-secondary">
            <div class="flex flex-col items-center justify-center">
              <span class="material-symbols-outlined text-[36px] mb-2 opacity-40">filter_alt_off</span>
              <span class="font-title-sm text-title-sm text-on-surface font-bold">No Records Match Criteria</span>
              <p class="font-body-sm text-body-sm text-secondary mt-1 max-w-sm">
                No transactions found for the active filter settings. Try adjusting your date range or clearing search keywords.
              </p>
              <button class="mt-3 px-space-md py-1.5 rounded-lg bg-surface-container text-on-surface font-title-sm text-title-sm hover:bg-surface-container-high transition-colors" onclick="FilterManager.reset()">
                Reset Filters
              </button>
            </div>
          </td>
        </tr>
      `;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 records';
      if (paginationBtns) paginationBtns.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(txs.length / this.pageSize);
    const startIdx = (this.transactionsPage - 1) * this.pageSize;
    const endIdx = Math.min(startIdx + this.pageSize, txs.length);
    const pageItems = txs.slice(startIdx, endIdx);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${txs.length} transactions`;
    }

    tbody.innerHTML = pageItems.map(t => {
      const isExpense = t.type === 'expense';
      return `
        <tr class="hover:bg-surface-container-low/60 transition-colors">
          <td class="py-3 px-space-md text-secondary whitespace-nowrap">${t.date}</td>
          <td class="py-3 px-space-md font-semibold text-on-surface">${t.merchant}</td>
          <td class="py-3 px-space-md">
            <span class="px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">${t.category}</span>
          </td>
          <td class="py-3 px-space-md">
            <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm font-semibold">${t.payment_method}</span>
          </td>
          <td class="py-3 px-space-md">
            <span class="px-2 py-0.5 rounded-full ${isExpense ? 'bg-surface-container text-secondary' : 'bg-tertiary-fixed text-on-tertiary-fixed font-semibold'} font-label-sm text-label-sm">
              ${isExpense ? 'Debit' : 'Credit'}
            </span>
          </td>
          <td class="py-3 px-space-md text-right font-bold ${isExpense ? 'text-on-surface' : 'text-tertiary'}">
            ${isExpense ? '-' : '+'} ${curr}${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td class="py-3 px-space-md text-center">
            <div class="inline-flex items-center gap-1 text-secondary">
              <button class="p-1 hover:text-primary rounded transition-colors" title="Edit" onclick="App.openEditModal(${t.id})">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button class="p-1 hover:text-error rounded transition-colors" title="Delete" onclick="App.openDeleteModal(${t.id})">
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Render pagination buttons
    if (paginationBtns) {
      let btnsHtml = '';
      if (this.transactionsPage > 1) {
        btnsHtml += `<button class="p-1.5 rounded-lg bg-surface-container-low text-secondary hover:text-on-surface transition-colors" onclick="App.changePage(${this.transactionsPage - 1})"><span class="material-symbols-outlined text-[18px]">chevron_left</span></button>`;
      }
      for (let p = 1; p <= totalPages; p++) {
        if (p === this.transactionsPage) {
          btnsHtml += `<button class="px-3 py-1 rounded-lg bg-primary text-on-primary font-title-sm text-title-sm font-bold">${p}</button>`;
        } else {
          btnsHtml += `<button class="px-3 py-1 rounded-lg bg-surface-container-low text-secondary hover:text-on-surface font-title-sm text-title-sm" onclick="App.changePage(${p})">${p}</button>`;
        }
      }
      if (this.transactionsPage < totalPages) {
        btnsHtml += `<button class="p-1.5 rounded-lg bg-surface-container-low text-secondary hover:text-on-surface transition-colors" onclick="App.changePage(${this.transactionsPage + 1})"><span class="material-symbols-outlined text-[18px]">chevron_right</span></button>`;
      }
      paginationBtns.innerHTML = btnsHtml;
    }
  },

  changePage(p) {
    this.transactionsPage = p;
    this.renderTransactionsTablePage();
  },

  async refreshAnalyticsView() {
    try {
      const params = FilterManager.getParams();
      const stats = await API.transactions.stats({
        start_date: params.start_date,
        end_date: params.end_date
      });

      const curr = stats.currency || '₹';

      // 4 Key Analytics Cards
      const topCatNameEl = document.getElementById('analytics-top-cat-name');
      const topCatSubEl = document.getElementById('analytics-top-cat-sub');
      const dailyAvgEl = document.getElementById('analytics-daily-avg');
      const peakDayEl = document.getElementById('analytics-peak-day');
      const peakDaySubEl = document.getElementById('analytics-peak-day-sub');
      const settledCountEl = document.getElementById('analytics-settled-count');
      const settledCountSubEl = document.getElementById('analytics-settled-count-sub');

      if (stats.category_breakdown && stats.category_breakdown.length > 0) {
        const top = stats.category_breakdown[0];
        if (topCatNameEl) topCatNameEl.textContent = top.category;
        if (topCatSubEl) topCatSubEl.innerHTML = `${curr}${top.total.toLocaleString('en-IN', { minimumFractionDigits: 0 })} <span class="text-primary font-semibold">(${top.percentage}% share)</span>`;
      } else {
        if (topCatNameEl) topCatNameEl.textContent = 'None';
        if (topCatSubEl) topCatSubEl.textContent = 'No expenses in timeframe';
      }

      if (dailyAvgEl) dailyAvgEl.textContent = `${curr}${Math.round(stats.daily_avg_outflow).toLocaleString('en-IN')} / day`;
      
      if (stats.peak_day && stats.peak_day.amount > 0) {
        if (peakDayEl) peakDayEl.textContent = stats.peak_day.date;
        if (peakDaySubEl) peakDaySubEl.textContent = `${curr}${stats.peak_day.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${stats.peak_day.count} records)`;
      } else {
        if (peakDayEl) peakDayEl.textContent = 'None';
        if (peakDaySubEl) peakDaySubEl.textContent = 'Zero outflow days';
      }

      if (settledCountEl) settledCountEl.textContent = `${stats.total_records} Records`;
      if (settledCountSubEl) settledCountSubEl.textContent = `${stats.debit_count} debits · ${stats.credit_count} credits`;

      // Detailed Donut center
      const detailedDonutTotal = document.getElementById('analytics-donut-total');
      if (detailedDonutTotal) detailedDonutTotal.textContent = `${curr}${stats.period_expense.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

      const detailedCategoryCount = document.getElementById('analytics-donut-cat-count');
      if (detailedCategoryCount) detailedCategoryCount.textContent = `${stats.category_breakdown.length} Categories`;

      // Render detailed Donut & detailed Table
      Charts.renderCategoryDonut('analytics-donut-svg', 'analytics-donut-legend', stats.category_breakdown, stats.period_expense, curr, true);
      Charts.renderDetailedTable('analytics-category-tbody', stats.category_breakdown, stats.period_expense, curr);
    } catch (err) {
      console.error('Error refreshing analytics view:', err);
    }
  },

  // -------------------------------------------------------------
  // Modals & Form Submission
  // -------------------------------------------------------------
  openAddTransactionModal(defaultDate = null) {
    this.currentEditingId = null;
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-tx-title');
    const submitBtn = document.getElementById('modal-tx-submit-btn');

    if (title) title.textContent = 'Add Transaction';
    if (submitBtn) submitBtn.textContent = 'Save Record';

    const now = new Date();
    const todayStr = defaultDate || FilterManager.formatDate(now);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    document.getElementById('tx-merchant').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-type').value = 'expense';
    document.getElementById('tx-category').value = 'Food & Dining';
    document.getElementById('tx-payment-method').value = 'UPI';
    document.getElementById('tx-date').value = todayStr;
    document.getElementById('tx-time').value = timeStr;
    document.getElementById('tx-notes').value = '';

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  async openEditModal(txId) {
    this.currentEditingId = txId;
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-tx-title');
    const submitBtn = document.getElementById('modal-tx-submit-btn');

    const tx = this.currentFilteredTransactions.find(t => t.id === txId);
    if (!tx) return;

    if (title) title.textContent = 'Edit Transaction';
    if (submitBtn) submitBtn.textContent = 'Update Record';

    document.getElementById('tx-merchant').value = tx.merchant;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-type').value = tx.type;
    document.getElementById('tx-category').value = tx.category;
    document.getElementById('tx-payment-method').value = tx.payment_method;
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-time').value = tx.time;
    document.getElementById('tx-notes').value = tx.notes || '';

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeTransactionModal() {
    const modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.currentEditingId = null;
  },

  isSubmittingTx: false,

  async handleTransactionSubmit(e, retryPayload = null, editingId = null) {
    if (e && e.preventDefault) e.preventDefault();

    if (this.isSubmittingTx) return;

    let payload = retryPayload;
    const isEdit = editingId !== null ? true : Boolean(this.currentEditingId);
    const targetId = editingId !== null ? editingId : this.currentEditingId;

    if (!payload) {
      const merchantEl = document.getElementById('tx-merchant');
      const amountEl = document.getElementById('tx-amount');
      const merchant = merchantEl ? merchantEl.value.trim() : '';
      const amount = amountEl ? parseFloat(amountEl.value) : NaN;
      const type = document.getElementById('tx-type') ? document.getElementById('tx-type').value : 'expense';
      const category = document.getElementById('tx-category') ? document.getElementById('tx-category').value : 'Food & Dining';
      const payment_method = document.getElementById('tx-payment-method') ? document.getElementById('tx-payment-method').value : 'UPI';
      const date = document.getElementById('tx-date') ? document.getElementById('tx-date').value : '';
      const time = document.getElementById('tx-time') ? document.getElementById('tx-time').value : '';
      const notes = document.getElementById('tx-notes') ? document.getElementById('tx-notes').value : '';

      if (!merchant || isNaN(amount) || amount <= 0) {
        this.showToast('Please enter a valid description and amount', 'error');
        return;
      }

      payload = { merchant, amount, type, category, payment_method, date, time, notes };
    }

    const submitBtn = document.getElementById('modal-tx-submit-btn');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

    try {
      this.isSubmittingTx = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
        submitBtn.innerHTML = 'Saving...';
      }

      if (isEdit && targetId) {
        await API.transactions.update(targetId, payload);
        this.showToast('Transaction updated successfully!', 'success');
      } else {
        await API.transactions.create(payload);
        this.showToast('Transaction recorded successfully!', 'success');
      }

      this.closeTransactionModal();
      await this.refreshAllViews();
    } catch (err) {
      console.error('Transaction submit failed:', err);
      // Show error with Retry option; backend prevents duplicate insertion
      this.showRetryToast(
        err.message || 'Failed to save transaction',
        () => this.handleTransactionSubmit(null, payload, isEdit ? targetId : null)
      );
    } finally {
      this.isSubmittingTx = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        submitBtn.innerHTML = originalBtnText;
      }
    }
  },

  openDeleteModal(txId) {
    this.currentDeleteId = txId;
    const modal = document.getElementById('delete-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.currentDeleteId = null;
  },

  async confirmDelete() {
    if (!this.currentDeleteId) return;
    try {
      await API.transactions.delete(this.currentDeleteId);
      this.showToast('Transaction deleted', 'info');
      this.closeDeleteModal();
      await this.refreshAllViews();
    } catch (err) {
      this.showToast(err.message || 'Failed to delete transaction', 'error');
    }
  },

  triggerCsvExport() {
    const params = FilterManager.getParams();
    window.location.href = API.transactions.getExportUrl(params);
    this.showToast('Downloading CSV statement...', 'success');
  },

  // -------------------------------------------------------------
  // Toast Notifications & Retry Banners
  // -------------------------------------------------------------
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const isError = type === 'error';

    toast.className = `toast-msg flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg font-title-sm text-title-sm transition-all ${
      isSuccess ? 'bg-primary text-on-primary' : isError ? 'bg-error text-on-error' : 'bg-surface-container-lowest text-on-surface shadow-md border border-surface-container'
    }`;

    const icon = isSuccess ? 'check_circle' : isError ? 'error' : 'info';
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[20px]">${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        toast.style.transition = 'all 0.25s ease-out';
        setTimeout(() => toast.remove(), 250);
      }
    }, 3200);
  },

  showRetryToast(message, onRetry) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-xl font-title-sm text-title-sm bg-error text-on-error border border-error-container/30 transition-all';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex items-center gap-2';
    contentDiv.innerHTML = `
      <span class="material-symbols-outlined text-[20px]">error</span>
      <span>${message}</span>
    `;

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'px-3 py-1 bg-white text-error font-bold rounded-lg hover:bg-white/90 active:scale-95 transition-all text-xs flex items-center gap-1 shadow-sm whitespace-nowrap';
    retryBtn.innerHTML = `
      <span class="material-symbols-outlined text-[14px]">refresh</span>
      <span>Retry</span>
    `;
    retryBtn.addEventListener('click', async () => {
      toast.remove();
      if (typeof onRetry === 'function') {
        await onRetry();
      }
    });

    toast.appendChild(contentDiv);
    toast.appendChild(retryBtn);
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        toast.style.transition = 'all 0.25s ease-out';
        setTimeout(() => toast.remove(), 250);
      }
    }, 8000);
  },

  // -------------------------------------------------------------
  // Automatic Backend & Connection Monitoring
  // -------------------------------------------------------------
  lastHealthCheckTime: 0,
  healthCheckCooldownMs: 5000,

  setConnectionStatus(status) {
    const pill = document.getElementById('connection-status-pill');
    const dot = document.getElementById('connection-status-dot');
    const text = document.getElementById('connection-status-text');
    if (!pill || !dot || !text) return;

    pill.className = 'flex items-center gap-1.5 px-space-sm py-1 rounded-full text-label-sm font-label-sm font-semibold border transition-all';
    dot.className = 'w-2 h-2 rounded-full transition-colors';

    switch (status) {
      case 'connected':
        pill.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200/70');
        dot.classList.add('bg-emerald-500');
        text.textContent = 'Connected';
        pill.title = 'Backend and database connected';
        break;
      case 'offline':
        pill.classList.add('bg-amber-50', 'text-amber-700', 'border-amber-200/70');
        dot.classList.add('bg-amber-500');
        text.textContent = 'Offline';
        pill.title = 'No internet connection';
        break;
      case 'server_unavailable':
        pill.classList.add('bg-rose-50', 'text-rose-700', 'border-rose-200/70');
        dot.classList.add('bg-rose-500');
        text.textContent = 'Server unavailable';
        pill.title = 'Backend server unreachable';
        break;
      case 'database_unavailable':
        pill.classList.add('bg-rose-50', 'text-rose-700', 'border-rose-200/70');
        dot.classList.add('bg-rose-500');
        text.textContent = 'Database unavailable';
        pill.title = 'Backend reached but database check failed';
        break;
      default:
        pill.classList.add('bg-surface-container-low', 'text-on-surface-variant', 'border-surface-container');
        dot.classList.add('bg-secondary');
        text.textContent = 'Connecting...';
    }
  },

  async checkHealth() {
    if (!navigator.onLine) {
      this.setConnectionStatus('offline');
      return;
    }

    try {
      const res = await fetch('/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.database === 'ok') {
        this.setConnectionStatus('connected');
      } else if (data.database === 'error') {
        this.setConnectionStatus('database_unavailable');
      } else {
        this.setConnectionStatus('server_unavailable');
      }
    } catch (err) {
      if (!navigator.onLine) {
        this.setConnectionStatus('offline');
      } else {
        this.setConnectionStatus('server_unavailable');
      }
    } finally {
      this.lastHealthCheckTime = Date.now();
    }
  },

  triggerHealthCheckThrottled() {
    const now = Date.now();
    if (now - this.lastHealthCheckTime > this.healthCheckCooldownMs) {
      this.checkHealth();
    }
  },

  setupMonitoringAndPWA() {
    // 1. PWA Service Worker Registration - independent and non-blocking
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => console.log('[PWA] Service Worker registered with scope:', reg.scope))
          .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // 2. Automatic check when app opens - deferred so it does not compete with bootstrap data query
    setTimeout(() => {
      if (!this.lastHealthCheckTime) {
        this.checkHealth();
      }
    }, 2500);

    // 3. Automatic check when app returns to foreground (visibility change / window focus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.triggerHealthCheckThrottled();
      }
    });

    window.addEventListener('focus', () => {
      this.triggerHealthCheckThrottled();
    });

    // 4. Automatic check when internet comes back online / goes offline
    window.addEventListener('online', () => {
      this.checkHealth();
      this.showToast('Internet connection restored', 'info');
    });

    window.addEventListener('offline', () => {
      this.setConnectionStatus('offline');
      this.showToast('You are currently offline', 'error');
    });
  }
};

// Global hook for calendar quick add
window.openAddTransactionModal = (dateStr) => App.openAddTransactionModal(dateStr);
window.switchTab = (tabId) => App.switchTab(tabId);

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
