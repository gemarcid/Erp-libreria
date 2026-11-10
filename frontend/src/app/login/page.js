"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ErpIcon from "@/components/ErpIcon";
import { useAuth } from "@/components/AuthProvider";
import "../erp.css";

function LoginField({ id, label, icon, children }) {
  return (
    <div className="erp-login-field">
      <label htmlFor={id}>{label}</label>
      <div className="erp-input-wrap">
        {icon && <ErpIcon name={icon} />}
        {children}
      </div>
    </div>
  );
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [renewing, setRenewing] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("");

    try {
      if (renewing && form.get("newPassword") !== form.get("confirmPassword")) {
        throw new Error("Las contraseñas nuevas no coinciden.");
      }
      if (registering) {
        if (form.get("password") !== form.get("confirmPassword")) throw new Error("Las contraseñas no coinciden.");
        const response = await fetch("/api/auth/registro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: form.get("nombre"), email: form.get("email"), password: form.get("password"), rut: form.get("rut") }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudo crear la cuenta.");
      }
      await login(form.get("email"), form.get("password"), renewing ? form.get("newPassword") : undefined);
      router.replace("/");
    } catch (error) {
      if (error.requiereCambio) {
        setRegistering(false);
        setRenewing(true);
      }
      setMessage(error.message || "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={"erp-screen erp-login" + (registering || renewing ? " erp-login-register" : "")} lang="es">
      <section className="erp-login-story" aria-label="Librería ERP">
        <Link href="/" className="erp-brand">
          <span className="erp-brand-icon">
            <ErpIcon name="book" />
          </span>
          <span>
            Librería <b>ERP</b>
            <small>SISTEMA DE GESTIÓN</small>
          </span>
        </Link>
        <div className="erp-story-content">
          <p className="erp-eyebrow">
            CADA LIBRO CUENTA. CADA DETALLE TAMBIÉN.
          </p>
          <h1>
            Todo lo que tu
            <br />{" "}
            librería necesita,
            <br />{" "}
            <em>en un solo lugar.</em>
          </h1>
          <p>
            Conecta tus compras, ventas, inventario y contabilidad. Más tiempo
            para las historias, menos para los pendientes.
          </p>
          <div className="erp-book-preview" aria-hidden="true">
            <div className="erp-book-illustration">
              <div className="erp-illustration-circle" />
              <div className="erp-illustrated-book book-one">
                <span>HISTORIAS<br />QUE CRECEN</span>
                <ErpIcon name="book" />
              </div>
              <div className="erp-illustrated-book book-two">
                <span>UN NUEVO<br />CAPÍTULO</span>
                <span className="erp-book-orbit" />
              </div>
              <div className="erp-illustrated-book book-three">
                <span>EL ARTE<br />DE LEER</span>
                <ErpIcon name="book" />
              </div>
              <div className="erp-book-shelf" />
            </div>
          </div>
        </div>
      </section>
      <section className="erp-login-form-panel" aria-labelledby="login-title">
        <div className="erp-login-form-wrap">
          <span className="erp-login-emblem">
            <ErpIcon name="book" />
          </span>
          <p className="erp-eyebrow">{registering ? "TU CUENTA DE CLIENTE" : renewing ? "SEGURIDAD DE TU CUENTA" : "BIENVENIDO DE NUEVO"}</p>
          <h2 id="login-title">{registering ? "Regístrate como cliente" : renewing ? "Renueva tu contraseña" : "Inicia sesión"}</h2>
          <p className="erp-login-intro">
            {registering ? "Crea tu cuenta para acceder a tus módulos de cliente." : renewing ? "Confirma tu contraseña actual y elige una nueva." : "Ingresa tus datos para acceder a tu espacio de trabajo."}
          </p>
          <form onSubmit={handleSubmit} className="erp-login-form">
            <div className="erp-login-fields">
              {registering && <>
                <LoginField id="nombre" label="Nombre completo">
                  <input id="nombre" name="nombre" autoComplete="name" maxLength={100} required disabled={submitting} />
                </LoginField>
                <LoginField id="rut" label="RUT del cliente" icon="user">
                  <input id="rut" name="rut" placeholder="Ejemplo: 12.345.678-5" maxLength={15}
                    required disabled={submitting} onChange={() => setMessage("")} />
                </LoginField>
              </>}
              <LoginField id="email" label="Correo electrónico" icon="mail">
                <input id="email" name="email" type="email" placeholder="tu.correo@libreria.cl"
                  autoComplete="username" maxLength={100} required onChange={() => setMessage("")} />
              </LoginField>
              <LoginField id="password" label={renewing ? "Contraseña actual" : "Contraseña"} icon="lock">
                <input id="password" name="password" type={showPassword ? "text" : "password"}
                  placeholder={registering ? "Al menos 8 caracteres" : "Ingresa tu contraseña"}
                  autoComplete={registering ? "new-password" : "current-password"}
                  minLength={registering ? 8 : undefined} required onChange={() => setMessage("")} />
                <button type="button" className="erp-password-toggle"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                  <ErpIcon name={showPassword ? "eyeOff" : "eye"} />
                </button>
              </LoginField>
              {renewing && (
                <LoginField id="newPassword" label="Nueva contraseña" icon="lock">
                  <input id="newPassword" name="newPassword" type="password" placeholder="Al menos 8 caracteres"
                    autoComplete="new-password" minLength={8} required disabled={submitting} />
                </LoginField>
              )}
              {(registering || renewing) && (
                <LoginField id="confirmPassword" label="Confirmar contraseña" icon="lock">
                  <input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"}
                    autoComplete="new-password" minLength={8} required disabled={submitting} />
                </LoginField>
              )}
            </div>
            {message && (
              <p id="login-message" className="erp-login-message" role="status">
                {message}
              </p>
            )}
            <div className="erp-login-actions">
              <button className="erp-primary-button" type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? "Procesando…" : registering ? "Crear cuenta" : renewing ? "Renovar e ingresar" : "Ingresar"}
                <ErpIcon name="arrow" />
              </button>
              <button type="button" className="erp-login-switch" disabled={submitting}
                onClick={() => { setRegistering(!registering && !renewing); setRenewing(false); setMessage(""); }}>
                {registering || renewing ? "Volver a iniciar sesión" : "¿Eres nuevo? Regístrate como cliente"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
