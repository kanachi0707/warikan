const STORAGE_KEY = "warikan-app-state";
const MAX_MEMBERS = 99;
const QUICK_DEFAULT_MESSAGE = "会計金額と人数を入力してね！";
const MANUAL_COUNT_VALUE = "manual";

const state = loadState();

const elements = {
  quickTotal: document.getElementById("quick-total"),
  quickCount: document.getElementById("quick-count"),
  quickCountManual: document.getElementById("quick-count-manual"),
  quickManualWrap: document.getElementById("quick-manual-wrap"),
  quickError: document.getElementById("quick-error"),
  quickResult: document.getElementById("quick-result"),
  toggleAdvanced: document.getElementById("toggle-advanced"),
  advancedPanel: document.getElementById("advanced-panel"),
  enteredTotal: document.getElementById("entered-total"),
  remainingTotal: document.getElementById("remaining-total"),
  remainingSplit: document.getElementById("remaining-split"),
  memberList: document.getElementById("member-list"),
  memberEmpty: document.getElementById("member-empty"),
  memberCount: document.getElementById("member-count"),
  summary: document.getElementById("summary"),
  settlementList: document.getElementById("settlement-list"),
  settlementEmpty: document.getElementById("settlement-empty"),
  resetButton: document.getElementById("reset-button"),
  memberTemplate: document.getElementById("member-item-template"),
};

normalizeState();
bindEvents();
render();

function bindEvents() {
  elements.quickTotal.addEventListener("input", handleQuickInput);
  elements.quickCount.addEventListener("change", handleCountChange);
  elements.quickCountManual.addEventListener("input", handleManualCountInput);
  elements.toggleAdvanced.addEventListener("click", toggleAdvancedPanel);
  elements.memberList.addEventListener("input", handleMemberInput);
  elements.resetButton.addEventListener("click", handleReset);
}

function handleQuickInput() {
  state.quickTotal = elements.quickTotal.value;
  renderQuickSplit();
  renderAdvancedSummary();
  renderSettlement();
  persistState();
}

function handleCountChange() {
  state.quickCount = elements.quickCount.value;

  if (state.quickCount !== MANUAL_COUNT_VALUE) {
    state.quickCountManual = "";
  }

  syncMembersWithCount(getSelectedCount());
  render();
  persistState();
}

function handleManualCountInput() {
  state.quickCountManual = elements.quickCountManual.value;
  syncMembersWithCount(getSelectedCount());
  renderQuickSplit();
  renderMembers();
  renderAdvancedSummary();
  renderSettlement();
  persistState();
}

function handleMemberInput(event) {
  const card = event.target.closest("[data-member-id]");
  if (!card) {
    return;
  }

  const member = state.members.find((item) => item.id === card.dataset.memberId);
  if (!member) {
    return;
  }

  const index = state.members.findIndex((item) => item.id === member.id);

  if (event.target.matches(".member-name-input")) {
    member.name = event.target.value;
    const number = card.querySelector(".member-number");
    const hint = card.querySelector(".member-hint");
    number.textContent = getMemberLabel(index);
    hint.textContent = buildMemberHint(member, index);
  }

  if (event.target.matches(".member-paid-input")) {
    member.paid = event.target.value;
    const hint = card.querySelector(".member-hint");
    hint.textContent = buildMemberHint(member, index);
  }

  renderAdvancedSummary();
  renderSettlement();
  persistState();
}

function toggleAdvancedPanel() {
  state.advancedOpen = !state.advancedOpen;
  renderAdvancedVisibility();
  persistState();
}

function handleReset() {
  const shouldReset = window.confirm("合計金額、人数、メンバー入力をすべて削除します。よろしいですか？");
  if (!shouldReset) {
    return;
  }

  state.quickTotal = "";
  state.quickCount = "";
  state.quickCountManual = "";
  state.advancedOpen = false;
  state.members = [];
  persistState();
  render();
}

function render() {
  renderQuickInputs();
  renderQuickSplit();
  renderAdvancedVisibility();
  renderMembers();
  renderAdvancedSummary();
  renderSettlement();
}

function renderQuickInputs() {
  elements.quickTotal.value = state.quickTotal;
  elements.quickCount.value = state.quickCount;
  elements.quickCountManual.value = state.quickCountManual;
  elements.quickManualWrap.hidden = state.quickCount !== MANUAL_COUNT_VALUE;
  elements.memberCount.textContent = `${state.members.length}人`;
}

function renderQuickSplit() {
  const total = getQuickTotal();
  const count = getSelectedCount();
  setError(elements.quickError, "");

  if (!state.quickTotal && !state.quickCount && !state.quickCountManual) {
    elements.quickResult.textContent = QUICK_DEFAULT_MESSAGE;
    return;
  }

  if (!Number.isInteger(total) || total <= 0) {
    setError(elements.quickError, "会計金額は1円以上の整数で入力してください。");
    elements.quickResult.textContent = QUICK_DEFAULT_MESSAGE;
    return;
  }

  if (!Number.isInteger(count) || count <= 0) {
    elements.quickResult.textContent = state.quickCount === MANUAL_COUNT_VALUE ? "手動人数を入力してください。" : "人数を選択してください。";
    return;
  }

  elements.quickResult.innerHTML = buildSplitMessage(splitAmount(total, count), count);
}

