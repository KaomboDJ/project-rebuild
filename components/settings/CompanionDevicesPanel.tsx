"use client";

import { useState } from "react";

interface CompanionDeviceView {
  id: string;
  deviceName: string;
  status: "active" | "revoked";
  expiresAt: string;
  lastSeenAt: string | null;
}

export function CompanionDevicesPanel({ initialDevices }: { initialDevices: CompanionDeviceView[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/companion/pairing", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.code !== "string") throw new Error();
      setCode(body.code);
      setExpiresAt(body.expiresAt);
    } catch {
      setError("Não foi possível gerar o código. A ligação segura ainda pode não estar configurada neste ambiente.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(deviceId: string) {
    if (!window.confirm("Revogar este dispositivo? A sincronização deixa de funcionar imediatamente.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/companion/devices/${deviceId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setDevices((current) => current.map((device) => device.id === deviceId ? { ...device, status: "revoked" } : device));
    } catch {
      setError("Não foi possível revogar o dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <p className="text-sm font-medium text-neutral-100">Ligar o Rebuild Companion</p>
        <p className="mt-1 text-sm text-neutral-400">
          Gera um código de utilização única, válido durante 5 minutos. O código deixa de funcionar depois do primeiro emparelhamento.
        </p>
        {code ? (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className="rounded-xl border border-emerald-400/30 bg-black/30 px-4 py-3 font-mono text-lg tracking-widest text-emerald-300"
              onClick={() => navigator.clipboard.writeText(code)}
              title="Copiar código"
            >
              {code}
            </button>
            <p className="text-xs text-neutral-500">
              Expira {expiresAt ? new Date(expiresAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "em breve"}. Toca no código para copiar.
            </p>
          </div>
        ) : (
          <button type="button" className="btn-primary mt-3" onClick={createCode} disabled={busy}>
            {busy ? "A gerar…" : "Gerar código de emparelhamento"}
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}

      {devices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Dispositivos emparelhados</p>
          {devices.map((device) => (
            <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3">
              <div>
                <p className="text-sm font-medium text-neutral-100">{device.deviceName}</p>
                <p className="text-xs text-neutral-500">
                  {device.status === "active" ? "Ativo" : "Revogado"}
                  {device.lastSeenAt ? ` · visto ${new Date(device.lastSeenAt).toLocaleString("pt-PT")}` : " · ainda sem sincronização"}
                </p>
              </div>
              {device.status === "active" && (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => revoke(device.id)}>
                  Revogar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
