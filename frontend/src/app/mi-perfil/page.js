"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ErpModuleShell from "@/components/ErpModuleShell";
import { canOpenModule } from "@/lib/module-access";

export default function MiPerfil() {
  const { usuario, refreshSession, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!usuario || !canOpenModule(usuario, "perfil")) return;
    const controller = new AbortController();
    fetch("/api/cliente/perfil", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setProfile(result); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [usuario]);
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const data = Object.fromEntries(new FormData(formElement));
    if (data.password !== data.confirmPassword) { setError("Las contraseñas nuevas no coinciden."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cliente/perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProfile({ ...profile, nombre: data.nombre, correo: data.correo });
      formElement.reset();
      if (data.password) await login(data.correo, data.password);
      else await refreshSession();
      setMessage("Tu perfil se actualizó correctamente.");
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <ErpModuleShell module="perfil" title="Mi perfil" description="Administra tus datos personales y tu contraseña." liveData>
    <section className="erp-card module-panel">
      <div className="erp-section-heading account-profile-heading"><div><p className="erp-eyebrow">MI CUENTA</p><h2>Datos personales</h2></div>{profile?.rut && <span className="account-loyalty">{profile.puntosFidelidad} puntos de fidelidad</span>}</div>
      {error && <p className="ventas-message ventas-message-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      {!profile ? !error && <p role="status">Cargando perfil…</p> : <form onSubmit={save} className="account-form" key={`${profile.nombre}-${profile.correo}`}>
        <label>Nombre<input name="nombre" defaultValue={profile.nombre} maxLength={100} required autoComplete="name" /></label>
        <label>Correo<input name="correo" type="email" defaultValue={profile.correo} maxLength={100} required autoComplete="email" /></label>
        {profile.rut && <>
          <label>RUT<input value={profile.rut} readOnly /></label>
          <label>Tipo de cliente<input value={{ persona: "Persona", colegio: "Colegio", empresa: "Empresa" }[profile.tipoCliente] || profile.tipoCliente} readOnly /><small>Administrado por la librería.</small></label>
        </>}
        <label>Contraseña actual<input name="passwordActual" type="password" required autoComplete="current-password" /></label>
        <label>Nueva contraseña (opcional)<input name="password" type="password" minLength={8} autoComplete="new-password" /></label>
        <label>Confirmar nueva contraseña<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" /></label>
        <div className="account-form-footer"><span className="account-form-hint">Confirma tu contraseña actual para guardar los cambios. La nueva contraseña es opcional.</span><button className="module-primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar perfil"}</button></div>
      </form>}
    </section>
  </ErpModuleShell>;
}
