---
title: "Blackjack al navegador"
description: "Una implementació responsive de Blackjack al navegador amb gestió de l'estat de la partida i una interfície interactiva compacta."
lang: ca
translationKey: browser-blackjack
order: 9
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Aplicació frontend"
image: "/blackjack.png"
source: "https://github.com/albert-queralto/js_blackjack"
preview: "https://js-blackjack.vercel.app/"
technologies:
  - JavaScript
  - HTML
  - CSS
  - Vercel
metrics:
  - label: "Tipus d'aplicació"
    value: "Joc al navegador"
  - label: "Repte principal"
    value: "Gestió de l'estat de la partida"
  - label: "Desplegament"
    value: "Vercel"
---

## Problema

El Blackjack té un conjunt de regles relativament compacte, però prou transicions d'estat per convertir-lo en un bon exercici d'enginyeria frontend. Una implementació al navegador ha de gestionar la baralla, les mans del jugador i de la banca, les puntuacions, l'ordre dels torns, els estats finals i els controls d'usuari sense permetre accions contradictòries.

El projecte es va construir com una aplicació interactiva focalitzada que demostra gestió d'estat amb JavaScript i disseny responsive sense dependre d'un framework gran.

## Restriccions

El valor dels asos pot canviar segons la resta de la mà, de manera que el càlcul de la puntuació no pot tractar totes les cartes com si tinguessin un valor fix. El comportament de la banca ha de seguir regles deterministes, mentre que les accions del jugador s'han de desactivar en els moments correctes de la ronda.

La interfície ha de continuar sent clara en pantalles petites i donar feedback immediat quan acaba una ronda. Tota la lògica s'executa al navegador, així que l'estat de l'aplicació es reinicia quan es refresca la pàgina.

El joc és una demostració simplificada i no inclou apostes amb diners reals ni funcionalitat multijugador en línia.

## Enfocament

L'aplicació modela una baralla de cartes, la barreja, el repartiment, el càlcul de mans, les accions del jugador, les accions de la banca i els resultats de cada ronda amb JavaScript.

Els controls de la interfície desencadenen transicions d'estat explícites, com començar una ronda, demanar una altra carta o plantar-se. Les cartes i les puntuacions representades es recalculen a partir de l'estat actual en lloc de mantenir-se com a valors visuals independents.

HTML proporciona l'estructura semàntica i CSS construeix la presentació responsive i la disposició del joc.

## Validació

El joc es pot comprovar amb mans representatives que incloguin Blackjack natural, passar-se de 21, robades de la banca, empats i mans amb un o més asos.

Les proves manuals d'interacció verifiquen que les accions no disponibles estiguin desactivades, que les puntuacions s'actualitzin després de cada carta, que la banca s'aturi segons la regla seleccionada i que una nova ronda reiniciï tot l'estat necessari.

La versió desplegada a Vercel proporciona una comprovació d'integració dels paths d'assets i del comportament en entorns de navegador reals.

## Decisions d'enginyeria

El projecte utilitza JavaScript pur per mantenir visibles les transicions d'estat i les actualitzacions del DOM. Això evita la sobrecàrrega d'un framework i fa que l'aplicació sigui adequada per demostrar les APIs bàsiques del navegador.

La lògica de joc i les actualitzacions de la interfície s'han de mantenir separades sempre que sigui possible perquè el comportament del càlcul de puntuacions es pugui provar independentment del codi de presentació.

L'allotjament estàtic a Vercel és suficient perquè el joc no necessita servidor ni base de dades persistent.

## Compromisos

L'aplicació prioritza una experiència compacta per a un sol jugador per sobre d'una simulació completa de casino. No inclou comptes, estadístiques persistents, diversos jugadors, regles de la casa configurables ni backend.

La gestió manual del DOM és adequada per a aquesta mida, però un joc més gran amb diverses pantalles i estat persistent podria beneficiar-se d'un framework de components i d'una màquina d'estats formal.

## Següents passos

Les possibles millores inclouen proves unitàries automatitzades per al càlcul de mans i la lògica de la banca, controls de teclat, anuncis d'accessibilitat més rics, animacions, estadístiques persistents del jugador i regles configurables.

Una versió més ambiciosa podria utilitzar una màquina d'estats finits per fer explícites les transicions, afegir un mode d'explicació d'estratègia i proporcionar un backend multijugador amb WebSockets.