function renderAdvancedVisibility() {
  elements.advancedPanel.hidden = !state.advancedOpen;
  elements.toggleAdvanced.textContent = state.advancedOpen ? "閉じる" : "表示する";
}

function renderMembers() {
  elements.memberList.innerHTML = "";
  elements.memberEmpty.hidden = state.members.length > 0;
  elements.memberCount.textContent = `${state.members.length}人`;

  state.members.forEach((member, index) => {
    const fragment = elements.memberTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".member-card");
    const number = fragment.querySelector(".member-number");
    const nameInput = fragment.querySelector(".member-name-input");
    const paidInput = fragment.querySelector(".member-paid-input");
    const hint = fragment.querySelector(".member-hint");

    card.dataset.memberId = member.id;
    number.textContent = getMemberLabel(index);
    nameInput.value = member.name;
    paidInput.value = member.paid;
    hint.textContent = buildMemberHint(member, index);

    elements.memberList.appendChild(fragment);
  });
}

function renderAdvancedSummary() {
  const total = getQuickTotal();
  const count = getSelectedCount();
  const amounts = getMemberAmounts();
  const enteredTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  const remaining = Number.isInteger(total) ? total - enteredTotal : 0;
  const change = Number.isInteger(total) ? Math.max(enteredTotal - total, 0) : 0;
  const unfilledMembers = getUnfilledMembers();

  elements.enteredTotal.textContent = formatCurrency(Math.max(enteredTotal, 0));
  elements.remainingTotal.textContent = Number.isInteger(total)
    ? remaining >= 0
      ? formatCurrency(remaining)
      : `おつり ${formatCurrency(change)}`
    : "合計未設定";

  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(count) || count <= 0) {
    elements.remainingSplit.textContent = "未入力メンバーで残額を割り勘します";
    return;
  }

  if (change > 0) {
    elements.remainingSplit.textContent = `おつり ${formatCurrency(change)} を差し引いて精算します`;
    return;
  }

  if (unfilledMembers.length === 0) {
    elements.remainingSplit.textContent = remaining === 0 ? "全員の入力が完了しています" : `残額 ${formatCurrency(remaining)} が未割り当てです`;
    return;
  }

  elements.remainingSplit.innerHTML = `${unfilledMembers.length}人の未入力メンバー向け: ${buildSplitMessage(splitAmount(remaining, unfilledMembers.length), unfilledMembers.length)}`;
}

function renderSettlement() {
  const total = getQuickTotal();
  const count = getSelectedCount();
  const enteredAmounts = getMemberAmounts();
  elements.settlementList.innerHTML = "";

  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(count) || count <= 0 || state.members.length === 0) {
    elements.summary.textContent = "合計金額と人数を設定してください。";
    elements.settlementEmpty.hidden = false;
    elements.settlementEmpty.textContent = "合計金額とメンバーの支払い額を入れると、あとで精算する金額を表示します。";
    return;
  }

  const enteredTotal = enteredAmounts.reduce((sum, amount) => sum + amount, 0);
  const remaining = total - enteredTotal;
  const adjustment = adjustAmountsForChange(enteredAmounts, total);

  if (remaining > 0) {
    elements.summary.textContent = `まだ ${formatCurrency(remaining)} の差があります。全体の支払い金額が合計に届くと精算を確定できます。`;
    elements.settlementEmpty.hidden = false;
    elements.settlementEmpty.textContent = "未入力メンバーに残額を割り当てると精算結果を表示できます。";
    return;
  }

  const shares = splitAmount(total, count);
  const balances = state.members.map((member, index) => ({
    name: getMemberDisplayName(member, index),
    balance: adjustment.amounts[index] - shares[index],
  }));
  const transfers = settleBalances(balances);

  elements.summary.textContent = adjustment.change > 0
    ? `入力合計は ${formatCurrency(enteredTotal)} ですが、おつり ${formatCurrency(adjustment.change)} を差し引いて精算しています。`
    : `合計 ${formatCurrency(total)} を ${count}人で割り、1円単位で調整した精算結果です。`;

  if (transfers.length === 0) {
    elements.settlementEmpty.hidden = false;
    elements.settlementEmpty.textContent = "精算は不要です。";
    return;
  }

  elements.settlementEmpty.hidden = true;
  transfers.forEach((transfer) => {
    const item = document.createElement("li");
    item.className = "settlement-item";
    item.textContent = `${transfer.from} → ${transfer.to} : ${formatCurrency(transfer.amount)}`;
    elements.settlementList.appendChild(item);
  });
}

