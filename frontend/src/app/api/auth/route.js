import { NextResponse } from "next/server";
import { requestBackend } from "@/lib/auth-backend";

const SESSION_COOKIE = "erp_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clearSession(response) {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

function isSameOrigin(request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

function publicUser(user) {
  if (!user?.id_usuario || !user?.id_rol || !user?.nombre || !user?.rol) {
    throw new Error("El backend no devolvió un usuario válido.");
  }
  return {
    id_usuario: String(user.id_usuario),
    id_rol: String(user.id_rol),
    nombre: user.nombre,
    correo: user.correo,
    rol: user.rol,
    ...(user.permisos && { permisos: user.permisos }),
  };
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return json({ error: "Solicitud de acceso no válida." }, 403);
  }

  let credentials;
  try {
    credentials = await request.json();
  } catch {
    return json({ error: "Los datos enviados no son válidos." }, 400);
  }

  if (
    typeof credentials?.email !== "string" ||
    !credentials.email.trim() ||
    credentials.email.trim().length > 100 ||
    typeof credentials.password !== "string" ||
    !credentials.password
  ) {
    return json({ error: "Ingresa el correo y la contraseña." }, 400);
  }

  try {
    const changing = typeof credentials.newPassword === "string";
    const { response, result } = await requestBackend(changing ? "CambiarPassword" : "Ingresar", {
      method: "POST",
      body: new URLSearchParams({
        email: credentials.email.trim(),
        password: credentials.password,
        ...(changing && { newPassword: credentials.newPassword }),
      }),
    });

    if (!response.ok || !result.success) {
      if (response.status === 428) {
        return clearSession(json({ error: result.error, requiereCambio: true }, 428));
      }
      if (changing && [400, 409].includes(response.status)) {
        return json({ error: result.error || "No se pudo renovar la contraseña." }, response.status);
      }
      const invalid = response.status === 400 || response.status === 401;
      return clearSession(
        json(
          {
            error: invalid
              ? "Correo o contraseña incorrectos."
              : "El servicio de acceso no está disponible.",
          },
          invalid ? response.status : 503,
        ),
      );
    }

    if (
      typeof result.sessionToken !== "string" ||
      !result.sessionToken ||
      !Number.isInteger(result.expiresIn) ||
      result.expiresIn <= 0
    ) {
      throw new Error("El backend no devolvió una sesión válida.");
    }

    const outgoing = json({ usuario: publicUser(result.usuario) });
    outgoing.cookies.set(SESSION_COOKIE, result.sessionToken, {
      ...cookieOptions,
      maxAge: Math.min(result.expiresIn, 8 * 60 * 60),
    });
    return outgoing;
  } catch {
    return json(
      {
        error:
          "No se pudo conectar con el backend. Verifica que esté iniciado.",
      },
      503,
    );
  }
}

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return clearSession(json({ usuario: null }, 401));
  }

  try {
    const { response, result } = await requestBackend("Sesion", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      return clearSession(json({ usuario: null }, 401));
    }
    if (!response.ok || !result.success) {
      return json(
        { error: "No se pudo comprobar tu sesión. Intenta nuevamente." },
        503,
      );
    }
    return json({ usuario: publicUser(result.usuario) });
  } catch {
    return json(
      { error: "No se pudo conectar con el backend. Intenta nuevamente." },
      503,
    );
  }
}

export async function DELETE(request) {
  if (!isSameOrigin(request)) {
    return json({ error: "Solicitud de cierre de sesión no válida." }, 403);
  }
  return clearSession(json({ success: true }));
}
