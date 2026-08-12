import Link from "next/link";
import {
  Activity,
  Bell,
  Brain,
  CalendarCheck2,
  LogOut,
  Mail,
  ShieldCheck,
  Star,
  UserCog,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import {
  disconnectGoogleCalendar,
  disconnectMicrosoftAccount,
  refreshCalendarSources,
  setPrimaryGoogleAccount,
  updateCalendarSourcePrivacyMode,
  updateCalendarSourceSelection,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listConnections } from "@/lib/google/calendar";
import { isGoogleCalendarConfigured } from "@/lib/google/oauth";
import { listMicrosoftConnections } from "@/lib/microsoft/calendar";
import { isMicrosoftCalendarConfigured } from "@/lib/microsoft/oauth";
import { ProfileEditForm } from "@/components/settings/ProfileEditForm";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
import { ResetAccountSection } from "@/components/settings/ResetAccountSection";
import { HelpTip } from "@/components/ui/HelpTip";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { listCalendarSources } from "@/lib/calendar-intelligence/sources";

const CALENDAR_STATUS_MESSAGE: Record<string, string> = {
  connected: "Conta Google adicionada.",
  disconnected: "Conta Google desligada.",
  "primary-updated": "Conta principal atualizada.",
  "sources-updated": "Calendários usados pelo Rebuild atualizados.",
  "sources-refreshed": "Lista de calendários sincronizada.",
  "privacy-updated": "Privacidade do calendário atualizada.",
  "write-enabled": "Autorização para adicionar eventos ativada.",
  denied: "Autorização cancelada — a conta não foi ligada.",
  error: "Não foi possível ligar a conta Google. Tenta novamente.",
  "not-configured": "A integração com o Google Calendar ainda não está configurada.",
};

const OUTLOOK_STATUS_MESSAGE: Record<string, string> = {
  connected: "Conta Outlook adicionada (só leitura).",
  disconnected: "Conta Outlook desligada.",
  denied: "Autorização cancelada — a conta não foi ligada.",
  error: "Não foi possível ligar a conta Outlook. Tenta novamente.",
  "not-configured": "A integração com o Outlook ainda não está configurada.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string; outlook?: string; setup?: string }>;
}) {
  const { calendar, outlook, setup } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const calendarConfigured = isGoogleCalendarConfigured();
  const connections = user && calendarConfigured ? await listConnections(user.id) : [];
  const statusMessage = calendar ? CALENDAR_STATUS_MESSAGE[calendar] : null;

  const outlookConfigured = isMicrosoftCalendarConfigured();
  const outlookConnections = user && outlookConfigured ? await listMicrosoftConnections(user.id) : [];
  const outlookStatusMessage = outlook ? OUTLOOK_STATUS_MESSAGE[outlook] : null;
  const calendarSources = user ? await listCalendarSources(user.id) : [];

  const { data: profile } =
    supabase && user
      ? await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle()
      : { data: null };

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Conta</p>
        <h1 className="text-2xl font-semibold tracking-tight">Definições</h1>
      </div>

      <section className="surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
            <Activity size={16} />
          </span>
          <div>
            <h2 className="font-medium">Saúde e dispositivos</h2>
            <p className="text-sm text-neutral-400">Peso, sono, passos e recuperação com origem e consentimento visíveis.</p>
          </div>
        </div>
        <Link href="/settings/health" className="btn-secondary mt-4 inline-flex">
          Gerir dados de saúde
        </Link>
      </section>

      {setup === "calendar" && (
        <div
          role="note"
          className="surface-card border-emerald-500/30 p-4 text-sm text-neutral-200"
        >
          <p className="font-medium">Falta só isto: liga um calendário</p>
          <p className="mt-1 text-neutral-400">
            Depois de ligares o Google Calendar ou o Outlook abaixo, já podes usar o resto da app.
          </p>
        </div>
      )}

      <section className="surface-card p-5" id="calendario">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <CalendarCheck2 size={16} />
          </span>
          <h2 className="flex items-center gap-1.5 font-medium">
            Google Calendar
            {connections.length > 1 && (
              <HelpTip heading="Conta principal / conta de destino">
                Com mais do que uma conta ligada, os espaços livres são calculados juntando todas,
                mas só uma fica marcada como &quot;principal&quot; — é essa que é usada por omissão
                quando adicionas uma decisão ao calendário sem escolher outra conta explicitamente.
              </HelpTip>
            )}
          </h2>
        </div>

        {statusMessage && <p className="mt-2 text-sm text-neutral-400">{statusMessage}</p>}

        {!calendarConfigured ? (
          <p className="mt-3 text-sm text-neutral-400">
            A integração ainda não está configurada neste ambiente.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {connections.length > 0 && (
              <>
                <p className="text-sm text-neutral-400">
                  O motor de decisões tem em conta os compromissos de todas as contas ligadas.{" "}
                  <Link href="/calendar" className="text-emerald-400 underline underline-offset-2">
                    Ver calendário
                  </Link>
                  .
                </p>
                <ul className="space-y-2">
                  {connections.map((connection) => (
                    <li
                      key={connection.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-200">
                          {connection.label || connection.googleAccountEmail || "Conta Google"}
                        </p>
                        {connection.isPrimary && (
                          <p className="flex items-center gap-1 text-xs text-emerald-400">
                            <Star size={11} />
                            Conta principal
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          {connection.canWrite ? "Pode adicionar eventos" : "Leitura apenas"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!connection.canWrite && (
                          <a
                            href={`/api/google/connect?access=write&connectionId=${connection.id}`}
                            className="btn-secondary"
                          >
                            Permitir adicionar eventos
                          </a>
                        )}
                        {!connection.isPrimary && (
                          <form action={setPrimaryGoogleAccount.bind(null, connection.id)}>
                            <button type="submit" className="btn-ghost" title="Tornar principal">
                              <Star size={13} />
                              Tornar principal
                            </button>
                          </form>
                        )}
                        <form action={disconnectGoogleCalendar.bind(null, connection.id)}>
                          <button type="submit" className="btn-secondary">
                            Desligar
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="text-sm text-neutral-400">
              {connections.length === 0
                ? "Liga o teu Google Calendar para as decisões terem em conta os espaços livres na tua agenda."
                : "Podes ligar outra conta Google (por exemplo, pessoal e trabalho) — os espaços livres/ocupados são calculados juntando todas."}
            </p>
            <a href="/api/google/connect?access=read" className="btn-primary inline-flex">
              {connections.length === 0 ? "Ligar Google Calendar" : "Ligar outra conta"}
            </a>
          </div>
        )}
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <CalendarCheck2 size={16} />
          </span>
          <h2 className="flex items-center gap-1.5 font-medium">
            Outlook
            <HelpTip heading="Outlook é só de leitura">
              O Rebuild usa os teus eventos do Outlook apenas para saber quando estás ocupado — nunca cria,
              edita ou apaga nada no teu Outlook. Se quiseres adicionar uma decisão a um calendário, isso
              continua a ser feito numa conta Google ligada.
            </HelpTip>
          </h2>
        </div>

        {outlookStatusMessage && <p className="mt-2 text-sm text-neutral-400">{outlookStatusMessage}</p>}

        {!outlookConfigured ? (
          <p className="mt-3 text-sm text-neutral-400">
            A integração com o Outlook ainda não está configurada neste ambiente.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {outlookConnections.length > 0 && (
              <ul className="space-y-2">
                {outlookConnections.map((connection) => (
                  <li
                    key={connection.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-200">
                        {connection.accountEmail || "Conta Outlook"}
                      </p>
                      <p className="text-xs text-neutral-500">Só leitura</p>
                    </div>
                    <form action={disconnectMicrosoftAccount.bind(null, connection.id)}>
                      <button type="submit" className="btn-secondary">
                        Desligar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm text-neutral-400">
              {outlookConnections.length === 0
                ? "Liga o teu Outlook para o motor de decisões também ter em conta esses compromissos — só de leitura."
                : "Podes ligar outra conta Outlook."}
            </p>
            <a href="/api/microsoft/connect" className="btn-primary inline-flex">
              {outlookConnections.length === 0 ? "Ligar Outlook" : "Ligar outra conta"}
            </a>
          </div>
        )}
      </section>
      <section className="surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-neutral-300">
            <Mail size={16} />
          </span>
          <div>
            <h2 className="font-medium">Sessão</h2>
            <p className="text-sm text-neutral-400">{user?.email}</p>
          </div>
        </div>
        <form action={signOut} className="mt-4">
          <button type="submit" className="btn-secondary">
            <LogOut size={14} />
            Terminar sessão
          </button>
        </form>
      </section>

      {(connections.length > 0 || outlookConnections.length > 0) && (
        <section className="surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">Calendários que contam para o teu dia</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Escolhe exatamente os calendários que podem bloquear refeições, treinos e outras
                decisões. Os restantes são ignorados.
              </p>
              <p className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
                Por defeito, o Rebuild lê apenas quando estás ocupado. Título e local são opcionais;
                descrições, participantes e anexos nunca são pedidos.
                <HelpTip heading="Privacidade por calendário">
                  Em “Só disponibilidade”, recebemos apenas início, fim e estado ocupado/livre. Em
                  “Título e local”, esses dois campos podem aparecer na agenda da app. Eventos
                  privados continuam sempre ocultos e os títulos nunca são enviados em bruto ao Coach.
                </HelpTip>
              </p>
            </div>
            <form action={refreshCalendarSources}>
              <button type="submit" className="btn-secondary">Atualizar lista</button>
            </form>
          </div>

          {calendarSources.length === 0 ? (
            <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Atualiza a lista — contas Google antigas poderão pedir uma autorização adicional para
              mostrar todos os calendários disponíveis.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {calendarSources.map((source) => (
                <li key={source.id} className="space-y-3 rounded-xl bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-200">{source.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {source.provider === "microsoft" ? "Outlook" : "Google"}
                      {source.accountLabel ? ` · ${source.accountLabel}` : ""}
                      {source.isReadOnly ? " · só leitura" : ""}
                    </p>
                  </div>
                  <form action={updateCalendarSourceSelection.bind(null, source.id, !source.selectedForContext)}>
                    <button
                      type="submit"
                      role="switch"
                      aria-checked={source.selectedForContext}
                      className={source.selectedForContext ? "btn-primary" : "btn-secondary"}
                    >
                      {source.selectedForContext ? "Incluído" : "Ignorado"}
                    </button>
                  </form>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                    <span className="mr-1 text-xs text-neutral-500">Detalhe permitido:</span>
                    <form
                      action={updateCalendarSourcePrivacyMode.bind(
                        null,
                        source.id,
                        "availability_only"
                      )}
                    >
                      <button
                        type="submit"
                        aria-pressed={source.privacyMode === "availability_only"}
                        className={
                          source.privacyMode === "availability_only" ? "btn-primary" : "btn-secondary"
                        }
                      >
                        Só disponibilidade
                      </button>
                    </form>
                    <form
                      action={updateCalendarSourcePrivacyMode.bind(
                        null,
                        source.id,
                        "metadata_allowed"
                      )}
                    >
                      <button
                        type="submit"
                        aria-pressed={source.privacyMode === "metadata_allowed"}
                        className={
                          source.privacyMode === "metadata_allowed" ? "btn-primary" : "btn-secondary"
                        }
                      >
                        Título e local
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <Bell size={16} />
          </span>
          <div>
            <h2 className="font-medium">Notificações</h2>
            <p className="text-sm text-neutral-400">Intervenções úteis, sem interromper o descanso.</p>
          </div>
        </div>
        <div className="mt-4"><NotificationSettings /></div>
      </section>

      <section className="surface-card p-5" id="perfil">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <UserCog size={16} />
          </span>
          <div>
            <h2 className="font-medium">Perfil</h2>
            <p className="text-sm text-neutral-400">
              Identidade, objetivo, horários e tom de comunicação usados pelo motor de decisões e
              pelo Coach.
            </p>
          </div>
        </div>
        <div className="mt-4">
          {profile ? (
            <ProfileEditForm initialProfile={profile} />
          ) : (
            <p className="text-sm text-neutral-400">Não foi possível carregar o teu perfil.</p>
          )}
        </div>
        <Link
          href="/nutrition/profile"
          className="mt-4 inline-flex text-sm text-emerald-400 underline underline-offset-2"
        >
          Editar perfil de alimentação (objetivo, dieta, alergias, macros) →
        </Link>
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
            <Brain size={16} />
          </span>
          <h2 className="font-medium">Memória e personalização</h2>
        </div>
        <p className="mt-2 text-sm text-neutral-400">
          Vê o que o motor de decisões aprendeu contigo, silencia regras ou adiciona notas.
        </p>
        <Link href="/settings/memory" className="btn-secondary mt-3 inline-flex">
          Abrir memória
        </Link>
      </section>

      <section className="surface-card space-y-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-neutral-300">
            <ShieldCheck size={16} />
          </span>
          <h2 className="font-medium">Os teus dados</h2>
        </div>
        <p className="text-sm text-neutral-400">
          Guardamos o teu perfil, os dados de saúde que autorizares importar, os compromissos e tokens de acesso do Google Calendar e Outlook
          (encriptados; o Outlook é usado apenas para leitura), o histórico de decisões, as conversas com o Coach, a despensa e listas de
          compras, o plano de refeições e as notas de personalização que crias em Memória. Usamos
          fornecedores técnicos para operar o serviço — Supabase, Vercel e Anthropic — e Google
          ou Microsoft quando ligas calendários. Não vendemos estes dados nem os usamos para publicidade.
          Consulta a{" "}
          <Link href="/privacy" className="text-emerald-400 underline underline-offset-2">
            Política de privacidade
          </Link>
          . Podes rever e corrigir o que o motor de decisões aprendeu em{" "}
          <Link href="/settings/memory" className="text-emerald-400 underline underline-offset-2">
            Memória
          </Link>
          , desligar o Google Calendar acima, ou eliminar a conta por completo abaixo.
        </p>
        <a href="/api/account/export" className="btn-secondary inline-flex" download>
          Descarregar os meus dados
        </a>
        {user?.email && (
          <div className="space-y-3">
            <ResetAccountSection email={user.email} />
            <DeleteAccountSection email={user.email} />
          </div>
        )}
      </section>
    </main>
  );
}
