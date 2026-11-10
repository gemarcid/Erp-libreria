const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { NextResponse } = require("next/server");

async function load(file, backend) {
  const mod = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, "../src", file), "utf8"));
  await mod.link(async (specifier) => {
    if (specifier === "next/server") return new vm.SyntheticModule(["NextResponse"], function () { this.setExport("NextResponse", NextResponse); });
    const name = specifier === "@/lib/auth-backend" ? "requestBackend" : "requestVentasBackend";
    return new vm.SyntheticModule([name], function () { this.setExport(name, backend); });
  });
  await mod.evaluate();
  return mod.namespace;
}
function request(data, token, origin = "http://localhost:3000") {
  return { url: "http://localhost:3000/api/example", headers: new Headers({ origin }),
    cookies: { get: () => token ? { value: token } : undefined }, json: async () => data };
}
const context = (action) => ({ params: Promise.resolve({ action }) });
const customer = { nombre: "Cliente", email: "cliente@example.test", password: "Password123!", rut: "12345678-5", tipoCliente: "persona" };
const upstream = (status, result) => ({ response: { status, ok: status >= 200 && status < 300 }, result });

test("El registro público omite los permisos solicitados y transmite los datos de Ventas", async () => {
  const route = await load("app/api/auth/registro/route.js", async (action, options) => {
    assert.equal(action, "Registrar");
    assert.equal(options.body.get("rut"), customer.rut);
    assert.equal(options.body.has("tipoCliente"), false);
    assert.equal(options.body.has("idRol"), false);
    assert.equal(options.body.has("estado"), false);
    return upstream(201, { success: true });
  });
  const result = await route.POST(request({ ...customer, idRol: 1, estado: "activo" }));
  assert.equal(result.status, 201);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await result.json(), { success: true });
});
test("El registro valida origen, RUT, correo y tamaño UTF-8 de la contraseña", async () => {
  const route = await load("app/api/auth/registro/route.js", () => assert.fail("No debe consultar el backend"));
  assert.equal((await route.POST(request(customer, undefined, "http://otro.test"))).status, 403);
  for (const data of [null, {}, { ...customer, rut: "" }, { ...customer, email: "invalido" }, { ...customer, password: "á".repeat(37) }])
    assert.equal((await route.POST(request(data))).status, 400);
});
test("El registro conserva correos o RUT duplicados y errores de conexión", async () => {
  const duplicate = await load("app/api/auth/registro/route.js", async () => upstream(409, { error: "RUT duplicado" }));
  assert.equal((await duplicate.POST(request(customer))).status, 409);
  const offline = await load("app/api/auth/registro/route.js", async () => { throw new Error("Offline"); });
  assert.equal((await offline.POST(request(customer))).status, 503);
});
test("Administración exige sesión, origen válido y conserva la prohibición del backend", async () => {
  const route = await load("app/api/administracion/usuarios/route.js", async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer cliente-token");
    return upstream(403, { error: "Sin acceso" });
  });
  assert.equal((await route.GET(request({}))).status, 401);
  assert.equal((await route.POST(request({}, "token", "http://otro.test"))).status, 403);
  assert.equal((await route.GET(request({}, "cliente-token"))).status, 403);
});
test("Guardar usuarios envía perfil y datos de cliente sin campos ajenos", async () => {
  const route = await load("app/api/administracion/usuarios/route.js", async (url, options) => {
    assert.equal(url, "/Administracion/Guardar");
    assert.equal(options.body.get("idRol"), "5");
    assert.equal(options.body.get("rut"), customer.rut);
    assert.equal(options.body.has("password_hash"), false);
    return upstream(200, { success: true });
  });
  assert.equal((await route.POST(request({ nombre: customer.nombre, correo: customer.email, idRol: 5, rut: customer.rut, tipoCliente: "persona", password_hash: "injected" }, "admin-token"))).status, 200);
});
test("Mi perfil nunca envía identificadores de otro usuario, roles ni puntos de fidelidad", async () => {
  const route = await load("app/api/cliente/[action]/route.js", async (url, options) => {
    assert.equal(url, "/Cliente/GuardarPerfil");
    for (const field of ["id", "idRol", "puntosFidelidad", "rut", "tipoCliente"]) assert.equal(options.body.has(field), false);
    return upstream(200, { success: true });
  });
  assert.equal((await route.POST(request({ nombre: "Cliente", id: 1, idRol: 1, puntosFidelidad: 9999, rut: "otro", tipoCliente: "empresa" }, "client"), context("perfil"))).status, 200);
  assert.equal((await route.GET(request({}, "client"), context("administracion"))).status, 404);
  assert.equal((await route.GET(request({}), context("catalogo"))).status, 401);
});
test("El cliente solo puede abrir Catálogo y Mi perfil; los roles existentes conservan sus accesos", async () => {
  const { canOpenModule, isCliente } = await load("lib/module-access.js");
  const client = { rol: "Cliente" };
  assert.equal(isCliente(client), true);
  for (const module of ["catalogo", "perfil"]) assert.equal(canOpenModule(client, module), true);
  for (const module of ["compras", "ventas", "inventario", "contabilidad", "administracion", "dashboard"]) assert.equal(canOpenModule(client, module), false);
  assert.equal(canOpenModule({ rol: "Administrador" }, "administracion"), true);
  assert.equal(canOpenModule({ rol: "Contador" }, "contabilidad"), true);
  assert.equal(canOpenModule({ rol: "Vendedor" }, "ventas"), true);
  assert.equal(canOpenModule({ rol: "Comprador" }, "compras"), true);
  for (const rol of ["Administrador", "Comprador", "Vendedor", "Contador", "Cliente"])
    assert.equal(canOpenModule({ rol }, "perfil"), true);
});

