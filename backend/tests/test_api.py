import sys

import pytest
from fastapi.testclient import TestClient

from app.main import app, _quotes

client = TestClient(app)


def syms(response):
    return [r["sym"] for r in response.json()]


def test_search_adani_finds_every_adani_stock():
    found = syms(client.get("/api/search", params={"q": "adani"}))
    assert {"ADANIENT", "ADANIPORTS", "ADANIPOWER"} <= set(found)
    assert "RELIANCE" not in found


def test_search_tolerates_a_typo():
    assert syms(client.get("/api/search", params={"q": "relaince"}))[0] == "RELIANCE"


def test_search_nickname_and_exact_symbol_rank_first():
    assert syms(client.get("/api/search", params={"q": "sbi"}))[0] == "SBIN"
    assert syms(client.get("/api/search", params={"q": "tcs"}))[0] == "TCS"


def test_search_empty_query_returns_nothing():
    assert client.get("/api/search", params={"q": ""}).json() == []


def test_stock_includes_company_facts():
    body = client.get("/api/stock/reliance").json()
    assert body["sym"] == "RELIANCE" and body["forecast"]["level"] == "Medium"
    assert body["facts"]["pe"] == 25.0


def test_stock_without_forecast_says_so():
    body = client.get("/api/stock/TINYCO").json()
    assert body["modelled"] is False and "enough" in body["message"]


def test_unknown_and_dangerous_symbols_are_rejected():
    assert client.get("/api/stock/NOPE").status_code == 404
    assert client.get("/api/stock/..%2F..%2Fetc%2Fpasswd").status_code == 404
    assert client.get("/api/stock/a b").status_code == 404


def test_compare_limits():
    assert len(client.get("/api/compare", params={"s": "SBIN,TCS"}).json()) == 2
    assert client.get("/api/compare", params={"s": "SBIN,TCS,RELIANCE,ADANIENT"}).status_code == 400
    assert client.get("/api/compare", params={"s": "NOPE"}).status_code == 404
    assert len(client.get("/api/compare", params={"s": "SBIN,SBIN"}).json()) == 1       # duplicates are merged


def test_explorer_filters_and_sorting():
    high = client.get("/api/explorer", params={"level": "High"}).json()
    assert high["total"] == 3 and all(r["level"] == "High" for r in high["items"])
    assert high["items"][0]["sym"] == "ADANIENT"                                       # riskiest first
    assert [r["sym"] for r in client.get("/api/explorer", params={"unusual": True}).json()["items"]] == ["SBIN"]
    assert client.get("/api/explorer", params={"sort": "calm"}).json()["items"][0]["sym"] == "TCS"
    assert client.get("/api/explorer", params={"level": "Huge"}).status_code == 400
    assert client.get("/api/explorer", params={"sector": "energy"}).json()["total"] == 1


def test_quote_falls_back_to_last_close_when_yahoo_is_unavailable(monkeypatch):
    monkeypatch.setitem(sys.modules, "yfinance", None)        # importing it now fails, like having no internet
    _quotes.clear()
    body = client.get("/api/quote/SBIN").json()
    assert body["source"] == "last close" and body["delayed"] is True and body["price"] == 100.0


def test_meta_hides_internal_details():
    body = client.get("/api/meta").json()
    assert body["asof"] == "2026-10-06" and "skipped" not in body


def test_popular_and_scoreboard():
    assert "RELIANCE" in syms(client.get("/api/popular"))
    assert client.get("/api/scoreboard").status_code == 200
    assert client.get("/api/health").json()["ok"] is True


def test_watchlist_rows_and_limit():
    rows = client.get("/api/watchlist", params={"s": "SBIN,TINYCO,NOPE"}).json()
    assert [r["sym"] for r in rows] == ["SBIN", "TINYCO"]
    assert rows[0]["unusual"] is True and len(rows[0]["spark"]) == 2 and rows[1]["modelled"] is False
    too_many = ",".join(f"S{i}" for i in range(51))
    assert client.get("/api/watchlist", params={"s": too_many}).status_code == 400
