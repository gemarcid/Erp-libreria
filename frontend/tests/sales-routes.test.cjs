const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { NextResponse } = require("next/server");

async function loadRoute(file, backend) {
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src/app/api", file), "utf8"));
  await module.link(async (name) => {
    if (name === "next/server") {
      return new vm.SyntheticModule(["NextResponse"], function () {
        this.setExport("NextResponse", NextResponse);
      });
    }
    if (name === "@/lib/ventas-backend") {
      return new vm.SyntheticModule(["requestVentasBackend"], function () {
        this.setExport("requestVentasBackend", backend);
      });
    }
    if (name === "@/lib/ventas-data") {
      return new vm.SyntheticModule(
        ["initialSales", "initialClients", "initialOrders", "initialReservations", "initialPromotions"],
        function () {
          this.setExport("initialSales", [
            { id_venta: 1, folio: "B-10001", fecha: "2026-09-15", canal: "tienda fisica", forma_pago: "tarjeta", tipo_documento: "boleta", total: 61368, estado: "pagado", cliente_nombre: "Juan Pérez", cliente_rut: "15.234.567-8" },
          ]);
          this.setExport("initialClients", []);
          this.setExport("initialOrders", []);
          this.setExport("initialReservations", []);
          this.setExport("initialPromotions", []);
        },
      );
    }
    throw new Error("Unexpected import " + name);
  });
  await module.evaluate();
  return module.namespace;
}

function mockRequest(token, url = "https://erp.example.test/api/ventas/historial") {
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers({ origin: "https://erp.example.test" }),
    cookies: { get: () => token ? { value: token } : undefined },
    json: async () => ({}),
  };
}

test("Historial de ventas exige sesión", async () => {
  const route = await loadRoute("ventas/historial/route.js", () => assert.fail("Backend no debe llamarse"));
  const res = await route.GET(mockRequest(null));
  assert.equal(res.status, 401);
});

test("Historial de ventas responde con registros válidos", async () => {
  const route = await loadRoute("ventas/historial/route.js", async () => ({
    response: { status: 200 },
    result: { success: true, ventas: [{ id_venta: 1, folio: "B-10001", total: 61368 }] },
  }));
  const res = await route.GET(mockRequest("valid-token"));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.ventas.length > 0);
});

test("Los 5 reportes gerenciales de ventas responden correctamente", async () => {
  const route = await loadRoute("ventas/reportes/route.js", async () => ({
    response: { status: 200 },
    result: { success: true, reporte: [{ posicion: 1, total_vendido: 100000 }] },
  }));

  const resRanking = await route.GET(mockRequest("valid-token", "https://erp.example.test/api/ventas/reportes?tipo=ranking"));
  assert.equal(resRanking.status, 200);
  const dataRanking = await resRanking.json();
  assert.ok(dataRanking.success);

  const resProducto = await route.GET(mockRequest("valid-token", "https://erp.example.test/api/ventas/reportes?tipo=producto"));
  assert.equal(resProducto.status, 200);

  const resMora = await route.GET(mockRequest("valid-token", "https://erp.example.test/api/ventas/reportes?tipo=cuentas-cobrar"));
  assert.equal(resMora.status, 200);

  const resRotacion = await route.GET(mockRequest("valid-token", "https://erp.example.test/api/ventas/reportes?tipo=rotacion"));
  assert.equal(resRotacion.status, 200);

  const resCanales = await route.GET(mockRequest("valid-token", "https://erp.example.test/api/ventas/reportes?tipo=canales"));
  assert.equal(resCanales.status, 200);
});
