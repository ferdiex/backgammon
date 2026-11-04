const BG = require("../engine.js");
let fails = 0;
const ok = (c, msg) => { console.log((c ? "✓ " : "✗ ") + msg); if (!c) fails++; };
const empty = () => ({ pts: new Array(24).fill(0), barH: 0, barA: 0, offH: 0, offA: 0 });
const count = (s, who) => (who === "H" ? s.pts.filter(c => c > 0).reduce((a, c) => a + c, 0) + s.barH + s.offH
                                         : s.pts.filter(c => c < 0).reduce((a, c) => a - c, 0) + s.barA + s.offA);
const fmt = seq => seq.map(m => `${m.from}/${m.to}`).join(" ");

let s = BG.initial();
ok(BG.pip(s, "H") === 167 && BG.pip(s, "A") === 167, "posición inicial: 167 pips cada uno");
ok(count(s, "H") === 15 && count(s, "A") === 15, "posición inicial: 15 fichas cada uno");

// 3-1 de apertura: se puede hacer el punto 5 (8/5 6/5)
const r31 = BG.distinctResults(s, "H", [3, 1]);
ok(r31.some(x => x.state.pts[4] === 2 && x.state.pts[7] === 2 && x.state.pts[5] === 4), `apertura 3-1: 8/5 6/5 es legal (${r31.length} posiciones distintas)`);
// 6-5 de apertura: 24/13 (corrida)
const r65 = BG.distinctResults(s, "H", [6, 5]);
ok(r65.some(x => x.state.pts[23] === 1 && x.state.pts[12] === 6), `apertura 6-5: 24/13 es legal (${r65.length} posiciones)`);

// Barra bloqueada: el humano está en la barra y el agente ocupa 19..24 con 2 fichas
let b = empty(); b.barH = 1; for (let p = 19; p <= 24; p++) b.pts[p - 1] = -2; b.pts[0] = 14; b.pts[5] = 0; b.pts[2] = -3;
ok(BG.sequences(b, "H", [3, 5]).length === 0, "barra bloqueada: no hay jugadas, se pasa el turno");
// Barra: con fichas en la barra, solo se puede entrar primero
let b2 = BG.initial(); b2.pts[5] -= 1; b2.barH = 1;
ok(BG.sequences(b2, "H", [3, 1]).every(x => x.seq[0].from === 25), "con ficha en la barra, la primera jugada es entrar");
// Golpe: entrar sobre una ficha sola del agente la manda a la barra
let g = empty(); g.pts[5] = 15; g.pts[2] = -1; g.pts[20] = -14;
const hit = BG.distinctResults(g, "H", [3, 2]).find(x => x.state.barA === 1);
ok(!!hit, "golpe: caer en una ficha sola del agente la manda a la barra");

// Regla del dado mayor: solo se puede usar uno de los dos dados
let L = empty(); L.pts[11] = 1; L.pts[0] = 14;          // humano: 1 en el 12 y 14 en el 1 (no todas en casa)
L.pts[5] = -2; L.pts[10] = -2; L.pts[22] = -11;          // bloqueos del agente en 6 y 11
// 12 -6-> 6 bloqueado; 12 -1-> 11 bloqueado... construimos un caso clásico:
let M = empty(); M.pts[23] = 1; M.pts[0] = 14;          // humano: 1 ficha en el 24
M.pts[17] = -2; M.pts[19] = -2; M.pts[12] = -11;         // agente bloquea 18 y 20
// dados 6 y 4: 24-6=18 bloqueado, 24-4=20 bloqueado => ninguna; probamos 5 y 6: 24-5=19 libre, luego 19-6=13 bloqueado; 24-6=18 bloqueado
const s56 = BG.sequences(M, "H", [5, 6]);
ok(s56.length === 1 && s56[0].seq.length === 1 && s56[0].seq[0].die === 5, "si solo cabe un dado, se usa el que se pueda: " + fmt(s56[0].seq));
let N = empty(); N.pts[23] = 1; N.pts[0] = 14; N.pts[13] = -2; N.pts[12] = -2; N.pts[5] = -11; // bloquea 14 y 13
// dados 6 y 4 desde 24: 24-6=18 libre luego 18-4=14 bloqueado; 24-4=20 libre luego 20-6=14 bloqueado => solo uno: debe ser el 6
const s64 = BG.sequences(N, "H", [6, 4]);
ok(s64.length >= 1 && s64.every(x => x.seq.length === 1 && x.seq[0].die === 6), "si solo se puede usar uno de dos dados distintos, debe ser el mayor: " + s64.map(x => fmt(x.seq)).join(", "));
// Usar ambos dados si es posible
const both = BG.sequences(BG.initial(), "H", [6, 1]);
ok(both.every(x => x.seq.length === 2), "si se pueden usar ambos dados, hay que usarlos");

