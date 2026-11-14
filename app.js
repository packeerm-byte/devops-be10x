const STORAGE_KEY = "moneta-finance-v1";
const DEFAULT_CATEGORIES = [
  { name: "Food & dining", type: "expense", icon: "✳" },
  { name: "Rent", type: "expense", icon: "⌂" },
  { name: "Transport", type: "expense", icon: "↗" },
  { name: "Bills", type: "expense", icon: "▤" },
  { name: "Shopping", type: "expense", icon: "◇" },
  { name: "Health", type: "expense", icon: "✚" },
  { name: "Entertainment", type: "expense", icon: "♫" },
  { name: "Groceries", type: "expense", icon: "⌑" },
  { name: "Education", type: "expense", icon: "▣" },
  { name: "Travel", type: "expense", icon: "✈" },
  { name: "Personal care", type: "expense", icon: "✿" },
  { name: "Subscriptions", type: "expense", icon: "↻" },
  { name: "Gifts", type: "expense", icon: "♡" },
  { name: "Salary", type: "income", icon: "↙" },
  { name: "Other income", type: "income", icon: "＋" }
];
const COLORS = ["#84b394", "#e8b58c", "#8897ba", "#c4a0b7", "#d7ddc7", "#e8cf8e", "#8db4b1"];
const pad = (value) => String(value).padStart(2, "0");
const dateISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const dateFromOffset = (months, day) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, maxDay, months === 0 ? new Date().getDate() : maxDay));
  return dateISO(date);
};
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const toMinor = (value) => Math.round((Number(value) + Number.EPSILON) * 100);

