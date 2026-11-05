"""Backgammon with expectiminimax in Python.

white = MAX: moves from point 24 down to 1, bears off below 1
black = MIN: moves from point 1 up to 24, bears off above 24

A position is a tuple  (points, bar_w, bar_b, off_w, off_b)
  points: tuple of 24 integers, point 1 first;
          positive = white checkers, negative = black checkers
A move is a tuple      (from, to, die)   with from = "bar", to = "off"

Try:
  >>> from backgammon import *
  >>> show(INITIAL)
  >>> decide(INITIAL, "white", (3, 1))
  >>> tournament(greedy((1, 0, 4, 3, 2)), greedy((1, 0, 0, 0, 0)), 100)
"""
import random

INITIAL = ((-2, 0, 0, 0, 0, 5,  0, 3, 0, 0, 0, -5,
            5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2), 0, 0, 0, 0)

OTHER = {"white": "black", "black": "white"}


def winner(s):
    if s[3] == 15:
        return "white"
    if s[4] == 15:
        return "black"
    return None


# =============================================================
#  1. RULES FOR WHITE
# =============================================================
def steps(s, d):
    """All moves of one white checker with die d: (move, new_state)."""
    pts, bar_w = s[0], s[1]
    if bar_w > 0:                                  # on the bar: enter first
        t = 25 - d
        if pts[t - 1] >= -1:                       # not blocked by 2+ black
            yield ("bar", t, d), apply_move(s, ("bar", t, d))
        return
    home = all_home(s)
    for f in range(1, 25):
        if pts[f - 1] <= 0:                        # need a white checker on f
            continue
        t = f - d
        if t >= 1:
            if pts[t - 1] >= -1:                   # land: not blocked
                yield (f, t, d), apply_move(s, (f, t, d))
        elif home and (t == 0 or not white_above(pts, f)):
            yield (f, "off", d), apply_move(s, (f, "off", d))   # bear off


def all_home(s):
    return s[1] == 0 and all(n <= 0 for n in s[0][6:])


def white_above(pts, f):
    return any(n > 0 for n in pts[f:])


def apply_move(s, move):
    """Apply a white move; a lone black checker on the target is hit."""
    pts, bar_w, bar_b, off_w, off_b = s
    f, t, _ = move
    pts = list(pts)
    if f == "bar":
        bar_w -= 1
    else:
        pts[f - 1] -= 1
    if t == "off":
        off_w += 1
    else:
        if pts[t - 1] == -1:                       # hit: black goes to the bar
            pts[t - 1] = 0
            bar_b += 1
        pts[t - 1] += 1
    return (tuple(pts), bar_w, bar_b, off_w, off_b)


# =============================================================
#  2. BLACK IS WHITE IN A MIRROR
# =============================================================
def mirror(s):
    pts, bar_w, bar_b, off_w, off_b = s
    return (tuple(-n for n in reversed(pts)), bar_b, bar_w, off_b, off_w)


def mirror_point(p):
    return p if p in ("bar", "off") else 25 - p


def mirror_move(m):
    return (mirror_point(m[0]), mirror_point(m[1]), m[2])


def single(s, player, d):
    """All moves of one checker of player with die d."""
    if player == "white":
        yield from steps(s, d)
    else:
        for move, w2 in steps(mirror(s), d):
            yield mirror_move(move), mirror(w2)


# =============================================================
#  3. A WHOLE TURN
# =============================================================
def dice_orders(dice):
    d1, d2 = dice
    if d1 == d2:
        return [(d1, d1, d1, d1)]                  # doubles: four moves
    return [(d1, d2), (d2, d1)]


def use_dice(s, player, dice):
    """All ways to use the dice in this order: (moves, final)."""
    if not dice:
        yield [], s
        return
    options = list(single(s, player, dice[0]))
    if not options:                                # this die cannot be used
        yield [], s
        return
    for move, s1 in options:
        for moves, final in use_dice(s1, player, dice[1:]):
            yield [move] + moves, final


def legal_turns(s, player, dice):
    """List of (final, moves), one per distinct final position.

    Rules: use as many dice as possible; if only one die can be
    used and they are different, it must be the larger one."""
    found = [(moves, final) for order in dice_orders(dice)
             for moves, final in use_dice(s, player, order)]
    most = max(len(moves) for moves, _ in found)
    if most == 0:
        return []                                  # no legal move: pass
    found = [(m, f) for m, f in found if len(m) == most]
    d1, d2 = dice
    if most == 1 and d1 != d2:
        bigger = [(m, f) for m, f in found if m[0][2] == max(d1, d2)]
        if bigger:
            found = bigger
    turns = {}
    for moves, final in found:
        turns.setdefault(final, moves)             # one per final position
    return sorted(turns.items(), key=lambda item: item[0])


# =============================================================
#  4. EVAL: the heuristic, from white's point of view
# =============================================================
#  Weights (pips, off, blots, home, bar):
#    pips   difference in pip count (how far each side is from home)
#    off    checkers borne off
#    blots  lone checkers the rival could hit
#    home   points made (2+ checkers) in your own home board
#    bar    checkers on the bar
DEFAULT_WEIGHTS = (1, 0, 4, 3, 2)


