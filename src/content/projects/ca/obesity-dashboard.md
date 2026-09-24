---
title: "Tauler d'obesitat"
description: "Un tauler interactiu per explorar patrons globals d'obesitat i diferències demogràfiques amb un stack analític en Python."
lang: ca
translationKey: obesity-dashboard
order: 5
featured: false
draft: false
status: "Deployed"
category: "Data Science"
focus: "Analítica interactiva"
image: "/obesitydashboard.png"
source: "https://github.com/albert-queralto/dashboard_obesity_analysis"
preview: "https://dashboard-obesity-analysis.onrender.com/"
technologies:
  - Python
  - Bokeh
  - Pandas
  - Render
metrics:
  - label: "Resultat"
    value: "Tauler interactiu"
  - label: "Focus de l'anàlisi"
    value: "Patrons globals i demogràfics"
  - label: "Desplegament"
    value: "Render"
---

## Problema

Les dades d'obesitat contenen múltiples dimensions geogràfiques, demogràfiques i temporals que són difícils d'entendre només amb taules estàtiques. El projecte transforma el conjunt de dades en un tauler interactiu que permet explorar patrons i comparar visualment grups de població.

El públic objectiu inclou analistes, estudiants i professionals de salut pública que necessiten una manera accessible d'inspeccionar diferències sense haver d'escriure codi.

## Restriccions

Els conjunts de dades de salut solen combinar categories, regions, grups d'edat i períodes d'informe amb una cobertura incompleta o desigual. Les comparacions poden resultar enganyoses si no es tenen en compte les diferències en les definicions de població o en la disponibilitat de dades.

Un tauler públic també ha d'equilibrar flexibilitat analítica, temps de càrrega reduït i una interfície senzilla. L'aplicació està desplegada en un nivell d'allotjament amb recursos limitats, de manera que cal evitar repetir transformacions costoses en cada interacció.

El projecte és exploratori i no s'ha d'interpretar com a consell mèdic ni com una anàlisi causal de l'obesitat.

## Enfocament

Pandas s'utilitza per netejar, reestructurar, filtrar i resumir les dades d'origen. Bokeh proporciona gràfics i controls interactius vinculats perquè els usuaris puguin examinar patrons geogràfics i demogràfics des de la mateixa aplicació.

La interfície posa l'èmfasi en la comparació exploratòria, no en una única conclusió fixa. Els usuaris poden modificar les dimensions seleccionades i observar com responen les distribucions i les tendències.

La preparació de dades es fa abans de la visualització perquè els callbacks dels gràfics treballin sobre estructures coherents i llestes per a l'anàlisi.

## Validació

El conjunt de dades transformat es compara amb l'original per verificar categories esperades, valors absents i coherència dels agregats. Es proven filtres representatius per assegurar que els controls actualitzen el subconjunt correcte i que les etiquetes dels gràfics es mantenen sincronitzades amb les dades seleccionades.

La validació visual inclou la revisió d'eixos, llegendes, unitats, estats buits i comportament responsive. També s'inspeccionen valors extrems i absents per evitar distorsions silencioses en els rangs dels gràfics.

L'aplicació desplegada ofereix una comprovació final d'integració del procés d'arrencada i de la càrrega d'assets en l'entorn d'allotjament.

## Decisions d'enginyeria

Bokeh es va seleccionar perquè permet visualització interactiva des de Python sense requerir un frontend JavaScript separat. Això manté la lògica analítica i d'interfície a prop del codi de processament de dades.

El projecte separa la preparació de dades de la construcció del tauler perquè els canvis al dataset no obliguin a reescriure cada visualització. El desplegament a Render fa que l'aplicació sigui accessible directament des del portfolio.

El repositori conté el codi font i la definició d'entorn necessaris per reproduir el tauler.

## Compromisos

El tauler prioritza la claredat exploratòria davant d'un gran nombre de gràfics. No intenta establir relacions causals ni construir un model predictiu de salut.

Una aplicació interactiva allotjada amb Python és convenient, però pot tenir arrencades en fred més lentes que una visualització completament estàtica. Més caching o extractes precalculats podrien millorar la resposta amb datasets més grans.

## Següents passos

El treball futur podria afegir documentació més clara de les fonts de dades, descàrrega de dades filtrades, intervals de confiança quan estiguin disponibles, descripcions d'accessibilitat més riques i proves automatitzades de transformacions i callbacks.

Un mode de resum estàtic podria millorar el temps de càrrega inicial, mentre que una pàgina metodològica més detallada podria explicar les limitacions de les comparacions entre països i grups demogràfics.
