---
title: "Análisis de los precios de la energía en España"
description: "Análisis exploratorio y estadístico de los precios del mercado eléctrico español, su comportamiento estacional y posibles factores explicativos del precio."
lang: es
translationKey: spanish-energy-analysis
order: 8
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "EDA · Modelización estadística"
image: "/energy_prices.png"
source: "https://github.com/albert-queralto/analysis_energy_prices"
technologies:
  - Python
  - Pandas
  - Matplotlib
  - Statsmodels
metrics:
  - label: "Tipo de análisis"
    value: "Exploratorio + estadístico"
  - label: "Dominio principal"
    value: "Mercado eléctrico español"
  - label: "Foco temporal"
    value: "Estacionalidad y factores del precio"
---

## Problema

Los precios de la electricidad varían con la demanda, el mix de generación, la estacionalidad, las condiciones de mercado y los eventos externos. Los valores brutos de una serie temporal por sí solos no explican cuándo cambian los precios ni qué factores pueden moverse conjuntamente.

Este proyecto analiza los precios del mercado eléctrico español para identificar patrones temporales, visualizar periodos de volatilidad e investigar relaciones con posibles variables explicativas.

El trabajo está pensado como base analítica para reporting, forecasting e investigación posterior del mercado energético.

## Restricciones

Las series temporales de energía presentan una fuerte dependencia temporal, múltiples ciclos estacionales, outliers, periodos ausentes y cambios estructurales. Las relaciones observadas en análisis exploratorio no implican causalidad automáticamente.

Las variables pueden utilizar frecuencias o timestamps distintos y deben alinearse antes de compararse. Las distribuciones de precios pueden estar muy sesgadas, por lo que los promedios por sí solos son insuficientes.

Cualquier interpretación predictiva debe respetar el orden cronológico en lugar de utilizar particiones train/test aleatorias.

## Enfoque

Pandas se utiliza para limpiar, alinear, agregar y reestructurar los datos. Matplotlib permite visualizaciones de series temporales, distribuciones y relaciones, mientras que Statsmodels proporciona herramientas estadísticas para analizar tendencias y comportamiento temporal.

El análisis comienza con comprobaciones de calidad de datos y estadísticas descriptivas, y después examina comportamiento horario, diario, mensual y estacional. Los posibles factores explicativos se comparan con los movimientos del precio mediante gráficos y resúmenes estadísticos.

El flujo distingue observaciones exploratorias de afirmaciones estadísticas más sólidas y registra los supuestos realizados durante las transformaciones.

## Validación

Antes del análisis se comprueban rangos de fechas, frecuencias, timestamps ausentes, duplicados y unidades. Los valores agregados se comparan con las observaciones subyacentes para asegurar que las transformaciones preserven el significado previsto.

Cuando hay predicción, los modelos estadísticos se inspeccionan mediante el comportamiento de los residuos y validación temporal. También se considera la sensibilidad a outliers y periodos de mercado inusuales al interpretar estadísticas resumidas.

Los gráficos se revisan para evitar escalas engañosas, agregaciones temporales inconsistentes y mezclas accidentales de variables con unidades distintas.

## Decisiones de ingeniería

El proyecto está estructurado como un análisis Python reproducible en lugar de una colección de cálculos manuales desconectados. La preparación de datos se separa de la visualización y modelización para que el mismo dataset limpio pueda respaldar varias vistas analíticas.

Statsmodels se utiliza cuando una salida estadística interpretable aporta más valor que un predictor de caja negra. El código fuente y las figuras están versionados en el repositorio.

El proyecto complementa el pipeline independiente de ingestión energética, encargado de la recopilación y persistencia de datos.

## Compromisos

El análisis prioriza interpretabilidad y exploración en lugar de construir un servicio de forecasting en producción. No afirma que las variables correlacionadas sean factores causales.

Los datos explicativos externos y las grandes intervenciones de mercado pueden no estar representados por completo. Un análisis más exhaustivo requeriría variables exógenas más ricas y tratamiento explícito de los cambios de régimen.

## Siguientes pasos

La siguiente etapa podría combinar el análisis con el pipeline automatizado de ingestión para crear un dataset y un panel actualizados de forma continua.

Trabajos posteriores podrían añadir baselines de forecasting de series temporales, evaluación rolling-origin, intervalos de incertidumbre, análisis de cambios de régimen y comparaciones entre modelos estadísticos clásicos y enfoques de gradient boosting.
