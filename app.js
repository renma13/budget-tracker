const STORAGE_KEY = "mara-budget-tracker-v1";
const SYNC_KEY = "mara-budget-sync-v1";

const salaryRules = {
  2026: {
    sss: { employeeRate: 0.05, salaryCreditMin: 5000, salaryCreditMax: 35000, salaryCreditStep: 500 },
    philhealth: { employeeRate: 0.025, incomeFloor: 10000, incomeCeiling: 100000 },
    pagibig: { employeeRate: 0.02, compensationMax: 10000 },
    taxBrackets: [
      { min: 0, max: 20833, base: 0, rate: 0 },
      { min: 20833, max: 33333, base: 0, rate: 0.15 },
      { min: 33333, max: 66667, base: 1875, rate: 0.2 },
      { min: 66667, max: 166667, base: 8541.8, rate: 0.25 },
      { min: 166667, max: 666667, base: 33541.8, rate: 0.3 },
      { min: 666667, max: Infinity, base: 183541.8, rate: 0.35 }
    ]
  },
  2025: {
    sss: { employeeRate: 0.05, salaryCreditMin: 5000, salaryCreditMax: 35000, salaryCreditStep: 500 },
    philhealth: { employeeRate: 0.025, incomeFloor: 10000, incomeCeiling: 100000 },
    pagibig: { employeeRate: 0.02, compensationMax: 10000 },
    taxBrackets: [
      { min: 0, max: 20833, base: 0, rate: 0 },
      { min: 20833, max: 33333, base: 0, rate: 0.15 },
      { min: 33333, max: 66667, base: 1875, rate: 0.2 },
      { min: 66667, max: 166667, base: 8541.8, rate: 0.25 },
      { min: 166667, max: 666667, base: 33541.8, rate: 0.3 },
      { min: 666667, max: Infinity, base: 183541.8, rate: 0.35 }
    ]
  }
};

const defaultState = {
  settings: {
    currency: "PHP",
    monthlyGrossSalary: 50000,
    taxableAllowance: 0,
    nonTaxableAllowance: 0,
    rateYear: "2026",
    extraDeduction: 0,
    deductions: {
      sss: true,
      philhealth: true,
      pagibig: true,
      tax: true
    },
    paycheckAmount: 21440,
    paydays: [5, 20],
    savingsRate: 20,
    flowMode: "paycheck"
  },
  expenses: [
    { id: makeId(), name: "Water", category: "Bills", dueDay: 14, amount: 700 },
    { id: makeId(), name: "Converge", category: "Bills", dueDay: 16, amount: 1500 },
    { id: makeId(), name: "Electricity", category: "Bills", dueDay: 20, amount: 8000 },
    { id: makeId(), name: "Mommy", category: "Other", dueDay: 5, amount: 0 }
  ],
  subscriptions: [
    { id: makeId(), name: "YouTube Premium", dueDay: 18, amount: 189, active: true },
    { id: makeId(), name: "Google One", dueDay: 28, amount: 119, active: true }
  ],
  daily: [
    { id: makeId(), date: todayIso(), category: "Office", amount: 1000, note: "Starter row from sheet" }
  ],
  fares: [
    { id: makeId(), service: "Pedicab", amount: 30 },
    { id: makeId(), service: "Jeep", amount: 26 },
    { id: makeId(), service: "Bus", amount: 100 },
    { id: makeId(), service: "Angkas", amount: 140 },
    { id: makeId(), service: "Lunch", amount: 200 }
  ],
  updatedAt: new Date().toISOString()
};

let state = loadState();
let syncSettings = loadSyncSettings();

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindNavigation();
  bindGlobalActions();
  bindSyncActions();
  render();
});

function bindElements() {
  [
    "viewTitle", "todayLabel", "periodLabel", "periodRemaining",
    "dailySafeNote", "paycheckReserve", "paycheckCalendar", "allocationBar", "allocationLegend",
    "flowModeToggle", "flowList", "dueList", "expenseRows", "dailyRows", "subscriptionRows",
    "fareRows", "fareDayTotal", "fareFourTotal", "fareFiveTotal",
    "monthlyGrossSalary", "taxableAllowance", "nonTaxableAllowance", "rateYear",
    "extraDeduction", "deductSss", "deductPhilhealth", "deductPagibig", "deductTax",
    "grossMonthlyPay", "netMonthlyPay", "netPaycheckPay", "deductionList",
    "firstPayday", "secondPayday", "savingsRate",
    "exportButton", "importInput", "saveButton", "githubToken", "gistId",
    "pushSync", "pullSync", "syncStatus"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  els.todayLabel.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
      button.classList.add("is-active");
      document.getElementById(`${button.dataset.view}View`).classList.add("is-active");
      els.viewTitle.textContent = button.textContent.trim();
    });
  });
}

