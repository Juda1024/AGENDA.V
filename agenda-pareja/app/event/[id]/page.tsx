"use client";

import { useParams } from "next/navigation";
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
  profiles?: { display_name: string } | null;
};


function clsx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(" ");
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <div className="inline-flex items-center gap-1" aria-label={`${v} estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={clsx(
            "text-sm",
            i < v ? "text-amber-200" : "text-white/20"
          )}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeUrl = useMemo(() => {
    if (photos.length === 0) return null;
    const i = Math.max(0, Math.min(activeIndex, photos.length - 1));
    return photos[i].photo_url;
  }, [photos, activeIndex]);

  const avgRating = useMemo(() => {
    const nums = reviews.map((r) => r.rating).filter((x): x is number => typeof x === "number");
    if (nums.length === 0) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return Math.round((sum / nums.length) * 10) / 10;
  }, [reviews]);

  async function ensureSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return null;
    }
    return data.session.user.id;
  }

  async function load() {
    if (!eventId) return;

    setLoading(true);
    const uid = await ensureSession();
    if (!uid) return;

    const { data: eData } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    setEvent((eData ?? null) as any);

    const { data: pData } = await supabase
      .from("photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    setPhotos((pData ?? []) as PhotoRow[]);
    setActiveIndex(0);

    const { data: rData } = await supabase
  .from("reviews")
  .select("*, profiles(display_name)")
  .eq("event_id", eventId)
  .order("created_at", { ascending: false });

setReviews((rData ?? []) as ReviewRow[]);


    setLoading(false);
  }

  function prev() {
    if (photos.length === 0) return;
    setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  function next() {
    if (photos.length === 0) return;
    setActiveIndex((i) => (i + 1) % photos.length);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!lightboxOpen) return;
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, photos.length]);

  if (loading) {
    return (
      <main className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-6 py-10 text-white/70">Cargando...</div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-6 py-10 text-white/70">
          No se encontró esta salida.
        </div>
      </main>
    );
  }

  if (event.status !== "done") {
    return (
      <main className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 backdrop-blur"
          >
            ← Volver
          </button>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-white/75 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
            Esta salida aún está pendiente. Solo las realizadas tienen álbum y reseñas.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      {/* Color blobs calmados */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-28 left-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,102,196,0.22),transparent_62%)] blur-2xl" />
        <div className="absolute top-10 right-[-170px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(72,219,251,0.20),transparent_62%)] blur-2xl" />
        <div className="absolute bottom-[-170px] left-[18%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,208,100,0.16),transparent_64%)] blur-2xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top */}
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
            <span className="text-white/60">Álbum</span>
          </div>
        </div>

        {/* HERO */}
        <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="relative h-[320px] bg-black/30">
            {event.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.cover_url}
                alt="cover"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-white/50">
                Sin portada
              </div>
            )}

            {/* overlay gradient */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.72))]" />

            {/* chips */}
            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-pink-200/25 bg-pink-500/15 px-3 py-1 text-xs text-pink-100 backdrop-blur">
                Realizada ✅
              </span>
              <span className="rounded-full border border-cyan-200/25 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100 backdrop-blur">
                {photos.length} fotos
              </span>
              <span className="rounded-full border border-amber-200/25 bg-amber-500/15 px-3 py-1 text-xs text-amber-100 backdrop-blur">
                {reviews.length} reseñas
              </span>
            </div>

            {/* title */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                {event.title}
              </h1>

              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-white/70 space-y-1">
                  {event.location && <div className="truncate">📍 {event.location}</div>}
                  {event.link && (
                    <a
                      href={event.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 hover:text-white underline underline-offset-4 break-all"
                    >
                      🔗 Ver link
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-white/60">
                  {avgRating !== null ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur">
                      <span className="text-white/80">Promedio:</span>
                      <span className="text-amber-200 font-semibold">{avgRating}</span>
                      <span className="text-white/40">/5</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur">
                      Aún sin promedio
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* GALERÍA MOSAICO */}
              <section className="lg:col-span-2 rounded-[26px] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">📸 Galería</div>
                    <div className="text-xs text-white/55">
                      Toca una foto para verla en grande.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (photos.length > 0) {
                        setActiveIndex(0);
                        setLightboxOpen(true);
                      }
                    }}
                    className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
                    disabled={photos.length === 0}
                    title={photos.length === 0 ? "Sin fotos" : "Abrir la primera foto"}
                  >
                    Abrir ✨
                  </button>
                </div>

                {photos.length === 0 ? (
                  <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                    Aún no hay fotos. Súbelas desde “Dejar reseña + fotos”.
                  </div>
                ) : (
                  <>
                    {/* Masonry usando columns */}
                    <div className="mt-5 columns-1 sm:columns-2 lg:columns-3 gap-3 [column-fill:_balance]">
                      {photos.map((p, idx) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveIndex(idx);
                            setLightboxOpen(true);
                          }}
                          className="mb-3 w-full overflow-hidden rounded-3xl border border-white/10 bg-black/20 hover:border-white/25 hover:opacity-[0.98] focus:outline-none"
                          title="Ver en grande"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.photo_url}
                            alt="foto"
                            className="w-full h-auto object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 text-xs text-white/50">
                      Tip: Guardemos nuestros mejores momentos.
                    </div>
                  </>
                )}
              </section>

              {/* RESEÑAS */}
              <aside className="rounded-[26px] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">📝 Reseñas</div>
                    <div className="text-xs text-white/55">
                      Lo que quedó escrito de esta salida.
                    </div>
                  </div>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {reviews.length}
                  </span>
                </div>

                {reviews.length === 0 ? (
                  <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                    Aún no hay reseñas guardadas.
                    <div className="mt-2 text-xs text-white/55">
                      Para agregar, usa “Dejar reseña + fotos”.
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {reviews.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.10))] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-white/60">Calificación</div>
                            <div className="mt-1">
                              <Stars value={r.rating ?? 0} />
                              {typeof r.rating === "number" && (
                                <span className="ml-2 text-xs text-white/55">
                                  {r.rating}/5
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-xs text-white/60">
  Por <span className="text-white/85 font-medium">
    {r.profiles?.display_name ?? "Usuario"}
  </span>
</div>


                          {/* avatar placeholder */}
                          <div className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-black/20 grid place-items-center text-sm">
                            ✨
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-white/85 whitespace-pre-wrap">
                          {r.review_text ?? "(sin texto)"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 text-xs text-white/55">
                  Para editar o agregar reseña/fotos dale a volver.
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightboxOpen && photos.length > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/85"
            onClick={() => setLightboxOpen(false)}
          />

          <div className="relative w-full max-w-6xl">
            {/* top controls */}
            <div className="absolute -top-12 left-0 right-0 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/70 backdrop-blur">
                📸 {activeIndex + 1} / {photos.length}
              </div>

              <button
                onClick={() => setLightboxOpen(false)}
                className="rounded-xl border border-white/12 bg-black/40 px-3 py-1 text-sm text-white/80 hover:bg-white/5 backdrop-blur"
              >
                Cerrar
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={prev}
                className="hidden sm:block rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85 hover:bg-white/10 backdrop-blur"
                title="Anterior"
              >
                ←
              </button>

              {/* image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeUrl as string}
                alt="foto grande"
                className="w-full max-h-[85vh] object-contain rounded-3xl border border-white/10 bg-black/40"
              />

              <button
                onClick={next}
                className="hidden sm:block rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85 hover:bg-white/10 backdrop-blur"
                title="Siguiente"
              >
                →
              </button>
            </div>

            {/* mobile controls */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
              <button
                onClick={prev}
                className="rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/85 hover:bg-white/10 backdrop-blur"
              >
                ← Anterior
              </button>
              <button
                onClick={next}
                className="rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/85 hover:bg-white/10 backdrop-blur"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
