"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function clsx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email.trim() || !password.trim()) {
      setMsg("Completa email y contraseña.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setMsg("Credenciales incorrectas. Revisa email/clave.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen text-white">
      {/* Fondo con formas/colores */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* base vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.06),transparent_45%)]" />

        {/* color blobs */}
        <div className="absolute -top-28 left-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,102,196,0.25),transparent_62%)] blur-2xl" />
        <div className="absolute top-10 right-[-170px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(72,219,251,0.22),transparent_62%)] blur-2xl" />
        <div className="absolute bottom-[-170px] left-[18%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,208,100,0.18),transparent_64%)] blur-2xl" />

        {/* diagonal glow ribbon */}
        <div className="absolute left-[-10%] top-[20%] h-56 w-[120%] rotate-[-6deg] bg-[linear-gradient(90deg,rgba(255,102,196,0.10),rgba(72,219,251,0.10),rgba(255,208,100,0.10))] blur-xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Lado izquierdo */}
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
              💫 Respira Ondo
              <span className="text-white/40">·</span>
              <span className="text-white/60">Solo para nosotros dos</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
              Una agenda para nuestros planes,
              <br />
              <span className="text-white/80">reseñas y fotitos.</span>
            </h1>

            <p className="max-w-xl text-white/70">
              Podemos guardar salidas pendientes, márcalas como realizadas y arma un álbum con
              reseñas y momentos lindos. Todo queda guardado en la nube para que lo volvamos a ver cuando y donde sea.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <div className="text-sm font-semibold">🗓️ Planes</div>
                <div className="mt-1 text-xs text-white/60">Pendientes bien ordenados.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <div className="text-sm font-semibold">📝 Reseñas</div>
                <div className="mt-1 text-xs text-white/60">Recuerdos con calificación.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <div className="text-sm font-semibold">📸 Álbum</div>
                <div className="mt-1 text-xs text-white/60">Galería de recuerditos.</div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur">
              <div className="text-sm text-white/85 font-medium">✨ Detallito</div>
              <div className="mt-1 text-sm text-white/65">
                La música de Spotify queda sonando mientras cambias de páginas.
              </div>
            </div>
          </section>

          {/* Lado derecho: Card login */}
          <section className="lg:justify-self-end w-full max-w-md">
            <div className="relative rounded-[30px] border border-white/12 bg-white/7 p-6 backdrop-blur shadow-[0_22px_70px_rgba(0,0,0,0.55)] overflow-hidden">
              {/* inner highlight */}
              <div className="pointer-events-none absolute -inset-1 opacity-60 blur-2xl bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.25),transparent_55%)]" />
              <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,102,196,0.18),transparent_60%)] blur-2xl" />
              <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(72,219,251,0.16),transparent_60%)] blur-2xl" />

              <div className="relative flex items-start justify-between">
                <div>
                  <div className="text-xl font-semibold">Iniciar sesión</div>
                  <div className="text-sm text-white/60">Acceso privado</div>
                </div>

                <div className="grid place-items-center h-12 w-12 rounded-2xl border border-white/10 bg-black/20">
                  🌙
                </div>
              </div>

              <form onSubmit={onSubmit} className="relative mt-6 space-y-3">
                <div className="space-y-2">
                  <label className="text-xs text-white/60">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className={clsx(
                      "w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none placeholder:text-white/30",
                      "focus:border-white/25"
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-white/60">Contraseña</label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    className={clsx(
                      "w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none placeholder:text-white/30",
                      "focus:border-white/25"
                    )}
                  />
                </div>

                {msg && (
                  <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm text-red-100">
                    {msg}
                  </div>
                )}

                <button
                  disabled={loading}
                  className="relative w-full overflow-hidden rounded-2xl py-3 text-sm font-medium text-black disabled:opacity-60"
                >
                  <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,102,196,0.95),rgba(72,219,251,0.92),rgba(255,208,100,0.90))]" />
                  <span className="absolute inset-0 opacity-40 blur-xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.8),transparent_45%)]" />
                  <span className="relative">{loading ? "Entrando..." : "Entrar ✨"}</span>
                </button>

                <div className="text-xs text-white/50">
                  Si quieres cambiar contraseña lo podemos hacer.
                </div>
              </form>
            </div>

            <div className="mt-4 text-xs text-white/45 text-center">
              Respira Ondo — planes bonitos, recuerdos aun mas bonitos.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
