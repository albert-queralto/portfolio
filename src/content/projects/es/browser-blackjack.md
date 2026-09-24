---
title: "Blackjack en el navegador"
description: "Una implementación responsive de Blackjack en el navegador con gestión del estado de la partida y una interfaz interactiva compacta."
lang: es
translationKey: browser-blackjack
order: 9
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Aplicación frontend"
image: "/blackjack.png"
source: "https://github.com/albert-queralto/js_blackjack"
preview: "https://js-blackjack.vercel.app/"
technologies:
  - JavaScript
  - HTML
  - CSS
  - Vercel
metrics:
  - label: "Tipo de aplicación"
    value: "Juego en el navegador"
  - label: "Reto principal"
    value: "Gestión del estado de la partida"
  - label: "Despliegue"
    value: "Vercel"
---

## Problema

El Blackjack tiene un conjunto de reglas compacto, pero suficientes transiciones de estado como para convertirlo en un ejercicio útil de ingeniería frontend. Una implementación en el navegador debe gestionar la baraja, las manos del jugador y del crupier, las puntuaciones, el orden de turnos, los estados finales y los controles de usuario sin permitir acciones contradictorias.

El proyecto se construyó como una aplicación interactiva focalizada que demuestra gestión de estado con JavaScript y diseño responsive sin depender de un framework grande.

## Restricciones

El valor de los ases puede cambiar según el resto de la mano, por lo que el cálculo de la puntuación no puede tratar todas las cartas como si tuvieran un valor fijo. El comportamiento del crupier debe seguir reglas deterministas, mientras que las acciones del jugador deben desactivarse en los momentos correctos de la ronda.

La interfaz debe seguir siendo comprensible en pantallas pequeñas y proporcionar feedback inmediato cuando termina una ronda. Toda la lógica se ejecuta en el navegador, por lo que el estado de la aplicación se reinicia al recargar la página.

El juego es una demostración simplificada y no incluye apuestas con dinero real ni funcionalidad multijugador en línea.

## Enfoque

La aplicación modela una baraja de cartas, el barajado, el reparto, el cálculo de manos, las acciones del jugador, las acciones del crupier y los resultados de cada ronda mediante JavaScript.

Los controles de la interfaz desencadenan transiciones de estado explícitas, como iniciar una ronda, pedir otra carta o plantarse. Las cartas y puntuaciones renderizadas se actualizan a partir del estado actual en lugar de mantenerse como valores visuales independientes.

HTML aporta la estructura semántica y CSS construye la presentación responsive y la disposición del juego.

## Validación

El juego puede comprobarse con manos representativas que incluyan Blackjack natural, pasarse de 21, robos del crupier, empates y manos con uno o más ases.

Las pruebas manuales de interacción verifican que las acciones no disponibles estén desactivadas, que las puntuaciones se actualicen después de cada carta, que el crupier se detenga según la regla seleccionada y que una nueva ronda reinicie todo el estado necesario.

La versión desplegada en Vercel ofrece una comprobación de integración de las rutas de assets y del comportamiento en entornos de navegador reales.

## Decisiones de ingeniería

El proyecto utiliza JavaScript puro para mantener visibles las transiciones de estado y las actualizaciones del DOM. Esto evita el sobrecoste de un framework y hace que la aplicación sea adecuada para demostrar APIs fundamentales del navegador.

La lógica del juego y las actualizaciones de la interfaz deben mantenerse separadas siempre que sea posible para que el comportamiento del cálculo de puntuaciones pueda probarse independientemente del código de presentación.

El alojamiento estático en Vercel es suficiente porque el juego no necesita servidor ni base de datos persistente.

## Compromisos

La aplicación prioriza una experiencia compacta para un solo jugador frente a una simulación completa de casino. No incluye cuentas, estadísticas guardadas, varios jugadores, reglas de la casa configurables ni backend.

La gestión manual del DOM es adecuada a esta escala, pero un juego mayor con varias pantallas y estado persistente podría beneficiarse de un framework de componentes y una máquina de estados formal.

## Siguientes pasos

Las posibles mejoras incluyen pruebas unitarias automatizadas para el cálculo de manos y la lógica del crupier, controles de teclado, anuncios de accesibilidad más completos, animaciones, estadísticas persistentes del jugador y reglas configurables.

Una versión más ambiciosa podría utilizar una máquina de estados finitos para hacer explícitas las transiciones, añadir un modo de explicación de estrategia y proporcionar un backend multijugador con WebSockets.
