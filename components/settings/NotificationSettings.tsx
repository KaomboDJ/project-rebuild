"use client";

import { useEffect, useState } from "react";

interface Preferences {
  enabled: boolean;
  daily_briefing: boolean;
  decision_reminders: boolean;
  nutrition_reminders: boolean;
  briefing_time: string;
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

export function NotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const browserSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(browserSupported);
    if (!browserSupported) {
      setState("idle");
      return;
    }
    fetch("/api/notifications")
      .then((response) => response.json())
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setPublicKey(data.publicKey ?? null);
        setSubscribed(Boolean(data.subscribed));
        setPreferences(data.preferences);
        setState("idle");
      })
      .catch(() => setState("error"));
  }, []);

  async function enableNotifications() {
    if (!publicKey) return;
    setState("saving");
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("As notificações ficaram bloqueadas no navegador. Podes autorizá-las nas definições do site.");
        setState("idle");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey),
      });
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("save-failed");
      setSubscribed(true);
      setMessage("Notificações ativas. O teu horário de sono continua sempre protegido.");
      setState("idle");
    } catch {
      setMessage("Não foi possível ativar neste dispositivo. Em iPhone, instala primeiro o Rebuild no ecrã principal.");
      setState("error");
    }
  }

  async function disableNotifications() {
    setState("saving");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await fetch(`/api/notifications${subscription ? `?endpoint=${encodeURIComponent(subscription.endpoint)}` : ""}`, { method: "DELETE" });
      await subscription?.unsubscribe();
      setSubscribed(false);
      setMessage("Notificações desativadas neste dispositivo.");
      setState("idle");
    } catch {
      setState("error");
      setMessage("Não foi possível desativar. Tenta novamente.");
    }
  }

  async function savePreferences(next: Preferences) {
    setPreferences(next);
    setState("saving");
    const response = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: next.enabled,
        dailyBriefing: next.daily_briefing,
        decisionReminders: next.decision_reminders,
        nutritionReminders: next.nutrition_reminders,
        briefingTime: next.briefing_time.slice(0, 5),
      }),
    });
    setState(response.ok ? "idle" : "error");
    setMessage(response.ok ? "Preferências guardadas." : "Não foi possível guardar as preferências.");
  }

  if (state === "loading") return <p className="text-sm text-neutral-400">A verificar este dispositivo…</p>;
  if (!supported) return <p className="text-sm text-neutral-400">Este navegador não suporta notificações Web Push.</p>;
  if (!configured) return <p className="text-sm text-neutral-400">As notificações ainda não estão configuradas neste ambiente.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3">
        <div>
          <p className="text-sm font-medium">Este dispositivo</p>
          <p className="text-xs text-neutral-400">{subscribed ? "A receber notificações" : "Notificações desligadas"}</p>
        </div>
        <button
          type="button"
          disabled={state === "saving"}
          onClick={subscribed ? disableNotifications : enableNotifications}
          className={subscribed ? "btn-secondary" : "btn-primary"}
        >
          {subscribed ? "Desativar" : "Ativar notificações"}
        </button>
      </div>

      {subscribed && preferences && (
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            Resumo do dia
            <input type="checkbox" checked={preferences.daily_briefing} onChange={(event) => savePreferences({ ...preferences, daily_briefing: event.target.checked })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Lembretes de decisões
            <input type="checkbox" checked={preferences.decision_reminders} onChange={(event) => savePreferences({ ...preferences, decision_reminders: event.target.checked })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Planeamento alimentar
            <input type="checkbox" checked={preferences.nutrition_reminders} onChange={(event) => savePreferences({ ...preferences, nutrition_reminders: event.target.checked })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Hora preferida do resumo
            <input className="field-input w-32" type="time" value={preferences.briefing_time.slice(0, 5)} onChange={(event) => savePreferences({ ...preferences, briefing_time: event.target.value })} />
          </label>
        </div>
      )}

      <p aria-live="polite" className={`text-xs ${state === "error" ? "text-rose-400" : "text-emerald-400"}`}>{message}</p>
      <p className="text-xs text-neutral-500">
        O Rebuild nunca envia lembretes durante o teu período de desaceleração ou sono. No iPhone, Web Push requer a app instalada no ecrã principal.
      </p>
    </div>
  );
}
