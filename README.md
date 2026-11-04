# Backgammon: el azar a la vista

Material del curso de Inteligencia Artificial: juegos con azar y expectiminimax.

**Jugar:** https://ferdiex.github.io/backgammon/

## El juego

Juegas backgammon contra un agente expectiminimax, desde la computadora o el celular, sin instalar nada. La página incluye:

- **Las reglas completas:** la barra, los golpes, sacar fichas, la obligación de usar ambos dados (o el mayor, si solo cabe uno) y pasar el turno cuando no hay jugada posible.
- **Pista:** el agente te sugiere tu mejor jugada y puedes aplicarla con un clic. Es la forma más rápida de aprender a jugar.
- **El nodo de azar:** después de cada jugada tuya, la página muestra las 21 tiradas posibles del agente, qué tan mal te iría con cada una, cuáles te pueden golpear y el valor esperado de tu posición. Cuando el agente tira, se marca la tirada que salió.
- **Lo que pensó el agente:** cuántas jugadas tenía, cuántas analizó a fondo, cuántas posiciones revisó y cuánto tardó.

## Cómo decide el agente

Expectiminimax de un nivel. Para cada jugada posible con sus dados, el agente considera las 21 tiradas del rival (los dobles con probabilidad 1/36 y las demás con 1/18), supone que el rival responde con su mejor jugada y promedia. Elige la jugada con el mejor valor esperado. Para ahorrar tiempo, solo analiza a fondo sus 12 jugadas más prometedoras.

La función de evaluación, desde el punto de vista del humano, suma la diferencia de pips, 4 puntos por cada ficha sola del rival menos cada ficha sola propia, 3 por cada punto cerrado en la casa propia menos los del rival, y 2 por cada ficha del rival en la barra menos las propias. Sin contacto entre las fichas solo cuentan los pips.

Considerar el nodo de azar sí importa: en 200 partidas contra un agente que usa la misma evaluación pero no mira las tiradas del rival, el agente expectiminimax ganó el 68%.

## Archivos

```
backgammon/
├── index.html             la página del juego
├── engine.js              reglas, evaluación y agente (JavaScript)
└── pruebas/
    └── reglas.test.js     pruebas de las reglas:  node pruebas/reglas.test.js
```

Para jugar en tu computadora sin internet basta con abrir `index.html` en el navegador.

Fernando Montes-Gonzalez, Universidad Veracruzana
