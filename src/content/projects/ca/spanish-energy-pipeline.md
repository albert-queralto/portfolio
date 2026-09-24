---
title: "Pipeline de dades energètiques d'Espanya"
description: "Un pipeline automatitzat que recull preus de l'electricitat i dades de generació renovable d'Espanya i n'emmagatzema els resultats estructurats per a l'anàlisi."
lang: ca
translationKey: spanish-energy-pipeline
order: 6
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "Ingestió de dades · Automatització"
image: "/web_scraping_esios.png"
source: "https://github.com/albert-queralto/scraping-energy-prices-spain"
technologies:
  - Python
  - REST API
  - PostgreSQL
  - Selenium
metrics:
  - label: "Tipus de pipeline"
    value: "Ingestió automatitzada"
  - label: "Emmagatzematge"
    value: "PostgreSQL"
  - label: "Adquisició"
    value: "APIs REST + automatització de navegador"
---

## Problema

L'anàlisi del mercat elèctric necessita dades històriques coherents de diverses fonts, però la informació energètica pública sovint està distribuïda entre APIs, fitxers descarregables i webs interactives.

Aquest projecte automatitza l'adquisició de preus de l'electricitat i dades de generació renovable a Espanya i les desa en una base de dades estructurada perquè els analistes puguin treballar sobre un dataset repetible en lloc de recopilar informació manualment.

## Restriccions

Les fonts externes poden canviar esquemes, estructura de pàgina, identificadors o disponibilitat sense avís. Algunes dades són accessibles mitjançant APIs REST, mentre que d'altres requereixen automatització del navegador.

Cal gestionar amb cura zones horàries, timestamps, observacions duplicades, períodes absents i unitats inconsistents. Tornar a executar el pipeline no ha de crear registres duplicats ni corrompre l'històric ja recollit.

Les credencials i la configuració específica dels proveïdors han de quedar fora del repositori.

## Enfocament

Els jobs d'ingestió en Python recuperen dades dels endpoints REST disponibles i utilitzen Selenium quan és necessària interacció amb el navegador. Les respostes es transformen en registres normalitzats abans d'inserir-se a PostgreSQL.

El pipeline separa extracció, transformació, validació i persistència. Això facilita substituir la lògica específica de cada font i permet executar comprovacions de qualitat abans d'escriure a la base de dades.

Les taules de base de dades proporcionen una capa analítica estable per a visualització, anàlisi estadística i desenvolupament de models posteriors.

## Validació

Cada execució comprova camps obligatoris, parsing de timestamps, conversió numèrica, unitats esperades i claus duplicades. Es pot inspeccionar la completitud dels rangs de dates per identificar observacions horàries o diàries absents.

Consultes a la base de dades verifiquen que les reexecucions siguin idempotents i que el nombre de files i els límits de data coincideixin amb el període d'extracció sol·licitat. Es poden comparar manualment totals de font o observacions seleccionades amb el proveïdor original.

Els errors han de ser explícits perquè una extracció parcial no es confongui amb dades completes.

## Decisions d'enginyeria

PostgreSQL s'utilitza com a magatzem analític persistent perquè ofereix constraints fiables, indexació, consultes per data i bona integració amb eines Python.

Es prefereix l'accés via API quan és disponible perquè és més estable que el scraping. Selenium s'aïlla a les fonts que requereixen comportament de navegador, limitant la part més fràgil del pipeline.

El codi s'organitza al voltant d'adaptadors de font i execucions repetibles en lloc d'un únic workflow limitat a notebooks.

## Compromisos

L'automatització de navegador introdueix cost de manteniment i es pot trencar quan canvia una web. Un pipeline de producció afegiria reintents, logging estructurat, alertes i contractes de font més forts.

El projecte se centra en ingestió i emmagatzematge, no en orquestració a escala empresarial. Encara no inclou un catàleg de dades complet, un sistema de lineage ni una capa de processament distribuït.

## Següents passos

El pipeline es podria programar amb Apache Airflow o un altre orquestrador, amb alertes automàtiques per períodes absents, canvis d'esquema i errors repetits.

Millores addicionals inclouen execució containeritzada, esquemes de base de dades gestionats amb migracions, informes de qualitat de dades, backfills incrementals, proves d'integració contra respostes de mostra i un tauler públic construït a partir de les dades desades.
