export function isCliente(usuario) {
  return (usuario?.rol || "").trim().toLowerCase() === "cliente";
}

export function canOpenModule(usuario, module) {
  return moduleAccessLevel(usuario, module) > 0;
}

export function moduleAccessLevel(usuario, module) {
  if (usuario?.permisos) return usuario.permisos[module] ?? 0;
  const role = (usuario?.rol || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["administrador", "administradora", "admin"].includes(role)) {
    return 3;
  }
  if (module === "perfil") return ["cliente", "comprador", "compradora", "vendedor", "vendedora", "contador", "contadora"].includes(role) ? 2 : 0;

  if (role === "cliente") return module === "catalogo" ? 1 : 0;

  if (module === "contabilidad") {
    return ["contador", "contadora"].includes(role) ? 3 : 0;
  }

  if (module === "ventas") {
    return ["vendedor", "vendedora"].includes(role) ? 2 : 0;
  }

  if (module === "compras") {
    return ["comprador", "compradora"].includes(role) ? 2 : 0;
  }

  if (module === "inventario") {
    return ["comprador", "compradora", "vendedor", "vendedora", "contador", "contadora"].includes(role) ? 1 : 0;
  }

  return 0;
}
