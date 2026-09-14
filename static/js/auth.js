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

// Authentication and Session Handler
const Auth = {
  currentUser: null,

  async checkAuth() {
    try {
      const res = await API.auth.me();
      if (res.authenticated && res.user) {
        this.currentUser = res.user;
        this.updateUserUI();
        this.hideAuthModal();
        return true;
      }
    } catch (e) {
      this.currentUser = null;
    }

    this.showAuthModal();
    return false;
  },

  updateUserUI() {
    if (!this.currentUser) return;
    const name = this.currentUser.name || 'Karma';
    
    // Sidebar user names
    document.querySelectorAll('.user-name-display').forEach(el => {
      el.textContent = name;
    });
    
    // Dashboard greeting
    const greetingEl = document.getElementById('dashboard-greeting-name');
    if (greetingEl) {
      const hour = new Date().getHours();
      let timeGreet = 'Good evening';
      if (hour < 12) timeGreet = 'Good morning';
      else if (hour < 17) timeGreet = 'Good afternoon';
      greetingEl.textContent = `${timeGreet}, ${name}`;
    }

    // Profile settings inputs
    const nameInput = document.getElementById('settings-name-input');
    const emailInput = document.getElementById('settings-email-input');
    const budgetInput = document.getElementById('settings-budget-input');
    const currencyInput = document.getElementById('settings-currency-input');

    if (nameInput) nameInput.value = this.currentUser.name;
    if (emailInput) emailInput.value = this.currentUser.email;
    if (budgetInput) budgetInput.value = this.currentUser.monthly_budget;
    if (currencyInput) currencyInput.value = this.currentUser.currency;
  },

  showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async handleLogin(email, password) {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) errBox.classList.add('hidden');

    try {
      const res = await API.auth.login(email, password);
      this.currentUser = res.user;
      this.updateUserUI();
      this.hideAuthModal();
      App.showToast(`Welcome back, ${this.currentUser.name}!`, 'success');
      App.refreshAllViews();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Login failed. Please check credentials.';
        errBox.classList.remove('hidden');
      }
    }
  },

  async handleRegister(name, email, password) {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) errBox.classList.add('hidden');

    try {
      const res = await API.auth.register(name, email, password);
      this.currentUser = res.user;
      this.updateUserUI();
      this.hideAuthModal();
      App.showToast(`Account created! Welcome, ${this.currentUser.name}.`, 'success');
      App.refreshAllViews();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Registration failed.';
        errBox.classList.remove('hidden');
      }
    }
  },

  async handleLogout() {
    try {
      await API.auth.logout();
      this.currentUser = null;
      App.showToast('Logged out successfully.', 'info');
      this.showAuthModal();
      App.refreshAllViews();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }
};
