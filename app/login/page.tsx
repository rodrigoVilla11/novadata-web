"use client";

import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-zinc-900">Ingresar</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Sesión segura con refresh token en cookie <span className="font-medium">httpOnly</span>.
            </p>
          </div>

          <Card>
            <CardHeader title="Cuenta" subtitle="Usá tu email y contraseña" />
            <CardBody>
              <form onSubmit={submit} className="grid gap-4">
                <Field label="Email">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
                </Field>

                <Field label="Contraseña">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" loading={submitting} disabled={submitting}>
                  Entrar
                </Button>

                <p className="text-xs text-zinc-500">
                  Tip: si cerrás y abrís el navegador, el refresh restaura la sesión automáticamente.
                </p>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
