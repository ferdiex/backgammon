:- encoding(utf8).
% =============================================================
%  Backgammon with expectiminimax in Prolog (SWI-Prolog)
%
%  white = MAX: moves from point 24 down to 1, bears off below 1
%  black = MIN: moves from point 1 up to 24, bears off above 24
%
%  A position is   state(Points, BarW, BarB, OffW, OffB)
%    Points: list of 24 integers, point 1 first;
%            positive = white checkers, negative = black checkers
%  A move is       m(From, To, Die)   with From = bar, To = off
%
%  Try:  ?- initial(S), show(S).
%        ?- initial(S), decide(S, white, [3,1], best(V, Seq, _)).
%        ?- tournament(agent(greedy, w(1,0,4,3,2)),
%                      agent(greedy, w(1,0,0,0,0)), 100, Wins).
% =============================================================

initial(state([-2,0,0,0,0,5,  0,3,0,0,0,-5,
                5,0,0,0,-3,0, -5,0,0,0,0,2], 0, 0, 0, 0)).

other(white, black).
other(black, white).

winner(state(_, _, _, 15, _), white).
winner(state(_, _, _, _, 15), black).

% ---------- Board helpers ----------
set_nth1(1, [_|T], X, [X|T]) :- !.
set_nth1(I, [H|T], X, [H|T2]) :- I1 is I - 1, set_nth1(I1, T, X, T2).

% =============================================================
%  1. RULES FOR WHITE
% =============================================================

% step(+State, +Die, -Move, -NewState): one white checker, one die
step(S, D, m(bar, T, D), S2) :-                 % on the bar: enter first
    S = state(Pts, BW, _, _, _), BW > 0, !,
    T is 25 - D,
    nth1(T, Pts, N), N >= -1,                   % not blocked by 2+ black
    apply_move(S, m(bar, T, D), S2).
step(S, D, m(F, T, D), S2) :-
    S = state(Pts, 0, _, _, _),
    nth1(F, Pts, N), N > 0,                     % a white checker on F
    T0 is F - D,
    (   T0 >= 1
    ->  nth1(T0, Pts, M), M >= -1, T = T0       % land: not blocked
    ;   all_home(S),                            % bear off
        ( T0 =:= 0 ; \+ white_above(Pts, F) ),
        T = off
    ),
    apply_move(S, m(F, T, D), S2).

all_home(state(Pts, 0, _, _, _)) :-
    \+ ( nth1(P, Pts, N), P > 6, N > 0 ).

white_above(Pts, F) :-
    nth1(P, Pts, N), P > F, N > 0.

% apply_move(+State, +Move, -NewState) for white; hits a lone black checker
apply_move(state(P, BW, BB, OW, OB), m(F, T, _), state(P2, BW1, BB1, OW1, OB)) :-
    (   F == bar
    ->  BW1 is BW - 1, P1 = P
    ;   nth1(F, P, N), N1 is N - 1, set_nth1(F, P, N1, P1), BW1 = BW
    ),
    (   T == off
    ->  OW1 is OW + 1, P2 = P1, BB1 = BB
    ;   nth1(T, P1, M),
        (   M =:= -1
        ->  BB1 is BB + 1, M1 = 1               % hit: black goes to the bar
        ;   BB1 = BB, M1 is M + 1
        ),
        set_nth1(T, P1, M1, P2), OW1 = OW
    ).

% =============================================================
%  2. BLACK IS WHITE IN A MIRROR
% =============================================================
mirror(state(P, BW, BB, OW, OB), state(M, BB, BW, OB, OW)) :-
    reverse(P, R), maplist(neg, R, M).
neg(X, Y) :- Y is -X.

mirror_move(m(F, T, D), m(F2, T2, D)) :- mirror_pt(F, F2), mirror_pt(T, T2).
mirror_pt(bar, bar) :- !.
mirror_pt(off, off) :- !.
mirror_pt(P, Q) :- Q is 25 - P.

% single(+State, +Player, +Die, -Move, -NewState)
single(S, white, D, M, S2) :- step(S, D, M, S2).
single(S, black, D, M, S2) :-
    mirror(S, W), step(W, D, MW, W2),
    mirror(W2, S2), mirror_move(MW, M).

% =============================================================
%  3. A WHOLE TURN
% =============================================================
dice_orders([D, D], [[D, D, D, D]]) :- !.        % doubles: four moves
dice_orders([D1, D2], [[D1, D2], [D2, D1]]).

% use_dice(+State, +Player, +Dice, -Moves, -Final)
use_dice(S, _, [], [], S).
use_dice(S, P, [D|Ds], [M|Ms], F) :-
    single(S, P, D, M, S1),
    use_dice(S1, P, Ds, Ms, F).
