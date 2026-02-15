#!/usr/bin/env python3
"""
Compare Market Cap EU.csv against the local reports index "database".

Default inputs:
  - Market Cap EU.csv
  - src/data/reportsIndex.json (uses the "c" field for company name)

Outputs a CSV containing only the rows whose companies are NOT found in the
reports index, using a few pragmatic matching heuristics:
  - normalized exact match (case/diacritics/punctuation/corp suffix tolerant)
  - compact match (ignores spaces)
  - single-token containment via token index (e.g., "Generali" vs "Assicurazioni Generali")
  - acronym match (e.g., "Banco Bilbao Vizcaya Argentaria" -> "BBVA")
  - symbol/ticker base match (e.g., "BBVA.MC" -> "BBVA")
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple


STOPWORDS: Set[str] = {
    "and",
    "of",
    "the",
    "de",
    "la",
    "le",
    "di",
    "del",
    "della",
    "van",
    "von",
    "der",
    "den",
    "du",
    "da",
    "dos",
    "das",
    "do",
    "y",
    "et",
}

# Tokens that are too generic to use as evidence for a "unique candidate" match.
GENERIC_TOKENS: Set[str] = {
    "bank",
    "banco",
    "banque",
    "insurance",
    "assurance",
    "reinsurance",
    "capital",
    "financial",
    "finance",
    "invest",
    "investments",
    "investment",
    "partners",
    "partner",
    "services",
    "service",
    "solutions",
    "technology",
    "technologies",
    "systems",
    "system",
    "international",
    "industries",
    "industry",
    "energy",
    "resources",
    "communications",
    "telecom",
    "telecommunications",
    "pharma",
    "pharmaceutical",
    "holding",
    "holdings",
    "group",
    "company",
    "companies",
    "corp",
    "corporation",
}

# Common trailing legal/corporate suffixes (normalized to lowercase tokens).
SUFFIX_TOKENS: Set[str] = {
    "se",
    "sa",
    "plc",
    "nv",
    "ag",
    "spa",
    "oyj",
    "ab",
    "as",
    "asa",
    "gmbh",
    "kgaa",
    "kg",
    "sarl",
    "bv",
    "co",
    "company",
    "corp",
    "corporation",
    "inc",
    "ltd",
    "limited",
    "holding",
    "holdings",
    "group",
}

# Patterns introduced by punctuation stripping, e.g. "S.p.A." -> ["s","p","a"]
SUFFIX_PATTERNS: List[Tuple[str, ...]] = [
    ("s", "p", "a"),
    ("s", "a"),
    ("s", "e"),
    ("a", "s"),
]

APOSTROPHES: Tuple[str, ...] = ("'", "\u2019", "\u2018", "\u0060", "\u00b4")

_NON_ALNUM_RE = re.compile(r"[^0-9a-z]+")
_WS_RE = re.compile(r"\s+")


def _strip_diacritics(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def clean_tokens(name: str) -> List[str]:
    s = _strip_diacritics((name or "").strip())
    s = s.lower()
    s = s.replace("&", " and ")
    for a in APOSTROPHES:
        s = s.replace(a, "")
    s = _NON_ALNUM_RE.sub(" ", s)
    s = _WS_RE.sub(" ", s).strip()
    return [t for t in s.split(" ") if t]


def strip_suffix(tokens: List[str]) -> List[str]:
    t = list(tokens)
    if not t:
        return []

    original = list(t)
    changed = True
    while t and changed:
        changed = False

        # Multi-token patterns first (e.g., ["s","p","a"] at the end)
        for pat in SUFFIX_PATTERNS:
            if len(t) >= len(pat) and tuple(t[-len(pat) :]) == pat:
                t = t[: -len(pat)]
                changed = True
                break
        if changed:
            continue

        # Single-token suffixes
        if t and t[-1] in SUFFIX_TOKENS:
            t = t[:-1]
            changed = True

    return t or original


def norm_str(tokens: List[str]) -> str:
    return " ".join(strip_suffix(tokens))


def compact_str(tokens: List[str]) -> str:
    return "".join(strip_suffix(tokens))


def acronym(tokens: List[str]) -> str:
    # Use tokens *before* suffix stripping (so "Holding" can contribute to CRH, etc.)
    out: List[str] = []
    for tok in tokens:
        if not tok or tok.isdigit() or tok in STOPWORDS:
            continue
        out.append(tok[0])
    return "".join(out)


def symbol_base(symbol: str) -> str:
    s = (symbol or "").strip()
    if not s:
        return ""

    # Typical formats: "BBVA.MC", "RMS.PA", "AIR:PA", "VOW3.DE"
    s = re.split(r"[.:/\s]", s, maxsplit=1)[0]

    # Sometimes formats like "RDS-A" exist; take left side.
    s = s.split("-", 1)[0]

    return s


def load_existing_companies(
    db_json: Path,
) -> Tuple[Set[str], Set[str], Dict[str, Set[str]]]:
    data = json.loads(db_json.read_text(encoding="utf-8"))

    existing_norm: Set[str] = set()
    existing_compact: Set[str] = set()
    token_index: Dict[str, Set[str]] = {}

    for row in data:
        if not isinstance(row, dict):
            continue
        name = row.get("c")
        if not name:
            continue

        toks = clean_tokens(str(name))
        ns = norm_str(toks)
        cs = compact_str(toks)
        existing_norm.add(ns)
        existing_compact.add(cs)

        for tok in strip_suffix(toks):
            token_index.setdefault(tok, set()).add(ns)

    return existing_norm, existing_compact, token_index


def row_exists(
    row: Dict[str, str],
    existing_norm: Set[str],
    existing_compact: Set[str],
    token_index: Dict[str, Set[str]],
) -> bool:
    name = row.get("Name", "") or ""

    toks = clean_tokens(name)
    stripped = strip_suffix(toks)
    ns = " ".join(stripped)
    cs = "".join(stripped)

    # 1) exact (normalized) company name match
    if ns in existing_norm or cs in existing_compact:
        return True

    # 2) symbol/ticker base match
    sym = symbol_base(row.get("Symbol", "") or "")
    if sym:
        sym_toks = clean_tokens(sym)
        if sym_toks:
            sym_ns = norm_str(sym_toks)
            sym_cs = compact_str(sym_toks)
            if sym_ns in existing_norm or sym_cs in existing_compact:
                return True
            sym_stripped = strip_suffix(sym_toks)
            if len(sym_stripped) == 1 and sym_stripped[0] in token_index:
                return True

    # 3) single-token containment (e.g. "Generali" matches "Assicurazioni Generali")
    if len(stripped) == 1 and stripped[0] in token_index:
        return True

    # 4) acronym match (e.g. Banco Bilbao Vizcaya Argentaria -> BBVA)
    acr = acronym(toks)
    if len(acr) >= 3 and (acr in existing_norm or acr in token_index):
        return True

    # 5) key-token disambiguation: if one unique existing company shares a
    # reasonably-specific token with this market-cap name, treat as a match.
    key_tokens = [
        t
        for t in stripped
        if len(t) >= 5 and t not in GENERIC_TOKENS and t not in STOPWORDS
    ]

    candidates: Set[str] = set()
    for t in key_tokens:
        candidates |= token_index.get(t, set())
        if len(candidates) > 5:
            break

    if len(candidates) == 1:
        return True

    return False


def read_market_cap_rows(path: Path) -> Tuple[List[str], List[Dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    return fieldnames, rows


def write_rows(path: Path, fieldnames: List[str], rows: Iterable[Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow(r)


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare EU market cap list vs reportsIndex.json")
    parser.add_argument("--market-cap-csv", default="Market Cap EU.csv", help="Input CSV")
    parser.add_argument(
        "--db-json",
        default="src/data/reportsIndex.json",
        help="Database JSON (expects company name in field 'c')",
    )
    parser.add_argument(
        "--out-csv",
        default="Market Cap EU_missing.csv",
        help="Output CSV of companies not found in the database",
    )
    args = parser.parse_args()

    market_cap_csv = Path(args.market_cap_csv)
    db_json = Path(args.db_json)
    out_csv = Path(args.out_csv)

    existing_norm, existing_compact, token_index = load_existing_companies(db_json)
    fieldnames, mc_rows = read_market_cap_rows(market_cap_csv)

    missing: List[Dict[str, str]] = []
    matched = 0
    for row in mc_rows:
        if row_exists(row, existing_norm, existing_compact, token_index):
            matched += 1
        else:
            missing.append(row)

    write_rows(out_csv, fieldnames, missing)

    print(f"Database companies (unique normalized): {len(existing_norm)}")  # noqa: T201
    print(f"Market cap rows: {len(mc_rows)}")  # noqa: T201
    print(f"Matched: {matched}")  # noqa: T201
    print(f"Missing: {len(missing)}")  # noqa: T201
    print(f"Wrote: {out_csv}")  # noqa: T201

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
