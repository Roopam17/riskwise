"""Stock search: partial names, nicknames, and typo tolerance. Typing "adani" finds every Adani stock."""

NICKNAMES = {
    "SBIN": "sbi", "RELIANCE": "ril", "HDFCBANK": "hdfc", "TCS": "tata consultancy", "HINDUNILVR": "hul",
    "LT": "l&t", "ICICIBANK": "icici", "BAJFINANCE": "bajaj fin", "MARUTI": "maruti suzuki", "ITC": "itc",
    "INFY": "infosys", "BHARTIARTL": "airtel", "ASIANPAINT": "asian paints", "TITAN": "titan", "WIPRO": "wipro",
    "ONGC": "oil and natural gas", "NTPC": "ntpc", "COALINDIA": "coal india", "TATAMOTORS": "tata motors",
    "M&M": "mahindra", "KOTAKBANK": "kotak", "AXISBANK": "axis", "ULTRACEMCO": "ultratech", "SUNPHARMA": "sun pharma",
}


def _lev(a, b):
    """Number of single-letter edits (insert, delete, change) to turn a into b."""
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def score(entry, q):
    sym, name = entry["sym"].lower(), entry["name"].lower()
    words = name.replace("-", " ").split()
    nick = NICKNAMES.get(entry["sym"], "")
    if sym == q:
        return 100
    if sym.startswith(q):
        return 90
    if name.startswith(q):
        return 85
    if any(w.startswith(q) for w in words):
        return 80
    if nick and nick.startswith(q):
        return 75
    if q in name or q in sym:
        return 60
    if len(q) > 3:
        tolerance = 2 if len(q) >= 6 else 1
        if any(_lev(w[: len(q)], q) <= tolerance for w in words + [sym]):
            return 40
    return 0


def search(index, query, limit=8):
    q = (query or "").strip().lower()
    if not q:
        return []
    scored = [(score(e, q), e) for e in index]
    scored = [(s, e) for s, e in scored if s > 0]
    # best score first; stocks we have a forecast for come before ones we do not; then shorter symbols
    scored.sort(key=lambda x: (-x[0], not x[1].get("modelled", False), len(x[1]["sym"]), x[1]["sym"]))
    return [e for _, e in scored[:limit]]
