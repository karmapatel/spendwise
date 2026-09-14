// Filter State and Preset Controller
const FilterManager = {
  state: {
    preset: 'this-month', // 'this-month', 'last-month', 'last-3-months', 'last-6-months', 'all-time', 'custom'
    start_date: '',
    end_date: '',
    type: 'all',          // 'all', 'expense', 'income'
    category: '',
    payment_method: '',
    search: ''
  },

  listeners: [],

  init() {
    this.applyPreset('this-month', false);
  },

  onChange(callback) {
    this.listeners.push(callback);
  },

  notify() {
    this.listeners.forEach(cb => cb(this.getParams()));
  },

  getParams() {
    return {
      start_date: this.state.start_date,
      end_date: this.state.end_date,
      type: this.state.type,
      category: this.state.category,
      payment_method: this.state.payment_method,
      search: this.state.search
    };
  },

  formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  applyPreset(presetName, triggerNotify = true) {
    this.state.preset = presetName;
    const now = new Date();

    if (presetName === 'this-month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.state.start_date = this.formatDate(start);
      this.state.end_date = this.formatDate(end);
    } else if (presetName === 'last-month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      this.state.start_date = this.formatDate(start);
      this.state.end_date = this.formatDate(end);
    } else if (presetName === 'last-3-months') {
      const start = new Date();
      start.setDate(now.getDate() - 90);
      this.state.start_date = this.formatDate(start);
      this.state.end_date = this.formatDate(now);
    } else if (presetName === 'last-6-months') {
      const start = new Date();
      start.setDate(now.getDate() - 180);
      this.state.start_date = this.formatDate(start);
      this.state.end_date = this.formatDate(now);
    } else if (presetName === 'all-time') {
      this.state.start_date = '';
      this.state.end_date = '';
    }

    this.updateFilterUI();
    if (triggerNotify) {
      this.notify();
    }
  },

  setType(typeVal) {
    this.state.type = typeVal;
    this.updateFilterUI();
    this.notify();
  },

  setCategory(catVal) {
    this.state.category = catVal;
    this.updateFilterUI();
    this.notify();
  },

  setPaymentMethod(methodVal) {
    this.state.payment_method = methodVal;
    this.updateFilterUI();
    this.notify();
  },

  setSearch(searchVal) {
    this.state.search = searchVal;
    this.notify();
  },

  reset() {
    this.state.type = 'all';
    this.state.category = '';
    this.state.payment_method = '';
    this.state.search = '';
    this.applyPreset('this-month', true);
  },

  updateFilterUI() {
    // Update active preset buttons (e.g. In Analytics or Transactions)
    document.querySelectorAll('[data-preset]').forEach(btn => {
      const p = btn.getAttribute('data-preset');
      if (p === this.state.preset) {
        btn.classList.add('bg-primary', 'text-on-primary');
        btn.classList.remove('text-secondary', 'hover:text-on-surface');
      } else {
        btn.classList.remove('bg-primary', 'text-on-primary');
        btn.classList.add('text-secondary', 'hover:text-on-surface');
      }
    });

    // Update Type Buttons (All, Expenses Only, Income Only)
    document.querySelectorAll('[data-type-filter]').forEach(btn => {
      const t = btn.getAttribute('data-type-filter');
      if (t === this.state.type) {
        btn.className = 'px-space-sm py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold';
      } else {
        btn.className = 'px-space-sm py-1 rounded-full bg-surface-container-low text-secondary hover:text-on-surface font-label-sm text-label-sm font-semibold';
      }
    });

    // Update Select Dropdowns if present
    const dateRangeSelect = document.getElementById('filter-date-range-select');
    if (dateRangeSelect) {
      dateRangeSelect.value = this.state.preset;
    }
    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) {
      catSelect.value = this.state.category;
    }
    const methodSelect = document.getElementById('filter-method-select');
    if (methodSelect) {
      methodSelect.value = this.state.payment_method;
    }

    // Render active chips container
    const chipsContainer = document.getElementById('filter-active-chips');
    if (chipsContainer) {
      let chipsHtml = '';

      if (this.state.category) {
        chipsHtml += `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
            <span>Category: ${this.state.category}</span>
            <span class="material-symbols-outlined text-[14px] cursor-pointer hover:text-error" onclick="FilterManager.setCategory('')">close</span>
          </span>
        `;
      }
      if (this.state.payment_method) {
        chipsHtml += `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
            <span>Method: ${this.state.payment_method}</span>
            <span class="material-symbols-outlined text-[14px] cursor-pointer hover:text-error" onclick="FilterManager.setPaymentMethod('')">close</span>
          </span>
        `;
      }
      if (this.state.type !== 'all') {
        chipsHtml += `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
            <span>Type: ${this.state.type}</span>
            <span class="material-symbols-outlined text-[14px] cursor-pointer hover:text-error" onclick="FilterManager.setType('all')">close</span>
          </span>
        `;
      }

      chipsContainer.innerHTML = chipsHtml;
    }
  }
};
