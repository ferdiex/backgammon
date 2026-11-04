/* Backgammon: reglas, función de evaluación y agente expectiminimax.
 *
 * Tablero: points 1..24. El humano (H) mueve de 24 hacia 1 y saca sus fichas
 * por debajo de 1; el agente (A) mueve de 1 hacia 24 y saca por arriba de 24.
 * pts[p-1] > 0: fichas del humano en el punto p; pts[p-1] < 0: del agente.
 * En una jugada, from = 25 (humano) o 0 (agente) significa "desde la barra",
 * y to = 0 (humano) o 25 (agente) significa "sacar la ficha".
 */
(function (root) {
  "use strict";

  const BAR = { H: 25, A: 0 };
  const OFF = { H: 0, A: 25 };
  const other = who => (who === "H" ? "A" : "H");

  function initial() {
    const pts = new Array(24).fill(0);
    const put = (p, n) => { pts[p - 1] = n; };
    put(24, 2); put(13, 5); put(8, 3); put(6, 5);        // humano
    put(1, -2); put(12, -5); put(17, -3); put(19, -5);   // agente
    return { pts, barH: 0, barA: 0, offH: 0, offA: 0 };
  }

  function clone(s) {
    return { pts: s.pts.slice(), barH: s.barH, barA: s.barA, offH: s.offH, offA: s.offA };
  }

  function key(s) {
    return s.pts.join(",") + "|" + s.barH + "," + s.barA + "," + s.offH + "," + s.offA;
  }

  function winner(s) {
    if (s.offH === 15) return "H";
    if (s.offA === 15) return "A";
    return null;
  }

  function pip(s, who) {
    let n = 0;
    for (let p = 1; p <= 24; p++) {
      const c = s.pts[p - 1];
      if (who === "H" && c > 0) n += c * p;
      if (who === "A" && c < 0) n += -c * (25 - p);
    }
    return n + 25 * (who === "H" ? s.barH : s.barA);
  }

  function allHome(s, who) {
    if (who === "H") {
      if (s.barH) return false;
      for (let p = 7; p <= 24; p++) if (s.pts[p - 1] > 0) return false;
    } else {
      if (s.barA) return false;
      for (let p = 1; p <= 18; p++) if (s.pts[p - 1] < 0) return false;
    }
    return true;
  }

  /* Jugadas legales de una sola ficha con el dado d. */
  function singleMoves(s, who, d) {
    const out = [];
    if (who === "H") {
      if (s.barH > 0) {
        const t = 25 - d;
        if (s.pts[t - 1] >= -1) out.push({ from: 25, to: t, die: d });
        return out;
      }
      const home = allHome(s, "H");
      for (let p = 1; p <= 24; p++) {
        if (s.pts[p - 1] <= 0) continue;
        const t = p - d;
        if (t >= 1) {
          if (s.pts[t - 1] >= -1) out.push({ from: p, to: t, die: d });
        } else if (home) {
          let higher = false;
          for (let q = p + 1; q <= 6; q++) if (s.pts[q - 1] > 0) { higher = true; break; }
          if (t === 0 || !higher) out.push({ from: p, to: 0, die: d });
        }
      }
    } else {
      if (s.barA > 0) {
        const t = d;
        if (s.pts[t - 1] <= 1) out.push({ from: 0, to: t, die: d });
        return out;
      }
      const home = allHome(s, "A");
      for (let p = 24; p >= 1; p--) {
        if (s.pts[p - 1] >= 0) continue;
        const t = p + d;
        if (t <= 24) {
          if (s.pts[t - 1] <= 1) out.push({ from: p, to: t, die: d });
        } else if (home) {
          let higher = false;
          for (let q = p - 1; q >= 19; q--) if (s.pts[q - 1] < 0) { higher = true; break; }
          if (t === 25 || !higher) out.push({ from: p, to: 25, die: d });
        }
      }
    }
    return out;
  }

  /* Aplica una jugada de una ficha; regresa un estado nuevo. */
  function apply(s, who, m) {
    const n = clone(s);
    if (who === "H") {
      if (m.from === 25) n.barH--; else n.pts[m.from - 1]--;
      if (m.to === 0) n.offH++;
      else {
        if (n.pts[m.to - 1] === -1) { n.pts[m.to - 1] = 0; n.barA++; }
        n.pts[m.to - 1]++;
      }
    } else {
      if (m.from === 0) n.barA--; else n.pts[m.from - 1]++;
      if (m.to === 25) n.offA++;
      else {
        if (n.pts[m.to - 1] === 1) { n.pts[m.to - 1] = 0; n.barH++; }
        n.pts[m.to - 1]--;
      }
    }
    return n;
  }

  /* Todas las secuencias legales de un turno completo.
   * Reglas: hay que usar el mayor número posible de dados; si solo se
   * puede usar uno y los dados son distintos, debe ser el mayor. */
  function sequences(s, who, dice) {
    const [d1, d2] = dice;
    const orders = d1 === d2 ? [[d1, d1, d1, d1]] : [[d1, d2], [d2, d1]];
    const all = [];
    const rec = (st, ds, seq) => {
      if (!ds.length || winner(st)) { all.push({ seq, state: st }); return; }
      const ms = singleMoves(st, who, ds[0]);
      if (!ms.length) { all.push({ seq, state: st }); return; }
      for (const m of ms) rec(apply(st, who, m), ds.slice(1), seq.concat([m]));
    };
    for (const o of orders) rec(s, o, []);
    const maxLen = Math.max(...all.map(x => x.seq.length));
    if (maxLen === 0) return [];
    let res = all.filter(x => x.seq.length === maxLen);
    if (maxLen === 1 && d1 !== d2) {
      const big = Math.max(d1, d2);
      if (res.some(x => x.seq[0].die === big)) res = res.filter(x => x.seq[0].die === big);
    }
    return res;
  }

  /* Igual que sequences, pero una sola secuencia por posición final.
   * Descarta sobre la marcha los estados intermedios repetidos, así que con
   * dobles no recorre todas las permutaciones de las mismas jugadas. */
  function distinctResults(s, who, dice) {
    const [d1, d2] = dice;
    const orders = d1 === d2 ? [[d1, d1, d1, d1]] : [[d1, d2], [d2, d1]];
    const finals = [];
    const visited = new Set();
    const rec = (st, ds, seq, oi) => {
      const vk = oi + ":" + ds.length + ":" + key(st);
      if (visited.has(vk)) return;
      visited.add(vk);
      if (!ds.length || winner(st)) { finals.push({ seq, state: st }); return; }
      const ms = singleMoves(st, who, ds[0]);
      if (!ms.length) { finals.push({ seq, state: st }); return; }
      for (const m of ms) rec(apply(st, who, m), ds.slice(1), seq.concat([m]), oi);
    };
    orders.forEach((o, oi) => rec(s, o, [], oi));
    const maxLen = Math.max(...finals.map(x => x.seq.length));
    if (maxLen === 0) return [];
    let res = finals.filter(x => x.seq.length === maxLen);
    if (maxLen === 1 && d1 !== d2) {
      const big = Math.max(d1, d2);
      if (res.some(x => x.seq[0].die === big)) res = res.filter(x => x.seq[0].die === big);
    }
    const seen = new Map();
    for (const x of res) { const k = key(x.state); if (!seen.has(k)) seen.set(k, x); }
    return [...seen.values()];
  }

  /* Las 21 tiradas distintas: los dobles salen 1 de 36 veces; las demás, 2 de 36. */
  const ROLLS = [];
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push({ dice: [b, a], w: a === b ? 1 : 2, p: (a === b ? 1 : 2) / 36 });

  /* ---------- Función de evaluación (desde el punto de vista del humano) ---------- */
  const WEIGHTS = { pips: 1, blots: 4, home: 3, bar: 2 };

  function features(s) {
    let hiH = s.barH ? 25 : 0, loA = s.barA ? 0 : 25;
    let blotsH = 0, blotsA = 0, homeH = 0, homeA = 0;
    for (let p = 1; p <= 24; p++) {
      const c = s.pts[p - 1];
      if (c > 0 && p > hiH) hiH = p;
      if (c < 0 && p < loA) loA = p;
    }
    const contact = hiH > loA;
    for (let p = 1; p <= 24; p++) {
      const c = s.pts[p - 1];
      if (c === 1) blotsH++;
      if (c === -1) blotsA++;
      if (p <= 6 && c >= 2) homeH++;
      if (p >= 19 && c <= -2) homeA++;
    }
    return {
      pipDiff: pip(s, "A") - pip(s, "H"),
      blotDiff: contact ? blotsA - blotsH : 0,
      homeDiff: contact ? homeH - homeA : 0,
      barDiff: s.barA - s.barH,
      contact,
    };
  }

  function evaluate(s, W = WEIGHTS) {
    const w = winner(s);
    if (w === "H") return 1000;
    if (w === "A") return -1000;
    const f = features(s);
    return W.pips * f.pipDiff + W.blots * f.blotDiff + W.home * f.homeDiff + W.bar * f.barDiff;
  }

  /* ---------- Expectiminimax de un nivel ----------
   * El agente (MIN) elige la secuencia que minimiza el valor esperado
   * después de la mejor respuesta del humano (MAX) a cada una de las 21 tiradas. */
  function bestReply(s, who, dice, W, opts) {
    if (!opts) opts = distinctResults(s, who, dice);
    if (!opts.length) return evaluate(s, W);
    let best = who === "H" ? -Infinity : Infinity;
    for (const o of opts) {
      const v = evaluate(o.state, W);
      if (who === "H" ? v > best : v < best) best = v;
    }
    return best;
  }

  function decide(s, who, dice, opts = {}) {
    const W = opts.weights || WEIGHTS, beam = opts.beam || 12;
    const cands = distinctResults(s, who, dice);
    if (!cands.length) return { seq: [], state: s, value: evaluate(s, W), candidates: 0, positions: 0 };
    const sign = who === "H" ? -1 : 1;              // ordenar del mejor al peor para quien decide
    cands.forEach(c => { c.static = evaluate(c.state, W); });
    cands.sort((a, b) => sign * (a.static - b.static));
    const top = cands.slice(0, beam);
    let best = null, positions = 0;
    for (const c of top) {
      let exp;
      if (winner(c.state)) exp = c.static;
      else {
        exp = 0;
        for (const r of ROLLS) {
          const replies = distinctResults(c.state, other(who), r.dice);
          exp += r.p * bestReply(c.state, other(who), r.dice, W, replies);
          positions += replies.length || 1;
        }
      }
      c.expected = exp;
      if (!best || sign * (exp - best.expected) < 0) best = c;
    }
    return { seq: best.seq, state: best.state, value: best.expected, candidates: cands.length, considered: top.length, positions };
  }

  /* ---------- El nodo de azar visto desde el humano ----------
   * Para cada una de las 21 tiradas del agente: ¿puede comer una ficha?, y valor
   * de la posición después de su mejor respuesta según la EVAL. */
  function chanceNode(s, W = WEIGHTS) {
    const now = evaluate(s, W);
    const rows = ROLLS.map(r => {
      const opts = distinctResults(s, "A", r.dice);
      const hit = opts.some(o => o.state.barH > s.barH);
      let v = now;
      if (opts.length) v = Math.min(...opts.map(o => evaluate(o.state, W)));
      return { dice: r.dice, w: r.w, p: r.p, hit, value: v, delta: v - now };
    });
    const shots = rows.filter(r => r.hit).reduce((a, r) => a + r.w, 0);
    const expected = rows.reduce((a, r) => a + r.p * r.value, 0);
    return { rows, shots, expected, now };
  }

  const api = { initial, clone, key, winner, pip, allHome, singleMoves, apply, sequences, distinctResults,
                ROLLS, WEIGHTS, features, evaluate, decide, chanceNode, BAR, OFF, other };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BG = api;
})(typeof self !== "undefined" ? self : this);
