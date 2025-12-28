"use client";

import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import Image from "next/image";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const canSubmit = useMemo(() => {
    return Boolean(email.trim()) && Boolean(password.trim()) && !submitting;
  }, [email, password, submitting]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "No pudimos iniciar sesión. Revisá tus datos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f2f26]">
      {/* Fondo con “glow” y textura sutil */}
      <div className="pointer-events-none absolute inset-0">
        {/* Glow */}
        <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#1b5a46]/35 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full bg-[#fbbf24]/15 blur-3xl" />
        {/* Gradiente */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/0 to-black/10" />
        {/* Pattern (puntos) */}
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.25) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#144336] ring-1 ring-white/20 shadow-sm">
              <Image
                src="/logo-white.svg"
                alt="Gourmetify"
                width={64}
                height={64}
                priority
              />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide text-white">
                GOURMETIFY
              </div>
              <div className="text-xs text-white/70">Gestión gastronómica</div>
            </div>
          </div>

          {/* Card principal */}
          <div className="relative">
            {/* borde/acento */}
            <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-b from-white/25 to-white/5" />
            <div className="relative rounded-3xl bg-white/95 shadow-xl shadow-black/15 ring-1 ring-white/25 backdrop-blur">
              {/* Puedes mantener tu Card si querés, pero así controlamos el look */}
              <div className="px-6 pt-6">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  Ingresar
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Controlá ventas, stock y caja en tiempo real.
                </p>
              </div>

              <div className="px-6 pb-6 pt-5">
                <form onSubmit={submit} className="grid gap-4">
                  <Field label="Email">
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      autoComplete="email"
                      inputMode="email"
                    />
                  </Field>

                  <Field label="Contraseña">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </Field>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    loading={submitting}
                    disabled={!canSubmit}
                    // si tu Button acepta className, esto lo vuelve "brand"
                    className="rounded-2xl bg-[#144336] text-white hover:bg-[#10362b] disabled:opacity-60"
                  >
                    Entrar
                  </Button>
                </form>
              </div>

              {/* Footer mini */}
              <div className="flex items-center justify-between border-t border-zinc-200/70 px-6 py-4">
                <div className="text-xs text-zinc-500">
                  © {new Date().getFullYear()} Gourmetify
                </div>
                <div className="text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
                    Acceso interno
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Micro copy bajo card (opcional) */}
          <p className="mt-4 text-center text-xs text-white/60">
            ¿Problemas para entrar? Consultá al administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
