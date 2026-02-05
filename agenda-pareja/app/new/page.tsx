"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function makeId() {
  return crypto.randomUUID();
}

async function uploadCover(file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `covers/${makeId()}.${ext}`;

  const { error } = await supabase.storage.from("covers").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("covers").getPublicUrl(path);
  return data.publicUrl;
}

function isValidUrlMaybe(u: string) {
  try {
    // obliga http(s)
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function clsx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

export default function NewEventPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [cover, setCover] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const titleOk = title.trim().length > 0;
  const locOk = location.trim().length > 0;
  const linkOk = link.trim().length > 0 && isValidUrlMaybe(link.trim());
  const coverOk = !!cover;

  const canSave = useMemo(() => titleOk && locOk && linkOk && coverOk, [titleOk, locOk, linkOk, coverOk]);

  async function ensureSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return null;
    }
    return data.session.user.id;
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!titleOk || !locOk || !linkOk || !coverOk) {
      setMsg("Completa todo correctamente (incluye un link válido y una portada).");
      return;
    }

    const uid = await ensureSession();
    if (!uid) return;

    setSaving(true);

    let coverUrl: string | null = null;
    try {
      coverUrl = await uploadCover(cover as File);
    } catch (err: any) {
      setSaving(false);
      setMsg("No se pudo subir la portada: " + (err?.message ?? "error"));
      return;
    }

    const { error } = await supabase.from("events").insert({
      title: title.trim(),
      location: location.trim(),
      link: link.trim(),
      cover_url: coverUrl,
      status: "planned",
      created_by: uid,
    });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/dashboard");
  }

  const helper = useMemo(() => {
    const missing: string[] = [];
    if (!titleOk) missing.push("Título");
    if (!locOk) missing.push("Ubicación");
    if (!linkOk) missing.push("Link válido");
    if (!coverOk) missing.push("Portada");
    return missing;
  }, [titleOk, locOk, linkOk, coverOk]);

  return (
    <main className="min-h-screen text-white">
      {/* Color blobs calmados */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-28 left-[-120px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,102,196,0.22),transparent_60%)] blur-2xl" />
        <div className="absolute top-8 right-[-150px] h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(72,219,251,0.20),transparent_60%)] blur-2xl" />
        <div className="absolute bottom-[-160px] left-[18%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,208,100,0.16),transparent_62%)] blur-2xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 backdrop-blur"
          >
            ← Volver
          </button>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
            💫 Respira Ondo
            <span className="text-white/40">·</span>
            <span className="text-white/60">Nueva salida</span>
          </div>
        </div>

        {/* Layout */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Left: Form */}
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Crear una salida ✨</h1>
                <p className="mt-2 text-sm text-white/70">
                  Ponlo lindo: título, ubicación, link y una portada bonita.
                </p>
              </div>

              <div className="grid place-items-center h-12 w-12 rounded-2xl border border-white/10 bg-black/20">
                🗓️
              </div>
            </div>

            {/* helper */}
            {!canSave && (
              <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm text-white/80 font-medium">Te falta:</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {helper.map((h) => (
                    <span
                      key={h}
                      className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/80"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={createEvent} className="mt-6 space-y-4">
              {/* title */}
              <div>
                <label className="text-xs text-white/60">Título</label>
                <input
                  className={clsx(
                    "mt-2 w-full rounded-2xl bg-black/30 border px-4 py-3 outline-none placeholder:text-white/30",
                    titleOk ? "border-white/10" : "border-pink-200/25"
                  )}
                  placeholder="Ej: Tour luciérnagas"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {!titleOk && <div className="mt-1 text-xs text-pink-100/90">Escribe un título.</div>}
              </div>

              {/* location */}
              <div>
                <label className="text-xs text-white/60">Ubicación</label>
                <input
                  className={clsx(
                    "mt-2 w-full rounded-2xl bg-black/30 border px-4 py-3 outline-none placeholder:text-white/30",
                    locOk ? "border-white/10" : "border-amber-200/25"
                  )}
                  placeholder="Ej: Laguna Limoncocha"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                {!locOk && <div className="mt-1 text-xs text-amber-100/90">Escribe la ubicación.</div>}
              </div>

              {/* link */}
              <div>
                <label className="text-xs text-white/60">Link (video/maps)</label>
                <input
                  className={clsx(
                    "mt-2 w-full rounded-2xl bg-black/30 border px-4 py-3 outline-none placeholder:text-white/30",
                    linkOk ? "border-white/10" : "border-cyan-200/25"
                  )}
                  placeholder="https://..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
                {!linkOk && (
                  <div className="mt-1 text-xs text-cyan-100/90">
                    Debe ser un link válido (con https://).
                  </div>
                )}
              </div>

              {/* cover */}
              <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.10))] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">📷 Portada</div>
                    <div className="text-xs text-white/60">Obligatoria. Se verá en tus cards.</div>
                  </div>
                  <div
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs border backdrop-blur",
                      coverOk
                        ? "border-emerald-200/25 bg-emerald-500/15 text-emerald-100"
                        : "border-white/12 bg-white/5 text-white/70"
                    )}
                  >
                    {coverOk ? "Lista ✅" : "Pendiente"}
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                  className="mt-3 text-sm"
                />

                {cover && (
                  <div className="mt-2 text-xs text-white/60">
                    Seleccionada: <span className="text-white/80">{cover.name}</span>
                  </div>
                )}
              </div>

              {msg && (
                <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm text-red-100">
                  {msg}
                </div>
              )}

              <button
                disabled={!canSave || saving}
                className="relative w-full overflow-hidden rounded-2xl py-3 text-sm font-medium text-black disabled:opacity-60"
              >
                <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,102,196,0.95),rgba(72,219,251,0.92),rgba(255,208,100,0.90))]" />
                <span className="absolute inset-0 opacity-40 blur-xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.8),transparent_45%)]" />
                <span className="relative">{saving ? "Guardando..." : "Guardar ✨"}</span>
              </button>

              <div className="text-xs text-white/45">
                Tip: una portada vertical u horizontal se adapta; la app la recorta automáticamente en la card.
              </div>
            </form>
          </div>

          {/* Right: Preview */}
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-white/60">Vista previa</div>
                <div className="text-xl font-semibold mt-1">Así se verá en tu lista</div>
              </div>
              <div className="grid place-items-center h-12 w-12 rounded-2xl border border-white/10 bg-black/20">
                🎨
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/25">
              <div className="relative h-44 bg-black/35">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(cover)}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-white/50 text-sm">
                    Portada (preview)
                  </div>
                )}

                <div className="absolute left-3 top-3 rounded-full border border-cyan-200/25 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100 backdrop-blur">
                  Pendiente
                </div>
              </div>

              <div className="p-4">
                <div className="text-lg font-semibold leading-tight">
                  {title.trim() ? title.trim() : "Título de la salida"}
                </div>

                <div className="mt-2 text-xs text-white/70 space-y-1">
                  <div className="truncate">
                    📍 {location.trim() ? location.trim() : "Ubicación"}
                  </div>
                  <div className="break-all underline underline-offset-4 text-white/70">
                    🔗 {link.trim() ? link.trim() : "Link (https://...)"}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <div className="w-full rounded-2xl bg-white py-2.5 text-sm font-medium text-black text-center opacity-95">
                    Marcar realizada ✅
                  </div>
                  <div className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 py-2.5 text-sm text-red-100 text-center">
                    Eliminar 🗑️
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              <div className="font-medium text-white/80">Recomendación</div>
              <div className="mt-1">
                Usa un link de TikTok/YouTube/Maps. Luego, cuando sea realizada, podrás
                dejar reseña y subir fotos al álbum.
              </div>
            </div>

            <div className="mt-4 text-xs text-white/45">
              Respira Ondo — crea planes con estilo ✨
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
