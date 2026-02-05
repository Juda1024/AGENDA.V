"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type EventRow = {
  id: string;
  title: string;
  location: string | null;
  link: string | null;
  cover_url: string | null;
  status: "planned" | "done";
  created_at: string;
  created_by: string;
};

type PhotoRow = {
  id: string;
  event_id: string;
  user_id: string;
  photo_url: string;
  created_at: string;
};

type ReviewRow = {
  id: string;
  event_id: string;
  user_id: string;
  rating: number | null;
  review_text: string | null;
  created_at: string;
};

function clsx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

function makeId() {
  return crypto.randomUUID();
}

// Best-effort: extrae el path del public URL para borrar archivos
function getStoragePathFromPublicUrl(publicUrl: string, bucket: string) {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.substring(idx + marker.length);
  } catch {
    return null;
  }
}

async function uploadAlbum(eventId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `albums/${eventId}/${makeId()}.${ext}`;

  const { error } = await supabase.storage.from("albums").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("albums").getPublicUrl(path);
  return data.publicUrl;
}

function getGreetingLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días ☀️";
  if (h < 18) return "Buenas tardes 🌤️";
  return "Buenas noches 🌙";
}

export default function DashboardPage() {
  const router = useRouter();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"planned" | "done">("planned");

  // sesión / perfil
  const [myUserId, setMyUserId] = useState<string>("");
  const [meName, setMeName] = useState<string>("");
  const [meEmail, setMeEmail] = useState<string>("");

  // Modal reseña + fotos
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewEvent, setReviewEvent] = useState<EventRow | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [albumFiles, setAlbumFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const planned = useMemo(() => events.filter((e) => e.status === "planned"), [events]);
  const done = useMemo(() => events.filter((e) => e.status === "done"), [events]);
  const list = tab === "planned" ? planned : done;

  async function ensureSessionAndProfile() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      router.push("/login");
      return null;
    }

    const uid = session.user.id;
    setMyUserId(uid);
    setMeEmail(session.user.email ?? "");

    // traer display_name del profile
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", uid)
      .maybeSingle();

    if (!error && prof?.display_name) setMeName(prof.display_name);
    else setMeName(""); // si no hay profile, se mostrará email como fallback

    return uid;
  }

  async function load() {
    setLoading(true);

    const uid = await ensureSessionAndProfile();
    if (!uid) return;

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setEvents(data as EventRow[]);
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function toggleDone(id: string, status: "planned" | "done") {
    const next = status === "planned" ? "done" : "planned";
    await supabase.from("events").update({ status: next }).eq("id", id);
    await load();
    if (next === "done") setTab("done");
  }

  async function openReviewModal(eventId: string) {
    const uid = await ensureSessionAndProfile();
    if (!uid) return;

    const ev = events.find((x) => x.id === eventId) ?? null;
    setReviewEvent(ev);
    setReviewOpen(true);

    const { data: existing } = await supabase
      .from("reviews")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", uid)
      .maybeSingle();

    setRating(existing?.rating ?? 5);
    setReviewText(existing?.review_text ?? "");

    const { data: pData } = await supabase
      .from("photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    setPhotos((pData ?? []) as PhotoRow[]);
    setAlbumFiles(null);
  }

  async function saveReview() {
    if (!reviewEvent) return;

    const uid = await ensureSessionAndProfile();
    if (!uid) return;

    setSavingReview(true);

    const { error } = await supabase
      .from("reviews")
      .upsert(
        {
          event_id: reviewEvent.id,
          user_id: uid,
          rating,
          review_text: reviewText.trim() || null,
        },
        { onConflict: "event_id,user_id" }
      );

    setSavingReview(false);

    if (error) {
      alert(error.message);
      return;
    }
  }

  async function uploadPhotosFromModal() {
    if (!reviewEvent) return;

    const uid = await ensureSessionAndProfile();
    if (!uid || !albumFiles || albumFiles.length === 0) return;

    setUploading(true);
    try {
      for (const f of Array.from(albumFiles)) {
        const url = await uploadAlbum(reviewEvent.id, f);
        await supabase.from("photos").insert({
          event_id: reviewEvent.id,
          user_id: uid,
          photo_url: url,
        });
      }

      const { data: pData } = await supabase
        .from("photos")
        .select("*")
        .eq("event_id", reviewEvent.id)
        .order("created_at", { ascending: false });

      setPhotos((pData ?? []) as PhotoRow[]);
      setAlbumFiles(null);
    } catch (err: any) {
      alert(err?.message ?? "Error subiendo fotos");
    } finally {
      setUploading(false);
    }
  }

  async function deleteEventCompletely(ev: EventRow) {
    const ok = confirm(`¿Eliminar "${ev.title}"? Esto borra reseñas y fotos asociadas.`);
    if (!ok) return;

    // fotos para borrar en storage (best-effort)
    const { data: pData } = await supabase.from("photos").select("*").eq("event_id", ev.id);
    const photosToDelete = (pData ?? []) as PhotoRow[];

    // borrar filas DB
    await supabase.from("reviews").delete().eq("event_id", ev.id);
    await supabase.from("photos").delete().eq("event_id", ev.id);
    await supabase.from("events").delete().eq("id", ev.id);

    // borrar storage (best-effort)
    const albumPaths = photosToDelete
      .map((p) => getStoragePathFromPublicUrl(p.photo_url, "albums"))
      .filter(Boolean) as string[];

    if (albumPaths.length > 0) {
      await supabase.storage.from("albums").remove(albumPaths);
    }

    if (ev.cover_url) {
      const coverPath = getStoragePathFromPublicUrl(ev.cover_url, "covers");
      if (coverPath) await supabase.storage.from("covers").remove([coverPath]);
    }

    await load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayUser = meName || meEmail || "Usuario";

  return (
    <main className="min-h-screen text-white">
      {/* Color blobs calmados (no monocromático) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-[-120px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,102,196,0.24),transparent_60%)] blur-2xl" />
        <div className="absolute top-10 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(72,219,251,0.22),transparent_60%)] blur-2xl" />
        <div className="absolute bottom-[-140px] left-[20%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,208,100,0.18),transparent_62%)] blur-2xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
              💫 Respira Ondo
              <span className="text-white/40">·</span>
              <span className="text-white/60">Agenda de salidas</span>
            </div>

            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              Planes & recuerdos ✨
            </h1>

            <p className="mt-2 text-sm text-white/70 max-w-2xl">
              Pendientes para planear. Realizadas para reseña, fotos y galería.
            </p>
          </div>

          {/* RIGHT SIDE: saludo grande + cerrar sesión */}
          <div className="flex items-center gap-3">
            {/* saludo grande (desktop) */}
            <div className="hidden md:flex items-center gap-4 rounded-3xl border border-white/12 bg-[linear-gradient(135deg,rgba(255,102,196,0.14),rgba(72,219,251,0.12),rgba(255,208,100,0.10))] px-5 py-3 backdrop-blur shadow-[0_14px_40px_rgba(0,0,0,0.30)]">
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/12 bg-black/25 text-sm font-semibold">
                  {displayUser.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-black/40" />
              </div>

              <div className="leading-tight">
                <div className="text-[11px] text-white/60">{getGreetingLabel()}</div>
                <div className="text-base font-semibold text-white/92">
                  Hola, {displayUser}
                </div>
                <div className="text-[11px] text-white/55 -mt-0.5">
                  Espero que estés teniendo un buen día.
                </div>
              </div>
            </div>

            {/* saludo compacto (mobile) */}
            <div className="md:hidden inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/85 backdrop-blur">
              👋 Hola, <span className="font-medium">{displayUser}</span>
            </div>

            <button
              onClick={signOut}
              className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 backdrop-blur"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Tabs + Crear */}
        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-full md:w-auto rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur">
            <button
              onClick={() => setTab("planned")}
              className={clsx(
                "flex-1 md:flex-none rounded-xl px-4 py-2 text-sm transition",
                tab === "planned"
                  ? "bg-white text-black shadow"
                  : "text-white/80 hover:bg-white/10"
              )}
            >
              Pendientes ({planned.length})
            </button>
            <button
              onClick={() => setTab("done")}
              className={clsx(
                "flex-1 md:flex-none rounded-xl px-4 py-2 text-sm transition",
                tab === "done"
                  ? "bg-white text-black shadow"
                  : "text-white/80 hover:bg-white/10"
              )}
            >
              Realizadas ({done.length})
            </button>
          </div>

          <Link
            href="/new"
            className="relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium text-black overflow-hidden"
          >
            <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,102,196,0.95),rgba(72,219,251,0.95),rgba(255,208,100,0.95))]" />
            <span className="absolute inset-0 opacity-40 blur-xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.75),transparent_45%)]" />
            <span className="relative">➕ Crear salida</span>
          </Link>
        </div>

        {/* Banner suave */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-white/85">
              {tab === "planned" ? "🗓️ Pendientes" : "✅ Realizadas"}
              <span className="text-white/50"> · </span>
              <span className="text-white/60">
                {tab === "planned"
                  ? "Crea planes bonitos y márcalos cuando se hagan."
                  : "Deja reseña + sube fotos y abre la galería."}
              </span>
            </div>

            <div className="text-xs text-white/55">
              Spotify queda sonando aunque cambies de página 🎵
            </div>
          </div>
        </div>

        {/* Listado */}
        <section className="mt-6">
          {loading && <div className="text-sm text-white/70">Cargando...</div>}

          {!loading && list.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
              {tab === "planned"
                ? "No tienes planes pendientes. Crea una salida ✨"
                : "Aún no hay realizadas. Marca una como realizada y aparecerá aquí 😌"}
            </div>
          )}

          {!loading && list.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <div
                  key={e.id}
                  className="group relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.42)]"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition">
                    <div className="absolute -inset-1 rounded-[28px] bg-[linear-gradient(135deg,rgba(255,102,196,0.30),rgba(72,219,251,0.25),rgba(255,208,100,0.22))] blur-xl" />
                  </div>

                  <div className="relative h-44 bg-black/25">
                    {e.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.cover_url}
                        alt="cover"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-white/50 text-sm">
                        Sin portada
                      </div>
                    )}

                    <div
                      className={clsx(
                        "absolute left-3 top-3 rounded-full px-3 py-1 text-xs backdrop-blur border",
                        e.status === "planned"
                          ? "border-cyan-200/25 bg-cyan-500/15 text-cyan-100"
                          : "border-pink-200/25 bg-pink-500/15 text-pink-100"
                      )}
                    >
                      {e.status === "planned" ? "Pendiente" : "Realizada"}
                    </div>
                  </div>

                  <div className="relative p-4">
                    <div className="text-lg font-semibold leading-tight">{e.title}</div>

                    <div className="mt-2 text-xs text-white/70 space-y-1">
                      {e.location && <div className="truncate">📍 {e.location}</div>}
                      {e.link && (
                        <a
                          href={e.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 hover:text-white underline underline-offset-4 break-all"
                        >
                          🔗 Ver video
                        </a>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2">
                      {e.status === "planned" ? (
                        <>
                          <button
                            onClick={() => toggleDone(e.id, e.status)}
                            className="w-full rounded-2xl bg-white py-2.5 text-sm font-medium text-black hover:opacity-90"
                          >
                            Marcar realizada ✅
                          </button>

                          <button
                            onClick={() => deleteEventCompletely(e)}
                            className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 py-2.5 text-sm text-red-100 hover:bg-red-500/15"
                          >
                            Eliminar 🗑️
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openReviewModal(e.id)}
                            className="relative w-full overflow-hidden rounded-2xl py-2.5 text-sm font-medium text-black"
                          >
                            <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,102,196,0.95),rgba(72,219,251,0.90))]" />
                            <span className="relative">Dejar reseña + fotos ✨</span>
                          </button>

                          <Link
                            href={`/event/${e.id}`}
                            className="w-full text-center rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/85 hover:bg-white/10"
                          >
                            Ver álbum 📸
                          </Link>

                          <button
                            onClick={() => toggleDone(e.id, e.status)}
                            className="w-full rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/85 hover:bg-white/10"
                          >
                            Volver a pendiente ⏳
                          </button>

                          <button
                            onClick={() => deleteEventCompletely(e)}
                            className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 py-2.5 text-sm text-red-100 hover:bg-red-500/15"
                          >
                            Eliminar 🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 text-xs text-white/45">
          Respira Ondo — hecho para dos. Guardado en Supabase.
        </footer>
      </div>

      {/* Modal reseña + fotos */}
      {reviewOpen && reviewEvent && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setReviewOpen(false)} />

          <div className="relative w-full max-w-3xl rounded-[28px] border border-white/12 bg-black/55 p-5 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  ✨ Reseña & fotos
                  <span className="text-white/40">·</span>
                  <span className="text-white/60">Realizadas</span>
                </div>
                <div className="mt-2 text-xl font-semibold">{reviewEvent.title}</div>
                <div className="text-sm text-white/60">
                  Deja reseña y sube fotos sin salir del dashboard.
                </div>
              </div>

              <button
                className="self-start rounded-xl border border-white/12 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
                onClick={() => setReviewOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.10))] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">📝 Tu reseña</div>
                  <div className="text-xs text-white/50">Se guarda en tu usuario</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/60 mb-1">Calificación (1–5)</div>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                    />
                  </div>
                  <div className="text-xs text-white/50 flex items-end">
                    Puedes editarla luego.
                  </div>
                </div>

                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={5}
                  className="mt-3 w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                  placeholder="Qué recuerdas, qué te gustó..."
                />

                <button
                  disabled={savingReview}
                  onClick={saveReview}
                  className="mt-3 w-full rounded-2xl bg-white py-2.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  {savingReview ? "Guardando..." : "Guardar reseña ✨"}
                </button>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.10))] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">📸 Fotos</div>
                  <div className="text-xs text-white/50">{photos.length} en el álbum</div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/60 mb-2">Subir fotos</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setAlbumFiles(e.target.files)}
                    className="text-sm"
                  />
                  <button
                    disabled={uploading}
                    onClick={uploadPhotosFromModal}
                    className="mt-3 w-full rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/85 hover:bg-white/10 disabled:opacity-60"
                  >
                    {uploading ? "Subiendo..." : "Subir al álbum"}
                  </button>
                </div>

                {photos.length === 0 ? (
                  <div className="mt-3 text-sm text-white/70">Aún no hay fotos aquí.</div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {photos.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setLightboxUrl(p.photo_url)}
                        className="rounded-2xl border border-white/10 overflow-hidden hover:opacity-95"
                        title="Ver grande"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.photo_url} alt="foto" className="h-20 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/event/${reviewEvent.id}`}
                    className="flex-1 text-center rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/85 hover:bg-white/10"
                  >
                    Ver galería completa 📸
                  </Link>

                  <button
                    onClick={() => setReviewOpen(false)}
                    className="rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:opacity-90"
                  >
                    Listo ✨
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setLightboxUrl(null)} />
          <div className="relative w-full max-w-5xl">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 rounded-xl border border-white/12 bg-black/40 px-3 py-1 text-sm text-white/80 hover:bg-white/5 backdrop-blur"
            >
              Cerrar
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="foto grande"
              className="w-full max-h-[85vh] object-contain rounded-3xl border border-white/10 bg-black/40"
            />
          </div>
        </div>
      )}
    </main>
  );
}
