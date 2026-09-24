---
title: "Portal meteorològic de Catalunya"
description: "Un portal React autenticat per planificar activitats a Catalunya, combinant històric d'estacions Meteocat, alertes sobre mapa, senyals de qualitat de l'aire i recomanacions d'activitat."
lang: ca
translationKey: catalunya-weather
order: 4
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Portal de planificació meteorològica"
image: "/catalunya_weather_app.png"
source: "https://github.com/albert-queralto/catalunya_weather_app"
preview: "https://catalonia-weather-app.albertqueralto.dev"
technologies:
  - TypeScript
  - React
  - Python
  - FastAPI
  - Leaflet
  - Recharts
metrics:
  - label: "Tipus de producte"
    value: "Portal de planificació autenticat"
  - label: "Senyals de dades"
    value: "Meteocat, previsions, qualitat de l'aire"
  - label: "Interfícies"
    value: "Mapes, gràfics, recomanador"
---

## Problema

Les decisions meteorològiques a Catalunya sovint depenen de més d'una única previsió. Una eina de planificació útil ha de combinar observacions de les estacions Meteocat, avisos regionals, senyals locals de qualitat de l'aire i context pràctic d'activitats en un mateix lloc.

Aquest projecte transforma aquests senyals fragmentats en un portal de planificació meteorològica. La pàgina pública presenta el producte com un espai centralitzat per consultar previsions regionals, qualitat de l'aire, avisos Meteocat i opcions d'activitats adaptades al temps arreu de Catalunya.

## Restriccions

L'aplicació depèn de diverses fonts de dades en temps real i històriques, de manera que ha de gestionar valors d'estació absents, observacions horàries de qualitat de l'aire no disponibles, períodes sense alertes, errors dels proveïdors externs i límits de peticions de Meteocat.

Els fluxos basats en mapes afegeixen complexitat geogràfica: coordenades, metadades d'estacions, límits comarcals, comparacions entre estacions properes i ubicacions seleccionades per l'usuari s'han de mantenir sincronitzats entre gràfics, controls i resultats del recomanador.

L'autenticació també és important. El portal inclou inici de sessió, registre, perfils, fluxos protegits d'usuari i pantalles orientades a administració, de manera que les crides a l'API han de preservar l'estat del token mantenint alhora els errors visibles i recuperables.

## Enfocament

El frontend desplegat és una aplicació Vite React i TypeScript que utilitza React Router, Material UI, Leaflet/react-leaflet i Recharts. Un client API compartit es comunica amb un backend `/api/v1` perquè les pantalles de funcionalitats puguin sol·licitar dades JSON mitjançant camins consistents de fetch i gestió d'errors.

El flux principal autenticat se centra en un recomanador d'activitats. Els usuaris poden seleccionar una ubicació manualment o mitjançant la geolocalització del navegador, ajustar radi, horitzó de previsió, finestra de planificació, límit de resultats i sensibilitat a la qualitat de l'aire, i visualitzar després les recomanacions properes en un mapa Leaflet.

Les eines d'estacions exposen dades Meteocat mitjançant un explorador d'estacions i un mapa de Catalunya. Els usuaris poden seleccionar estacions, variables i rangs de dates, inspeccionar tendències, gràfics diaris de mínim/mitjana/màxim, indicadors de dades absents, comparacions d'estacions properes, informació de microclima i resums de precisió de previsions.

El portal també inclou un mapa de qualitat de l'aire per a PM2.5, PM10, CO, CO2, NO2, SO2, ozó i índex UV, a més d'una vista d'episodis SMP de Meteocat que acoloreix les comarques segons el nivell de perill dels avisos per a avui i demà.

## Validació

La validació cobreix l'accés a rutes, persistència del token, fluxos d'inici de sessió i registre, pantalles protegides d'usuari i determinades operacions d'administració. Les respostes de l'API han de fallar de manera clara quan els serveis meteorològics externs retornen dades buides, payloads invàlids o errors de quota.

Les comprovacions específiques de meteorologia inclouen estacions Meteocat representatives, variables d'estació, rangs de dates, intervals absents, contaminants de qualitat de l'aire, períodes d'alerta SMP oberts, overlays de mapa i execucions del recomanador amb diferents radis i finestres de planificació.

La validació del frontend se centra en estats de càrrega, estats buits, format dels gràfics, posició dels marcadors, coloració de comarques, agrupació de recomanacions i en si els esdeveniments de feedback s'envien amb prou context meteorològic i de rànquing per a anàlisis posteriors.

## Decisions d'enginyeria

React Router separa el portal en fluxos públics, autenticats i orientats a administració. Material UI proporciona formularis, botons, chips, modals i controls de navegació coherents en una superfície funcional gran.

Leaflet s'utilitza per als mapes interactius perquè la selecció d'estacions, la ubicació de l'usuari, els overlays comarcals i els marcadors de contaminants són interaccions centrals, no elements decoratius. Recharts gestiona històrics d'estacions, sèries horàries de qualitat de l'aire, resums de dades absents i comparacions de precisió de previsions.

L'API backend continua actuant com a capa anticorrupció davant Meteocat, qualitat de l'aire, recomanacions, usuaris i endpoints de models. Mantenir aquestes integracions al servidor facilita normalitzar esquemes, protegir configuracions dels proveïdors i aplicar caché o substituir serveis externs en el futur.

## Compromisos

La versió actual prioritza una experiència integrada de planificació per sobre d'una modelització meteorològica profunda. Reuneix senyals útils per a decisions quotidianes, però no s'ha de considerar un sistema oficial d'alertes ni un substitut de les indicacions primàries de Meteocat.

Carregar mapes en temps real, metadades d'estacions, valors històrics, alertes i observacions de qualitat de l'aire dona amplitud a la interfície, però també crea latència i pressió sobre els límits de peticions. Un caching més fort i resums precalculats millorarien la resiliència.

El bucle de recomanacions captura accions d'usuari com visualitzacions, desats, completats, descartats i valoracions, però la qualitat de la personalització depèn de continuar acumulant esdeveniments i d'avaluar acuradament el comportament del rànquing.

## Següents passos

La següent versió hauria d'afegir proves automatitzades d'API i navegador, protecció de rutes més robusta per a totes les pantalles exclusives d'administració, caché de respostes, documentació de desplegament i monitoratge d'errors dels proveïdors externs.

Altres millores podrien incloure ubicacions desades, preferències de notificacions, comprovacions d'accessibilitat més riques per a mapes i gràfics, millor recollida de snapshots de previsió, metodologia de fonts de dades més explícita i un bucle d'analítica de producció per a la qualitat de les recomanacions.
