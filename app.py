from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

import streamlit as st
from PIL import Image

from auth import require_login
from db import (
    init_db, list_events, create_event, save_uploaded_file,
    COVERS_DIR, PHOTOS_DIR, set_event_status, get_event,
    upsert_review, get_reviews, add_photo, get_photos, delete_event
)
from ui import inject_css, page_shell_start, page_shell_end, spotify_embed_sidebar

st.set_page_config(
    page_title="Agenda de Salidas ✨",
    page_icon="💫",
    layout="wide",
)

def main() -> None:
    init_db()
    inject_css()
    spotify_embed_sidebar()

    ok, user = require_login()
    if not ok:
        return

    page_shell_start()

    # Header
    st.markdown(
        """
        <div class="hero">
          <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px;">
            <div>
              <h1 style="margin:0;">💫 Agenda de Salidas</h1>
              <div class="muted">Planes bonitos, recuerdos, reseñas y álbum por salida.</div>
            </div>
            <div class="muted" style="text-align:right;">
              Sesión: <b>{}</b>
            </div>
          </div>
        </div>
        """.format(user),
        unsafe_allow_html=True,
    )

    st.write("")

    colA, colB = st.columns([1.05, 1], gap="large")
    with colA:
        create_event_panel()

    with colB:
        events_browser_panel(user)

    page_shell_end()

def create_event_panel() -> None:
    st.subheader("➕ Crear nueva salida")
    st.caption("No necesitas fecha: es más estilo lista de planes con portada y link.")

    with st.form("create_event_form", clear_on_submit=True):
        title = st.text_input("Título", placeholder="Ej: Tour de luciérnagas")
        location = st.text_input("Ubicación", placeholder="Ej: Mindo / Quito / donde sea")
        link = st.text_input("Link (opcional)", placeholder="YouTube / TikTok / Google Maps / etc.")
        cover = st.file_uploader("Foto de portada (opcional)", type=["png", "jpg", "jpeg"], accept_multiple_files=False)
        submitted = st.form_submit_button("Guardar salida ✨", use_container_width=True)

    if submitted:
        if not title.strip():
            st.error("El título es obligatorio.")
            return

        cover_path = None
        if cover is not None:
            ext = Path(cover.name).suffix.lower().replace(".", "") or "jpg"
            fname = f"cover_{uuid.uuid4().hex}.{ext}"
            dst = COVERS_DIR / fname
            cover_path = save_uploaded_file(dst, cover.getvalue())

        event_id = create_event(title, location, link, cover_path)
        st.success(f"Salida creada (# {event_id}).")
        st.rerun()

def events_browser_panel(user: str) -> None:
    st.subheader("📌 Tus salidas")
    tab1, tab2, tab3 = st.tabs(["Pendientes", "Realizadas", "Todas"])

    with tab1:
        render_event_list(user, status="planned")

    with tab2:
        render_event_list(user, status="done")

    with tab3:
        render_event_list(user, status=None)

def render_event_list(user: str, status: Optional[str]) -> None:
    events = list_events(status=status)
    if not events:
        st.info("Aquí no hay nada todavía. Crea una salida a la izquierda ✨")
        return

    # selector de evento
    options = {
        f"#{e['id']} · {e['title']}": int(e["id"]) for e in events
    }
    selected_label = st.selectbox("Selecciona una salida", list(options.keys()), key=f"sel_{status}")
    event_id = options[selected_label]
    event = get_event(event_id)
    if not event:
        st.error("No se encontró el evento.")
        return

    render_event_detail(user, event_id)

def render_event_detail(user: str, event_id: int) -> None:
    event = get_event(event_id)
    if not event:
        return

    status = event["status"]
    pill_class = "pill-done" if status == "done" else "pill-planned"
    pill_text = "REALIZADA ✅" if status == "done" else "PENDIENTE ⏳"

    left, right = st.columns([0.9, 1.1], gap="large")

    with left:
        st.markdown("<div class='card'>", unsafe_allow_html=True)
        st.markdown(
            f"<div class='pill {pill_class}'>{pill_text}</div>",
            unsafe_allow_html=True
        )
        st.markdown(f"<p class='event-title'>{event['title']}</p>", unsafe_allow_html=True)

        meta = []
        if event["location"]:
            meta.append(f"📍 {event['location']}")
        if event["link"]:
            meta.append(f"🔗 {event['link']}")
        meta_line = " · ".join(meta) if meta else "<span class='muted'>Sin detalles extra</span>"
        st.markdown(f"<p class='event-meta'>{meta_line}</p>", unsafe_allow_html=True)

        st.markdown("<div class='soft-line'></div>", unsafe_allow_html=True)

        if event["cover_path"]:
            try:
                img = Image.open(event["cover_path"])
                st.image(img, use_container_width=True, caption="Portada")
            except Exception:
                st.warning("No pude cargar la portada.")

        # Acciones
        col1, col2, col3 = st.columns(3)
        with col1:
            if status != "done":
                if st.button("Marcar realizada ✅", use_container_width=True):
                    set_event_status(event_id, "done")
                    st.rerun()
            else:
                if st.button("Volver a pendiente ⏳", use_container_width=True):
                    set_event_status(event_id, "planned")
                    st.rerun()

        with col2:
            if st.button("Eliminar 🗑️", use_container_width=True):
                delete_event(event_id)
                st.rerun()

        with col3:
            st.download_button(
                "Compartir resumen 📄",
                data=build_summary_text(event_id),
                file_name=f"salida_{event_id}_resumen.txt",
                use_container_width=True
            )

        st.markdown("</div>", unsafe_allow_html=True)

    with right:
        if status == "done":
            render_done_extras(user, event_id)
        else:
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            st.subheader("✨ Cuando la hagan…")
            st.write("Aquí aparecerán las **reseñas de cada uno** y el **álbum de fotos**.")
            st.caption("Tip: cuando ya esté realizada, marca ✅ y se habilita todo.")
            st.markdown("</div>", unsafe_allow_html=True)

