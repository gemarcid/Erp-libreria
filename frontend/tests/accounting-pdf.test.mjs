import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildBalance } from "../src/lib/accounting-balance.js";
import { createAccountingPdf, createAccountingTablePdf } from "../src/lib/accounting-pdf.js";
import { buildIncomeStatement, buildLedger } from "../src/lib/accounting-reports.js";

const accounts = [
  { code: "1.1.01", name: "Caja", type: "activo" },
  { code: "1.1.02", name: "Banco", type: "activo" },
  { code: "4.1.01", name: "Ingresos por ventas", type: "ingreso" },
  { code: "5.1.02", name: "Gastos generales", type: "gasto" },
];
const entries = [
  { code: "AS-000001", date: "2026-10-08", source: "Ventas", document: "Boleta #1", description: "Venta de libros", lines: [
    { account: "1.1.01", debit: 1000, credit: 0 }, { account: "4.1.01", debit: 0, credit: 1000 },
  ] },
  { code: "AS-000002", date: "2026-10-08", source: "Manual", document: "Pago #1", description: "Gastos operacionales", lines: [
    { account: "5.1.02", debit: 200, credit: 0 }, { account: "1.1.02", debit: 0, credit: 200 },
  ] },
];
test("Ocho columnas, utilidad y ajuste final cuadran", () => {
  const balance = buildBalance(entries, accounts);
  assert.equal(balance.difference, 0);
  assert.equal(balance.result, 800);
  assert.equal(balance.closing.liability, 800);
  assert.equal(balance.closing.loss, 800);
  assert.equal(balance.grandTotals.asset, balance.grandTotals.liability);
  assert.equal(balance.grandTotals.loss, balance.grandTotals.profit);
  assert.equal(balance.rows.find((row) => row.code === "1.1.02").liability, 200);
});
test("Pérdida y saldos invertidos se clasifican por signo", () => {
  const balance = buildBalance([entries[1]], accounts);
  assert.equal(balance.result, -200);
  assert.equal(balance.closing.asset, 200);
  assert.equal(balance.closing.profit, 200);
  assert.equal(balance.grandTotals.asset, balance.grandTotals.liability);
  const reversed = buildBalance([{ lines: [{ account: "4.1.01", debit: 50, credit: 0 }] }], accounts);
  assert.equal(reversed.rows[0].loss, 50);
});
test("Centavos exactos y errores de clasificación visibles", () => {
  const balance = buildBalance([{ lines: [
    { account: "1.1.01", debit: 0.1, credit: 0 }, { account: "1.1.01", debit: 0.2, credit: 0 },
    { account: "4.1.01", debit: 0, credit: 0.3 },
  ] }], accounts);
  assert.equal(balance.difference, 0);
  assert.equal(balance.sums.debit, 0.3);
  assert.throws(() => buildBalance([{ lines: [{ account: "sin-cuenta", debit: 5, credit: 0 }] }], accounts), /plan contable/);
  assert.throws(() => buildBalance(entries, accounts.map((a) => ({ ...a, type: "sin-tipo" }))), /clasificación/);
});
test("PDF incluye balance, detalle, filtros y varias páginas", () => {
  const longEntries = Array.from({ length: 90 }, (_, i) => ({ ...entries[i % 2], code: `AS-${i}`, description: "Glosa extensa con descripción del documento y trazabilidad de la operación registrada" }));
  const doc = createAccountingPdf({ entries: longEntries, accounts, period: "2026-10", periodLabel: "Octubre 2026", search: "Consulta de prueba", generatedAt: new Date("2026-10-08T12:00:00Z") });
  assert.ok(doc.getNumberOfPages() > 3);
  assert.ok(doc.output("arraybuffer").byteLength > 10000);
  assert.throws(() => createAccountingPdf({ entries: [], accounts }), /No hay asientos/);
});

test("El mayor incluye saldo inicial y ordena asientos por fecha y número", () => {
  const [sale] = entries;
  const earlier = { ...sale, date: "2026-09-30", period: "2026-09", code: "AS-1" };
  const monthEntries = [{ ...sale, code: "AS-10" }, { ...sale, code: "AS-2" }];
  const [cash] = buildLedger([...monthEntries, earlier], accounts, "2026-10", "1.1.01");
  assert.equal(cash.opening, 1000);
  assert.deepEqual(cash.rows.map(({ code, balance }) => [code, balance]), [["AS-2", 2000], ["AS-10", 3000]]);
  assert.equal(cash.balance, 3000);
});

test("Resultados separa costos históricos y nuevas cuentas de costo", () => {
  const catalog = [...accounts, { code: "5.1.01", type: "gasto" }, { code: "5.1.15", type: "costo" }];
  const costs = { lines: [{ account: "5.1.01", debit: 0.1, credit: 0 }, { account: "5.1.15", debit: 0.2, credit: 0 }] };
  const statement = buildIncomeStatement([...entries, costs], catalog);
  assert.deepEqual(statement.groups.map(({ total }) => total), [1000, 0.3, 200]);
  assert.equal(statement.result, 799.7);
});

test("PDF de tablas conserva su paginación", () => {
  const doc = createAccountingTablePdf({
    title: "Libro mayor", periodLabel: "octubre 2026", detail: "Saldo acumulado",
    columns: [{ label: "Cuenta" }, { label: "Saldo", numeric: true }],
    rows: Array.from({ length: 120 }, () => ({ cells: ["Caja", 15.5] })),
  });
  assert.ok(doc.getNumberOfPages() > 1);
});
// Un único PDF de muestra para revisar visualmente el diseño con datos de prueba.
if (process.env.PDF_PREVIEW_PATH) {
  const doc = createAccountingPdf({ entries, accounts, period: "2026-10", periodLabel: "Octubre 2026 - datos de prueba", generatedAt: new Date("2026-10-08T12:00:00Z") });
  fs.writeFileSync(process.env.PDF_PREVIEW_PATH, Buffer.from(doc.output("arraybuffer")));
}
