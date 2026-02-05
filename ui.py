from __future__ import annotations
import re
import streamlit as st
from streamlit.components.v1 import html

def inject_css() -> None:
    st.markdown(
        """
        <style>
        .app-wrap { max-width: 1100px; margin: 0 auto; }
        .hero {
            padding: 18px 18px 14px 18px;
            border-radius: 18px;
            background: linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02));
            border: 1px solid rgba(255,255,255,0.12);
            backdrop-filter: blur(8px);
        }
        .muted { opacity: .78; }
        .card {
            border-radius: 18px;
            border: 1px solid rgba(255,255,255,0.10);
            padding: 14px;
            background: rgba(255,255,255,0.04);
        }
        .pill {
            display:inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            border: 1px solid rgba(255,255,255,0.15);
            opacity: .9;
        }
        .pill-planned { background: rgba(99, 102, 241, 0.15); }
        .pill-done { background: rgba(16, 185, 129, 0.15); }
        .event-title { font-size: 18px; font-weight: 700; margin: 0; }
        .event-meta { margin: 6px 0 0 0; }
        .soft-line { height: 1px; background: rgba(255,255,255,0.10); margin: 10px 0; }
        .small { font-size: 12px; opacity: .8; }
        </style>
        """,
        unsafe_allow_html=True,
    )

def page_shell_start() -> None:
    st.markdown("<div class='app-wrap'>", unsafe_allow_html=True)

def page_shell_end() -> None:
    st.markdown("</div>", unsafe_allow_html=True)

def spotify_embed_sidebar() -> None:
    playlist_url = st.secrets["spotify"]["playlist_url"]
    playlist_id = extract_spotify_playlist_id(playlist_url)
    if not playlist_id:
        st.sidebar.warning("No pude leer tu playlist_url. Revisa el formato.")
        return

    st.sidebar.markdown("### 🎵 Música")
    st.sidebar.caption("Reproduce desde aquí sin romper la estética.")
    # Player compacto
    src = f"https://open.spotify.com/embed/playlist/{playlist_id}?utm_source=generator"
    html(
        f"""
        <iframe style="border-radius:14px" src="{src}" width="100%" height="152"
        frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"></iframe>
        """,
        height=170,
    )

def extract_spotify_playlist_id(url: str) -> str | None:
    # soporta: https://open.spotify.com/playlist/{id}?...
    m = re.search(r"open\.spotify\.com/playlist/([a-zA-Z0-9]+)", url)
    return m.group(1) if m else None