// Sacar fichas
let O = empty(); O.pts[1] = 2; O.pts[4] = 1; O.pts[18] = -15;   // humano: 2 en el 2, 1 en el 5
const o6 = BG.sequences(O, "H", [6, 1]);
ok(o6.some(x => x.seq.some(m => m.from === 5 && m.to === 0 && m.die === 6)), "sacar con dado mayor desde el punto más alto (5 con un 6)");
let P = empty(); P.pts[1] = 1; P.pts[4] = 2; P.pts[18] = -15;   // 1 en el 2, 2 en el 5
const p3 = BG.singleMoves(P, "H", 3);
ok(!p3.some(m => m.from === 2 && m.to === 0), "no se puede sacar desde el 2 con un 3 si hay fichas en el 5");
let Q = BG.initial();
ok(!BG.singleMoves(Q, "H", 6).some(m => m.to === 0), "no se saca ninguna ficha si no están todas en casa");

// Dobles: cuatro movimientos
const d44 = BG.sequences(BG.initial(), "H", [4, 4]);
ok(d44.every(x => x.seq.length === 4), "con dobles se mueven cuatro veces");

// Simetría: el agente tiene las mismas jugadas que el humano en la posición espejo
const mirror = st => ({ pts: st.pts.slice().reverse().map(c => -c), barH: st.barA, barA: st.barH, offH: st.offA, offA: st.offH });
let sym = true;
for (const r of BG.ROLLS) {
  const a = BG.distinctResults(BG.initial(), "H", r.dice).length, c = BG.distinctResults(mirror(BG.initial()), "A", r.dice).length;
  if (a !== c) sym = false;
}
ok(sym, "simetría: el agente y el humano tienen el mismo número de jugadas en posiciones espejo");

// Partidas aleatorias: invariantes y terminación
let games = 0, maxTurns = 0, bad = 0, passes = 0;
const rnd = (n) => Math.floor(Math.random() * n);
for (let g = 0; g < 3000; g++) {
  let st = BG.initial(), who = g % 2 ? "H" : "A", turns = 0;
  while (!BG.winner(st) && turns < 2000) {
    const dice = [1 + rnd(6), 1 + rnd(6)];
    const opts = BG.sequences(st, who, dice);
    if (!opts.length) passes++;
    else st = opts[rnd(opts.length)].state;
    if (count(st, "H") !== 15 || count(st, "A") !== 15 || st.pts.some((c, i) => false)) bad++;
    who = BG.other(who); turns++;
  }
  if (BG.winner(st)) games++;
  maxTurns = Math.max(maxTurns, turns);
}
ok(bad === 0, "3,000 partidas aleatorias: siempre 15 fichas por jugador");
ok(games === 3000, `las 3,000 partidas terminan (la más larga: ${maxTurns} turnos; turnos sin jugada: ${passes})`);
console.log(fails ? `\n${fails} fallas` : "\nTodas las pruebas pasan");
