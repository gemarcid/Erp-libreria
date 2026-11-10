const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { NextResponse } = require("next/server");

async function loadRoute(file, backend) {
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src/app/api", file), "utf8"));
  await module.link(async (name) => new vm.SyntheticModule(
    name === "next/server" ? ["NextResponse"] : ["requestVentasBackend"],
    function () {
      if (name === "next/server") this.setExport("NextResponse", NextResponse);
      else if (name === "@/lib/ventas-backend") this.setExport("requestVentasBackend", backend);
      else throw new Error("Unexpected import " + name);
    },
  ));
  await module.evaluate();
  return module.namespace;
}
function request(token, origin = "https://erp.example.test") {
  return {
    url: "https://erp.example.test/api/ventas/registrar",
    headers: new Headers({ origin }),
    cookies: { get: () => token ? { value: token } : undefined },
    json: async () => ({ id_cliente: 1, id_usuario: 7, detalles: [{ isbn: "123", cantidad: 1 }] }),
  };
}
test("Contabilidad exige sesión sin consultar el backend", async () => {
  const route = await loadRoute("contabilidad/route.js", () => assert.fail("Backend no debe llamarse"));
  assert.equal((await route.GET(request())).status, 401);
});
test("Contabilidad transmite el token y devuelve los asientos confirmados", async () => {
  const payload = { success: true, accounts: [], periods: [], entries: [{ code: "AS-000001" }] };
  const route = await loadRoute("contabilidad/route.js", async (url, options) => {
    assert.equal(url, "/Contabilidad/Diario");
    assert.equal(options.headers.Authorization, "Bearer session-test");
    return { response: { status: 200 }, result: payload };
  });
  const response = await route.GET(request("session-test"));
  assert.deepEqual(await response.json(), payload);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("Contabilidad conserva la denegación de permisos y muestra caídas del servicio", async () => {
  const denied = await loadRoute("contabilidad/route.js", async () => ({ response: { status: 403 }, result: { error: "Sin acceso" } }));
  assert.equal((await denied.GET(request("session-test"))).status, 403);
  const unavailable = await loadRoute("contabilidad/route.js", async () => { throw new Error("Offline"); });
  assert.equal((await unavailable.GET(request("session-test"))).status, 503);
});
test("Las escrituras contables requieren sesión y origen local, y conservan el rechazo del backend", async () => {
  const data = { date: "2026-11-10", description: "Ajuste", lines: [] };
  const route = await loadRoute("contabilidad/route.js", async (url, options) => {
    assert.equal(url, "/Contabilidad/Manual");
    assert.equal(options.headers.Authorization, "Bearer session-test");
    assert.deepEqual(JSON.parse(options.body), data);
    return { response: { status: 409 }, result: { error: "Período cerrado" } };
  });
  const write = { ...request("session-test"), json: async () => ({ operation: "manual", data }) };
  assert.equal((await route.POST(request())).status, 401);
  assert.equal((await route.POST(request("session-test", "https://otro.example.test"))).status, 403);
  assert.equal((await route.POST({ ...write, json: async () => ({ operation: "constructor", data }) })).status, 400);
  const response = await route.POST(write);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "Período cerrado" });
});
test("Registrar ventas exige sesión y el mismo origen", async () => {
  const route = await loadRoute("ventas/registrar/route.js", () => assert.fail("Backend no debe llamarse"));
  assert.equal((await route.POST(request())).status, 401);
  assert.equal((await route.POST(request("session-test", "https://otro.example.test"))).status, 403);
});

for (const [action, query] of [["reporte-clientes", "desde=2026-10-01&hasta=2026-10-08"], ["clientes", "buscar=Cliente"], ["libros", "buscar=Libro"]]) {
  test(`Ventas ${action} conserva la sesión y los filtros`, async () => {
    const route = await loadRoute(`ventas/${action}/route.js`, async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer session-test");
      assert.ok(url.endsWith(query));
      return { response: { status: 200 }, result: { success: true } };
    });
    const response = await route.GET({ ...request("session-test"), nextUrl: new URL(`https://erp.example.test/api/ventas/${action}?${query}`) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const denied = await loadRoute(`ventas/${action}/route.js`, () => assert.fail("No debe consultar sin sesión"));
    assert.equal((await denied.GET(request())).status, 401);
  });
}
test("Registrar ventas devuelve el asiento y conserva el error de período cerrado", async () => {
  let status = 200;
  const route = await loadRoute("ventas/registrar/route.js", async (url, options) => {
    assert.equal(url, "/Ventas/Registrar");
    assert.equal(options.headers.Authorization, "Bearer session-test");
    assert.equal(JSON.parse(options.body).detalles[0].cantidad, 1);
    return { response: { status }, result: status === 200 ? { success: true, id_venta: 5, id_asiento: 8 } : { error: "Período cerrado" } };
  });
  const response = await route.POST(request("session-test"));
  assert.equal((await response.json()).id_asiento, 8);
  status = 409;
  assert.equal((await route.POST(request("session-test"))).status, 409);
});
test("El resumen incluye los gastos del plan real y evita diferencias por decimales", async () => {
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src/lib/module-demo.js"), "utf8"));
  await module.link(() => new vm.SyntheticModule(["createCsv"], function () { this.setExport("createCsv", () => ""); }));
  await module.evaluate();
  const summary = module.namespace.totals([{ lines: [
    { account: "1.1.01", debit: 0.3, credit: 0 },
    { account: "4.1.01", debit: 0, credit: 0.1 },
    { account: "2.1.02", debit: 0, credit: 0.2 },
    { account: "5.1.02", debit: 0.05, credit: 0 },
    { account: "1.1.02", debit: 0, credit: 0.05 },
  ] }]);
  assert.equal(summary.debit, summary.credit);
  assert.equal(summary.expenses, 0.05);
  assert.equal(summary.result, 0.05);
});
