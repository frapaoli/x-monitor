"""Shared application state — avoids circular imports between main.py and API routers."""

app_state: dict = {}