function bindGlobalActions() {
  els.saveButton.addEventListener("click", async () => {
    saveState();
    saveSyncSettings();

    if (els.githubToken.value.trim()) {
      const synced = await syncToGithub();
      flashStatus(els.saveButton, synced ? "Synced" : "Saved");
      return;
    }

    flashStatus(els.saveButton, "Saved");
  });

  els.exportButton.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mara-budget-backup-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  els.importInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const imported = JSON.parse(await file.text());
    state = normalizeState(imported);
    saveState();
    render();
    event.target.value = "";
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => addRow(button.dataset.add));
  });

  els.flowModeToggle.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.flowMode = button.dataset.flowMode;
      saveState();
      renderDashboard();
    });
  });

  [els.allocationBar, els.allocationLegend].forEach((container) => {
    container.addEventListener("pointerover", (event) => {
      const item = event.target.closest("[data-allocation-key]");
      if (item) setActiveAllocation(item.dataset.allocationKey);
    });

    container.addEventListener("pointerout", (event) => {
      if (container.contains(event.relatedTarget)) return;
      setActiveAllocation("");
    });

    container.addEventListener("focusin", (event) => {
      const item = event.target.closest("[data-allocation-key]");
      if (item) setActiveAllocation(item.dataset.allocationKey);
    });

    container.addEventListener("focusout", (event) => {
      if (container.contains(event.relatedTarget)) return;
      setActiveAllocation("");
    });
  });

  [
    "monthlyGrossSalary", "taxableAllowance", "nonTaxableAllowance", "rateYear",
    "extraDeduction", "firstPayday", "secondPayday", "savingsRate",
    "deductSss", "deductPhilhealth", "deductPagibig", "deductTax"
  ].forEach((id) => {
    els[id].addEventListener("input", () => {
      state.settings.monthlyGrossSalary = numberFromInput(els.monthlyGrossSalary.value);
      state.settings.taxableAllowance = numberFromInput(els.taxableAllowance.value);
      state.settings.nonTaxableAllowance = numberFromInput(els.nonTaxableAllowance.value);
      state.settings.rateYear = els.rateYear.value;
      state.settings.extraDeduction = numberFromInput(els.extraDeduction.value);
      state.settings.paydays = [
        clampDay(numberFromInput(els.firstPayday.value)),
        clampDay(numberFromInput(els.secondPayday.value))
      ].sort((a, b) => a - b);
      state.settings.savingsRate = Math.max(0, numberFromInput(els.savingsRate.value));
      state.settings.deductions = {
        sss: els.deductSss.checked,
        philhealth: els.deductPhilhealth.checked,
        pagibig: els.deductPagibig.checked,
        tax: els.deductTax.checked
      };
      saveState();
      renderInputs();
      renderDashboard();
    });
  });
}

function bindSyncActions() {
  els.githubToken.value = syncSettings.token || "";
  els.gistId.value = syncSettings.gistId || "";

  els.githubToken.addEventListener("input", saveSyncSettings);
  els.gistId.addEventListener("input", saveSyncSettings);

  els.pushSync.addEventListener("click", async () => {
    saveSyncSettings();
    await syncToGithub();
  });

  els.pullSync.addEventListener("click", async () => {
    saveSyncSettings();
    await syncFromGithub();
  });
}

function render() {
  renderInputs();
  renderDashboard();
  renderExpenses();
  renderDaily();
  renderSubscriptions();
  renderFares();
  refreshIcons();
}

