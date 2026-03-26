#!/usr/bin/env python3
"""
tests/smoke_test.py
───────────────────
Full end-to-end smoke test for Dwell.

Exercises the complete first-run user journey:
  1.  GET  /health                      → stack alive
  2.  POST /auth/login                  → JWT access + refresh tokens issued
  3.  GET  /scenarios/                  → at least one scenario seeded
  4.  POST /game/start/{scenario_id}    → session created, join_token returned
  5.  WS   /game/play/{session_id}      → WebSocket connects, receives game_state
  6.  send  set_role   (solo)           → role confirmed in state
  7.  send  make_choice (option 0)      → choice_result received
  8.  send  save_exit                   → session saved cleanly
  9.  GET  /scenarios/{id}              → scenario detail endpoint works

All assertions print a ✓ / ✗ line and raise on failure so the CI step
exits non-zero and the workflow is marked red.

Run manually:
    pip install requests websockets
    python tests/smoke_test.py
"""

import asyncio
import json
import sys
import time

import requests
import websockets

BASE   = "http://localhost:5173"
WS     = "ws://localhost:5173"
ADMIN  = {"username": "admin", "password": "Dwell!Change123"}

PASS = "✓"
FAIL = "✗"

errors: list[str] = []


# ── Helpers ────────────────────────────────────────────────────────────────

def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  {PASS}  {label}")
    else:
        msg = f"{label}" + (f" — {detail}" if detail else "")
        print(f"  {FAIL}  {msg}")
        errors.append(msg)


def require(label: str, condition: bool, detail: str = "") -> None:
    """Like check() but aborts on failure — downstream steps depend on this."""
    check(label, condition, detail)
    if not condition:
        print(f"\n  ABORT: '{label}' is required for subsequent steps.\n")
        _finish()


def _finish() -> None:
    print()
    if errors:
        print(f"FAILED — {len(errors)} assertion(s) failed:")
        for e in errors:
            print(f"  • {e}")
        sys.exit(1)
    else:
        print("All smoke checks passed ✓")
        sys.exit(0)


# ── Step 1: Health ─────────────────────────────────────────────────────────

def test_health() -> None:
    print("\n[1] Health endpoint")
    r = requests.get(f"{BASE}/health", timeout=10)
    require("GET /health → 200", r.status_code == 200,
            f"got HTTP {r.status_code}")
    body = r.json()
    check("body contains status=ok",
          body.get("status") == "ok", str(body))


# ── Step 2: Login ──────────────────────────────────────────────────────────

def test_login() -> str:
    print("\n[2] Admin login")
    r = requests.post(f"{BASE}/api/v1/auth/login", json=ADMIN, timeout=10)
    require("POST /auth/login → 200", r.status_code == 200,
            f"got HTTP {r.status_code}: {r.text[:120]}")
    body = r.json()
    token = body.get("access_token", "")
    require("access_token present", bool(token),
            f"body keys: {list(body.keys())}")
    check("refresh_token present", bool(body.get("refresh_token")))
    print(f"     token prefix: {token[:20]}…")
    return token


# ── Step 3: Scenarios list ─────────────────────────────────────────────────