def build_summary_text(event_id: int) -> str:
    e = get_event(event_id)
    if not e:
        return "Evento no encontrado."
    reviews = get_reviews(event_id)
    photos = get_photos(event_id)

    lines = []
    lines.append(f"Salida #{e['id']}: {e['title']}")
    lines.append(f"Estado: {e['status']}")
    lines.append(f"Ubicación: {e['location'] or '-'}")
    lines.append(f"Link: {e['link'] or '-'}")
    lines.append("")
    lines.append("RESEÑAS")
    if reviews:
        for r in reviews:
            lines.append(f"- {r['username']}: {r['rating'] or '-'} /5")
            lines.append(f"  {r['review_text'] or ''}")
    else:
        lines.append("- (sin reseñas)")
    lines.append("")
    lines.append(f"FOTOS: {len(photos)}")
    return "\n".join(lines)

def render_done_extras(user: str, event_id: int) -> None:
    st.markdown("<div class='card'>", unsafe_allow_html=True)
    st.subheader("📝 Reseña + 📸 Álbum")

    # Reseña (una por usuario)
    with st.expander("Escribir/editar mi reseña", expanded=True):
        rating = st.slider("Calificación (opcional)", 1, 5, 5)
        text = st.text_area("Tu reseña", placeholder="¿Qué fue lo mejor? ¿Qué repetirían? ¿Algo gracioso que pasó?")
        if st.button("Guardar reseña 💾", use_container_width=True):
            upsert_review(event_id, user, int(rating), text)
            st.success("Reseña guardada.")
            st.rerun()

    # Mostrar reseñas de ambos
    st.markdown("<div class='soft-line'></div>", unsafe_allow_html=True)
    st.markdown("#### 💬 Reseñas")
    reviews = get_reviews(event_id)
    if not reviews:
        st.info("Aún no hay reseñas. ¡Deja la primera! ✨")
    else:
        for r in reviews:
            st.markdown(
                f"""
                <div class="card" style="margin-bottom:10px;">
                  <div style="display:flex; justify-content:space-between; gap:12px;">
                    <div><b>👤 {r['username']}</b></div>
                    <div class="pill pill-planned">⭐ {r['rating'] or '-'} / 5</div>
                  </div>
                  <div class="small" style="margin-top:6px;">{(r['review_text'] or '').replace('\n','<br>')}</div>
                </div>
                """,
                unsafe_allow_html=True
            )

    # Subir fotos
    st.markdown("<div class='soft-line'></div>", unsafe_allow_html=True)
    st.markdown("#### 📸 Subir fotos al álbum")
    files = st.file_uploader(
        "Selecciona fotos",
        type=["png", "jpg", "jpeg"],
        accept_multiple_files=True,
        key=f"photos_{event_id}",
        label_visibility="collapsed",
    )
    if files:
        if st.button("Guardar fotos al álbum 📌", use_container_width=True):
            saved = 0
            for f in files:
                ext = Path(f.name).suffix.lower().replace(".", "") or "jpg"
                fname = f"photo_{event_id}_{uuid.uuid4().hex}.{ext}"
                dst = PHOTOS_DIR / fname
                p = save_uploaded_file(dst, f.getvalue())
                add_photo(event_id, user, p)
                saved += 1
            st.success(f"Listo: {saved} foto(s) añadida(s).")
            st.rerun()

    # Galería
    st.markdown("#### 🖼️ Álbum")
    photos = get_photos(event_id)
    if not photos:
        st.caption("Aún no hay fotos en este álbum.")
    else:
        cols = st.columns(3)
        for i, ph in enumerate(photos):
            with cols[i % 3]:
                try:
                    st.image(ph["photo_path"], use_container_width=True)
                    st.caption(f"Subida por {ph['username']}")
                except Exception:
                    st.warning("No pude cargar una foto.")

    st.markdown("</div>", unsafe_allow_html=True)

if __name__ == "__main__":
    main()
