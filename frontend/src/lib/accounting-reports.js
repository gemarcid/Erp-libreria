export const accountTypes = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  ingreso: "Ingreso",
  costo: "Costo de ventas",
  gasto: "Gasto",
};

export const accountingMoney = new Intl.NumberFormat("es-CL", {
  style: "currency", currency: "CLP", maximumFractionDigits: 2,
});

export const toCents = (value) => Math.round(Number(value) * 100);
export const entryPeriod = (entry) => entry.period || entry.date.slice(0, 7);

export function chronological(entries) {
  return [...entries].sort((a, b) =>
    a.date.localeCompare(b.date) || a.code.localeCompare(b.code, "es", { numeric: true }));
}

export function journalRows(entries, accounts) {
  const names = new Map(accounts.map(({ code, name }) => [code, name]));
  return chronological(entries).flatMap((entry) => {
    const header = [entry.date, entry.code, entry.source, entry.document || "—", entry.description];
    return entry.lines.length ? entry.lines.map((line) => [
      ...header, line.account + " · " + (names.get(line.account) || ""), line.debit, line.credit,
    ]) : [[...header, "Sin líneas registradas", 0, 0]];
  });
}

export function buildLedger(entries, accounts, period, code = "") {
  if (!period) return [];
  const groups = new Map(accounts
    .filter((account) => !code || account.code === code)
    .map((account) => [account.code, { ...account, opening: 0, balance: 0, rows: [] }]));

  for (const entry of chronological(entries.filter((item) => entryPeriod(item) <= period))) {
    for (const line of entry.lines) {
      const group = groups.get(line.account);
      if (!group) continue;
      const movement = toCents(line.debit) - toCents(line.credit);
      if (entryPeriod(entry) < period) {
        group.opening += movement;
        continue;
      }
      group.balance += movement;
      group.rows.push({ entry, line, netMovement: group.balance });
    }
  }
  return [...groups.values()]
    .filter((group) => group.rows.length > 0 || (code && group.opening !== 0))
    .map((group) => ({
      ...group,
      opening: group.opening / 100,
      balance: (group.opening + group.balance) / 100,
      rows: group.rows.map(({ entry, line, netMovement }) => ({
        ...entry, line, balance: (group.opening + netMovement) / 100,
      })),
    }));
}

export function buildIncomeStatement(entries, accounts) {
  const groups = {
    ingreso: { label: "Ingresos", total: 0, accounts: [] },
    costo: { label: "Costo de libros vendidos", total: 0, accounts: [] },
    gasto: { label: "Gastos operacionales", total: 0, accounts: [] },
  };
  const movements = new Map();
  for (const entry of entries) {
    for (const line of entry.lines) {
      const amount = toCents(line.credit) - toCents(line.debit);
      movements.set(line.account, (movements.get(line.account) || 0) + amount);
    }
  }
  for (const account of accounts) {
    // El plan histórico identifica el costo de ventas con 5.1.01 y tipo gasto.
    const type = account.code === "5.1.01" && account.type === "gasto" ? "costo" : account.type;
    const group = Object.hasOwn(groups, type) ? groups[type] : null;
    if (!group || !movements.has(account.code)) continue;
    const value = (type === "ingreso" ? 1 : -1) * movements.get(account.code);
    group.total += value;
    group.accounts.push({ ...account, amount: value / 100 });
  }
  return {
    groups: Object.values(groups).map((group) => ({ ...group, total: group.total / 100 })),
    result: (groups.ingreso.total - groups.costo.total - groups.gasto.total) / 100,
  };
}
