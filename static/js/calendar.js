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

// Dynamic Expense Calendar Controller
const CalendarController = {
  currentDate: new Date(),
  selectedDateStr: null,
  monthStats: null,
  dayTransactions: [],

  init() {
    this.selectedDateStr = this.formatDate(this.currentDate);
  },

  formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getMonthRange(year, monthIndex) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
      daysInMonth: end.getDate(),
      firstDayWeekday: (start.getDay() + 6) % 7 // Monday = 0, Sunday = 6
    };
  },

  formatMonthYear(dateObj) {
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  formatFriendlyDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  },

  async loadMonthData() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const range = this.getMonthRange(year, month);

    try {
      this.monthStats = await API.transactions.stats({
        start_date: range.startDate,
        end_date: range.endDate
      });

      this.renderMonthHeader();
      this.renderMetricStrip();
      this.renderCalendarGrid();
      await this.selectDate(this.selectedDateStr || range.startDate);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    }
  },

  renderMonthHeader() {
    const title = this.formatMonthYear(this.currentDate);
    const headerTitleEl = document.getElementById('calendar-header-title');
    const navTitleEl = document.getElementById('calendar-nav-title');
    const topBarMonthEl = document.getElementById('topbar-month-indicator');

    if (headerTitleEl) headerTitleEl.textContent = title;
    if (navTitleEl) navTitleEl.textContent = title;
    if (topBarMonthEl) topBarMonthEl.textContent = title;
  },

  renderMetricStrip() {
    if (!this.monthStats) return;
    const stats = this.monthStats;
    const curr = stats.currency || '₹';

    const spentEl = document.getElementById('cal-total-spent');
    const budgetEl = document.getElementById('cal-monthly-budget');
    const dailyAvgEl = document.getElementById('cal-daily-avg');
    const peakAmountEl = document.getElementById('cal-peak-amount');
    const peakDateEl = document.getElementById('cal-peak-date');

    if (spentEl) spentEl.textContent = `${curr}${stats.period_expense.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
    if (budgetEl) budgetEl.textContent = `/ ${curr}${stats.monthly_budget.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
    if (dailyAvgEl) dailyAvgEl.textContent = `${curr}${Math.round(stats.daily_avg_outflow).toLocaleString('en-IN')}`;
    
    if (peakAmountEl) {
      peakAmountEl.textContent = stats.peak_day && stats.peak_day.amount > 0 
        ? `${curr}${stats.peak_day.amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}` 
        : `${curr}0`;
    }
    if (peakDateEl) {
      if (stats.peak_day && stats.peak_day.date) {
        const [, , d] = stats.peak_day.date.split('-');
        peakDateEl.textContent = `${parseInt(d)} ${this.currentDate.toLocaleDateString('en-US', { month: 'short' })}`;
      } else {
        peakDateEl.textContent = 'None';
      }
    }
  },

  renderCalendarGrid() {
    const gridContainer = document.getElementById('calendar-grid');
    if (!gridContainer || !this.monthStats) return;

    gridContainer.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const range = this.getMonthRange(year, month);
    const curr = this.monthStats.currency || '₹';
    const dailyOutflows = this.monthStats.daily_outflows || {};
    const dailyCounts = this.monthStats.daily_counts || {};

    // Previous month filler days
    const prevMonthEnd = new Date(year, month, 0).getDate();
    for (let i = range.firstDayWeekday - 1; i >= 0; i--) {
      const prevDay = prevMonthEnd - i;
      const cell = document.createElement('div');
      cell.className = 'min-h-[58px] sm:min-h-[92px] p-1 sm:p-space-xs rounded-lg bg-surface-container-low/40 flex flex-col justify-between opacity-40 cursor-not-allowed select-none';
      cell.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-xs sm:text-label-md text-on-surface-variant font-medium">${prevDay}</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] sm:text-body-sm text-on-surface-variant">${curr}0</span>
        </div>
      `;
      gridContainer.appendChild(cell);
    }

    // Days of current month
    for (let d = 1; d <= range.daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const expenseAmt = dailyOutflows[dateStr] || 0;
      const txCount = dailyCounts[dateStr] || 0;
      const isSelected = this.selectedDateStr === dateStr;

      let badgeHtml = '';
      let dotClass = 'bg-surface-container';
      let cardBg = 'bg-surface hover:bg-surface-container-low';

      if (expenseAmt === 0) {
        badgeHtml = `<span class="material-symbols-outlined text-[12px] sm:text-[14px] text-tertiary">check_circle</span>`;
      } else if (expenseAmt < 300) {
        dotClass = 'bg-tertiary';
        badgeHtml = `<span class="inline-block px-1 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[9px] sm:text-[10px] font-semibold">Low</span>`;
      } else if (expenseAmt <= 750) {
        dotClass = 'bg-secondary';
        badgeHtml = `<span class="inline-block px-1 rounded bg-secondary-container text-on-secondary-fixed text-[9px] sm:text-[10px] font-semibold">Mid</span>`;
      } else {
        dotClass = 'bg-error';
        cardBg = 'bg-error-container/20 hover:bg-error-container/40';
        badgeHtml = `<span class="inline-block px-1 rounded bg-error-container text-on-error-container text-[9px] sm:text-[10px] font-bold">High</span>`;
      }

      const cell = document.createElement('div');
      cell.className = `min-h-[58px] sm:min-h-[92px] p-1 sm:p-space-xs rounded-lg ${cardBg} transition-colors cursor-pointer flex flex-col justify-between calendar-day-card group ${isSelected ? 'calendar-day-selected' : ''}`;
      cell.setAttribute('data-date', dateStr);

      cell.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-xs sm:text-title-sm ${isSelected ? 'font-bold text-primary' : 'text-on-surface font-semibold'}">${d}</span>
          ${expenseAmt === 0 ? badgeHtml : `<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dotClass}"></span>`}
        </div>
        <div class="space-y-0.5 sm:space-y-space-2xs">
          <div class="text-[10px] sm:text-title-sm font-semibold sm:font-bold truncate ${expenseAmt > 750 ? 'text-error font-bold' : 'text-on-surface'}">
            ${curr}${Math.round(expenseAmt).toLocaleString('en-IN')}
          </div>
          <div class="hidden sm:flex font-label-sm text-label-sm text-on-surface-variant items-center justify-between">
            <span>${txCount > 0 ? `${txCount} txn${txCount === 1 ? '' : 's'}` : 'No spend'}</span>
            ${expenseAmt > 0 ? badgeHtml : ''}
          </div>
        </div>
      `;

      cell.addEventListener('click', () => {
        this.selectDate(dateStr);
      });

      gridContainer.appendChild(cell);
    }

    // Remaining cells to fill row
    const totalRendered = range.firstDayWeekday + range.daysInMonth;
    const remaining = (7 - (totalRendered % 7)) % 7;
    for (let nextDay = 1; nextDay <= remaining; nextDay++) {
      const cell = document.createElement('div');
      cell.className = 'min-h-[58px] sm:min-h-[92px] p-1 sm:p-space-xs rounded-lg bg-surface-container-low/40 flex flex-col justify-between opacity-40 cursor-not-allowed select-none';
      cell.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-xs sm:text-label-md text-on-surface-variant font-medium">${nextDay}</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] sm:text-body-sm text-on-surface-variant">${curr}0</span>
        </div>
      `;
      gridContainer.appendChild(cell);
    }
  },

  async selectDate(dateStr) {
    this.selectedDateStr = dateStr;

    // Highlight card
    document.querySelectorAll('.calendar-day-card').forEach(card => {
      if (card.getAttribute('data-date') === dateStr) {
        card.classList.add('calendar-day-selected');
      } else {
        card.classList.remove('calendar-day-selected');
      }
    });

    // Fetch transactions for that specific day
    try {
      this.dayTransactions = await API.transactions.list({
        start_date: dateStr,
        end_date: dateStr
      });
      this.renderDateInspectionPanel();
    } catch (err) {
      console.error('Failed to load day transactions:', err);
    }
  },

  renderDateInspectionPanel() {
    const titleEl = document.getElementById('cal-inspect-date-title');
    const totalOutflowEl = document.getElementById('cal-inspect-total-outflow');
    const budgetStatusEl = document.getElementById('cal-inspect-budget-status');
    const txCountEl = document.getElementById('cal-inspect-tx-count');
    const ledgerContainer = document.getElementById('cal-inspect-ledger');
    const addBtnForDate = document.getElementById('cal-btn-add-for-date');

    const curr = (this.monthStats && this.monthStats.currency) || '₹';
    const friendlyDate = this.formatFriendlyDate(this.selectedDateStr);

    if (titleEl) titleEl.textContent = friendlyDate;
    if (addBtnForDate) {
      addBtnForDate.innerHTML = `<span class="material-symbols-outlined text-[18px]">add_circle</span> Add Transaction for ${friendlyDate.split(',')[0]}`;
      addBtnForDate.onclick = () => {
        window.openAddTransactionModal(this.selectedDateStr);
      };
    }

    const expensesOnly = this.dayTransactions.filter(t => t.type === 'expense');
    const dayTotal = expensesOnly.reduce((acc, t) => acc + t.amount, 0);

    if (totalOutflowEl) totalOutflowEl.textContent = `${curr}${dayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (txCountEl) txCountEl.textContent = `${this.dayTransactions.length} item${this.dayTransactions.length === 1 ? '' : 's'}`;

    // Status against daily target (aligned with moderate threshold ₹750)
    const dailyTarget = 750;
    if (budgetStatusEl) {
      if (dayTotal === 0) {
        budgetStatusEl.innerHTML = `<span class="text-tertiary font-semibold">Zero Outflow</span>`;
      } else if (dayTotal > dailyTarget) {
        budgetStatusEl.innerHTML = `<span class="text-error font-bold">+${curr}${(dayTotal - dailyTarget).toFixed(0)} over target</span>`;
      } else {
        budgetStatusEl.innerHTML = `<span class="text-tertiary font-semibold">Within Daily Target</span>`;
      }
    }

    // Render day transactions list
    if (!ledgerContainer) return;

    if (this.dayTransactions.length === 0) {
      ledgerContainer.innerHTML = `
        <div class="py-8 text-center text-secondary flex flex-col items-center justify-center">
          <span class="material-symbols-outlined text-[28px] mb-1 opacity-60">calendar_today</span>
          <p class="font-body-sm text-body-sm">No transactions logged on this day.</p>
        </div>
      `;
      return;
    }

    ledgerContainer.innerHTML = this.dayTransactions.map(t => {
      const isExpense = t.type === 'expense';
      return `
        <div class="flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-low transition-colors group">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="w-10 h-10 rounded-lg ${isExpense ? 'bg-surface-container-high text-primary' : 'bg-tertiary-fixed text-on-tertiary-fixed'} flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[20px]">${(window.App && window.App.getCategoryIcon) ? window.App.getCategoryIcon(t.category, t.type) : (isExpense ? 'receipt' : 'payments')}</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-title-sm text-title-sm text-on-surface font-bold truncate">${t.merchant}</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant truncate">${t.category} • ${t.payment_method} • ${t.time}</span>
            </div>
          </div>
          <span class="font-title-sm text-title-sm ${isExpense ? 'text-on-surface font-bold' : 'text-tertiary font-bold'} whitespace-nowrap ml-2">
            ${isExpense ? '-' : '+'} ${curr}${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      `;
    }).join('');
  },

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.selectedDateStr = null;
    this.loadMonthData();
  },

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.selectedDateStr = null;
    this.loadMonthData();
  },

  goToToday() {
    this.currentDate = new Date();
    this.selectedDateStr = this.formatDate(this.currentDate);
    this.loadMonthData();
  }
};
