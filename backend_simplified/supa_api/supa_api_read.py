"""
Supabase RLS-safe read helpers

This module centralises *read-only* helpers that must always enforce
Row-Level-Security by attaching the caller's JWT to every request.
It avoids scattering `client.postgrest.auth(jwt)` boiler-plate across
multiple files and guarantees that each helper requires a JWT.

All functions include extensive console logging per project rules.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from supabase.client import create_client

# `postgrest.auth(jwt)` exists in all supabase-py versions (1.x → 2.x)
# so we use it instead of the version-specific ClientOptions class.
from config import SUPA_API_URL, SUPA_API_ANON_KEY

logger = logging.getLogger(__name__)

__all__ = [
    "get_user_transactions",
]

# 🔧 ————————————————————————————————————————————————————————————
# internal helper

def _jwt_client(jwt: str) -> Any:
    """Return a Supabase client whose PostgREST layer forwards *jwt*.

    We keep this tiny so it's easy to swap out if we ever migrate to a
    different auth pattern.  Extensive debug logging lets us inspect
    the final headers in production.
    """

    logger.info("🔐 [_jwt_client] Building user-authenticated client")

    client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
    client.postgrest.auth(jwt)

    # Log effective headers (best-effort ‑ guard for SDK internals)
    try:
        headers = client.postgrest.builder.session.headers  # type: ignore[attr-defined]
        logger.info("🔐 [_jwt_client] PostgREST headers: %s", headers)
    except Exception as exc:  # pragma: no cover
        logger.warning("⚠️ [_jwt_client] Could not introspect headers: %s", exc)

    return client


# 🔧 ————————————————————————————————————————————————————————————
# public helper

async def get_user_transactions(
    *,
    user_id: str,
    jwt: str,
    limit: int = 100,
    offset: int = 0,
    symbol: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch *user_id*'s transactions, newest-first, with full RLS.

    Parameters
    ----------
    user_id : str
        Supabase UUID from the validated session.
    jwt : str
        Raw JWT – mandatory so RLS (`auth.uid()`) is evaluated.
    limit, offset : int
        Pagination controls.
    symbol : str | None
        Optional filter for a single ticker.
    """

    #logger.info("📄 [get_user_transactions] uid=%s symbol=%s limit=%s offset=%s", user_id, symbol, limit, offset)

    client = _jwt_client(jwt)

    query = (
        client.table("transactions")
        .select("*")
        .eq("user_id", user_id)  # defence-in-depth – redundant but harmless
        .order("date", desc=True)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if symbol:
        query = query.eq("symbol", symbol)

    #logger.info("📡 [get_user_transactions] Executing PostgREST query …")
    resp = query.execute()

    rows: List[Dict[str, Any]] = resp.data or []  # supabase-py returns None when empty
    #logger.info("📈 [get_user_transactions] Retrieved %d rows", len(rows))

    return rows 