function renderInputs() {
  const salary = calculateSalary();
  state.settings.paycheckAmount = salary.netPaycheck;

  els.monthlyGrossSalary.value = state.settings.monthlyGrossSalary;
  els.taxableAllowance.value = state.settings.taxableAllowance;
  els.nonTaxableAllowance.value = state.settings.nonTaxableAllowance;
  els.rateYear.value = state.settings.rateYear;
  els.extraDeduction.value = state.settings.extraDeduction;
  els.firstPayday.value = state.settings.paydays[0] || 5;
  els.secondPayday.value = state.settings.paydays[1] || 20;
  els.savingsRate.value = state.settings.savingsRate;
  els.deductSss.checked = state.settings.deductions.sss;
  els.deductPhilhealth.checked = state.settings.deductions.philhealth;
  els.deductPagibig.checked = state.settings.deductions.pagibig;
  els.deductTax.checked = state.settings.deductions.tax;
  els.grossMonthlyPay.textContent = money(salary.grossMonthly);
  els.netMonthlyPay.textContent = money(salary.netMonthly);
  els.netPaycheckPay.textContent = money(salary.netPaycheck);
  renderDeductions(salary);
}

function renderDashboard() {
  const totals = getTotals();
  const period = getCurrentPayPeriod();
  const remaining = totals.paycheckAllowance;
  const daysLeft = Math.max(1, Math.ceil((period.end - startOfDay(new Date())) / 86400000) + 1);
  const dailySafe = remaining / daysLeft;

  els.periodLabel.textContent = `${formatShortDate(period.start)} to ${formatShortDate(period.end)}`;
  els.periodRemaining.textContent = money(remaining);
  els.dailySafeNote.textContent = `${money(dailySafe)} per day until payday`;
  els.paycheckReserve.textContent = money(totals.reservePerPaycheck);
  renderPaycheckCalendar(period);
  renderAllocation(totals);
  renderFlow(totals);

  const dueItems = getUpcomingDueItems().slice(0, 6);
  els.dueList.innerHTML = dueItems.length
    ? dueItems.map((item) => dueItem(item)).join("")
    : `<div class="due-item"><div><strong>Nothing due soon</strong><span>Enjoy the breathing room.</span></div></div>`;
}

function renderPaycheckCalendar(period) {
  const today = startOfDay(new Date());
  const payday = getActualPayday(addDays(period.end, 1));
  const calendarStart = startOfWeek(today);
  const calendarEnd = endOfWeek(payday);
  const days = [];
  for (let date = calendarStart; date <= calendarEnd; date = addDays(date, 1)) {
    days.push(date);
  }
  const weeksLeft = Math.max(0, Math.ceil((payday - today) / 604800000));

  els.paycheckCalendar.innerHTML = `
    <div class="paycheck-calendar-head">
      <strong>${weeksLeft} week${weeksLeft === 1 ? "" : "s"} left</strong>
      <span>Payday ${formatShortDate(payday)}</span>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      ${["S", "M", "T", "W", "T", "F", "S"].map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="calendar-grid">
      ${days.map((date) => {
        const isToday = isSameDay(date, today);
        const isPayday = isSameDay(date, payday);
        const isWaiting = date > today && date < payday;
        const classes = [
          "calendar-day",
          isToday ? "is-today" : "",
          isPayday ? "is-payday" : "",
          isWaiting ? "is-waiting" : ""
        ].filter(Boolean).join(" ");
        const label = isToday
          ? `Today, ${formatShortDate(date)}`
          : isPayday ? `Payday, ${formatShortDate(date)}` : formatShortDate(date);
        return `<span class="${classes}" aria-label="${escapeAttr(label)}">${date.getDate()}</span>`;
      }).join("")}
    </div>
  `;
}

function getActualPayday(date) {
  if (date.getDay() === 6) return addDays(date, -1);
  if (date.getDay() === 0) return addDays(date, -2);
  return date;
}

