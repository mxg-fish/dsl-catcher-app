from __future__ import annotations
from database import get_conn

MAX_LIDERAZGO = 12
MAX_PRACTICA  = 24
MAX_BLOCKEAR  = 17
MAX_TIRAR     = 17
SL_MAX        = 20
PBWP_MAX      = 8.5
BLOCK_EVT_MAX = 8.5
PITCHES_FULL_CREDIBILITY = 200


def movement_points(pct: float) -> float:
    if pct >= 1.00: return 14
    if pct >= 0.95: return 12
    if pct >= 0.90: return 10
    if pct >= 0.85: return 8
    if pct >= 0.80: return 6
    if pct >= 0.75: return 4
    if pct >= 0.70: return 2
    return 1


def sl_rank_bonus(rank):
    if rank is None: return 0
    if rank == 1: return 7
    if rank <= 10: return 5
    if rank <= 25: return 3
    return 0


def pbwp_rank_bonus(rank):
    if rank is None: return 0
    if rank <= 10: return 2
    if rank <= 25: return 1
    return 0

def pbwp_score_calc(pbwp_plus):
    if pbwp_plus is None:
        return None
    if pbwp_plus >= 45:
        t = min((pbwp_plus - 45) / (150 - 45), 1.0)
        return 5 + 5.5 * (t ** 1.5)
    else:
        t = max((pbwp_plus - 10) / (45 - 10), 0)
        return 5 * (t ** 1.5)

