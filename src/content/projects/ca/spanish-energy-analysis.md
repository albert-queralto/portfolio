---
title: "Anàlisi dels preus de l'energia a Espanya"
description: "Anàlisi exploratòria i estadística dels preus del mercat elèctric espanyol, el comportament estacional i possibles factors explicatius del preu."
lang: ca
translationKey: spanish-energy-analysis
order: 8
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "EDA · Modelització estadística"
image: "/energy_prices.png"
source: "https://github.com/albert-queralto/analysis_energy_prices"
technologies:
  - Python
  - Pandas
  - Matplotlib
  - Statsmodels
metrics:
  - label: "Tipus d'anàlisi"
    value: "Exploratòria + estadística"
  - label: "Domini principal"
    value: "Mercat elèctric espanyol"
  - label: "Focus temporal"
    value: "Estacionalitat i factors del preu"
---

## Problema

Els preus de l'electricitat varien amb la demanda, el mix de generació, l'estacionalitat, les condicions de mercat i els esdeveniments externs. Els valors bruts d'una sèrie temporal no expliquen per si sols quan canvien els preus ni quins factors poden moure's conjuntament.

Aquest projecte analitza els preus del mercat elèctric espanyol per identificar patrons temporals, visualitzar períodes de volatilitat i investigar relacions amb possibles variables explicatives.

El treball està pensat com una base analítica per a reporting, forecasting i investigació posterior del mercat energètic.

## Restriccions

Les sèries temporals energètiques tenen una forta dependència temporal, múltiples cicles estacionals, outliers, períodes absents i canvis estructurals. Les relacions observades en l'anàlisi exploratòria no impliquen causalitat automàticament.

Les variables poden tenir freqüències o timestamps diferents i s'han d'alinear abans de comparar-les. Les distribucions de preu poden estar fortament esbiaixades, de manera que les mitjanes per si soles són insuficients.

Qualsevol interpretació predictiva ha de respectar l'ordre cronològic i evitar particions train/test aleatòries.

## Enfocament

Pandas s'utilitza per netejar, alinear, agregar i reestructurar les dades. Matplotlib dona suport a visualitzacions de sèries temporals, distribucions i relacions, mentre que Statsmodels proporciona eines estadístiques per analitzar tendències i comportament temporal.

L'anàlisi comença amb comprovacions de qualitat de dades i estadística descriptiva, i després examina comportaments horaris, diaris, mensuals i estacionals. Els possibles factors explicatius es comparen amb els moviments del preu mitjançant gràfics i resums estadístics.

El flux diferencia observacions exploratòries d'afirmacions estadístiques més fortes i registra les hipòtesis assumides durant les transformacions.

## Validació

Abans de l'anàlisi es comproven rangs de dates, freqüències, timestamps absents, duplicats i unitats. Els valors agregats es comparen amb les observacions subjacents per assegurar que les transformacions conserven el significat previst.

Quan hi ha predicció, els models estadístics s'inspeccionen mitjançant el comportament dels residus i validació temporal. També es considera la sensibilitat als outliers i als períodes de mercat poc habituals en interpretar els resums estadístics.

Els gràfics es revisen per evitar escales enganyoses, agregacions temporals inconsistents i mescles accidentals de variables amb unitats diferents.

## Decisions d'enginyeria

El projecte s'estructura com una anàlisi Python reproduïble i no com una col·lecció de càlculs manuals desconnectats. La preparació de dades es separa de la visualització i la modelització perquè el mateix dataset net pugui donar suport a diverses vistes analítiques.

Statsmodels s'utilitza quan una sortida estadística interpretable aporta més valor que un predictor de caixa negra. El codi font i les figures estan versionats al repositori.

El projecte complementa el pipeline d'ingestió energètica separat, que s'encarrega de la recollida i persistència de dades.

## Compromisos

L'anàlisi prioritza la interpretabilitat i l'exploració en lloc de construir un servei de forecasting en producció. No afirma que les variables correlacionades siguin factors causals.

Les dades explicatives externes i les intervencions importants del mercat poden no estar completament representades. Una anàlisi més completa requeriria variables exògenes més riques i un tractament explícit dels canvis de règim.

## Següents passos

La següent etapa podria combinar l'anàlisi amb el pipeline automatitzat d'ingestió per crear un dataset i un tauler actualitzats contínuament.

Treball addicional podria incorporar baselines de forecasting de sèries temporals, avaluació rolling-origin, intervals d'incertesa, anàlisi de canvis de règim i comparacions entre models estadístics clàssics i enfocaments de gradient boosting.
