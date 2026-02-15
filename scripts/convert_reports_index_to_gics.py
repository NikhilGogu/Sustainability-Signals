#!/usr/bin/env python3
"""
Convert src/data/reportsIndex.json from SASB SICS (current dataset) to GICS.

The UI currently expects two classification strings per report:
  - s: Sector
  - i: Industry

After running this script:
  - s becomes the GICS Sector (e.g., "Industrials")
  - i becomes the GICS Industry Group (e.g., "Capital Goods")
  - ss stores the original SICS sector
  - si stores the original SICS industry

This is a pragmatic crosswalk (SICS industry -> GICS sector + industry group).
If you add new SICS industries to the index, extend SICS_INDUSTRY_TO_GICS below.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Tuple


IndexRow = Dict[str, object]


GICS_SECTORS = {
    "Energy",
    "Materials",
    "Industrials",
    "Consumer Discretionary",
    "Consumer Staples",
    "Health Care",
    "Financials",
    "Information Technology",
    "Communication Services",
    "Utilities",
    "Real Estate",
}

# Industry Group names reflect the official GICS hierarchy (post-2018 sector changes).
# We allow the 2023 retail renames commonly seen in data vendors.
GICS_INDUSTRY_GROUPS = {
    "Energy",
    "Materials",
    "Capital Goods",
    "Commercial & Professional Services",
    "Transportation",
    "Automobiles & Components",
    "Consumer Durables & Apparel",
    "Consumer Services",
    "Retailing",
    "Consumer Discretionary Distribution & Retail",
    "Consumer Staples Distribution & Retail",
    "Food & Staples Retailing",
    "Food, Beverage & Tobacco",
    "Household & Personal Products",
    "Health Care Equipment & Services",
    "Pharmaceuticals, Biotechnology & Life Sciences",
    "Banks",
    "Financial Services",
    "Insurance",
    "Software & Services",
    "Technology Hardware & Equipment",
    "Semiconductors & Semiconductor Equipment",
    "Telecommunication Services",
    "Media & Entertainment",
    "Utilities",
    "Real Estate",
}


def _norm_key(s: str) -> str:
    # Normalize dashes, whitespace, and casing differences we see in CSV/JSON edits.
    x = (s or "").strip()
    x = x.replace("\u2013", "-").replace("\u2014", "-").replace("\u2212", "-")
    x = " ".join(x.split())
    return x


# Crosswalk: SASB SICS industry -> (GICS sector, GICS industry group)
SICS_INDUSTRY_TO_GICS: Dict[str, Tuple[str, str]] = {
    "Advertising & Marketing": ("Communication Services", "Media & Entertainment"),
    "Aerospace & Defence": ("Industrials", "Capital Goods"),
    "Agricultural Products": ("Consumer Staples", "Food, Beverage & Tobacco"),
    "Air Freight & Logistics": ("Industrials", "Transportation"),
    "Airlines": ("Industrials", "Transportation"),
    "Alcoholic Beverages": ("Consumer Staples", "Food, Beverage & Tobacco"),
    "Apparel, Accessories & Footwear": ("Consumer Discretionary", "Consumer Durables & Apparel"),
    "Appliance Manufacturing": ("Consumer Discretionary", "Consumer Durables & Apparel"),
    "Asset Management & Custody Activities": ("Financials", "Financial Services"),
    "Auto Parts": ("Consumer Discretionary", "Automobiles & Components"),
    "Automobiles": ("Consumer Discretionary", "Automobiles & Components"),
    "Biotechnology & Pharmaceuticals": ("Health Care", "Pharmaceuticals, Biotechnology & Life Sciences"),
    "Building Products & Furnishings": ("Industrials", "Capital Goods"),
    "Car Rental & Leasing": ("Industrials", "Transportation"),
    "Casinos & Gaming": ("Consumer Discretionary", "Consumer Services"),
    "Chemicals": ("Materials", "Materials"),
    "Coal Operations": ("Energy", "Energy"),
    "Commercial Banks": ("Financials", "Banks"),
    "Construction Materials": ("Materials", "Materials"),
    "Consumer Finance": ("Financials", "Financial Services"),
    "Containers & Packaging": ("Materials", "Materials"),
    "Drug Retailers": ("Consumer Staples", "Consumer Staples Distribution & Retail"),
    "E-Commerce": ("Consumer Discretionary", "Consumer Discretionary Distribution & Retail"),
    "E-commerce": ("Consumer Discretionary", "Consumer Discretionary Distribution & Retail"),
    "Electric Utilities & Power Generators": ("Utilities", "Utilities"),
    "Electrical & Electronic Equipment": ("Industrials", "Capital Goods"),
    "Electronic Manufacturing Services & Original Design Manufacturing": (
        "Information Technology",
        "Technology Hardware & Equipment",
    ),
    "Engineering & Construction Services": ("Industrials", "Capital Goods"),
    "Food Retailers & Distributors": ("Consumer Staples", "Consumer Staples Distribution & Retail"),
    "Forestry Management": ("Materials", "Materials"),
    "Fuel Cells & Industrial Batteries": ("Industrials", "Capital Goods"),
    "Gas Utilities & Distributors": ("Utilities", "Utilities"),
    "Hardware": ("Information Technology", "Technology Hardware & Equipment"),
    "Health Care Delivery": ("Health Care", "Health Care Equipment & Services"),
    "Health Care Distributors": ("Health Care", "Health Care Equipment & Services"),
    "Home Builders": ("Consumer Discretionary", "Consumer Durables & Apparel"),
    "Hotels & Lodging": ("Consumer Discretionary", "Consumer Services"),
    "Household & Personal Products": ("Consumer Staples", "Household & Personal Products"),
    "Industrial Machinery & Goods": ("Industrials", "Capital Goods"),
    "Insurance": ("Financials", "Insurance"),
    "Internet Media & Services": ("Communication Services", "Media & Entertainment"),
    "Investment Banking & Brokerage": ("Financials", "Financial Services"),
    "Iron & Steel Producers": ("Materials", "Materials"),
    "Leisure Facilities": ("Consumer Discretionary", "Consumer Services"),
    "Marine Transportation": ("Industrials", "Transportation"),
    "Meat, Poultry & Dairy": ("Consumer Staples", "Food, Beverage & Tobacco"),
    "Media & Entertainment": ("Communication Services", "Media & Entertainment"),
    "Medical Equipment & Supplies": ("Health Care", "Health Care Equipment & Services"),
    "Metals & Mining": ("Materials", "Materials"),
    "Multiline and Specialty Retailers & Distributors": (
        "Consumer Discretionary",
        "Consumer Discretionary Distribution & Retail",
    ),
    "Non-Alcoholic Beverages": ("Consumer Staples", "Food, Beverage & Tobacco"),
    "Oil & Gas - Exploration & Production": ("Energy", "Energy"),
    "Oil & Gas - Midstream": ("Energy", "Energy"),
    "Oil & Gas - Refining & Marketing": ("Energy", "Energy"),
    "Oil & Gas - Services": ("Energy", "Energy"),
    "Processed Foods": ("Consumer Staples", "Food, Beverage & Tobacco"),
    "Professional & Commercial Services": ("Industrials", "Commercial & Professional Services"),
    "Pulp & Paper Products": ("Materials", "Materials"),
    "Rail Transportation": ("Industrials", "Transportation"),
    "Real Estate": ("Real Estate", "Real Estate"),
    "Real Estate Services": ("Real Estate", "Real Estate"),
    "Restaurants": ("Consumer Discretionary", "Consumer Services"),
    "Road Transportation": ("Industrials", "Transportation"),
    "Security & Commodity Exchange": ("Financials", "Financial Services"),
    "Semiconductors": ("Information Technology", "Semiconductors & Semiconductor Equipment"),
    "Software & IT Services": ("Information Technology", "Software & Services"),
    "Solar Technology & Project Developers": ("Industrials", "Capital Goods"),
    "Telecommunication Services": ("Communication Services", "Telecommunication Services"),
    "Tobacco": ("Consumer Staples", "Food, Beverage & Tobacco"),
    "Toys & Sporting Goods": ("Consumer Discretionary", "Consumer Durables & Apparel"),
    "Waste Management": ("Industrials", "Commercial & Professional Services"),
    "Water Utilities & Services": ("Utilities", "Utilities"),
    "Wind Technology & Project Developers": ("Industrials", "Capital Goods"),
}


# Optional company-level overrides for known mismatches in the source classification.
# Key is the *exact* company string in reportsIndex.json ("c" field).
COMPANY_TO_GICS_OVERRIDE: Dict[str, Tuple[str, str]] = {
    # Adyen is typically classified under Financials (transaction & payment processing),
    # even though the source dataset puts it under "E-Commerce".
    "Adyen": ("Financials", "Financial Services"),
}


def main() -> int:
    index_path = Path("src/data/reportsIndex.json")
    rows = json.loads(index_path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise SystemExit(f"Index must be a list: {index_path}")

    missing: Dict[str, int] = {}
    for r in rows:
        if not isinstance(r, dict):
            raise SystemExit("Index rows must be objects")

        company = str(r.get("c") or "")
        current_sector = str(r.get("s") or "")
        current_group = str(r.get("i") or "")

        # If a row already looks like GICS and doesn't carry legacy SICS fields,
        # leave it as-is (common for newly imported rows).
        if not r.get("si") and current_sector in GICS_SECTORS and current_group in GICS_INDUSTRY_GROUPS:
            continue

        # Prefer preserved legacy labels if present; fall back to current fields.
        sics_sector = str(r.get("ss") or current_sector or "")
        sics_industry_raw = str(r.get("si") or current_group or "")
        sics_industry = _norm_key(sics_industry_raw)

        # Preserve original labels once.
        r.setdefault("ss", sics_sector)
        r.setdefault("si", sics_industry_raw)

        gics = COMPANY_TO_GICS_OVERRIDE.get(company)
        if gics is None:
            gics = SICS_INDUSTRY_TO_GICS.get(sics_industry)

        if gics is None:
            missing[sics_industry] = missing.get(sics_industry, 0) + 1
            # Keep placeholders to avoid losing data if you want to inspect after a partial run.
            r["s"] = "Unknown"
            r["i"] = "Unknown"
            continue

        gics_sector, gics_group = gics
        if gics_sector not in GICS_SECTORS:
            raise SystemExit(f"Invalid GICS sector for {company}: {gics_sector!r}")
        if gics_group not in GICS_INDUSTRY_GROUPS:
            raise SystemExit(f"Invalid GICS industry group for {company}: {gics_group!r}")

        r["s"] = gics_sector
        r["i"] = gics_group

    if missing:
        missing_items = "\n".join(f"- {k!r}: {v}" for k, v in sorted(missing.items()))
        raise SystemExit(
            "Missing SICS->GICS mappings for the following SICS industries:\n" + missing_items
        )

    index_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated: {index_path}")  # noqa: T201
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