def calc_week_scores(week_id: int) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM weeks WHERE id=%s", (week_id,))
        week = cur.fetchone()
        if not week:
            return []
        week = dict(week)
        league_avg_sl = week["league_avg_sl_plus"] or 115.0
        league_avg_pbwp = week.get("league_avg_pbwp") or 100.0

        cur.execute("SELECT * FROM players WHERE active=1 ORDER BY name")
        players = cur.fetchall()

        cur.execute("SELECT id FROM games WHERE week_id=%s", (week_id,))
        game_ids = [r["id"] for r in cur.fetchall()]

        results = []
        for p in players:
            pid = p["id"]
            s = {"player_id": pid, "player_name": p["name"], "week_id": week_id,
                 "liderazgo": 0.0, "recibir": None, "practica": 0.0,
                 "blockear": None, "tirar": 0.0,
                 "sl_plus": None, "sl_score": None, "mov_score": None,
                 "pbwp_plus": None, "pbwp_score": None, "block_evt_score": None,
                 "pitches_caught": None, "sl_rank": None, "pbwp_rank": None,
                 "block_chances": 0, "blocks": 0, "passed_balls": 0, "wild_pitches": 0,
                 "block_pct": 0.0,
                 "throw_opps": 0, "accurate_throws": 0, "exchange_errors": 0,
                 "back_picks": 0, "bp_outs": 0, "caught_stealings": 0,
                 "avg_pop_time": None, "accurate_throw_pct": 0.0,
                 "great_moves": 0, "good_moves": 0, "bad_moves": 0,
                 "mov_pct": None, "daily_breakdown": []}

            cur.execute(
                "SELECT entry_date, liderazgo, practica FROM daily_entries WHERE player_id=%s AND entry_date BETWEEN %s AND %s ORDER BY entry_date",
                (pid, week["start_date"], week["end_date"])
            )
            daily = cur.fetchall()
            s["liderazgo"] = min(sum(r["liderazgo"] for r in daily), MAX_LIDERAZGO)
            s["practica"]  = min(sum(r["practica"]  for r in daily), MAX_PRACTICA)
            s["daily_breakdown"] = [{"date": r["entry_date"], "liderazgo": r["liderazgo"], "practica": r["practica"]} for r in daily]

            cur.execute(
                "SELECT sl_plus, pbwp_plus, pitches_caught, sl_rank, pbwp_rank FROM weekly_sl WHERE week_id=%s AND player_id=%s",
                (week_id, pid)
            )
            sl = cur.fetchone()

            if sl:
                s["pitches_caught"] = sl["pitches_caught"]
                s["sl_rank"] = sl["sl_rank"]
                s["pbwp_rank"] = sl["pbwp_rank"]

                if sl["sl_plus"]:
                    s["sl_plus"] = sl["sl_plus"]
                    raw_sl_score = (sl["sl_plus"] / league_avg_sl) * SL_MAX
                    pitches = sl["pitches_caught"] or 0
                    credibility = min(pitches / PITCHES_FULL_CREDIBILITY, 1.0)
                    baseline = SL_MAX  # league-average equivalent score
                    shrunk_sl_score = (raw_sl_score * credibility) + (baseline * (1 - credibility))
                    s["sl_score"] = round(shrunk_sl_score + sl_rank_bonus(sl["sl_rank"]), 2)

                if sl["pbwp_plus"]:
                    s["pbwp_plus"] = sl["pbwp_plus"]
                    raw_pbwp_score = pbwp_score_calc(sl["pbwp_plus"])
                    s["pbwp_score"] = round(raw_pbwp_score + pbwp_rank_bonus(sl["pbwp_rank"]), 2)

            if game_ids:
                ph = ",".join(["%s"] * len(game_ids))
                args = [pid] + game_ids

                cur.execute(f"SELECT * FROM throw_events WHERE player_id=%s AND game_id IN ({ph})", args)
                throws = cur.fetchall()
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

                cur.execute(f"SELECT * FROM block_events WHERE player_id=%s AND game_id IN ({ph})", args)
                blocks = cur.fetchall()
                s["block_chances"] = len(blocks)
                s["blocks"]        = sum(r["blocked"] for r in blocks)
                s["passed_balls"]  = sum(r["passed_ball"] for r in blocks)
                s["wild_pitches"]  = sum(r["wild_pitch"] for r in blocks)
                if s["block_chances"] > 0:
                    pct = s["blocks"] / s["block_chances"]
                    s["block_pct"]  = round(pct * 100, 1)
                    s["block_evt_score"] = round(pct * BLOCK_EVT_MAX, 2)

                cur.execute(f"SELECT quality FROM receiving_events WHERE player_id=%s AND game_id IN ({ph})", args)
                recv = cur.fetchall()
                s["great_moves"] = sum(1 for r in recv if r["quality"] == "great")
                s["good_moves"]  = sum(1 for r in recv if r["quality"] == "good")
                s["bad_moves"]   = sum(1 for r in recv if r["quality"] == "bad")
                total_recv = s["great_moves"] + s["good_moves"] + s["bad_moves"]

                if total_recv > 0:
                    weighted = (s["great_moves"] * 2 + s["good_moves"] * 1)
                    max_possible = total_recv * 2
                    pct = weighted / max_possible
                    s["mov_pct"]   = round(pct * 100, 1)
                    s["mov_score"] = movement_points(pct)

            if s["sl_score"] is not None or s["mov_score"] is not None:
                s["recibir"] = round((s["sl_score"] or 0) + (s["mov_score"] or 0), 2)

            if s["pbwp_score"] is not None or s["block_evt_score"] is not None:
                s["blockear"] = round((s["pbwp_score"] or 0) + (s["block_evt_score"] or 0), 2)

            s["total"] = round(
                s["liderazgo"] + (s["recibir"] or 0) +
                s["practica"] + (s["blockear"] or 0) + s["tirar"], 2
            )
            results.append(s)

        results.sort(key=lambda x: x["total"], reverse=True)
        for i, r in enumerate(results):
            r["rank"] = i + 1
        return results


def calc_season_scores(season_id: int) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM weeks WHERE season_id=%s", (season_id,))
        weeks = cur.fetchall()

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
            for k in ["liderazgo", "practica", "tirar", "total"]:
                t[k] += s[k]
            if s["recibir"] is not None:
                t["recibir"] += s["recibir"]
            if s["blockear"] is not None:
                t["blockear"] += s["blockear"]
            if s["total"] > 0:
                t["weeks_played"] += 1

    results = sorted(totals.values(), key=lambda x: x["total"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1
        for k in ["liderazgo", "recibir", "practica", "blockear", "tirar", "total"]:
            r[k] = round(r[k], 1)
    return results