test("Los permisos de la sesión prevalecen sobre el nombre del rol", async () => {
  const { canOpenModule, moduleAccessLevel } = await load("lib/module-access.js");
  const seller = { rol: "Vendedor", permisos: { ventas: 0, compras: 1 } };
  assert.equal(canOpenModule(seller, "ventas"), false);
  assert.equal(canOpenModule(seller, "compras"), true);
  assert.equal(moduleAccessLevel(seller, "compras"), 1);
});

test("La matriz conserva el control de origen y sólo transmite los campos autorizados", async () => {
  const route = await load("app/api/administracion/seguridad/route.js", async (url, options) => {
    assert.equal(url, "/Administracion/GuardarPermiso");
    assert.equal(options.headers.Authorization, "Bearer admin");
    assert.deepEqual(Object.fromEntries(options.body), { idRol: "3", modulo: "ventas", nivel: "1" });
    return upstream(200, { success: true });
  });
  const data = { operacion: "permiso", idRol: 3, modulo: "ventas", nivel: 1, correo: "extra@example.test" };
  assert.equal((await route.POST(request(data))).status, 401);
  assert.equal((await route.POST(request(data, "admin", "http://otro.test"))).status, 403);
  assert.equal((await route.POST(request(data, "admin"))).status, 200);
});

test("Un acceso vencido solicita renovación y sólo emite cookie cuando el cambio se confirma", async () => {
  const route = await load("app/api/auth/route.js", async (action, options) => {
    if (action === "Ingresar") return upstream(428, { error: "Tu contraseña venció." });
    assert.equal(action, "CambiarPassword");
    assert.equal(options.body.get("newPassword"), "Nueva-clave-123!");
    return upstream(200, { success: true, sessionToken: "new-token", expiresIn: 3600,
      usuario: { id_usuario: 7, id_rol: 3, nombre: "Vendedor", rol: "Vendedor", permisos: { ventas: 1 } } });
  });
  const credentials = { email: "vendedor@example.test", password: "Anterior-123!" };
  const expired = await route.POST(request(credentials));
  assert.equal(expired.status, 428);
  assert.equal((await expired.json()).requiereCambio, true);
  assert.match(expired.headers.get("set-cookie"), /Max-Age=0/);
  const renewed = await route.POST(request({ ...credentials, newPassword: "Nueva-clave-123!" }));
  assert.equal(renewed.status, 200);
  assert.match(renewed.headers.get("set-cookie"), /erp_session=new-token/);
  assert.deepEqual((await renewed.json()).usuario.permisos, { ventas: 1 });
});
