import { NextResponse } from "next/server";
import { requestVentasBackend } from "@/lib/ventas-backend";

const json = (body, status) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});

async function forward(request, path, options = {}) {
  const token = request.cookies.get("erp_session")?.value;
  if (!token) return json({ error: "Debes iniciar sesión." }, 401);
  try {
    const { response, result } = await requestVentasBackend("/Administracion/" + path, {
      ...options, headers: { Authorization: "Bearer " + token },
    });
    return json(result, response.status);
  } catch {
    return json({ error: "No se pudo conectar con Administración." }, 503);
  }
}

export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const view = params.get("vista");
  if (view === "perfiles") return forward(request, "Roles");
  if (!["accesos", "operaciones", "actividad"].includes(view)) return json({ error: "Consulta no válida." }, 400);
  const query = new URLSearchParams({ vista: view });
  for (const key of ["desde", "hasta", "modulo", "buscar", "resultado", "pagina"]) {
    if (params.has(key)) query.set(key, params.get(key));
  }
  return forward(request, "Eventos?" + query);
}

export async function POST(request) {
  if (!request.cookies.get("erp_session")?.value) return json({ error: "Debes iniciar sesión." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Solicitud no válida." }, 403);
  const data = await request.json().catch(() => null);
  if (!Number.isInteger(data?.idRol) || data.idRol < 1) return json({ error: "Perfil no válido." }, 400);
  if (data.operacion === "permiso" && typeof data.modulo === "string" && Number.isInteger(data.nivel)) {
    return forward(request, "GuardarPermiso", {
      method: "POST", body: new URLSearchParams({ idRol: data.idRol, modulo: data.modulo, nivel: data.nivel }),
    });
  }
  if (data.operacion === "perfil" && typeof data.descripcion === "string") {
    return forward(request, "GuardarRol", {
      method: "POST", body: new URLSearchParams({ idRol: data.idRol, descripcion: data.descripcion }),
    });
  }
  return json({ error: "Operación no válida." }, 400);
}
