import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input, Select, Switch } from "@stock-c/ui";
import { SYSTEM_ROLE_NAMES, type TeamUser } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createTeamUser, deleteTeamUser, updateTeamUser } from "./api";

function randomPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

// "Visor" — el rol de menor privilegio, default seguro para un usuario nuevo.
const DEFAULT_ROLE = SYSTEM_ROLE_NAMES[SYSTEM_ROLE_NAMES.length - 1]!;

export interface TeamUserFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamUser?: TeamUser;
  onSaved: () => void;
}

export function TeamUserFormDrawer({ open, onOpenChange, teamUser, onSaved }: TeamUserFormDrawerProps) {
  const { accessToken } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState<string>(DEFAULT_ROLE);
  const [active, setActive] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState("");

  // Se completa recién al crear un usuario: mientras esté seteado, el drawer
  // muestra la pantalla de confirmación en vez del formulario, para que la
  // contraseña generada no se pierda si el admin cierra sin copiarla.
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(teamUser?.name ?? "");
      setEmail(teamUser?.email ?? "");
      setPassword(randomPassword());
      setRoleName(teamUser?.roleName ?? DEFAULT_ROLE);
      setActive(teamUser?.active ?? true);
      setNameError(null);
      setSubmitError(null);
      setResettingPassword(false);
      setResetPassword("");
      setCreatedCredentials(null);
      setCopied(false);
    }
  }, [open, teamUser]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!name.trim()) {
      setNameError("El nombre es obligatorio");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (teamUser) {
        await updateTeamUser(accessToken, teamUser.id, {
          version: teamUser.version,
          name: name.trim(),
          email: email.trim(),
          roleName,
          active,
          password: resettingPassword && resetPassword ? resetPassword : undefined,
        });
        onSaved();
        onOpenChange(false);
      } else {
        const createdEmail = email.trim();
        await createTeamUser(accessToken, { name: name.trim(), email: createdEmail, password, roleName });
        onSaved();
        setCreatedCredentials({ email: createdEmail, password });
      }
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "duplicate_email") {
        setSubmitError("Ya existe un usuario con ese email.");
      } else if (err instanceof ApiAuthError && err.code === "cannot_deactivate_self") {
        setSubmitError("No podés desactivar tu propio usuario.");
      } else if (err instanceof ApiAuthError && err.code === "cannot_delete_self") {
        setSubmitError("No podés eliminar tu propio usuario.");
      } else if (err instanceof ApiAuthError && err.code === "last_admin") {
        setSubmitError("Es el único usuario Admin activo — la empresa quedaría sin administrador.");
      } else if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setSubmitError("Este usuario cambió desde que lo abriste. Cerrá y volvé a intentar.");
      } else {
        setSubmitError("No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!accessToken || !teamUser) return;
    if (!confirm(`¿Eliminar definitivamente a "${teamUser.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setSubmitError(null);
    try {
      await deleteTeamUser(accessToken, teamUser.id);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "cannot_delete_self") {
        setSubmitError("No podés eliminar tu propio usuario.");
      } else if (err instanceof ApiAuthError && err.code === "last_admin") {
        setSubmitError("Es el único usuario Admin activo — la empresa quedaría sin administrador.");
      } else {
        setSubmitError("No se pudo eliminar. Intentá de nuevo.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleCopy() {
    if (!createdCredentials) return;
    await navigator.clipboard.writeText(
      `Email: ${createdCredentials.email}\nContraseña: ${createdCredentials.password}`,
    );
    setCopied(true);
  }

  if (createdCredentials) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title="Usuario creado"
        footer={
          <div className="flex justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-secondary">
            Comunicale estas credenciales por fuera del sistema — no hay envío de email automático, y esta
            contraseña no se puede volver a ver una vez que cierres esta ventana.
          </p>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-bg-sunken p-3 font-mono text-[13px]">
            <div>
              <span className="text-text-tertiary">Email: </span>
              {createdCredentials.email}
            </div>
            <div>
              <span className="text-text-tertiary">Contraseña: </span>
              {createdCredentials.password}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
              Copiar
            </Button>
            {copied && <span className="text-xs text-success">Copiado.</span>}
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={teamUser ? "Editar usuario" : "Nuevo usuario"}
      footer={
        <div className="flex justify-between gap-2">
          {teamUser ? (
            <Button variant="danger" type="button" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? "Eliminando…" : "Eliminar usuario"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="team-user-form" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar usuario"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="team-user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="tu-name" error={nameError ?? undefined}>
          <Input id="tu-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>

        <FormField label="Email" htmlFor="tu-email">
          <Input id="tu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </FormField>

        {!teamUser && (
          <FormField
            label="Contraseña inicial"
            htmlFor="tu-password"
            helper="Al guardar te la vuelvo a mostrar para que se la comuniques al usuario — no hay envío de email automático."
          >
            <div className="flex gap-2">
              <Input id="tu-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
              <Button type="button" variant="secondary" onClick={() => setPassword(randomPassword())}>
                Generar
              </Button>
            </div>
          </FormField>
        )}

        <FormField label="Rol" htmlFor="tu-role">
          <Select id="tu-role" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
            {SYSTEM_ROLE_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </FormField>

        {teamUser && (
          <>
            <div className="flex items-center gap-2">
              <Switch id="tu-active" checked={active} onCheckedChange={setActive} />
              <label htmlFor="tu-active" className="text-[13px] text-text-secondary">
                Usuario activo
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {!resettingPassword ? (
                <button
                  type="button"
                  className="self-start text-[13px] text-accent hover:underline"
                  onClick={() => {
                    setResettingPassword(true);
                    setResetPassword(randomPassword());
                  }}
                >
                  Restablecer contraseña…
                </button>
              ) : (
                <FormField
                  label="Nueva contraseña"
                  htmlFor="tu-reset-password"
                  helper="Se aplica al guardar. Comunicásela al usuario por fuera del sistema."
                >
                  <div className="flex gap-2">
                    <Input
                      id="tu-reset-password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      minLength={8}
                    />
                    <Button type="button" variant="secondary" onClick={() => setResetPassword(randomPassword())}>
                      Generar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setResettingPassword(false);
                        setResetPassword("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </FormField>
              )}
            </div>
          </>
        )}

        {submitError && <p className="text-xs text-danger">{submitError}</p>}
      </form>
    </Drawer>
  );
}
