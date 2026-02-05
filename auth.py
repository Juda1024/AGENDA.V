from __future__ import annotations
import bcrypt
import streamlit as st

def _get_users() -> dict[str, str]:
    a = st.secrets["auth"]
    return {
        a["user1_name"]: a["user1_hash"],
        a["user2_name"]: a["user2_hash"],
    }

def verify_login(username: str, password: str) -> bool:
    users = _get_users()
    if username not in users:
        return False
    stored_hash = users[username].encode()
    return bcrypt.checkpw(password.encode(), stored_hash)

def require_login() -> tuple[bool, str]:
    if "auth_user" not in st.session_state:
        st.session_state.auth_user = None

    if st.session_state.auth_user:
        return True, st.session_state.auth_user

    # UI login
    st.markdown("<h2 style='margin-bottom:0.2rem;'>🔒 Iniciar sesión</h2>", unsafe_allow_html=True)
    st.caption("Solo dos usuarios autorizados pueden entrar.")

    with st.form("login_form", clear_on_submit=False):
        username = st.text_input("Usuario", placeholder="Escribe tu usuario")
        password = st.text_input("Contraseña", type="password", placeholder="••••••••")
        submitted = st.form_submit_button("Entrar ✨", use_container_width=True)

    if submitted:
        if verify_login(username.strip(), password):
            st.session_state.auth_user = username.strip()
            st.success("Sesión iniciada.")
            st.rerun()
        else:
            st.error("Usuario o contraseña incorrectos.")

    return False, ""