function createInitialState() {
  const categories = DEFAULT_CATEGORIES.map((category) => ({ ...category, id: uid(), archived: false }));
  const byName = (name) => categories.find((category) => category.name === name).id;
  const checking = uid();
  const wallet = uid();
  const savings = uid();
  const accounts = [
    { id: checking, name: "Everyday account", type: "Bank", openingBalance: 3200000, archived: false },
    { id: wallet, name: "Cash wallet", type: "Cash", openingBalance: 650000, archived: false },
    { id: savings, name: "Savings account", type: "Bank", openingBalance: 8500000, archived: false }
  ];
  const transactions = [];
  const entries = [
    [-5, "Salary", "income", 9200000, "Monthly salary", checking, 1],
    [-5, "Rent", "expense", 2850000, "Monthly rent", checking, 3],
    [-4, "Food & dining", "expense", 56000, "Sunday brunch", wallet, 12],
    [-4, "Transport", "expense", 18500, "Cab ride", wallet, 16],
    [-3, "Salary", "income", 9200000, "Monthly salary", checking, 1],
    [-3, "Groceries", "expense", 84200, "Weekly groceries", checking, 8],
    [-3, "Shopping", "expense", 125000, "New running shoes", checking, 14],
    [-2, "Salary", "income", 9200000, "Monthly salary", checking, 1],
    [-2, "Bills", "expense", 46800, "Internet & utilities", checking, 6],
    [-2, "Entertainment", "expense", 34900, "Movie night", wallet, 19],
    [-1, "Salary", "income", 9200000, "Monthly salary", checking, 1],
    [-1, "Rent", "expense", 2850000, "Monthly rent", checking, 3],
    [-1, "Health", "expense", 65000, "Pharmacy", wallet, 13],
    [0, "Salary", "income", 9200000, "Monthly salary", checking, 1],
    [0, "Rent", "expense", 2850000, "Monthly rent", checking, 2],
    [0, "Food & dining", "expense", 42500, "Coffee with Sam", wallet, 6],
    [0, "Transport", "expense", 16800, "Metro card", wallet, 9],
    [0, "Groceries", "expense", 78500, "Weekly groceries", checking, 11],
    [0, "Bills", "expense", 39200, "Electricity bill", checking, 13],
    [0, "Entertainment", "expense", 28000, "Concert tickets", wallet, 16],
    [0, "Shopping", "expense", 54900, "Weekend finds", checking, 18],
    [0, "Health", "expense", 12000, "Vitamins", wallet, 20]
  ];
  entries.forEach(([offset, category, type, amount, note, account, day]) => {
    transactions.push({ id: uid(), date: dateFromOffset(offset, day), categoryId: byName(category), type, amount, note, accountId: account });
  });
  const budgetValues = { "Food & dining": 1250000, "Transport": 650000, "Shopping": 1200000, "Bills": 850000, "Entertainment": 900000, "Groceries": 1100000, "Health": 500000, "Rent": 3000000 };
  const budgets = Object.keys(budgetValues).map((name) => ({ categoryId: byName(name), limit: budgetValues[name] }));
  return { currency: "INR", locale: "en-IN", categories, accounts, transactions, budgets, overallBudget: 6000000 };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createInitialState();
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.categories)) {
      throw new Error("Saved finance data has an invalid format.");
    }
    return { ...createInitialState(), ...parsed };
  } catch (error) {
    console.error("Could not load Moneta data:", error);
    if (error.name === "SecurityError") {
      showToast("Browser storage is unavailable. Changes may not be saved.");
      return createInitialState();
    }
    showToast("Saved data could not be loaded. A fresh demo was started.");
    return createInitialState();
  }
}
let state = loadState();
let activeType = "expense";
let editingId = null;
let importRows = [];
let importHeaders = [];
let currentTransactionPage = 1;
const transactionPageSize = 50;
const selectedTransactions = new Set();
let toastTimer;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save Moneta data:", error);
    showToast("Could not save changes in this browser.");
  }
}
function currencyFormatter() {
  return new Intl.NumberFormat(state.locale || "en-IN", {
    style: "currency", currency: state.currency || "INR", maximumFractionDigits: 0
  });
}
function money(minor) {
  return currencyFormatter().format((Number(minor) || 0) / 100);
}
function moneyExact(minor) {
  return new Intl.NumberFormat(state.locale || "en-IN", {
    style: "currency", currency: state.currency || "INR", minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format((Number(minor) || 0) / 100);
}
function activeAccounts() { return state.accounts.filter((account) => !account.archived); }
function categoryById(id) { return state.categories.find((category) => category.id === id); }
function accountById(id) { return state.accounts.find((account) => account.id === id); }
function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function currentMonthTransactions() {
  const month = monthKey(new Date());
  return state.transactions.filter((transaction) => transaction.date.startsWith(month));
}
function totals(transactions) {
  return transactions.reduce((sum, transaction) => {
    sum[transaction.type] = (sum[transaction.type] || 0) + transaction.amount;
    return sum;
  }, { income: 0, expense: 0 });
}
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function dateLabel(date, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat(state.locale || "en-IN", options).format(new Date(`${date}T12:00:00`));
}
function progressClass(spent, limit) {
  if (!limit || spent / limit < 0.8) return "";
  return spent > limit ? "over" : "warning";
}
function categorySpent(categoryId, transactions = currentMonthTransactions()) {
  return transactions.filter((transaction) => transaction.type === "expense" && transaction.categoryId === categoryId)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}
function accountBalance(account) {
  return state.transactions.filter((transaction) => transaction.accountId === account.id)
    .reduce((balance, transaction) => balance + (transaction.type === "income" ? transaction.amount : -transaction.amount), account.openingBalance);
}
function setPage(page) {
  document.querySelectorAll(".page").forEach((section) => section.classList.toggle("active", section.id === `page-${page}`));
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
  const labels = { dashboard: "Overview", transactions: "Transactions", budgets: "Budgets", accounts: "Accounts", import: "Import & export" };
  document.getElementById("pageTitle").textContent = labels[page] || "Overview";
  document.getElementById("sidebar").classList.remove("open");
  if (page === "transactions") renderTransactions();
  if (page === "budgets") renderBudgetCards();
  if (page === "accounts") renderAccounts();
}
function renderDashboard() {
  const now = new Date();
  const monthName = new Intl.DateTimeFormat(state.locale || "en-IN", { month: "long", year: "numeric" }).format(now);
  document.getElementById("monthEyebrow").textContent = monthName.toUpperCase() + " SNAPSHOT";
  document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat(state.locale || "en-IN", { weekday: "short", month: "short", day: "numeric" }).format(now);
  document.getElementById("currencySymbol").textContent = new Intl.NumberFormat(state.locale || "en-IN", { style: "currency", currency: state.currency || "INR" }).formatToParts(0).find((part) => part.type === "currency").value;
  document.getElementById("accountCurrencySymbol").textContent = document.getElementById("currencySymbol").textContent;
  const monthTotals = totals(currentMonthTransactions());
  const savings = monthTotals.income - monthTotals.expense;
  const balance = activeAccounts().reduce((sum, account) => sum + accountBalance(account), 0);
  document.getElementById("totalBalance").textContent = money(balance);
  document.getElementById("monthIncome").textContent = money(monthTotals.income);
  document.getElementById("monthExpenses").textContent = money(monthTotals.expense);
  document.getElementById("monthSavings").textContent = money(savings);
  document.getElementById("savingsCaption").textContent = monthTotals.income ? `${Math.max(0, Math.round(savings / monthTotals.income * 100))}% of income saved` : "Income minus expenses";
  document.getElementById("savingsTrack").style.width = `${Math.max(0, Math.min(100, monthTotals.income ? savings / monthTotals.income * 100 : 0))}%`;
  renderTrend();
  renderBudgetPreview();
  renderCategoryChart();
  renderRecent();
}
function renderTrend() {
  const count = Number(document.getElementById("trendRange").value);
  const months = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    const key = monthKey(date);
    const monthTransactions = state.transactions.filter((transaction) => transaction.date.startsWith(key));
    months.push({ label: new Intl.DateTimeFormat(state.locale || "en-IN", { month: "short" }).format(date), ...totals(monthTransactions) });
  }
  const max = Math.max(1, ...months.flatMap((month) => [month.income || 0, month.expense || 0]));
  document.getElementById("trendChart").innerHTML = months.map((month) => `
    <div class="chart-column" title="${safeText(month.label)} · Income ${money(month.income)} · Expenses ${money(month.expense)}">
      <div class="bar-pair"><i class="bar income" style="height:${Math.max(3, month.income / max * 100)}%"></i><i class="bar expense" style="height:${Math.max(3, month.expense / max * 100)}%"></i></div>
      <span class="chart-month">${safeText(month.label)}</span>
    </div>`).join("");
}
function renderBudgetPreview() {
  const expenses = totals(currentMonthTransactions()).expense;
  const spent = expenses;
  const limit = state.overallBudget || 0;
  const percent = limit ? spent / limit * 100 : 0;
  const remaining = limit - spent;
  document.getElementById("budgetSummary").textContent = limit ? `${Math.min(100, Math.round(percent))}% of your monthly limit used` : "Set a monthly spending plan";
  document.getElementById("overallBudgetAmount").textContent = limit ? money(limit) : "Not set";
  const bar = document.getElementById("overallBudgetBar");
  bar.style.width = `${Math.min(100, percent)}%`;
  bar.className = progressClass(spent, limit);
  document.getElementById("overallBudgetSpent").textContent = `${money(spent)} spent`;
  document.getElementById("overallBudgetRemaining").textContent = remaining >= 0 ? `${money(remaining)} left` : `${money(Math.abs(remaining))} over`;
  const visibleBudgets = state.budgets.slice().sort((a, b) => categorySpent(b.categoryId) - categorySpent(a.categoryId)).slice(0, 3);
  document.getElementById("budgetPreview").innerHTML = visibleBudgets.length ? visibleBudgets.map((budget) => {
    const category = categoryById(budget.categoryId);
    if (!category) return "";
    const amount = categorySpent(category.id);
    return `<div class="budget-preview-row"><span class="category-mark">${safeText(category.icon || "•")}</span><div class="budget-preview-copy"><strong>${safeText(category.name)}</strong><div class="progress-track"><span class="${progressClass(amount, budget.limit)}" style="width:${budget.limit ? Math.min(100, amount / budget.limit * 100) : 0}%"></span></div></div><span class="budget-preview-amount">${money(amount)} / ${money(budget.limit)}</span></div>`;
  }).join("") : `<div class="empty-state">No category budgets yet.</div>`;
}
function renderCategoryChart() {
  const totalsByCategory = new Map();
  currentMonthTransactions().filter((transaction) => transaction.type === "expense").forEach((transaction) => {
    totalsByCategory.set(transaction.categoryId, (totalsByCategory.get(transaction.categoryId) || 0) + transaction.amount);
  });
  const categories = [...totalsByCategory.entries()].map(([id, amount]) => ({ category: categoryById(id), amount })).filter((item) => item.category).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
  const max = Math.max(1, ...categories.map((item) => item.amount));
  const chart = document.getElementById("categoryChart");
  if (!categories.length) {
    chart.innerHTML = '<div class="empty-chart">Your spending breakdown will appear here.</div>';
    return;
  }
  const gradient = categories.map((item, index) => {
    const before = categories.slice(0, index).reduce((sum, previous) => sum + previous.amount, 0);
    return `${COLORS[index % COLORS.length]} ${before / total * 100}% ${(before + item.amount) / total * 100}%`;
  }).join(", ");
  chart.innerHTML = `<div class="category-bars">${categories.map((item) => `<div class="category-bar-row"><span>${safeText(item.category.name)}</span><div class="category-bar-track"><i style="width:${item.amount / max * 100}%;background:${COLORS[categories.indexOf(item) % COLORS.length]}"></i></div><strong>${money(item.amount)}</strong></div>`).join("")}</div><div class="donut-wrap" style="background:conic-gradient(${gradient})"><div class="donut-center"><span>Spent this month</span><strong>${money(total)}</strong></div></div>`;
}
function transactionIcon(transaction) {
  const category = categoryById(transaction.categoryId);
  return category ? category.icon || "•" : "•";
}
function renderRecent() {
  const items = state.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  document.getElementById("recentList").innerHTML = items.length ? items.map((transaction) => {
    const category = categoryById(transaction.categoryId);
    return `<div class="transaction-item"><span class="transaction-icon ${transaction.type}">${safeText(transactionIcon(transaction))}</span><div class="transaction-copy"><strong>${safeText(transaction.note || (category && category.name) || "Transaction")}</strong><span>${safeText((category && category.name) || "Uncategorized")} · ${dateLabel(transaction.date)}</span></div><span class="transaction-amount ${transaction.type}">${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}</span></div>`;
  }).join("") : '<div class="empty-state">Add a transaction to get started.</div>';
}
function populateTransactionOptions() {
  const categories = state.categories.filter((category) => !category.archived && category.type === activeType);
  const select = document.getElementById("txCategory");
  select.innerHTML = categories.map((category) => `<option value="${category.id}">${safeText(category.name)}</option>`).join("");
  const accounts = activeAccounts();
  document.getElementById("txAccount").innerHTML = accounts.map((account) => `<option value="${account.id}">${safeText(account.name)}</option>`).join("");
}
function openTransactionModal(transaction = null) {
  editingId = transaction ? transaction.id : null;
  activeType = transaction ? transaction.type : "expense";
  document.getElementById("transactionModalTitle").textContent = transaction ? "Edit transaction" : "Add transaction";
  document.getElementById("saveTransaction").textContent = transaction ? "Save changes" : "Save transaction";
  document.getElementById("txAmount").value = transaction ? (transaction.amount / 100).toFixed(2) : "";
  document.getElementById("txDate").value = transaction ? transaction.date : dateISO(new Date());
  document.getElementById("txNote").value = transaction ? transaction.note : "";
  document.getElementById("transactionError").textContent = "";
  document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("selected", button.dataset.type === activeType));
  populateTransactionOptions();
  if (transaction) {
    document.getElementById("txCategory").value = transaction.categoryId;
    document.getElementById("txAccount").value = transaction.accountId;
  }
  document.getElementById("transactionModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("txAmount").focus(), 0);
}
function renderTransactions() {
  const search = document.getElementById("transactionSearch").value.trim().toLowerCase();
  const categoryId = document.getElementById("categoryFilter").value;
  const type = document.getElementById("typeFilter").value;
  const accountId = document.getElementById("accountFilter").value;
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;
  const amountMin = document.getElementById("amountMin").value === "" ? null : toMinor(document.getElementById("amountMin").value);
  const amountMax = document.getElementById("amountMax").value === "" ? null : toMinor(document.getElementById("amountMax").value);
  const items = state.transactions.filter((transaction) => {
    const category = categoryById(transaction.categoryId);
    const account = accountById(transaction.accountId);
    const searchable = `${transaction.note} ${category ? category.name : ""} ${account ? account.name : ""} ${transaction.amount / 100}`.toLowerCase();
    return (!search || searchable.includes(search)) && (!categoryId || transaction.categoryId === categoryId) &&
      (!type || transaction.type === type) && (!accountId || transaction.accountId === accountId) &&
      (!dateFrom || transaction.date >= dateFrom) && (!dateTo || transaction.date <= dateTo) &&
      (amountMin === null || transaction.amount >= amountMin) && (amountMax === null || transaction.amount <= amountMax);
  }).sort((a, b) => b.date.localeCompare(a.date));
  const pageCount = Math.max(1, Math.ceil(items.length / transactionPageSize));
  currentTransactionPage = Math.min(currentTransactionPage, pageCount);
  const pageItems = items.slice((currentTransactionPage - 1) * transactionPageSize, currentTransactionPage * transactionPageSize);
  document.getElementById("transactionRows").innerHTML = pageItems.map((transaction) => {
    const category = categoryById(transaction.categoryId);
    const account = accountById(transaction.accountId);
    return `<tr><td><input type="checkbox" data-select-transaction="${transaction.id}" ${selectedTransactions.has(transaction.id) ? "checked" : ""} aria-label="Select transaction"></td><td><div class="table-transaction"><span class="transaction-icon ${transaction.type}">${safeText(transactionIcon(transaction))}</span><div><strong>${safeText(transaction.note || (category && category.name) || "Transaction")}</strong><span>${safeText((category && category.name) || "Uncategorized")}</span></div></div></td><td>${safeText(account ? account.name : "—")}</td><td>${dateLabel(transaction.date, { month: "short", day: "numeric", year: "numeric" })}</td><td class="amount-cell">${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}</td><td><button class="row-actions" data-edit="${transaction.id}" aria-label="Edit transaction">Edit</button><button class="row-actions delete-row" data-delete="${transaction.id}" aria-label="Delete transaction">Delete</button></td></tr>`;
  }).join("");
  document.getElementById("transactionEmpty").classList.toggle("hidden", items.length > 0);
  const start = items.length ? (currentTransactionPage - 1) * transactionPageSize + 1 : 0;
  document.getElementById("pageSummary").textContent = `Showing ${start}–${Math.min(currentTransactionPage * transactionPageSize, items.length)} of ${items.length} transactions`;
  document.getElementById("pageNumber").textContent = `${currentTransactionPage} / ${pageCount}`;
  document.getElementById("previousPage").disabled = currentTransactionPage <= 1;
  document.getElementById("nextPage").disabled = currentTransactionPage >= pageCount;
  const selectAll = document.getElementById("selectAllTransactions");
  selectAll.checked = pageItems.length > 0 && pageItems.every((item) => selectedTransactions.has(item.id));
  selectAll.indeterminate = pageItems.some((item) => selectedTransactions.has(item.id)) && !selectAll.checked;
  document.getElementById("bulkToolbar").classList.toggle("hidden", selectedTransactions.size === 0);
  document.getElementById("selectedCount").textContent = `${selectedTransactions.size} selected`;
  const filter = document.getElementById("categoryFilter");
  const current = filter.value;
  filter.innerHTML = `<option value="">All categories</option>${state.categories.filter((category) => !category.archived).map((category) => `<option value="${category.id}">${safeText(category.name)}</option>`).join("")}`;
  filter.value = current;
  const accountFilter = document.getElementById("accountFilter");
  const selectedAccount = accountFilter.value;
  accountFilter.innerHTML = `<option value="">All accounts</option>${activeAccounts().map((account) => `<option value="${account.id}">${safeText(account.name)}</option>`).join("")}`;
  accountFilter.value = selectedAccount;
}
function renderBudgetCards() {
  const categoryExpenses = state.categories.filter((category) => category.type === "expense" && !category.archived);
  const overall = totals(currentMonthTransactions()).expense;
  const limit = state.overallBudget || 0;
  document.getElementById("budgetPageLimit").textContent = limit ? money(limit) : "Not set";
  document.getElementById("budgetPageSpent").textContent = money(overall);
  document.getElementById("budgetPageLeft").textContent = limit ? money(Math.max(0, limit - overall)) : "—";
  document.getElementById("budgetPageBar").style.width = `${limit ? Math.min(100, overall / limit * 100) : 0}%`;
  document.getElementById("budgetPageBar").className = progressClass(overall, limit);
  document.getElementById("budgetPagePercent").textContent = limit ? `${Math.round(overall / limit * 100)}% of limit used` : "Set a limit to track progress";
  document.getElementById("budgetCards").innerHTML = categoryExpenses.map((category, index) => {
    const budget = state.budgets.find((item) => item.categoryId === category.id);
    const spent = categorySpent(category.id);
    const budgetLimit = budget ? budget.limit : 0;
    return `<article class="panel budget-card"><div class="budget-card-head"><span class="category-mark" style="background:${COLORS[index % COLORS.length]}25">${safeText(category.icon || "•")}</span><div><strong>${safeText(category.name)}</strong><span>${budgetLimit ? "Monthly budget" : "No budget set"}</span></div></div><div class="budget-card-amounts"><strong>${money(spent)}</strong><span>${budgetLimit ? `of ${money(budgetLimit)}` : "spent this month"}</span></div><div class="progress-track"><span class="${progressClass(spent, budgetLimit)}" style="width:${budgetLimit ? Math.min(100, spent / budgetLimit * 100) : 0}%"></span></div><div class="budget-card-foot"><span>${budgetLimit ? (spent > budgetLimit ? `${money(spent - budgetLimit)} over budget` : `${money(Math.max(0, budgetLimit - spent))} left`) : "Track your spending"}</span><button class="budget-edit" data-budget="${category.id}">${budgetLimit ? "Edit limit" : "Set limit"}</button></div></article>`;
  }).join("");
}
function renderAccounts() {
  const accounts = activeAccounts();
  document.getElementById("accountTotal").textContent = money(accounts.reduce((sum, account) => sum + accountBalance(account), 0));
  const icons = { Bank: "▤", Cash: "◉", "Credit card": "▰", Wallet: "◇" };
  document.getElementById("accountGrid").innerHTML = accounts.length ? accounts.map((account) => `<article class="panel account-card"><div class="account-card-top"><span class="account-card-icon">${icons[account.type] || "◈"}</span><span class="account-card-type">${safeText(account.type)}</span></div><h3>${safeText(account.name)}</h3><p>Current balance</p><strong>${money(accountBalance(account))}</strong><div class="account-opening">Opening balance: ${money(account.openingBalance)}</div></article>`).join("") : '<div class="empty-state">Add an account to see your balances.</div>';
}
function promptBudget(categoryId) {
  const category = categoryById(categoryId);
  if (!category) return;
  const current = state.budgets.find((budget) => budget.categoryId === categoryId);
  const input = window.prompt(`Monthly budget for ${category.name} (${state.currency}):`, current ? (current.limit / 100).toFixed(2) : "");
  if (input === null) return;
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a budget amount greater than zero.");
    return;
  }
  if (current) current.limit = toMinor(amount);
  else state.budgets.push({ categoryId, limit: toMinor(amount) });
  saveState();
  renderAll();
  showToast(`${category.name} budget updated.`);
}
function exportCsv() {
  const rows = [["date", "type", "amount", "category", "account", "note"], ...state.transactions.slice().sort((a, b) => a.date.localeCompare(b.date)).map((transaction) => [
    transaction.date, transaction.type, (transaction.amount / 100).toFixed(2),
    (categoryById(transaction.categoryId) || {}).name || "",
    (accountById(transaction.accountId) || {}).name || "", transaction.note || ""
  ])];
  const csv = rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `moneta-transactions-${dateISO(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Your transactions CSV is ready.");
}
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}
const IMPORT_FIELDS = [
  { key: "date", label: "Date", aliases: ["date", "transaction date", "posted date"] },
  { key: "amount", label: "Amount", aliases: ["amount", "value", "total"] },
  { key: "type", label: "Type", aliases: ["type", "transaction type", "debit/credit"] },
  { key: "category", label: "Category", aliases: ["category", "description category"] },
  { key: "account", label: "Account", aliases: ["account", "account name"] },
  { key: "note", label: "Note", aliases: ["note", "description", "memo", "details"] }
];
function guessColumn(field, headers) {
  const match = headers.findIndex((header) => field.aliases.includes(header.trim().toLowerCase()));
  return match >= 0 ? String(match) : "";
}
function openImportPreview(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) { showToast("This CSV needs a header row and at least one transaction."); return; }
  importHeaders = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  importRows = rows.slice(1).map((row) => Object.fromEntries(importHeaders.map((header, index) => [header, (row[index] || "").trim()])));
  document.getElementById("importMapping").innerHTML = IMPORT_FIELDS.map((field) => `<label>${field.label}${field.key === "date" || field.key === "amount" ? " *" : ""}<select data-map="${field.key}"><option value="">Do not import</option>${importHeaders.map((header, index) => `<option value="${index}">${safeText(header)}</option>`).join("")}</select></label>`).join("");
  IMPORT_FIELDS.forEach((field) => {
    const select = document.querySelector(`[data-map="${field.key}"]`);
    select.value = guessColumn(field, importHeaders);
    select.addEventListener("change", renderImportPreview);
  });
  renderImportPreview();
  document.getElementById("importModal").classList.remove("hidden");
}
function importValue(row, key) {
  const index = document.querySelector(`[data-map="${key}"]`).value;
  return index === "" ? "" : row[importHeaders[Number(index)]] || "";
}
function parseImportDate(value) {
  if (!value) return "";
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return date.getFullYear() === Number(iso[1]) && date.getMonth() === Number(iso[2]) - 1 && date.getDate() === Number(iso[3]) ? dateISO(date) : "";
  }
  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]), second = Number(numeric[2]);
    const day = first > 12 ? first : second > 12 ? second : (state.locale || "en-IN").toLowerCase().endsWith("-in") ? first : second;
    const month = first > 12 ? second : second > 12 ? first : day === first ? second : first;
    const date = new Date(Number(numeric[3]), month - 1, day);
    return date.getFullYear() === Number(numeric[3]) && date.getMonth() === month - 1 && date.getDate() === day ? dateISO(date) : "";
  }
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return dateISO(direct);
  return "";
}
function rowIsDuplicate(candidate) {
  return state.transactions.some((transaction) => transaction.date === candidate.date && transaction.amount === candidate.amount && transaction.note.trim().toLowerCase() === candidate.note.trim().toLowerCase());
}
function renderImportPreview() {
  const parsed = importRows.map((row, index) => {
    const date = parseImportDate(importValue(row, "date"));
    const rawAmount = importValue(row, "amount").replace(/[₹$£,\s]/g, "");
    const amount = toMinor(Math.abs(Number(rawAmount)));
    const rawType = importValue(row, "type").toLowerCase();
    const type = /income|credit|deposit/.test(rawType) ? "income" : "expense";
    const categoryName = importValue(row, "category");
    const accountName = importValue(row, "account");
    const note = importValue(row, "note");
    const category = state.categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase() && item.type === type)
      || state.categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
    const account = state.accounts.find((item) => item.name.toLowerCase() === accountName.toLowerCase()) || activeAccounts()[0];
    const candidate = { date, amount, type, note, categoryId: category ? category.id : (state.categories.find((item) => item.type === type) || {}).id, accountId: account ? account.id : "" };
    return { candidate, valid: Boolean(date && amount > 0 && candidate.categoryId && candidate.accountId), duplicate: rowIsDuplicate(candidate), index };
  });
  document.getElementById("importPreview").innerHTML = parsed.slice(0, 20).map(({ candidate, valid, duplicate, index }) => `<tr><td>${candidate.date ? dateLabel(candidate.date) : "Invalid date"}</td><td>${candidate.type}</td><td>${safeText((categoryById(candidate.categoryId) || {}).name || "—")}</td><td>${moneyExact(candidate.amount)}</td><td>${safeText(candidate.note || "—")}${duplicate ? " · duplicate" : ""}</td><td><input type="checkbox" data-import-row="${index}" ${valid ? "checked" : ""} ${valid ? "" : "disabled"} aria-label="Import row ${index + 1}"></td></tr>`).join("");
  const invalid = parsed.filter((item) => !item.valid).length;
  document.getElementById("importSummary").textContent = `${importRows.length} rows found · Previewing ${Math.min(20, importRows.length)} · ${invalid} need a valid date, amount, category, and account`;
  document.getElementById("confirmImport").disabled = !parsed.some((item) => item.valid);
  window.__monetaImportParsed = parsed;
}
function commitImport() {
  const parsed = window.__monetaImportParsed || [];
  const selected = new Set([...document.querySelectorAll("[data-import-row]:checked")].map((checkbox) => Number(checkbox.dataset.importRow)));
  const displayed = new Set([...document.querySelectorAll("[data-import-row]")].map((checkbox) => Number(checkbox.dataset.importRow)));
  const already = new Set(state.transactions.map((transaction) => `${transaction.date}|${transaction.amount}|${transaction.note.trim().toLowerCase()}`));
  let imported = 0, duplicates = 0;
  parsed.forEach(({ candidate, valid, index }) => {
    if (!valid || (!selected.has(index) && displayed.has(index))) return;
    const key = `${candidate.date}|${candidate.amount}|${candidate.note.trim().toLowerCase()}`;
    if (already.has(key)) { duplicates++; return; }
    state.transactions.push({ id: uid(), ...candidate });
    already.add(key);
    imported++;
  });
  saveState();
  renderAll();
  document.getElementById("importModal").classList.add("hidden");
  document.getElementById("csvFile").value = "";
  showToast(`${imported} transaction${imported === 1 ? "" : "s"} imported${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}.`);
}
function renderAll() {
  renderDashboard();
  renderTransactions();
  renderBudgetCards();
  renderAccounts();
}

document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.go)));
document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => openTransactionModal()));
document.getElementById("addTransaction").addEventListener("click", () => openTransactionModal());
document.getElementById("topAdd").addEventListener("click", () => openTransactionModal());
document.getElementById("trendRange").addEventListener("change", renderTrend);
document.querySelectorAll(".type-option").forEach((button) => button.addEventListener("click", () => {
  activeType = button.dataset.type;
  document.querySelectorAll(".type-option").forEach((option) => option.classList.toggle("selected", option === button));
  populateTransactionOptions();
}));
document.getElementById("transactionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(document.getElementById("txAmount").value);
  const date = document.getElementById("txDate").value;
  const categoryId = document.getElementById("txCategory").value;
  const accountId = document.getElementById("txAccount").value;
  if (!Number.isFinite(amount) || amount <= 0 || !date || !categoryId || !accountId) {
    document.getElementById("transactionError").textContent = "Add a valid amount, date, category, and account.";
    return;
  }
  const before = totals(currentMonthTransactions()).expense;
  const transaction = { id: editingId || uid(), date, amount: toMinor(amount), type: activeType, categoryId, accountId, note: document.getElementById("txNote").value.trim() };
  if (editingId) state.transactions = state.transactions.map((item) => item.id === editingId ? transaction : item);
  else state.transactions.push(transaction);
  saveState();
  renderAll();
  document.getElementById("transactionModal").classList.add("hidden");
  const after = totals(currentMonthTransactions()).expense;
  const crossed = state.overallBudget && before < state.overallBudget * 0.8 && after >= state.overallBudget * 0.8;
  const crossedLimit = state.overallBudget && before <= state.overallBudget && after > state.overallBudget;
  showToast(crossedLimit ? "You’ve gone over your monthly budget." : crossed ? "You’ve used 80% of your monthly budget." : editingId ? "Transaction updated." : "Transaction saved.");
});
document.getElementById("transactionRows").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const transaction = state.transactions.find((item) => item.id === editButton.dataset.edit);
    if (transaction) openTransactionModal(transaction);
  } else if (deleteButton && window.confirm("Delete this transaction?")) {
    state.transactions = state.transactions.filter((item) => item.id !== deleteButton.dataset.delete);
    selectedTransactions.delete(deleteButton.dataset.delete);
    saveState(); renderAll(); showToast("Transaction deleted.");
  }
});
document.getElementById("transactionRows").addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-select-transaction]");
  if (!checkbox) return;
  if (checkbox.checked) selectedTransactions.add(checkbox.dataset.selectTransaction);
  else selectedTransactions.delete(checkbox.dataset.selectTransaction);
  renderTransactions();
});
document.getElementById("selectAllTransactions").addEventListener("change", (event) => {
  document.querySelectorAll("[data-select-transaction]").forEach((checkbox) => {
    if (event.target.checked) selectedTransactions.add(checkbox.dataset.selectTransaction);
    else selectedTransactions.delete(checkbox.dataset.selectTransaction);
  });
  renderTransactions();
});
document.getElementById("deleteSelected").addEventListener("click", () => {
  if (!selectedTransactions.size || !window.confirm(`Delete ${selectedTransactions.size} selected transaction(s)?`)) return;
  const selected = new Set(selectedTransactions);
  state.transactions = state.transactions.filter((transaction) => !selected.has(transaction.id));
  selectedTransactions.clear();
  saveState(); renderAll(); showToast("Selected transactions deleted.");
});
document.getElementById("previousPage").addEventListener("click", () => { currentTransactionPage--; renderTransactions(); });
document.getElementById("nextPage").addEventListener("click", () => { currentTransactionPage++; renderTransactions(); });
["transactionSearch", "categoryFilter", "typeFilter", "accountFilter", "dateFrom", "dateTo", "amountMin", "amountMax"].forEach((id) => {
  document.getElementById(id).addEventListener(id === "transactionSearch" ? "input" : "change", () => {
    currentTransactionPage = 1;
    renderTransactions();
  });
});
document.getElementById("budgetCards").addEventListener("click", (event) => {
  const button = event.target.closest("[data-budget]");
  if (button) promptBudget(button.dataset.budget);
});
document.getElementById("editOverallBudget").addEventListener("click", () => {
  const input = window.prompt(`Overall monthly budget (${state.currency}):`, state.overallBudget ? (state.overallBudget / 100).toFixed(2) : "");
  if (input === null) return;
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0) { showToast("Enter a budget amount greater than zero."); return; }
  state.overallBudget = toMinor(amount);
  saveState(); renderAll(); showToast("Overall budget updated.");
});
document.getElementById("addAccount").addEventListener("click", () => {
  document.getElementById("accountForm").reset();
  document.getElementById("accountError").textContent = "";
  document.getElementById("accountModal").classList.remove("hidden");
  document.getElementById("accountName").focus();
});
document.getElementById("accountForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("accountName").value.trim();
  const opening = Number(document.getElementById("accountOpening").value);
  if (!name || !Number.isFinite(opening)) { document.getElementById("accountError").textContent = "Enter an account name and a valid opening balance."; return; }
  state.accounts.push({ id: uid(), name, type: document.getElementById("accountType").value, openingBalance: toMinor(opening), archived: false });
  saveState(); renderAll(); document.getElementById("accountModal").classList.add("hidden"); showToast("Account added.");
});
document.getElementById("csvFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try { openImportPreview(await file.text()); }
  catch (error) { console.error("Could not read CSV:", error); showToast("Could not read that CSV file."); }
});
document.getElementById("confirmImport").addEventListener("click", commitImport);
document.getElementById("exportCsv").addEventListener("click", exportCsv);
document.getElementById("mobileMenu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest(".modal-backdrop").classList.add("hidden")));
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) backdrop.classList.add("hidden");
}));
document.addEventListener("keydown", (event) => {
  if ((event.key === "n" || event.key === "N") && !event.ctrlKey && !event.metaKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    event.preventDefault(); openTransactionModal();
  }
  if (event.key === "Escape") document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach((modal) => modal.classList.add("hidden"));
});
renderAll();
