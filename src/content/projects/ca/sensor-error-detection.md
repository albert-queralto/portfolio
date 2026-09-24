---
title: "Detecció i localització d'errors de sensors amb RNNs"
description: "Un pipeline de xarxes neuronals recurrents amb models LSTM i GRU per detectar i localitzar errors en fluxos multivariants de sensors."
lang: ca
translationKey: sensor-error-detection
order: 3
featured: false
draft: false
status: "Completed"
category: "Machine Learning"
focus: "Deep learning · Sèries temporals"
image: "/Sensor_Error_Detection_and_Localization_with_RNNs.png"
source: "https://github.com/albert-queralto/Sensor_Error_Detection_and_Localization_with_RNNs"
technologies:
  - Python
  - PyTorch
  - LSTM
  - GRU
  - Time series
metrics:
  - label: "Tipus de problema"
    value: "Detecció multivariant d'errors"
  - label: "Famílies de models"
    value: "LSTM + GRU"
  - label: "Sortida"
    value: "Detecció + localització"
---

## Problema

Els sistemes de monitoratge industrial i ambiental depenen de diversos sensors que produeixen mesures correlacionades al llarg del temps. Un sensor defectuós pot distorsionar l'anàlisi posterior, generar falses alarmes o amagar un esdeveniment operatiu real.

El projecte explora com les xarxes neuronals recurrents poden detectar quan un flux de sensor es torna anòmal i identificar quin sensor n'és el responsable. Els usuaris objectiu són enginyers i analistes encarregats de mantenir sistemes de monitoratge multivariant fiables.

## Restriccions

Els errors de sensors són temporals i no simples esdeveniments tabulars aïllats. Un valor sospitós pot ser identificable només per la seva relació amb observacions anteriors i amb el comportament simultani d'altres sensors.

Els exemples d'error poden ser molt menys freqüents que les observacions normals, cosa que crea un problema d'aprenentatge desequilibrat. Diferents tipus d'error també poden produir símptomes semblants, i un mateix sensor pot comportar-se de manera diferent sota condicions operatives canviants.

El projecte és experimental i no un servei de monitoratge desplegat, per la qual cosa l'avaluació se centra en el comportament dels models i el rendiment comparatiu en lloc de la latència de producció o la disponibilitat d'infraestructura.

## Enfocament

Les dades s'organitzen com a seqüències multivariants adequades per a xarxes neuronals recurrents. S'entrenen arquitectures LSTM i GRU perquè aprenguin dependències temporals i relacions entre sensors.

El pipeline separa dues tasques relacionades: detectar si una seqüència conté un error de sensor i localitzar el sensor afectat. La preparació de dades inclou construcció de seqüències, escalat de variables, generació d'objectius i separació entre entrenament i avaluació.

Comparar models LSTM i GRU permet valorar si la complexitat addicional de les portes d'una LSTM aporta prou benefici per a les dades i longitud de seqüència seleccionades.

## Validació

Els models s'avaluen sobre seqüències retingudes que no s'utilitzen durant l'entrenament. L'avaluació considera tant si es detecten els errors com si s'identifica correctament el sensor afectat.

Com que les observacions normals poden dominar el dataset, les mètriques sensibles a cada classe són més informatives que l'accuracy sola. Les matrius de confusió i el comportament per classe ajuden a revelar si un model funciona bé en tots els sensors o només en els patrons d'error més freqüents.

El repositori conté l'anàlisi reproduïble i els experiments de model utilitzats per comparar arquitectures i configuracions d'entrenament.

## Decisions d'enginyeria

PyTorch s'utilitza per definir explícitament les arquitectures recurrents i el bucle d'entrenament. Això fa visibles la gestió de l'estat ocult, les formes de les seqüències, l'optimització i el comportament d'avaluació en lloc d'amagar-los darrere d'una abstracció d'alt nivell.

El projecte manté lògicament separades la preparació de dades, la definició del model, l'entrenament i l'avaluació perquè cada etapa es pugui inspeccionar i modificar. La configuració reproduïble i les llavors aleatòries fixes són importants quan es comparen models recurrents.

S'utilitzen diagnòstics visuals juntament amb mètriques resum per inspeccionar el comportament de l'entrenament i els errors del model.

## Compromisos

El projecte se centra en arquitectures LSTM i GRU en lloc de provar tots els mètodes possibles per a sèries temporals. Baselines estadístics més simples i arquitectures de seqüència més recents podrien aportar comparacions addicionals útils.

El pipeline experimental encara no inclou una API d'inferència en streaming, un registre persistent de models, detecció automatitzada de drift ni una interfície d'alertes per a operadors.

## Següents passos

Una versió següent més sòlida afegiria baselines no recurrents, validació creuada temporal, optimització de llindars i una comparació més clara entre errors de detecció i de localització.

Per a ús en producció, el model es podria empaquetar darrere d'un servei FastAPI, connectar a una font de dades en streaming, monitorar per detectar data drift i integrar amb una interfície d'alertes que mostri el sensor afectat i les evidències de suport.
