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

// Dynamic SVG Category Donut Chart Renderer
const Charts = {
  renderCategoryDonut(svgContainerId, legendContainerId, categories, totalSpent, currency = '₹', isDetailed = false) {
    const svg = document.getElementById(svgContainerId);
    const legend = document.getElementById(legendContainerId);

    if (!svg || !legend) return;

    // Radius for circumference calculation (C = 2 * PI * r = 100)
    // 2 * Math.PI * 15.91549430918954 ~= 100
    const r = 15.91549430918954;
    const strokeWidth = isDetailed ? 4.8 : 4.6;

    // Clear previous SVG contents
    svg.innerHTML = '';

    // Base background track
    const baseCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    baseCircle.setAttribute('cx', '21');
    baseCircle.setAttribute('cy', '21');
    baseCircle.setAttribute('r', r.toString());
    baseCircle.setAttribute('fill', 'transparent');
    baseCircle.setAttribute('stroke', '#eff4ff');
    baseCircle.setAttribute('stroke-width', (strokeWidth - 0.1).toString());
    svg.appendChild(baseCircle);

    // Empty state check
    if (!categories || categories.length === 0 || totalSpent <= 0) {
      // Empty Legend
      legend.innerHTML = `
        <div class="col-span-full py-8 text-center flex flex-col items-center justify-center text-secondary">
          <div class="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-secondary mb-2">
            <span class="material-symbols-outlined text-[24px]">pie_chart</span>
          </div>
          <span class="font-title-sm text-title-sm text-on-surface font-semibold">No Expense Records</span>
          <p class="font-body-sm text-body-sm text-secondary max-w-xs mt-1">
            No expenses found for this period. Click <strong>'+ Add Transaction'</strong> to start visualizing your spending.
          </p>
        </div>
      `;
      return;
    }

    // Render slices
    let cumulativePercent = 0;
    categories.forEach((cat) => {
      const pct = Math.max(0.5, cat.percentage); // Minimum visual representation
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '21');
      circle.setAttribute('cy', '21');
      circle.setAttribute('r', r.toString());
      circle.setAttribute('fill', 'transparent');
      circle.setAttribute('stroke', cat.color || '#00685f');
      circle.setAttribute('stroke-width', strokeWidth.toString());
      circle.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
      circle.setAttribute('stroke-dashoffset', `-${cumulativePercent}`);
      circle.classList.add('donut-segment');

      // Simple tooltip title
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${cat.category}: ${currency}${cat.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${cat.percentage}%)`;
      circle.appendChild(title);

      svg.appendChild(circle);
      cumulativePercent += pct;
    });

    // Render Legend Items
    legend.innerHTML = categories.map((cat, idx) => {
      const isSpanTwo = (!isDetailed && idx === categories.length - 1 && categories.length % 2 !== 0) ? 'sm:col-span-2' : '';
      return `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low/50 hover:bg-surface-container-low transition-colors ${isSpanTwo}">
          <div class="flex items-center gap-2 min-w-0 pr-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${cat.color}"></span>
            <span class="font-title-sm text-title-sm text-on-surface truncate">${cat.category}</span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0 text-right">
            <span class="font-title-sm text-title-sm font-semibold text-on-surface">${currency}${cat.total.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
            <span class="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-label-sm text-label-sm font-medium">${cat.percentage}%</span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderDetailedTable(tableBodyId, categories, totalSpent, currency = '₹') {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;

    if (!categories || categories.length === 0 || totalSpent <= 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-secondary">
            No categorical outlay recorded for this timeframe.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = categories.map(cat => `
      <tr class="hover:bg-surface-container-low/60 transition-colors">
        <td class="py-2.5 px-space-md font-semibold text-on-surface flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cat.color}"></span>
          <span>${cat.category}</span>
        </td>
        <td class="py-2.5 px-space-md text-secondary">${cat.count} record${cat.count === 1 ? '' : 's'}</td>
        <td class="py-2.5 px-space-md font-semibold text-on-surface">${cat.percentage}%</td>
        <td class="py-2.5 px-space-md text-secondary font-medium">-</td>
        <td class="py-2.5 px-space-md text-right font-bold text-on-surface">${currency}${cat.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');
  }
};
