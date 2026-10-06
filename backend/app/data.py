"""Reads the files the nightly job wrote (app_data/*.json), from disk or from a web address, with a small cache.

Environment variables:
    DATA_DIR        folder with the JSON files (default: ../app_data next to the backend)
    DATA_BASE_URL   if set, files are fetched from this web address instead (e.g. a raw GitHub URL)
    DATA_TTL_SECONDS  how long a file stays cached (default 600)
"""
import json
import os
import re
import threading
from pathlib import Path

import httpx
from cachetools import TTLCache

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[2] / "app_data"))
DATA_BASE_URL = os.environ.get("DATA_BASE_URL", "").rstrip("/")
_cache = TTLCache(maxsize=3000, ttl=int(os.environ.get("DATA_TTL_SECONDS", "600")))
_lock = threading.Lock()

SYMBOL_PATTERN = re.compile(r"^[A-Z0-9&_.\-]{1,25}$")     # only these characters ever reach a file path or a URL


def clean_symbol(raw):
    sym = (raw or "").strip().upper()
    return sym if SYMBOL_PATTERN.match(sym) else None


def load_json(relative_path):
    """Return the parsed file, or None if it does not exist."""
    with _lock:
        if relative_path in _cache:
            return _cache[relative_path]
    data = None
    if DATA_BASE_URL:
        try:
            response = httpx.get(f"{DATA_BASE_URL}/{relative_path}", timeout=20)
            if response.status_code == 200:
                data = response.json()
        except httpx.HTTPError:
            data = None
    else:
        path = DATA_DIR / relative_path
        if path.exists():
            data = json.loads(path.read_text())
    if data is not None:
        with _lock:
            _cache[relative_path] = data
    return data


def clear_cache():
    with _lock:
        _cache.clear()
