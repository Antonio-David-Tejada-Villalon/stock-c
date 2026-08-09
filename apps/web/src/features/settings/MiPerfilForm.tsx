import { useState } from "react";
import type { FormEvent } from "react";
import { Button, FormField, Input } from "@stock-c/ui";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError, changePasswordRequest, updateProfileRequest } from "../auth/api";

export function MiPerfilForm() {
  const { accessToken, user, setUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const { user: updated } = await updateProfileRequest(accessToken, {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });
      setUser(updated);
      setProfileSaved(true);
    } catch {
      setProfileError("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await changePasswordRequest(accessToken, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "wrong_current_password") {
        setPasswordError("La contraseña actual no coincide.");
      } else {
        setPasswordError("No se pudo cambiar la contraseña. Intentá de nuevo.");
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-8">
      <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-text">Mi perfil</h3>
        <FormField label="Nombre" htmlFor="p-name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Avatar (URL)" htmlFor="p-avatar" helper="Sin subida de archivos — pegá una URL">
          <Input id="p-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
        </FormField>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={profileSaving}>
            {profileSaving ? "Guardando…" : "Guardar perfil"}
          </Button>
          {profileSaved && <span className="text-xs text-success">Guardado.</span>}
        </div>
        {profileError && <p className="text-xs text-danger">{profileError}</p>}
      </form>

      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text">Cambiar contraseña</h3>
        <FormField label="Contraseña actual" htmlFor="p-current">
          <Input
            id="p-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Contraseña nueva" htmlFor="p-new">
          <Input
            id="p-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </FormField>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={passwordSaving}>
            {passwordSaving ? "Cambiando…" : "Cambiar contraseña"}
          </Button>
          {passwordSaved && <span className="text-xs text-success">Contraseña actualizada.</span>}
        </div>
        {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
      </form>
    </div>
  );
}