function renderFlow(totals) {
  const mode = state.settings.flowMode === "month" ? "month" : "paycheck";
  const isMonthly = mode === "month";
  const divisor = isMonthly ? 1 : 2;
  const periodLabel = isMonthly ? "monthly" : "per-paycheck";
  const incomeLabel = isMonthly ? "Monthly" : "Paycheck";
  const flowRows = [
    [`Gross ${periodLabel} income`, totals.grossMonthlyIncome / divisor, "Before payroll deductions"],
    [`Net ${periodLabel} income`, totals.monthlyIncome / divisor, "Used for this budget"],
    [`${incomeLabel} expenses`, totals.expensesTotal / divisor, "Bills and recurring set-asides"],
    ["Subscriptions", totals.subscriptionsTotal / divisor, "Active renewals"],
    ["Savings target", totals.savingsTotal / divisor, `${state.settings.savingsRate}% of income`],
    [`${incomeLabel} flex`, totals.monthlyFlex / divisor, "Income after commitments"]
  ];

  els.flowModeToggle.querySelectorAll("button").forEach((button) => {
    const isActive = button.dataset.flowMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  els.flowList.innerHTML = flowRows.map(([label, value, note]) => flowItem(label, value, note)).join("");
}

function renderAllocation(totals) {
  const parts = [
    { label: "Expenses", value: totals.expensesTotal, color: "var(--coral)" },
    { label: "Subscriptions", value: totals.subscriptionsTotal, color: "var(--blue)" },
    { label: "Savings", value: totals.savingsTotal, color: "var(--gold)" },
    { label: "Flex", value: Math.max(0, totals.monthlyFlex), color: "var(--green)" }
  ];
  const total = parts.reduce((sumTotal, part) => sumTotal + Math.max(0, part.value), 0) || 1;

  els.allocationBar.innerHTML = parts.map((part) => {
    const width = Math.max(0, (part.value / total) * 100);
    const key = allocationKey(part.label);
    return `
      <span
        data-allocation-key="${key}"
        role="img"
        tabindex="0"
        aria-label="${escapeAttr(`${part.label}: ${Math.round(width)}%`)}"
        title="${escapeAttr(part.label)}"
        style="--segment-color: ${part.color}; width: ${width}%"
      ></span>
    `;
  }).join("");

  els.allocationLegend.innerHTML = parts.map((part) => {
    const share = Math.round((Math.max(0, part.value) / total) * 100);
    const key = allocationKey(part.label);
    return `
      <div class="legend-item" data-allocation-key="${key}" tabindex="0" style="--legend-color: ${part.color}">
        <i style="--legend-color: ${part.color}"></i>
        <span>${part.label}</span>
        <strong>${share}%</strong>
      </div>
    `;
  }).join("");
}

function renderExpenses() {
  els.expenseRows.innerHTML = state.expenses.map((expense) => `
    <tr data-id="${expense.id}">
      <td><input data-field="name" value="${escapeAttr(expense.name)}"></td>
      <td><input data-field="category" value="${escapeAttr(expense.category)}"></td>
      <td><input data-field="dueDay" type="number" min="1" max="31" value="${expense.dueDay}"></td>
      <td><input data-field="amount" type="number" min="0" step="0.01" value="${expense.amount}"></td>
      <td><button class="row-remove" title="Remove"><i data-lucide="trash-2"></i></button></td>
    </tr>
  `).join("");
  bindTable("expenseRows", "expenses");
}

function renderDaily() {
  const rows = [...state.daily].sort((a, b) => b.date.localeCompare(a.date));
  els.dailyRows.innerHTML = rows.map((entry) => `
    <tr data-id="${entry.id}">
      <td><input data-field="date" type="date" value="${entry.date}"></td>
      <td><input data-field="category" value="${escapeAttr(entry.category)}"></td>
      <td><input data-field="amount" type="number" min="0" step="0.01" value="${entry.amount}"></td>
      <td><input data-field="note" value="${escapeAttr(entry.note)}"></td>
      <td><button class="row-remove" title="Remove"><i data-lucide="trash-2"></i></button></td>
    </tr>
  `).join("");
  bindTable("dailyRows", "daily");
}

function renderSubscriptions() {
  els.subscriptionRows.innerHTML = state.subscriptions.map((sub) => `
    <tr data-id="${sub.id}">
      <td><input data-field="name" value="${escapeAttr(sub.name)}"></td>
      <td><input data-field="dueDay" type="number" min="1" max="31" value="${sub.dueDay}"></td>
      <td><input data-field="amount" type="number" min="0" step="0.01" value="${sub.amount}"></td>
      <td><input data-field="active" type="checkbox" ${sub.active ? "checked" : ""}></td>
      <td><button class="row-remove" title="Remove"><i data-lucide="trash-2"></i></button></td>
    </tr>
  `).join("");
  bindTable("subscriptionRows", "subscriptions");
}

function renderFares() {
  els.fareRows.innerHTML = state.fares.map((fare) => `
    <tr data-id="${fare.id}">
      <td><input data-field="service" value="${escapeAttr(fare.service)}"></td>
      <td><input data-field="amount" type="number" min="0" step="0.01" value="${fare.amount}"></td>
      <td><button class="row-remove" title="Remove"><i data-lucide="trash-2"></i></button></td>
    </tr>
  `).join("");
  bindTable("fareRows", "fares");

  const total = sum(state.fares, "amount");
  els.fareDayTotal.textContent = money(total);
  els.fareFourTotal.textContent = money(total * 4);
  els.fareFiveTotal.textContent = money(total * 5);
}

function renderDeductions(salary) {
  const rows = [
    ["SSS employee share", salary.sss, salary.deductions.sss ? `MSC ${money(salary.sssSalaryCredit)}` : "Off"],
    ["PhilHealth employee share", salary.philhealth, salary.deductions.philhealth ? "2.5% employee share" : "Off"],
    ["Pag-IBIG employee share", salary.pagibig, salary.deductions.pagibig ? "2% capped contribution" : "Off"],
    ["Withholding tax", salary.tax, salary.deductions.tax ? "Monthly TRAIN table" : "Off"],
    ["Extra deduction", salary.extraDeduction, "Optional payroll deduction"]
  ];

  els.deductionList.innerHTML = rows.map(([label, value, note]) => `
    <div class="deduction-item">
      <div><strong>${label}</strong><span>${note}</span></div>
      <strong>${money(value)}</strong>
    </div>
  `).join("");
}

function bindTable(bodyId, collectionName) {
  const body = els[bodyId];
  body.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      const row = input.closest("tr");
      const item = state[collectionName].find((candidate) => candidate.id === row.dataset.id);
      const field = input.dataset.field;
      item[field] = input.type === "checkbox"
        ? input.checked
        : input.type === "number"
          ? numberFromInput(input.value)
          : input.value;
      if (field === "dueDay") item[field] = clampDay(item[field]);
      saveState();
      renderDashboard();
      if (collectionName === "fares") renderFares();
    });
  });

  body.querySelectorAll(".row-remove").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.closest("tr").dataset.id;
      state[collectionName] = state[collectionName].filter((item) => item.id !== id);
      saveState();
      render();
    });
  });
  refreshIcons();
}

