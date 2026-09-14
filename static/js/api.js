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

// API Client Wrapper for SpendWise Backend
const API = {
  async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Auth Endpoints
  auth: {
    me: () => API.request('/api/auth/me'),
    login: (email, password) => API.request('/api/auth/login', { method: 'POST', body: { email, password } }),
    register: (name, email, password) => API.request('/api/auth/register', { method: 'POST', body: { name, email, password } }),
    logout: () => API.request('/api/auth/logout', { method: 'POST' }),
    updateProfile: (data) => API.request('/api/auth/profile', { method: 'PUT', body: data })
  },

  // Transactions Endpoints
  transactions: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, val);
        }
      });
      const qStr = query.toString();
      return API.request(`/api/transactions${qStr ? '?' + qStr : ''}`);
    },
    create: (txData) => API.request('/api/transactions', { method: 'POST', body: txData }),
    update: (id, txData) => API.request(`/api/transactions/${id}`, { method: 'PUT', body: txData }),
    delete: (id) => API.request(`/api/transactions/${id}`, { method: 'DELETE' }),
    stats: (params = {}) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, val);
        }
      });
      const qStr = query.toString();
      return API.request(`/api/transactions/stats${qStr ? '?' + qStr : ''}`);
    },
    getExportUrl: (params = {}) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, val);
        }
      });
      const qStr = query.toString();
      return `/api/transactions/export${qStr ? '?' + qStr : ''}`;
    }
  },

  // Categories Endpoint
  categories: {
    list: () => API.request('/api/categories')
  }
};
