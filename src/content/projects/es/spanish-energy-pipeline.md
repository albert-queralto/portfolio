---
title: "Pipeline de datos energéticos de España"
description: "Un pipeline automatizado que recopila precios de la electricidad y datos de generación renovable de España y almacena resultados estructurados para su análisis."
lang: es
translationKey: spanish-energy-pipeline
order: 6
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "Ingesta de datos · Automatización"
image: "/web_scraping_esios.png"
source: "https://github.com/albert-queralto/scraping-energy-prices-spain"
technologies:
  - Python
  - REST API
  - PostgreSQL
  - Selenium
metrics:
  - label: "Tipo de pipeline"
    value: "Ingesta automatizada"
  - label: "Almacenamiento"
    value: "PostgreSQL"
  - label: "Adquisición"
    value: "APIs REST + automatización de navegador"
---

## Problema

El análisis del mercado eléctrico requiere datos históricos consistentes de varias fuentes, pero la información energética pública suele estar distribuida entre APIs, archivos descargables y sitios web interactivos.

Este proyecto automatiza la adquisición de precios de la electricidad y datos de generación renovable en España y los almacena en una base de datos estructurada para que los analistas puedan trabajar sobre un dataset repetible en lugar de recopilar información manualmente.

## Restricciones

Las fuentes externas pueden cambiar esquemas, estructura de página, identificadores o disponibilidad sin previo aviso. Parte de la información es accesible mediante APIs REST, mientras que otros datos requieren automatización del navegador.

Hay que gestionar con cuidado zonas horarias, timestamps, observaciones duplicadas, periodos ausentes y unidades inconsistentes. Volver a ejecutar el pipeline no debe crear registros duplicados ni corromper el histórico ya recopilado.

Las credenciales y la configuración específica de proveedores deben permanecer fuera del repositorio.

## Enfoque

Los jobs de ingestión en Python recuperan datos de los endpoints REST disponibles y utilizan Selenium cuando es necesaria interacción con el navegador. Las respuestas se convierten en registros normalizados antes de insertarse en PostgreSQL.

El pipeline separa extracción, transformación, validación y persistencia. Esto facilita sustituir la lógica específica de cada fuente y permite ejecutar controles de calidad antes de escribir en la base de datos.

Las tablas de la base de datos proporcionan una capa analítica estable para visualización, análisis estadístico y desarrollo posterior de modelos.

## Validación

Cada ejecución comprueba campos obligatorios, parsing de timestamps, conversión numérica, unidades esperadas y claves duplicadas. La completitud de los rangos de fechas puede inspeccionarse para detectar observaciones horarias o diarias ausentes.

Consultas de base de datos verifican que las reejecuciones sean idempotentes y que los conteos de filas y límites de fechas coincidan con el periodo de extracción solicitado. Los totales de origen u observaciones seleccionadas pueden compararse manualmente con el proveedor original.

Los fallos deben ser explícitos para que las extracciones parciales no se confundan con datos completos.

## Decisiones de ingeniería

PostgreSQL se utiliza como almacén analítico persistente porque ofrece constraints fiables, indexación, consultas por fecha e integración con herramientas Python.

Se prefiere el acceso por API cuando está disponible porque es más estable que el scraping. Selenium se aísla en las fuentes que requieren comportamiento de navegador, limitando la parte más frágil del pipeline.

El código se organiza alrededor de adaptadores de fuente y ejecuciones repetibles en lugar de un único workflow limitado a notebooks.

## Compromisos

La automatización de navegador introduce coste de mantenimiento y puede romperse cuando cambia un sitio web. Un pipeline de producción añadiría reintentos, logging estructurado, alertas y contratos de fuente más fuertes.

El proyecto se centra en ingestión y almacenamiento, no en orquestación a escala empresarial. Todavía no incluye un catálogo de datos completo, un sistema de lineage ni una capa de procesamiento distribuido.

## Siguientes pasos

El pipeline podría programarse con Apache Airflow u otro orquestador, con alertas automáticas para periodos ausentes, cambios de esquema y fallos repetidos.

Mejoras adicionales incluyen ejecución contenerizada, esquemas de base de datos gestionados mediante migraciones, informes de calidad, backfills incrementales, pruebas de integración contra respuestas de muestra y un panel público construido sobre los datos almacenados.