use_dice(S, P, [D|_], [], S) :-                 % this die cannot be used
    \+ single(S, P, D, _, _).

% legal_turns(+State, +Player, +Dice, -Turns)
%   Turns: list of Final-Moves, one per distinct final position.
%   Rules: use as many dice as possible; if only one die can be
%   used and they are different, it must be the larger one.
legal_turns(S, P, Dice, Turns) :-
    dice_orders(Dice, Orders),
    findall(L-(F-Ms), ( member(O, Orders),
                        use_dice(S, P, O, Ms, F),
                        length(Ms, L) ), All),
    aggregate_all(max(L), member(L-_, All), Max),
    (   Max =:= 0
    ->  Turns = []                               % no legal move: pass
    ;   findall(F-Ms, member(Max-(F-Ms), All), Longest),
        larger_die(Max, Dice, Longest, Legal),
        sort(1, @<, Legal, Turns)                % one per final position
    ).

larger_die(1, [D1, D2], Turns, Big) :-
    D1 =\= D2, B is max(D1, D2),
    include(first_die(B), Turns, Big), Big \== [], !.
larger_die(_, _, Turns, Turns).
first_die(B, _-[m(_, _, B)]).

% =============================================================
%  4. EVAL: the heuristic, from white's point of view
% =============================================================
%  Weights w(Pips, Off, Blots, Home, Bar):
%    Pips   difference in pip count (how far each side is from home)
%    Off    checkers borne off
%    Blots  lone checkers the rival could hit
%    Home   points made (2+ checkers) in your own home board
%    Bar    checkers on the bar
default_weights(w(1, 0, 4, 3, 2)).

eval(S, _, 1000) :- winner(S, white), !.
eval(S, _, -1000) :- winner(S, black), !.
eval(S, w(WP, WO, WB, WH, WR), V) :-
    features(S, f(Pips, Off, Blots, Home, Bar)),
    V is WP*Pips + WO*Off + WB*Blots + WH*Home + WR*Bar.

features(S, f(PipDiff, OffDiff, BlotDiff, HomeDiff, BarDiff)) :-
    S = state(Pts, BW, BB, OW, OB),
    pips(S, white, PW), pips(S, black, PB),
    PipDiff is PB - PW,
    OffDiff is OW - OB,
    BarDiff is BB - BW,
    (   contact(S)
    ->  aggregate_all(count, member(1, Pts), BlW),
        aggregate_all(count, member(-1, Pts), BlB),
        aggregate_all(count, (nth1(P, Pts, C), P =< 6, C >= 2), HW),
        aggregate_all(count, (nth1(P, Pts, C), P >= 19, C =< -2), HB),
        BlotDiff is BlB - BlW, HomeDiff is HW - HB
    ;   BlotDiff = 0, HomeDiff = 0              % a pure race: only pips
    ).

pips(state(Pts, BW, _, _, _), white, N) :-
    aggregate_all(sum(P*C), (nth1(P, Pts, C), C > 0), S0),
    N is S0 + 25*BW.
pips(state(Pts, _, BB, _, _), black, N) :-
    aggregate_all(sum((25-P)*(-C)), (nth1(P, Pts, C), C < 0), S0),
    N is S0 + 25*BB.

contact(state(Pts, BW, BB, _, _)) :-          % can the sides still meet?
    ( BW > 0 -> HiW = 25
    ; aggregate_all(max(P), (nth1(P, Pts, C), C > 0), HiW) -> true
    ; HiW = 0 ),
    ( BB > 0 -> LoB = 0
    ; aggregate_all(min(P), (nth1(P, Pts, C), C < 0), LoB) -> true
    ; LoB = 25 ),
    HiW > LoB.

% =============================================================
%  5. EXPECTIMINIMAX WITH A CUTOFF
% =============================================================
% The 21 distinct rolls: doubles 1/36, the others 2/36
roll([B, A], P) :-
    between(1, 6, A), between(A, 6, B),
    ( A =:= B -> P is 1/36 ; P is 2/36 ).

% best_reply(+State, +Player, +Dice, +W, -V):
%   Player rolls Dice and plays his best move; we stop there and
%   use EVAL instead of searching deeper (the cutoff).
best_reply(S, P, Dice, W, V) :-
    legal_turns(S, P, Dice, Turns),
    (   Turns == []
    ->  eval(S, W, V)
    ;   findall(E, (member(F-_, Turns), eval(F, W, E)), Es),
        ( P == white -> max_list(Es, V) ; min_list(Es, V) )
    ).