def evaluate(s, w=DEFAULT_WEIGHTS):
    won = winner(s)
    if won:
        return 1000 if won == "white" else -1000
    return sum(wi * fi for wi, fi in zip(w, features(s)))


def features(s):
    pts, bar_w, bar_b, off_w, off_b = s
    pip_diff = pips(s, "black") - pips(s, "white")
    off_diff = off_w - off_b
    bar_diff = bar_b - bar_w
    if contact(s):
        blot_diff = pts.count(-1) - pts.count(1)
        home_diff = (sum(1 for n in pts[:6] if n >= 2)
                     - sum(1 for n in pts[18:] if n <= -2))
    else:                                          # a pure race: only pips
        blot_diff = home_diff = 0
    return (pip_diff, off_diff, blot_diff, home_diff, bar_diff)


def pips(s, player):
    pts = s[0]
    if player == "white":
        return sum(p * n for p, n in enumerate(pts, 1) if n > 0) + 25 * s[1]
    return sum((25 - p) * -n for p, n in enumerate(pts, 1) if n < 0) + 25 * s[2]


def contact(s):
    """Can the two sides still meet?"""
    pts, bar_w, bar_b = s[0], s[1], s[2]
    hi_w = 25 if bar_w else max((p for p, n in enumerate(pts, 1) if n > 0), default=0)
    lo_b = 0 if bar_b else min((p for p, n in enumerate(pts, 1) if n < 0), default=25)
    return hi_w > lo_b


# =============================================================
#  5. EXPECTIMINIMAX WITH A CUTOFF
# =============================================================
# The 21 distinct rolls: doubles 1/36, the others 2/36
ROLLS = [((b, a), (1 if a == b else 2) / 36)
         for a in range(1, 7) for b in range(a, 7)]


def best_reply(s, player, dice, w):
    """player rolls dice and plays his best move; we stop there
    and use EVAL instead of searching deeper (the cutoff)."""
    turns = legal_turns(s, player, dice)
    if not turns:
        return evaluate(s, w)
    values = [evaluate(final, w) for final, _ in turns]
    return max(values) if player == "white" else min(values)


def chance(s, player, w):
    """The chance node before player rolls."""
    return sum(p * best_reply(s, player, dice, w) for dice, p in ROLLS)


def decide(s, player, dice, w=DEFAULT_WEIGHTS, beam=12):
    """Return (value, moves, final). Only the beam best moves by
    EVAL are searched one level deeper."""
    if player == "black":                          # decide in the mirror
        best = decide(mirror(s), "white", dice, w, beam)
        if best is None:
            return None
        value, moves, final = best
        return (-value, [mirror_move(m) for m in moves], mirror(final))
    turns = legal_turns(s, "white", dice)
    if not turns:
        return None
    turns.sort(key=lambda t: evaluate(t[0], w), reverse=True)
    scored = []
    for final, moves in turns[:beam]:
        value = evaluate(final, w) if winner(final) else chance(final, "black", w)
        scored.append((value, moves, final))
    return max(scored, key=lambda t: t[0])


# =============================================================
#  6. AGENTS, GAMES AND TOURNAMENTS
# =============================================================
def greedy(w):
    """Best move by EVAL alone (no lookahead)."""
    def act(s, player, dice):
        if player == "black":                      # decide in the mirror
            return mirror(act(mirror(s), "white", dice))
        turns = legal_turns(s, "white", dice)
        if not turns:
            return s
        return max(turns, key=lambda t: evaluate(t[0], w))[0]
    return act


def expecti(beam, w):
    """Expectiminimax: one chance level + EVAL."""
    def act(s, player, dice):
        best = decide(s, player, dice, w, beam)
        return best[2] if best else s
    return act


def game(agent_w, agent_b, first, rng=random):
    s, player = INITIAL, first
    for _ in range(2000):
        won = winner(s)
        if won:
            return won
        dice = (rng.randint(1, 6), rng.randint(1, 6))
        agent = agent_w if player == "white" else agent_b
        s = agent(s, player, dice)
        player = OTHER[player]
    return winner(s)


def tournament(agent_w, agent_b, n, seed=None):
    """n games, alternating who starts; returns white's wins."""
    rng = random.Random(seed)
    return sum(game(agent_w, agent_b, "white" if i % 2 else "black", rng) == "white"
               for i in range(n))


# =============================================================
#  7. SHOWING A POSITION
# =============================================================
def show(s):
    pts, bar_w, bar_b, off_w, off_b = s
    cell = lambda p: (f"W{pts[p - 1]}" if pts[p - 1] > 0
                      else f"B{-pts[p - 1]}" if pts[p - 1] < 0 else ".").rjust(3)
    print(" 13  14  15  16  17  18 |  19  20  21  22  23  24")
    print(" ".join(cell(p) for p in range(13, 19)), "|", " ".join(cell(p) for p in range(19, 25)))
    print(" ".join(cell(p) for p in range(12, 6, -1)), "|", " ".join(cell(p) for p in range(6, 0, -1)))
    print(" 12  11  10   9   8   7 |   6   5   4   3   2   1")
    print(f" bar: W{bar_w} B{bar_b}   off: W{off_w} B{off_b}")


if __name__ == "__main__":
    show(INITIAL)
    print(decide(INITIAL, "white", (3, 1))[:2])