function addRow(kind) {
  const id = makeId();
  if (kind === "expense") state.expenses.push({ id, name: "New expense", category: "Other", dueDay: 5, amount: 0 });
  if (kind === "daily") state.daily.push({ id, date: todayIso(), category: "Food", amount: 0, note: "" });
  if (kind === "subscription") state.subscriptions.push({ id, name: "New subscription", dueDay: 1, amount: 0, active: true });
  if (kind === "fare") state.fares.push({ id, service: "New fare", amount: 0 });
  saveState();
  render();
}

function getTotals() {
  const salary = calculateSalary();
  state.settings.paycheckAmount = salary.netPaycheck;
  const monthlyIncome = salary.netMonthly;
  const expensesTotal = sum(state.expenses, "amount");
  const subscriptionsTotal = state.subscriptions
    .filter((sub) => sub.active)
    .reduce((total, sub) => total + Number(sub.amount || 0), 0);
  const savingsTotal = monthlyIncome * (Number(state.settings.savingsRate || 0) / 100);
  const monthlyCommitments = expensesTotal + subscriptionsTotal + savingsTotal;
  const reservePerPaycheck = monthlyCommitments / 2;
  const paycheckAllowance = state.settings.paycheckAmount - reservePerPaycheck;
  const monthlyFlex = monthlyIncome - monthlyCommitments;

  return { monthlyIncome, grossMonthlyIncome: salary.grossMonthly, expensesTotal, subscriptionsTotal, savingsTotal, monthlyCommitments, reservePerPaycheck, paycheckAllowance, monthlyFlex };
}

function calculateSalary() {
  const settings = state.settings;
  const rules = salaryRules[settings.rateYear] || salaryRules["2026"];
  const deductions = settings.deductions || defaultState.settings.deductions;
  const monthlyGrossSalary = Number(settings.monthlyGrossSalary || 0);
  const taxableAllowance = Number(settings.taxableAllowance || 0);
  const nonTaxableAllowance = Number(settings.nonTaxableAllowance || 0);
  const grossMonthly = monthlyGrossSalary + taxableAllowance + nonTaxableAllowance;
  const sssSalaryCredit = getSssSalaryCredit(monthlyGrossSalary, rules.sss);
  const sss = deductions.sss ? sssSalaryCredit * rules.sss.employeeRate : 0;
  const philhealthBase = clamp(monthlyGrossSalary, rules.philhealth.incomeFloor, rules.philhealth.incomeCeiling);
  const philhealth = deductions.philhealth ? philhealthBase * rules.philhealth.employeeRate : 0;
  const pagibigBase = Math.min(monthlyGrossSalary, rules.pagibig.compensationMax);
  const pagibig = deductions.pagibig ? pagibigBase * rules.pagibig.employeeRate : 0;
  const extraDeduction = Number(settings.extraDeduction || 0);
  const taxableMonthly = Math.max(0, monthlyGrossSalary + taxableAllowance - sss - philhealth - pagibig);
  const tax = deductions.tax ? getMonthlyWithholdingTax(taxableMonthly, rules.taxBrackets) : 0;
  const totalDeductions = sss + philhealth + pagibig + tax + extraDeduction;
  const netMonthly = Math.max(0, grossMonthly - totalDeductions);
  const netPaycheck = netMonthly / 2;

  return {
    grossMonthly,
    taxableMonthly,
    netMonthly,
    netPaycheck,
    sss,
    sssSalaryCredit,
    philhealth,
    pagibig,
    tax,
    extraDeduction,
    totalDeductions,
    deductions
  };
}

