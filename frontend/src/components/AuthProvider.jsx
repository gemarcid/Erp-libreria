"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AuthContext = createContext(null);

function clearLegacyStorage() {
  try {
    localStorage.removeItem("nombre_usuario");
    localStorage.removeItem("id_rol");
  } catch {
    // La sesión actual funciona incluso si el navegador bloquea localStorage.
  }
}

export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);

  const refreshSession = useCallback(() => {
    const currentRevision = ++revision.current;
    return fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (currentRevision !== revision.current) return;
        if (response.status === 401) {
          setUsuario(null);
          setError("");
          clearLegacyStorage();
        } else if (!response.ok) {
          setError(result.error || "No se pudo comprobar tu sesión.");
        } else {
          setUsuario(result.usuario);
          setError("");
        }
      })
      .catch(() => {
        if (currentRevision === revision.current) {
          setError("No se pudo comprobar tu sesión. Intenta nuevamente.");
        }
      })
      .finally(() => {
        if (currentRevision === revision.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    refreshSession();
    window.addEventListener("focus", refreshSession);
    return () => window.removeEventListener("focus", refreshSession);
  }, [refreshSession]);

  async function login(email, password, newPassword) {
    ++revision.current;
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, newPassword }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 428) setUsuario(null);
      const failure = new Error(result.error || "No se pudo iniciar sesión.");
      failure.requiereCambio = result.requiereCambio === true;
      throw failure;
    }
    ++revision.current;
    clearLegacyStorage();
    setUsuario(result.usuario);
    setError("");
    setLoading(false);
  }

  async function logout() {
    ++revision.current;
    const response = await fetch("/api/auth", { method: "DELETE" });
    if (!response.ok)
      throw new Error("No se pudo cerrar sesión. Intenta nuevamente.");
    ++revision.current;
    clearLegacyStorage();
    setUsuario(null);
    setError("");
  }

  const partes = (usuario?.nombre || "").trim().split(/\s+/).filter(Boolean);
  const iniciales =
    partes.length > 1
      ? (partes[0][0] + partes[1][0]).toLocaleUpperCase("es")
      : (partes[0] || "").slice(0, 2).toLocaleUpperCase("es");

  return (
    <AuthContext.Provider
      value={{
        usuario,
        iniciales,
        loading,
        error,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
}