function adjustAmountsForChange(amounts, total) {
  const adjusted = [...amounts];
  let change = Math.max(adjusted.reduce((sum, amount) => sum + amount, 0) - total, 0);

  if (change === 0) {
    return { amounts: adjusted, change: 0 };
  }

  const payerIndexes = adjusted
    .map((amount, index) => ({ amount, index }))
    .sort((a, b) => b.amount - a.amount);

  payerIndexes.forEach((payer) => {
    if (change === 0) {
      return;
    }

    const deduction = Math.min(adjusted[payer.index], change);
    adjusted[payer.index] -= deduction;
    change -= deduction;
  });

  return {
    amounts: adjusted,
    change: Math.max(amounts.reduce((sum, amount) => sum + amount, 0) - total, 0),
  };
}

function settleBalances(balances) {
  const creditors = balances.filter((item) => item.balance > 0).map((item) => ({ ...item }));
  const debtors = balances.filter((item) => item.balance < 0).map((item) => ({ name: item.name, balance: Math.abs(item.balance) }));
  const transfers = [];

  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.balance, debtor.balance);

    transfers.push({ from: debtor.name, to: creditor.name, amount });

    creditor.balance -= amount;
    debtor.balance -= amount;

    if (creditor.balance === 0) {
      creditorIndex += 1;
    }
    if (debtor.balance === 0) {
      debtorIndex += 1;
    }
  }

  return transfers;
}

function buildSplitMessage(shares, count) {
  const minShare = Math.min(...shares);
  const maxShare = Math.max(...shares);

  if (count === 0) {
    return "";
  }

  if (minShare === maxShare) {
    return `1人あたり <strong>${formatCurrency(minShare)}</strong> です。`;
  }

  const higherCount = shares.filter((share) => share === maxShare).length;
  const lowerCount = count - higherCount;
  const parts = [];

  if (higherCount > 0) {
    parts.push(`${higherCount}人が${formatCurrency(maxShare)}`);
  }
  if (lowerCount > 0) {
    parts.push(`${lowerCount}人が${formatCurrency(minShare)}`);
  }

  return `1人あたりの目安は <strong>${formatCurrency(minShare)}</strong> から <strong>${formatCurrency(maxShare)}</strong> です。<div class="quick-breakdown">${parts.join("、")}</div>`;
}

function buildMemberHint(member, index) {
  const paid = parseAmount(member.paid);
  if (paid === null) {
    return `${getMemberDisplayName(member, index)} は未入力です。残額の均等割り目安を参考に入力できます。`;
  }
  return `${getMemberDisplayName(member, index)} の支払い金額は ${formatCurrency(paid)} です。`;
}

function getMemberLabel(index) {
  return `メンバー${index + 1}`;
}

function getMemberDisplayName(member, index) {
  const name = member.name.trim();
  return name || getMemberLabel(index);
}

function getMemberAmounts() {
  return state.members.map((member) => parseAmount(member.paid) || 0);
}

function getUnfilledMembers() {
  return state.members.filter((member) => parseAmount(member.paid) === null);
}

function getQuickTotal() {
  return parsePositiveInt(state.quickTotal);
}

function getSelectedCount() {
  if (state.quickCount === MANUAL_COUNT_VALUE) {
    return parsePositiveInt(state.quickCountManual);
  }
  return parsePositiveInt(state.quickCount);
}

function parseAmount(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parsePositiveInt(value) {
  const parsed = parseAmount(value);
  return parsed === null || parsed <= 0 ? null : parsed;
}

function syncMembersWithCount(count) {
  if (!Number.isInteger(count) || count <= 0) {
    state.members = [];
    return;
  }

  const nextMembers = [];
  for (let index = 0; index < Math.min(count, MAX_MEMBERS); index += 1) {
    const existing = state.members[index];
    nextMembers.push(existing || createMember());
  }
  state.members = nextMembers;
}

function createMember() {
  return {
    id: createId(),
    name: "",
    paid: "",
  };
}

function splitAmount(amount, count) {
  const base = Math.floor(amount / count);
  const remainder = amount % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function normalizeState() {
  state.quickTotal = typeof state.quickTotal === "string" ? state.quickTotal : "";
  state.quickCount = typeof state.quickCount === "string" ? state.quickCount : "";
  state.quickCountManual = typeof state.quickCountManual === "string" ? state.quickCountManual : "";
  state.advancedOpen = Boolean(state.advancedOpen);
  state.members = Array.isArray(state.members)
    ? state.members.map((member) => ({
        id: typeof member.id === "string" ? member.id : createId(),
        name: typeof member.name === "string" ? member.name : "",
        paid: typeof member.paid === "string" ? member.paid : "",
      }))
    : [];

  if (state.quickCount) {
    syncMembersWithCount(getSelectedCount());
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { quickTotal: "", quickCount: "", quickCountManual: "", advancedOpen: false, members: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      quickTotal: parsed.quickTotal,
      quickCount: parsed.quickCount,
      quickCountManual: parsed.quickCountManual,
      advancedOpen: parsed.advancedOpen,
      members: parsed.members,
    };
  } catch (error) {
    return { quickTotal: "", quickCount: "", quickCountManual: "", advancedOpen: false, members: [] };
  }
}

function setError(element, message) {
  element.textContent = message;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCurrency(amount) {
  return `${amount.toLocaleString("ja-JP")}円`;
}
