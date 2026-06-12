from __future__ import annotations
from database import get_conn

MAX_LIDERAZGO = 12
MAX_PRACTICA  = 24
MAX_BLOCKEAR  = 17
MAX_TIRAR     = 17
SL_MAX        = 20
MOV_MAX       = 14  # achievable at 100%


def movement_points(pct: float) -> float:
    """Convert good/great movement percentage to points."""
    if pct >= 1.00: return 14
    if pct >= 0.95: return 12
    if pct >= 0.90: return 10
    if pct >= 0.85: return 8
    if pct >= 0.80: return 6
    if pct >= 0.75: return 4
    if pct >= 0.70: return 2
    return 1


def calc_week_scores(week_id: int) -> list[dict]:
    with get_conn() as conn:
        week = conn.execute("SELECT * FROM weeks WHERE id=?", (week_id,)).fetchone()
        if not week:
            return []
        week = dict(week)
        league_avg = week["league_avg_sl_plus"] or 115.0
        players = conn.execute("SELECT * FROM players WHERE active=1 ORDER BY name").fetchall()
        game_ids = [r[0] for r in conn.execute("SELECT id FROM games WHERE week_id=?", (week_id,)).fetchall()]
        ph = ",".join("?" * len(game_ids)) if game_ids else "NULL"

        results = []
        for p in players:
            pid = p["id"]
            s = {"player_id": pid, "player_name": p["name"], "week_id": week_id,
                 "liderazgo": 0.0, "recibir": None, "practica": 0.0,
                 "blockear": 0.0, "tirar": 0.0,
                 "sl_plus": None, "sl_score": None, "mov_score": None,
                 "block_chances": 0, "blocks": 0, "passed_balls": 0, "wild_pitches": 0,
                 "block_pct": 0.0,
                 "throw_opps": 0, "accurate_throws": 0, "exchange_errors": 0,
                 "back_picks": 0, "bp_outs": 0, "caught_stealings": 0,
                 "avg_pop_time": None, "accurate_throw_pct": 0.0,
                 "great_moves": 0, "good_moves": 0, "bad_moves": 0,
                 "mov_pct": None}

            # Liderazgo & Practica
            daily = conn.execute(
                "SELECT liderazgo, practica FROM daily_entries WHERE player_id=? AND entry_date BETWEEN ? AND ?",
                (pid, week["start_date"], week["end_date"])
            ).fetchall()
            s["liderazgo"] = min(sum(r["liderazgo"] for r in daily), MAX_LIDERAZGO)
            s["practica"]  = min(sum(r["practica"]  for r in daily), MAX_PRACTICA)

            # SL+ score (20 pts, scaled to league avg)
            sl = conn.execute(
                "SELECT sl_plus FROM weekly_sl WHERE week_id=? AND player_id=?",
                (week_id, pid)
            ).fetchone()
            if sl and sl["sl_plus"]:
                s["sl_plus"]  = sl["sl_plus"]
                s["sl_score"] = round((sl["sl_plus"] / league_avg) * SL_MAX, 2)

            if game_ids:
                args = [pid] + game_ids

                # Throws
                throws = conn.execute(
                    f"SELECT * FROM throw_events WHERE player_id=? AND game_id IN ({ph})", args
                ).fetchall()
                reg_throws = [r for r in throws if not r["back_pick"]]
                bp_throws  = [r for r in throws if r["back_pick"]]
                s["throw_opps"]       = len(reg_throws)
                s["accurate_throws"]  = sum(r["accurate"] for r in reg_throws)
                s["exchange_errors"]  = sum(r["exchange_error"] for r in reg_throws)
                s["back_picks"]       = len(bp_throws)
                s["bp_outs"]          = sum(r["bp_out"] for r in throws)
                s["caught_stealings"] = sum(r["caught_stealing"] for r in reg_throws)
                times = [r["pop_time"] for r in reg_throws if r["pop_time"]]
                s["avg_pop_time"] = round(sum(times) / len(times), 2) if times else None
                denom = s["throw_opps"] + s["exchange_errors"]
                if denom > 0:
                    pct = s["accurate_throws"] / denom
                    s["accurate_throw_pct"] = round(pct * 100, 1)
                    s["tirar"] = round(pct * MAX_TIRAR, 2)
                s["tirar"] = round(s["tirar"] + s["bp_outs"] + s["caught_stealings"], 2)

                # Blocks
                blocks = conn.execute(
                    f"SELECT * FROM block_events WHERE player_id=? AND game_id IN ({ph})", args
                ).fetchall()
                s["block_chances"] = len(blocks)
                s["blocks"]        = sum(r["blocked"] for r in blocks)
                s["passed_balls"]  = sum(r["passed_ball"] for r in blocks)
                s["wild_pitches"]  = sum(r["wild_pitch"] for r in blocks)
                if s["block_chances"] > 0:
                    pct = s["blocks"] / s["block_chances"]
                    s["block_pct"]  = round(pct * 100, 1)
                    s["blockear"]   = round(pct * MAX_BLOCKEAR, 2)

                # Receiving movement
                recv = conn.execute(
                    f"SELECT quality FROM receiving_events WHERE player_id=? AND game_id IN ({ph})", args
                ).fetchall()
                s["great_moves"] = sum(1 for r in recv if r["quality"] == "great")
                s["good_moves"]  = sum(1 for r in recv if r["quality"] == "good")
                s["bad_moves"]   = sum(1 for r in recv if r["quality"] == "bad")
                total_recv = s["great_moves"] + s["good_moves"] + s["bad_moves"]

                if total_recv > 0:
                    # weighted score: great=2, good=1, bad=0
                    weighted = (s["great_moves"] * 2 + s["good_moves"] * 1)
                    max_possible = total_recv * 2
                    pct = weighted / max_possible
                    s["mov_pct"]   = round(pct * 100, 1)
                    s["mov_score"] = movement_points(pct)

            # Recibir = SL score + movement score (null if neither logged)
            if s["sl_score"] is not None or s["mov_score"] is not None:
                s["recibir"] = round((s["sl_score"] or 0) + (s["mov_score"] or 0), 2)

            s["total"] = round(
                s["liderazgo"] + (s["recibir"] or 0) +
                s["practica"] + s["blockear"] + s["tirar"], 2
            )
            results.append(s)

        results.sort(key=lambda x: x["total"], reverse=True)
        for i, r in enumerate(results):
            r["rank"] = i + 1
        return results


def calc_season_scores(season_id: int) -> list[dict]:
    with get_conn() as conn:
        weeks = conn.execute("SELECT id FROM weeks WHERE season_id=?", (season_id,)).fetchall()

    totals: dict[int, dict] = {}
    for w in weeks:
        for s in calc_week_scores(w["id"]):
            pid = s["player_id"]
            if pid not in totals:
                totals[pid] = {
                    "player_id": pid, "player_name": s["player_name"],
                    "liderazgo": 0.0, "recibir": 0.0, "practica": 0.0,
                    "blockear": 0.0, "tirar": 0.0, "total": 0.0, "weeks_played": 0,
                }
            t = totals[pid]
            for k in ["liderazgo", "practica", "blockear", "tirar", "total"]:
                t[k] += s[k]
            if s["recibir"] is not None:
                t["recibir"] += s["recibir"]
            if s["total"] > 0:
                t["weeks_played"] += 1

    results = sorted(totals.values(), key=lambda x: x["total"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1
        for k in ["liderazgo", "recibir", "practica", "blockear", "tirar", "total"]:
            r[k] = round(r[k], 1)
    return results
