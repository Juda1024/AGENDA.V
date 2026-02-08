"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, isSameDay, parseISO } from "date-fns";

type EventRow = {
  id: string;
  title: string;
  location: string | null;
  link: string | null;
  cover_url: string | null;
  status: "planned" | "done";
  created_at: string;
  created_by: string;
  date_start: string | null;
  date_end: string | null;
};

type PhotoRow = {
  id: string;
  event_id: string;
  user_id: string;
  photo_url: string;
  created_at: string;
};

const QUITO_TZ = "America/Guayaquil";

// Formato bonito: "8 feb 2026, 16:00"
function formatQuitoDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: QUITO_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Solo hora: "16:00"
function formatQuitoTime(iso: string) {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: QUITO_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// yyyy-mm-dd EN QUITO (para comparar días en el calendario)
function ymdInQuito(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: QUITO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const da = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${da}`;
}

// Convierte un ISO a "Date local" pero representando el DÍA de Quito (para pintar en DayPicker)
function quitoDayAsLocalDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: QUITO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const y = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const m = Number(parts.find((p) => p.type === "month")?.value ?? "01");
  const da = Number(parts.find((p) => p.type === "day")?.value ?? "01");

  // OJO: esto crea una Date en local, pero con el mismo “día calendario Quito”
  return new Date(y, m - 1, da);
}




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

// datetime-local -> ISO UTC (compatible con timestamptz)
function toIsoFromLocalDatetime(value: string) {
  // value: "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mi] = timePart.split(":").map(Number);

  // Quito = UTC-5  => UTC = Quito + 5 horas
  const utcMs = Date.UTC(y, m - 1, d, hh + 5, mi, 0, 0);
  return new Date(utcMs).toISOString();
}


// ISO -> datetime-local (para editar)
function toLocalInputFromIso(iso: string) {
  const d = new Date(iso);
  // Quito = UTC-5 => Quito = UTC - 5
  const quito = new Date(d.getTime() - 5 * 60 * 60 * 1000);

  const yyyy = quito.getUTCFullYear();
  const mm = String(quito.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(quito.getUTCDate()).padStart(2, "0");
  const hh = String(quito.getUTCHours()).padStart(2, "0");
  const mi = String(quito.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}


function initialsOf(name: string) {
  const clean = (name || "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  const init = (a + (b ?? "")).toUpperCase();
  return init.slice(0, 2);
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function withCacheBust(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("v", String(Date.now()));
    return u.toString();
  } catch {
    // si no es URL válida, lo devuelvo como estaba
    return url;
  }
}

function buildDefaultLocalDatetime(day: Date) {
  const d = new Date(day);
  d.setHours(19, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"planned" | "done" | "calendar">("planned");

  // sesión / perfil
  const [myUserId, setMyUserId] = useState<string>("");
  const [meName, setMeName] = useState<string>("");
  const [meEmail, setMeEmail] = useState<string>("");
  const [meAvatarUrl, setMeAvatarUrl] = useState<string | null>(null);

  // Avatar modal
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

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

  // CALENDARIO
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateEventId, setDateEventId] = useState<string>("");
  const [dateLocalValue, setDateLocalValue] = useState<string>("");
  const [savingDate, setSavingDate] = useState(false);

  const planned = useMemo(() => events.filter((e) => e.status === "planned"), [events]);
  const done = useMemo(() => events.filter((e) => e.status === "done"), [events]);
  const list = tab === "planned" ? planned : tab === "done" ? done : [];

  const eventsWithDate = useMemo(() => events.filter((e) => !!e.date_start), [events]);
  const eventsNoDate = useMemo(() => events.filter((e) => !e.date_start), [events]);

  const daysWithEvents = useMemo(() => {
  return eventsWithDate
    .filter((e) => !!e.date_start)
    .map((e) => quitoDayAsLocalDate(e.date_start as string));
}, [eventsWithDate]);


  const eventsForSelectedDay = useMemo(() => {
  const selectedQuitoYmd = ymdInQuito(selectedDay);

  return eventsWithDate
    .filter((e) => {
      if (!e.date_start) return false;
      const eventQuitoYmd = ymdInQuito(new Date(e.date_start));
      return eventQuitoYmd === selectedQuitoYmd;
    })
    .sort((a, b) => {
      const da = a.date_start ? new Date(a.date_start).getTime() : 0;
      const db = b.date_start ? new Date(b.date_start).getTime() : 0;
      return da - db;
    });
}, [eventsWithDate, selectedDay]);


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

    const { data: prof, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", uid)
      .maybeSingle();

    if (!error && prof?.display_name) setMeName(prof.display_name);
    else setMeName("");

    if (!error && prof?.avatar_url) setMeAvatarUrl(withCacheBust(prof.avatar_url));
    else setMeAvatarUrl(null);

    return uid;
  }

  async function load() {
    setLoading(true);

    const uid = await ensureSessionAndProfile();
    if (!uid) {
      setLoading(false);
      return;
    }

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

    const { data: pData } = await supabase.from("photos").select("*").eq("event_id", ev.id);
    const photosToDelete = (pData ?? []) as PhotoRow[];

    await supabase.from("reviews").delete().eq("event_id", ev.id);
    await supabase.from("photos").delete().eq("event_id", ev.id);
    await supabase.from("events").delete().eq("id", ev.id);

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

  // ====== CALENDARIO: Asignar fecha después ======
  function openDateModal(prefillEventId?: string) {
    setDateModalOpen(true);

    const chosenId = prefillEventId ?? "";
    setDateEventId(chosenId);

    const ev = events.find((x) => x.id === chosenId);
    if (ev?.date_start) {
      setDateLocalValue(toLocalInputFromIso(ev.date_start));
      return;
    }

    setDateLocalValue(buildDefaultLocalDatetime(selectedDay));
  }

  async function saveDateForEvent() {
    if (!dateEventId) {
      alert("Selecciona una salida.");
      return;
    }
    if (!dateLocalValue) {
      alert("Elige una fecha y hora.");
      return;
    }

    setSavingDate(true);
    const iso = toIsoFromLocalDatetime(dateLocalValue);

    const { error } = await supabase.from("events").update({ date_start: iso }).eq("id", dateEventId);

    setSavingDate(false);

    if (error) {
      alert(error.message);
      return;
    }

    setDateModalOpen(false);
    await load();
    setTab("calendar");
  }

  async function removeDateForEvent(eventId: string) {
    const ok = confirm("¿Quitar la fecha de esta salida?");
    if (!ok) return;

    await supabase.from("events").update({ date_start: null, date_end: null }).eq("id", eventId);
    await load();
  }

  // ====== AVATAR ======
  function openAvatarModal() {
    setAvatarOpen(true);
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
  }

  function closeAvatarModal() {
    setAvatarOpen(false);
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
  }

  function onPickAvatar(file: File | null) {
    if (!file) return;
    if (!isImageFile(file)) {
      alert("Elige una imagen (jpg/png/webp).");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      alert("La imagen es muy pesada (máx 6MB).");
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function saveAvatar() {
    if (!avatarFile) {
      alert("Elige una imagen primero.");
      return;
    }

    const uid = await ensureSessionAndProfile();
    if (!uid) return;

    setSavingAvatar(true);

    try {
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const path = `${uid}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, {
        cacheControl: "3600",
        upsert: true,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", uid);
      if (profErr) throw profErr;

      setMeAvatarUrl(withCacheBust(publicUrl));
      closeAvatarModal();
    } catch (err: any) {
      alert(err?.message ?? "No se pudo guardar la foto.");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function removeAvatar() {
    const ok = confirm("¿Quitar tu foto de perfil?");
    if (!ok) return;

    const uid = await ensureSessionAndProfile();
    if (!uid) return;

    setSavingAvatar(true);
    try {
      await supabase.storage.from("avatars").remove([
        `${uid}/avatar.jpg`,
        `${uid}/avatar.jpeg`,
        `${uid}/avatar.png`,
        `${uid}/avatar.webp`,
      ]);

      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid);
      if (error) throw error;

      setMeAvatarUrl(null);
      closeAvatarModal();
    } catch (err: any) {
      alert(err?.message ?? "No se pudo quitar la foto.");
    } finally {
      setSavingAvatar(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayUser = meName || meEmail || "Usuario";
  const initials = initialsOf(displayUser);

  return (
    <main className="min-h-screen text-white">
      {/* Color blobs calmados */}
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
              <span className="text-white/60">Nuestra Agenda de planes</span>
            </div>

            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              Planes & recuerdos ✨
            </h1>

            <p className="mt-2 text-sm text-white/70 max-w-2xl">
              Pendientes para planear, Realizadas para reseñas y galería, y Calendario para asignar fechas después.
            </p>
          </div>

          {/* RIGHT SIDE: saludo + acciones */}
          <div className="flex items-center gap-3">
            {/* saludo grande (desktop) */}
            <div className="hidden md:flex items-center gap-4 rounded-3xl border border-white/12 bg-[linear-gradient(135deg,rgba(255,102,196,0.14),rgba(72,219,251,0.12),rgba(255,208,100,0.10))] px-5 py-3 backdrop-blur shadow-[0_14px_40px_rgba(0,0,0,0.30)]">
              <div className="relative">
                <button
                  onClick={openAvatarModal}
                  className="group relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/12 bg-black/25 text-sm font-semibold hover:bg-black/35 transition"
                  title="Cambiar foto"
                >
                  {meAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-white/90">{initials}</span>
                  )}

                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/25 grid place-items-center text-[11px] text-white/90">
                    Editar
                  </span>
                </button>

                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-black/40" />
              </div>

              <div className="leading-tight">
                <div className="text-[11px] text-white/60">{getGreetingLabel()}</div>
                <div className="text-base font-semibold text-white/92">Hola, {displayUser}</div>
                <div className="text-[11px] text-white/55 -mt-0.5">
                  Espero que estés teniendo un buen día.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openAvatarModal}
                  className="rounded-xl border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/85 hover:bg-white/10"
                >
                  Foto
                </button>

                <button
                  onClick={signOut}
                  className="rounded-xl border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/85 hover:bg-white/10"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>

            {/* mobile */}
            <div className="md:hidden flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/85 backdrop-blur">
              <button
                onClick={openAvatarModal}
                className="relative h-8 w-8 rounded-xl overflow-hidden border border-white/12 bg-black/25"
                title="Cambiar foto"
              >
                {meAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-white/90 font-semibold">
                    {initials.slice(0, 1)}
                  </span>
                )}
              </button>
              <div className="leading-tight">
                <div className="text-[11px] text-white/70">{getGreetingLabel()}</div>
                <div className="text-xs">
                  Hola, <span className="font-medium">{displayUser}</span>
                </div>
              </div>

              <button
                onClick={signOut}
                className="ml-2 rounded-xl border border-white/12 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                Salir
              </button>
            </div>
          </div>
        </header>

        {/* Tabs + Crear */}
        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-full md:w-auto rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur">
            <button
              onClick={() => setTab("planned")}
              className={clsx(
                "flex-1 md:flex-none rounded-xl px-4 py-2 text-sm transition",
                tab === "planned" ? "bg-white text-black shadow" : "text-white/80 hover:bg-white/10"
              )}
            >
              Pendientes ({planned.length})
            </button>
            <button
              onClick={() => setTab("done")}
              className={clsx(
                "flex-1 md:flex-none rounded-xl px-4 py-2 text-sm transition",
                tab === "done" ? "bg-white text-black shadow" : "text-white/80 hover:bg-white/10"
              )}
            >
              Realizadas ({done.length})
            </button>
            <button
              onClick={() => setTab("calendar")}
              className={clsx(
                "flex-1 md:flex-none rounded-xl px-4 py-2 text-sm transition",
                tab === "calendar" ? "bg-white text-black shadow" : "text-white/80 hover:bg-white/10"
              )}
            >
              Calendario 📅
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
              {tab === "planned" ? "🗓️ Pendientes" : tab === "done" ? "✅ Realizadas" : "📅 Calendario"}
              <span className="text-white/50"> · </span>
              <span className="text-white/60">
                {tab === "planned"
                  ? "Para crear planes bonitos y marcarlos cuando los hagamos."
                  : tab === "done"
                  ? "Deja reseña + subir fotos y abrir la galería."
                  : "Aquí asignas fechas a salidas ya creadas (no al crear)."}
              </span>
            </div>

            <div className="text-xs text-white/55">
              Spotify queda sonando aunque cambies de página 🎵
            </div>
          </div>
        </div>

        {/* ===================== LISTADO (Pendientes / Realizadas) ===================== */}
        {tab !== "calendar" && (
          <section className="mt-6">
            {loading && <div className="text-sm text-white/70">Cargando...</div>}

            {!loading && list.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
                {tab === "planned"
                  ? "No tenemos planes pendientes. Creemos una salida! ✨"
                  : "Aún no hemos realizado ninguna. En cuanto hagamos uno de los planes aparecerá aquí 😌"}
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

                      {e.date_start && (
                        <div className="absolute right-3 top-3 rounded-full px-3 py-1 text-xs border border-white/12 bg-black/35 backdrop-blur text-white/85">
                          📅 {formatQuitoDateTime(e.date_start)}
                        </div>
                      )}
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
                        {/* Añadir al calendario */}
                        <button
                          onClick={() => openDateModal(e.id)}
                          className="w-full rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm text-white/85 hover:bg-white/10"
                        >
                          {e.date_start ? "Editar fecha 📅" : "Añadir al calendario 📅"}
                        </button>

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
        )}

        {/* ===================== CALENDARIO ===================== */}
        {tab === "calendar" && (
          <section className="mt-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/90">📅 Calendario</div>
                  <div className="text-xs text-white/60 mt-1">
                    Añade fechas a salidas ya creadas (no al crear).
                  </div>
                </div>

                <button
                  onClick={() => openDateModal()}
                  className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Añadir salida al calendario ➕
                </button>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold text-white/90">Mes</div>

                  <div className="mt-3">
                    <DayPicker
                      mode="single"
                      selected={selectedDay}
                      onSelect={(d) => d && setSelectedDay(d)}
                      modifiers={{ hasEvent: daysWithEvents }}
                      modifiersClassNames={{ hasEvent: "hasEventDay" }}
                      className="rdp"
                    />
                  </div>

                  <style jsx global>{`
                    .rdp {
                      --rdp-cell-size: 42px;
                      --rdp-accent-color: rgba(255, 255, 255, 0.95);
                      --rdp-background-color: rgba(255, 255, 255, 0.1);
                      --rdp-outline: rgba(255, 255, 255, 0.2);
                      color: rgba(255, 255, 255, 0.85);
                    }
                    .rdp button {
                      border-radius: 14px;
                    }
                    .hasEventDay > button {
                      background: linear-gradient(
                        135deg,
                        rgba(255, 102, 196, 0.18),
                        rgba(72, 219, 251, 0.14),
                        rgba(255, 208, 100, 0.12)
                      );
                      border: 1px solid rgba(255, 255, 255, 0.12);
                    }
                  `}</style>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                    Día seleccionado:{" "}
                    <span className="text-white/90 font-medium">{format(selectedDay, "PPP")}</span>
                  </div>

                  <div className="mt-3 text-xs text-white/55">
                    Los días con planes tienen un fondo con gradiente.
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white/90">Planes del día</div>
                    <div className="text-xs text-white/55">
                      {loading ? "Cargando..." : `${eventsForSelectedDay.length} plan(es)`}
                    </div>
                  </div>

                  {!loading && eventsForSelectedDay.length === 0 && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                      No hay planes en este día. Usa “Añadir salida al calendario”.
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {eventsForSelectedDay.map((e) => (
                      <div key={e.id} className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
                        <div className="h-28 bg-black/30">
                          {e.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.cover_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-white/50 text-sm">
                              Sin portada
                            </div>
                          )}
                        </div>

                        <div className="p-4">
                          <div className="text-base font-semibold">{e.title}</div>
                          <div className="mt-2 text-xs text-white/70 space-y-1">
                            {e.date_start && <div>🕒 {formatQuitoTime(e.date_start)}</div>}
                            {e.location && <div className="truncate">📍 {e.location}</div>}
                          </div>

                          <div className="mt-3 grid gap-2">
                            <button
                              onClick={() => openDateModal(e.id)}
                              className="w-full rounded-2xl border border-white/12 bg-white/5 py-2 text-sm hover:bg-white/10"
                            >
                              Editar fecha
                            </button>
                            <button
                              onClick={() => removeDateForEvent(e.id)}
                              className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 py-2 text-sm text-red-100 hover:bg-red-500/15"
                            >
                              Quitar fecha
                            </button>

                            {e.status === "done" && (
                              <Link
                                href={`/event/${e.id}`}
                                className="w-full text-center rounded-2xl border border-white/12 bg-white/5 py-2 text-sm hover:bg-white/10"
                              >
                                Ver álbum 📸
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white/90">Salidas sin fecha</div>
                      <div className="text-xs text-white/55">{eventsNoDate.length}</div>
                    </div>

                    {eventsNoDate.length === 0 ? (
                      <div className="mt-3 text-sm text-white/70">Todas tienen fecha 🎉</div>
                    ) : (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {eventsNoDate.slice(0, 8).map((e) => (
                          <button
                            key={e.id}
                            onClick={() => openDateModal(e.id)}
                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                          >
                            <div className="font-medium text-white/90 truncate">{e.title}</div>
                            <div className="text-xs text-white/55 truncate">
                              {e.status === "planned" ? "Pendiente" : "Realizada"}
                              {e.location ? ` · ${e.location}` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-10 text-xs text-white/45">
          Our Journeys — un lugar donde nuestros planes tomarán sentido.
        </footer>
      </div>

      {/* MODAL AVATAR */}
      {avatarOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closeAvatarModal} />
          <div className="relative w-full max-w-xl rounded-[28px] border border-white/12 bg-black/55 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  👤 Foto de perfil
                </div>
                <div className="mt-2 text-lg font-semibold">Cambiar foto</div>
                <div className="text-sm text-white/60">Elige una imagen bonita (máx 6MB).</div>
              </div>

              <button
                className="rounded-xl border border-white/12 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
                onClick={closeAvatarModal}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60 mb-2">Vista previa</div>
                <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-[26px] border border-white/12 bg-black/25">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="preview" className="h-full w-full object-cover" />
                  ) : meAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-white/90 font-semibold text-2xl">
                      {initials}
                    </div>
                  )}
                </div>

                <button
                  onClick={removeAvatar}
                  disabled={savingAvatar}
                  className="mt-3 w-full rounded-2xl border border-red-300/25 bg-red-500/10 py-2 text-sm text-red-100 hover:bg-red-500/15 disabled:opacity-60"
                >
                  Quitar foto
                </button>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Subir nueva foto</div>
                <div className="mt-1 text-xs text-white/60">
                  Recomendado: cuadrada o vertical. JPG/PNG/WebP.
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                </div>

                <button
                  onClick={saveAvatar}
                  disabled={savingAvatar || !avatarFile}
                  className="mt-3 relative w-full overflow-hidden rounded-2xl py-2.5 text-sm font-medium text-black disabled:opacity-60"
                >
                  <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,102,196,0.95),rgba(72,219,251,0.92),rgba(255,208,100,0.90))]" />
                  <span className="absolute inset-0 opacity-40 blur-xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.8),transparent_45%)]" />
                  <span className="relative">{savingAvatar ? "Guardando..." : "Guardar foto ✨"}</span>
                </button>

                <div className="mt-2 text-[11px] text-white/50">
                  Tip: haz click en tu avatar del saludo para abrir este panel.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal reseña + fotos */}
      {reviewOpen && reviewEvent && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setReviewOpen(false)} />

          <div className="relative w-full max-w-3xl rounded-[28px] border border-white/12 bg-black/55 p-5 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  ✨ Reseñas & fotos
                  <span className="text-white/40">·</span>
                  <span className="text-white/60">Realizadas</span>
                </div>
                <div className="mt-2 text-xl font-semibold">{reviewEvent.title}</div>
                <div className="text-sm text-white/60">
                  Deja una reseña/comentario y sube fotos de nuestro plan juntos.
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
                  <div className="text-xs text-white/50">Se guarda para verla despues</div>
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
                  <div className="text-xs text-white/50 flex items-end">Puedes editarla luego.</div>
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

      {/* Modal: asignar fecha */}
      {dateModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDateModalOpen(false)} />

          <div className="relative w-full max-w-xl rounded-[28px] border border-white/12 bg-black/55 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  📅 Añadir al calendario
                </div>
                <div className="mt-2 text-lg font-semibold">Asignar fecha</div>
                <div className="text-sm text-white/60">
                  Selecciona una salida ya creada y ponle fecha/hora.
                </div>
              </div>

              <button
                className="rounded-xl border border-white/12 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
                onClick={() => setDateModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Salida</div>
                <select
                  value={dateEventId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setDateEventId(id);

                    const ev = events.find((x) => x.id === id);
                    if (ev?.date_start) {
                      setDateLocalValue(toLocalInputFromIso(ev.date_start));
                    } else {
                      setDateLocalValue(buildDefaultLocalDatetime(selectedDay));
                    }
                  }}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-white"
                >
                  <option value="">— Selecciona —</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.status === "planned" ? "Pendiente" : "Realizada"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">Fecha y hora</div>
                <input
                  type="datetime-local"
                  value={dateLocalValue}
                  onChange={(e) => setDateLocalValue(e.target.value)}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                />
                <div className="mt-1 text-[11px] text-white/50">
                  Puedes editarla luego desde el calendario o desde la tarjeta.
                </div>
              </div>

              <button
                onClick={saveDateForEvent}
                disabled={savingDate}
                className="mt-1 w-full rounded-2xl bg-white py-2.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
              >
                {savingDate ? "Guardando..." : "Guardar fecha 📌"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
