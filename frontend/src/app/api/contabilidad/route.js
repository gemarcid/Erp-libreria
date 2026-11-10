import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";

export async function GET(request) {
  const token = request.cookies.get("erp_session")?.value;
  const json = (body, status) => NextResponse.json(body, {
    status, headers: { "Cache-Control": "no-store" },
  });
  if (!token) return json({ error: "Debes iniciar sesión." }, 401);
  try {
    const { response, result } = await requestVentasBackend("/Contabilidad/Diario", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return json(result, response.status);
  } catch {
    return json({ error: "No se pudo conectar con contabilidad." }, 503);
  }
}

const operations = new Map([
  ["account", "Cuenta"],
  ["automatic", "Automatica"],
  ["period", "Periodo"],
  ["manual", "Manual"],
]);

export async function POST(request) {
  const json = (body, status) => NextResponse.json(body, {
    status, headers: { "Cache-Control": "no-store" },
  });
  const token = request.cookies.get("erp_session")?.value;
  if (!token) return json({ error: "Debes iniciar sesión." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "Solicitud contable no válida." }, 403);
  }
  const body = await request.json().catch(() => null);
  const action = operations.get(body?.operation);
  if (!action || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return json({ error: "Los datos contables no son válidos." }, 400);
  }
  try {
    const { response, result } = await requestVentasBackend("/Contabilidad/" + action, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
    });
    return json(result, response.status);
  } catch {
    return json({ error: "No se pudo confirmar la operación contable." }, 503);
  }
}