function getSssSalaryCredit(monthlySalary, rules) {
  if (monthlySalary <= 0) return 0;
  const bounded = clamp(monthlySalary, rules.salaryCreditMin, rules.salaryCreditMax);
  return Math.round(bounded / rules.salaryCreditStep) * rules.salaryCreditStep;
}

function getMonthlyWithholdingTax(taxableMonthly, brackets) {
  const bracket = brackets.find((item) => taxableMonthly >= item.min && taxableMonthly < item.max);
  if (!bracket) return 0;
  return bracket.base + ((taxableMonthly - bracket.min) * bracket.rate);
}

function getCurrentPayPeriod(date = new Date()) {
  const paydays = [...state.settings.paydays].sort((a, b) => a - b);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const first = dateWithClampedDay(year, month, paydays[0]);
  const second = dateWithClampedDay(year, month, paydays[1]);

  if (day >= paydays[1]) {
    return { start: second, end: dayBefore(dateWithClampedDay(year, month + 1, paydays[0])) };
  }
  if (day >= paydays[0]) {
    return { start: first, end: dayBefore(second) };
  }
  return { start: dateWithClampedDay(year, month - 1, paydays[1]), end: dayBefore(first) };
}

function getUpcomingDueItems() {
  const now = startOfDay(new Date());
  const items = [
    ...state.expenses.map((item) => ({ ...item, type: item.category || "Expense" })),
    ...state.subscriptions
      .filter((item) => item.active)
      .map((item) => ({ ...item, type: "Subscription" }))
  ];

  const dueItems = items.map((item) => {
    const currentMonthDue = dateWithClampedDay(now.getFullYear(), now.getMonth(), item.dueDay);
    const nextDue = currentMonthDue < now
      ? dateWithClampedDay(now.getFullYear(), now.getMonth() + 1, item.dueDay)
      : currentMonthDue;
    return { ...item, due: nextDue, passedDue: currentMonthDue < now ? currentMonthDue : null };
  });
  const lastPassedDueItem = dueItems
    .filter((item) => item.passedDue)
    .sort((a, b) => b.passedDue - a.passedDue)[0];
  const upcomingItems = dueItems.map(({ passedDue, ...item }) => item).sort((a, b) => a.due - b.due);

  return lastPassedDueItem
    ? [{ ...lastPassedDueItem, due: lastPassedDueItem.passedDue, isPassedDue: true }, ...upcomingItems]
    : upcomingItems;
}

function flowItem(label, value, note) {
  return `
    <div class="flow-item">
      <div><strong>${label}</strong><br><span>${note}</span></div>
      <strong>${money(value)}</strong>
    </div>
  `;
}