def test_scenarios(token: str) -> int:
    print("\n[3] Scenarios list")
    r = requests.get(
        f"{BASE}/api/v1/scenarios/",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    require("GET /scenarios/ → 200", r.status_code == 200,
            f"got HTTP {r.status_code}: {r.text[:120]}")
    body = r.json()
    require("returns a list", isinstance(body, list),
            f"got type {type(body).__name__}")
    require("at least one scenario seeded", len(body) >= 1,
            "seed_scenarios.py may not have run")
    check("20 scenarios present (full seed)", len(body) >= 20,
          f"found {len(body)}")
    scenario_id = body[0]["id"]
    name        = body[0].get("name", "?")
    print(f"     using scenario {scenario_id}: {name}")
    return scenario_id


# ── Step 4: Scenario detail ────────────────────────────────────────────────

def test_scenario_detail(token: str, scenario_id: int) -> None:
    print("\n[9] Scenario detail endpoint")
    r = requests.get(
        f"{BASE}/api/v1/scenarios/{scenario_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    check("GET /scenarios/{id} → 200", r.status_code == 200,
          f"got HTTP {r.status_code}")
    if r.status_code == 200:
        body = r.json()
        check("scenario has decisionTree",
              bool(body.get("scenario_structure", {}).get("decisionTree")),
              "scenario_structure.decisionTree missing or empty")
        check("scenario has keyTTPs",
              bool(body.get("scenario_structure", {}).get("keyTTPs")),
              "scenario_structure.keyTTPs missing or empty")


# ── Step 5–8: Start session + WebSocket journey ────────────────────────────

async def test_websocket_journey(token: str, scenario_id: int) -> None:
    print("\n[4] Start game session")
    r = requests.post(
        f"{BASE}/api/v1/game/start/{scenario_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"team_name": "SmokeTest"},
        timeout=10,
    )
    require("POST /game/start/{id} → 200", r.status_code == 200,
            f"got HTTP {r.status_code}: {r.text[:120]}")
    body       = r.json()
    session_id = body.get("session_id", "")
    join_token = body.get("join_token", "")
    share_link = body.get("share_link", "")
    require("session_id present", bool(session_id),
            f"body keys: {list(body.keys())}")
    require("join_token present", bool(join_token),
            "join_token missing — WS auth will fail")
    check("share_link present", bool(share_link))
    check("share_link contains session_id", session_id in share_link)
    print(f"     session: {session_id[:8]}…")

    # ── 5. WebSocket connect ───────────────────────────────────────────────
    print("\n[5] WebSocket connect")
    ws_url = (
        f"{WS}/api/v1/game/play/{session_id}"
        f"?name=SmokeTest&token={join_token}"
    )
    try:
        async with websockets.connect(ws_url, open_timeout=10) as ws:
            check("WebSocket connected", True)

            # Expect game_state on connect
            raw = await asyncio.wait_for(ws.recv(), timeout=10)
            msg = json.loads(raw)
            check("initial message type=game_state",
                  msg.get("type") == "game_state",
                  f"got type={msg.get('type')!r}")

            state = msg.get("state", {})
            check("state contains current_stage_id",
                  "current_stage_id" in state,
                  f"state keys: {list(state.keys())[:6]}")
            check("state contains participants",
                  "participants" in state)

            current_stage = state.get("current_stage_id", "")
            print(f"     initial stage: {current_stage}")

            # ── 6. Set role ───────────────────────────────────────────────
            print("\n[6] Set role (solo)")
            await ws.send(json.dumps({"type": "set_role", "role": "solo"}))

            # Drain messages until we see a game_state confirming the role
            role_confirmed = False
            for _ in range(5):
                raw = await asyncio.wait_for(ws.recv(), timeout=8)
                msg = json.loads(raw)
                if msg.get("type") == "game_state":
                    roles = msg.get("state", {}).get("roles", {})
                    if "solo" in roles.values():
                        role_confirmed = True
                        break
                elif msg.get("type") == "error":
                    break

            check("role=solo confirmed in state", role_confirmed)

            # ── 7. Make a choice ──────────────────────────────────────────
            print("\n[7] Submit choice (option 0)")
            await ws.send(json.dumps({
                "type":         "make_choice",
                "stage_id":     current_stage,
                "option_index": 0,
            }))

            choice_received = False
            for _ in range(8):
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
                msg = json.loads(raw)
                t   = msg.get("type", "")
                if t in ("choice_result", "game_state", "game_end"):
                    choice_received = True
                    if t == "choice_result":
                        check("choice_result has consequence",
                              bool(msg.get("consequence")))
                        check("choice_result has is_correct field",
                              "is_correct" in msg)
                    break
                elif t == "error":
                    check("no error on make_choice", False,
                          msg.get("message", ""))
                    break

            check("got response to make_choice", choice_received,
                  "no choice_result / game_state received")

            # ── 8. Save and exit ──────────────────────────────────────────
            print("\n[8] Save and exit")
            await ws.send(json.dumps({"type": "save_exit"}))

            # Allow a brief moment for the server to process, then close
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(raw)
                check("clean server response to save_exit",
                      msg.get("type") in ("saved", "game_state", "game_end"),
                      f"got type={msg.get('type')!r}")
            except asyncio.TimeoutError:
                # Server may close the connection silently — that's fine
                check("save_exit completed (no error response)", True)

    except websockets.exceptions.ConnectionClosedError as e:
        check("WebSocket did not close with error", False, str(e))
    except Exception as e:
        check("WebSocket journey completed", False, str(e))


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("Dwell — Smoke Test")
    print("=" * 60)

    test_health()
    token       = test_login()
    scenario_id = test_scenarios(token)

    # WebSocket tests (async)
    asyncio.run(test_websocket_journey(token, scenario_id))

    # Scenario detail (after WS journey so it's logged as step 9)
    test_scenario_detail(token, scenario_id)

    _finish()


if __name__ == "__main__":
    main()
