# Backgammon: el azar a la vista

Material del curso de Inteligencia Artificial: juegos con azar y expectiminimax.

**Jugar:** https://ferdiex.github.io/backgammon/

## El juego

Juegas backgammon contra un agente expectiminimax, desde la computadora o el celular, sin instalar nada. La página incluye:

- **Las reglas completas:** la barra, comer fichas, sacar fichas, la obligación de usar ambos dados (o el mayor, si solo cabe uno) y pasar el turno cuando no hay jugada posible.
- **Pista:** el agente te sugiere tu mejor jugada y puedes aplicarla con un clic. Es la forma más rápida de aprender a jugar.
- **El nodo de azar:** después de cada jugada tuya, la página muestra las 21 tiradas posibles del agente, qué tan mal te iría con cada una, en cuáles te pueden comer una ficha y el valor esperado de tu posición. Cuando el agente tira, se marca la tirada que salió.
- **Lo que pensó el agente:** cuántas jugadas tenía, cuántas analizó a fondo, cuántas posiciones revisó y cuánto tardó.

## Cómo decide el agente

Expectiminimax de un nivel. Para cada jugada posible con sus dados, el agente considera las 21 tiradas del rival (los dobles con probabilidad 1/36 y las demás con 1/18), supone que el rival responde con su mejor jugada y promedia. Elige la jugada con el mejor valor esperado. Para ahorrar tiempo, solo analiza a fondo sus 12 jugadas más prometedoras.

La función de evaluación, desde el punto de vista del humano, suma la diferencia de pips, 4 puntos por cada ficha suelta del rival menos cada ficha suelta propia, 3 por cada punto cerrado en la casa propia menos los del rival, y 2 por cada ficha del rival en la barra menos las propias. Sin contacto entre las fichas solo cuentan los pips.

Mirar el nodo de azar ayuda, pero menos de lo que uno esperaría: en 200 partidas contra un agente que usa la misma evaluación sin mirar las tiradas del rival, el agente expectiminimax ganó el 54%, apenas por encima del ruido. La calidad de la evaluación pesa mucho más: una evaluación que solo cuenta pips gana alrededor del 5% de las partidas contra la nuestra.

## En Prolog y en Python

El mismo juego y el mismo agente están escritos en SWI-Prolog (`prolog/backgammon.pl`) y en Python (`python/backgammon.py`), con el mismo diseño: las reglas solo para las blancas (las negras se calculan reflejando el tablero), la función de evaluación con pesos que se pueden cambiar, expectiminimax con un nivel de azar y corte con la EVAL, y torneos entre agentes para comparar funciones de evaluación. Los dos generan exactamente las mismas jugadas legales y la misma EVAL que la página: lo verificamos en 4,000 y 2,000 posiciones aleatorias.

```
$ swipl prolog/backgammon.pl
?- initial(S), show(S).
?- initial(S), decide(S, white, [3,1], best(V, Moves, _)).
?- tournament(agent(greedy, w(1,0,4,3,2)), agent(greedy, w(1,0,0,0,0)), 100, Wins).
```

```
$ cd python
$ python3 -i backgammon.py
>>> decide(INITIAL, "white", (3, 1))
>>> tournament(greedy((1, 0, 4, 3, 2)), greedy((1, 0, 0, 0, 0)), 100, seed=2)
```

## Presentaciones

1. `presentaciones/1_backgammon_laboratorio.pdf`: cómo se juega y la tarea de jugar con la página.
2. `presentaciones/2_backgammon_prolog.pdf`: expectiminimax con corte y diseña tu propia EVAL, en Prolog.
3. `presentaciones/3_backgammon_python.pdf`: lo mismo en Python, con una comparación entre los dos lenguajes.

## Archivos

```
backgammon/
├── index.html             la página del juego
├── engine.js              reglas, evaluación y agente (JavaScript)
├── prolog/
│   └── backgammon.pl      el mismo juego y agente en SWI-Prolog
├── python/
│   └── backgammon.py      el mismo juego y agente en Python
├── presentaciones/        las tres presentaciones en PDF
└── pruebas/
    └── reglas.test.js     pruebas de las reglas:  node pruebas/reglas.test.js
```

Para jugar en tu computadora sin internet basta con abrir `index.html` en el navegador.

Fernando Montes-Gonzalez, Universidad Veracruzana