function dueItem(item) {
  const rawDaysAway = Math.ceil((item.due - startOfDay(new Date())) / 86400000);
  const daysAway = Math.max(0, rawDaysAway);
  const urgency = daysAway <= 3 ? "soon" : daysAway <= 10 ? "near" : "later";
  const timing = item.isPassedDue
    ? `${Math.abs(rawDaysAway)} day${Math.abs(rawDaysAway) === 1 ? "" : "s"} ago`
    : daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway} days`;
  return `
    <div class="due-item ${item.isPassedDue ? "due-passed" : `due-${urgency}`}">
      <i>${timing}</i>
      <div><strong>${escapeHtml(item.name)}</strong><br><span>${item.type} on ${formatShortDate(item.due)}</span></div>
      <strong>${money(item.amount)}</strong>
    </div>
  `;
}

async function syncToGithub() {
  const token = els.githubToken.value.trim();
  let gistId = els.gistId.value.trim();
  if (!token) {
    setSyncStatus("Add a GitHub token first.");
    return false;
  }

  setSyncStatus("Pushing latest budget...");
  const body = {
    description: "Mara's Budget Tracker data",
    public: false,
    files: {
      "mara-budget-data.json": {
        content: JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)
      }
    }
  };

  const response = await fetch(gistId ? `https://api.github.com/gists/${gistId}` : "https://api.github.com/gists", {
    method: gistId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    setSyncStatus(`GitHub push failed: ${response.status}`);
    return false;
  }

  const data = await response.json();
  els.gistId.value = data.id;
  saveSyncSettings();
  setSyncStatus(`Synced to GitHub at ${new Date().toLocaleTimeString()}.`);
  return true;
}

async function syncFromGithub() {
  const token = els.githubToken.value.trim();
  const gistId = els.gistId.value.trim();
  if (!token || !gistId) {
    setSyncStatus("Add both a GitHub token and Gist ID first.");
    return;
  }

  setSyncStatus("Pulling latest budget...");
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    setSyncStatus(`GitHub pull failed: ${response.status}`);
    return;
  }

  const data = await response.json();
  const file = data.files["mara-budget-data.json"];
  if (!file) {
    setSyncStatus("No budget data file found in that Gist.");
    return;
  }

  state = normalizeState(JSON.parse(file.content));
  saveState();
  render();
  setSyncStatus(`Pulled from GitHub at ${new Date().toLocaleTimeString()}.`);
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? normalizeState(JSON.parse(stored)) : cloneDefaultState();
}

function normalizeState(value) {
  const migratedSettings = {
    ...defaultState.settings,
    ...(value.settings || {}),
    deductions: {
      ...defaultState.settings.deductions,
      ...((value.settings || {}).deductions || {})
    }
  };

  if (!value.settings?.monthlyGrossSalary) {
    migratedSettings.monthlyGrossSalary = Number(value.settings?.paycheckAmount || defaultState.settings.paycheckAmount) * 2;
  }

  return {
    settings: migratedSettings,
    expenses: ensureIds(value.expenses || []),
    subscriptions: ensureIds(value.subscriptions || []),
    daily: ensureIds(value.daily || []),
    fares: ensureIds(value.fares || []),
    updatedAt: value.updatedAt || new Date().toISOString()
  };
}

function ensureIds(items) {
  return items.map((item) => ({ id: item.id || makeId(), ...item }));
}

function loadSyncSettings() {
  const stored = localStorage.getItem(SYNC_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveSyncSettings() {
  syncSettings = {
    token: els.githubToken.value.trim(),
    gistId: els.gistId.value.trim()
  };
  localStorage.setItem(SYNC_KEY, JSON.stringify(syncSettings));
}

function setSyncStatus(message) {
  els.syncStatus.textContent = message;
}

function flashStatus(button, text) {
  const original = button.querySelector("span")?.textContent;
  const label = button.querySelector("span");
  if (!label) return;
  label.textContent = text;
  window.setTimeout(() => {
    label.textContent = original;
  }, 1200);
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function percentOf(value, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (Number(value || 0) / total) * 100));
}

function money(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: state.settings.currency,
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

function numberFromInput(value) {
  return Number.parseFloat(value) || 0;
}

function clampDay(value) {
  return Math.min(31, Math.max(1, Math.round(value || 1)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function allocationKey(label) {
  return String(label).toLowerCase().replace(/\s+/g, "-");
}

function setActiveAllocation(activeKey) {
  const items = document.querySelectorAll("[data-allocation-key]");
  items.forEach((item) => {
    const isActive = activeKey && item.dataset.allocationKey === activeKey;
    item.classList.toggle("is-active", Boolean(isActive));
    item.classList.toggle("is-muted", Boolean(activeKey && !isActive));
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function cloneDefaultState() {
  return typeof structuredClone === "function"
    ? structuredClone(defaultState)
    : JSON.parse(JSON.stringify(defaultState));
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

function dateWithClampedDay(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return startOfDay(new Date(year, month, Math.min(day, last)));
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return startOfDay(copy);
}

function dayBefore(date) {
  return addDays(date, -1);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

function endOfWeek(date) {
  return addDays(date, 6 - date.getDay());
}

function isSameDay(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}