% chance(+State, +Player, +W, -V): the chance node before Player rolls
chance(S, P, W, V) :-
    aggregate_all(sum(Pr*Vr), ( roll(D, Pr), best_reply(S, P, D, W, Vr) ), V).

% decide(+State, +Player, +Dice, -best(Value, Moves, Final))
decide(S, P, Dice, Best) :-
    default_weights(W), decide(S, P, Dice, W, 12, Best).

% decide(+State, +Player, +Dice, +W, +Beam, -best(Value, Moves, Final))
%   Only the Beam best moves by EVAL are searched one level deeper.
decide(S, black, Dice, W, Beam, best(V, Ms, F)) :- !,  % decide in the mirror
    mirror(S, M), decide(M, white, Dice, W, Beam, best(V0, Ms0, F0)),
    V is -V0, maplist(mirror_move, Ms0, Ms), mirror(F0, F).
decide(S, white, Dice, W, Beam, best(V, Ms, F)) :-
    legal_turns(S, white, Dice, Turns), Turns \== [],
    findall(E-(F0-Ms0), (member(F0-Ms0, Turns), eval(F0, W, E)), Scored),
    keysort(Scored, Up), reverse(Up, Sorted),
    take(Beam, Sorted, Top),
    findall(V0-(Ms0-F0),
            ( member(_-(F0-Ms0), Top),
              ( winner(F0, _) -> eval(F0, W, V0) ; chance(F0, black, W, V0) ) ),
            Vs),
    max_member(V-(Ms-F), Vs).

take(N, L, P) :- length(L, Len), ( Len =< N -> P = L ; length(P, N), append(P, _, L) ).

% =============================================================
%  6. AGENTS, GAMES AND TOURNAMENTS
% =============================================================
%  agent(greedy, W):        best move by EVAL alone (no lookahead)
%  agent(expecti(Beam), W): expectiminimax, one chance level + EVAL

act(A, S, black, Dice, S2) :- !,                  % decide in the mirror
    mirror(S, M), act(A, M, white, Dice, M2), mirror(M2, S2).
act(agent(greedy, W), S, white, Dice, S2) :-
    legal_turns(S, white, Dice, Turns),
    (   Turns == [] -> S2 = S
    ;   findall(E-F, (member(F-_, Turns), eval(F, W, E)), Es),
        max_member(_-S2, Es)
    ).
act(agent(expecti(Beam), W), S, white, Dice, S2) :-
    (   decide(S, white, Dice, W, Beam, best(_, _, F)) -> S2 = F ; S2 = S ).

roll_dice([A, B]) :- random_between(1, 6, A), random_between(1, 6, B).

% game(+White, +Black, +First, -Winner)
game(AW, AB, First, Winner) :-
    initial(S), game_loop(S, First, AW, AB, 0, Winner).

game_loop(S, _, _, _, _, W) :- winner(S, W0), !, W = W0.   % stop at ANY winner
game_loop(S, P, AW, AB, N, W) :-
    N < 2000,
    roll_dice(D),
    ( P == white -> A = AW ; A = AB ),
    act(A, S, P, D, S1),
    other(P, Q), N1 is N + 1,
    game_loop(S1, Q, AW, AB, N1, W).

% tournament(+White, +Black, +N, -WhiteWins): N games, alternating who starts
tournament(AW, AB, N, Wins) :-
    aggregate_all(count,
                  ( between(1, N, I),
                    ( I mod 2 =:= 0 -> First = white ; First = black ),
                    game(AW, AB, First, Winner),
                    Winner == white ),
                  Wins).

% =============================================================
%  7. SHOWING A POSITION
% =============================================================
show(state(Pts, BW, BB, OW, OB)) :-
    format(" 13  14  15  16  17  18  | 19  20  21  22  23  24~n"),
    forall(between(13, 24, P), (cell(Pts, P), ( P =:= 18 -> write(" |") ; true ))), nl,
    forall(between(1, 12, K), (P is 13 - K, cell(Pts, P), ( P =:= 7 -> write(" |") ; true ))), nl,
    format(" 12  11  10   9   8   7  |  6   5   4   3   2   1~n"),
    format(" bar: W~w B~w   off: W~w B~w~n", [BW, BB, OW, OB]).

cell(Pts, P) :-
    nth1(P, Pts, C),
    (   C > 0 -> format("~t~w~w~3|", ['W', C]) ; true ),
    (   C < 0 -> N is -C, format("~t~w~w~3|", ['B', N]) ; true ),
    (   C =:= 0 -> format("  .") ; true ),
    write(" ").
