---
title: "Panel de obesidad"
description: "Un panel interactivo para explorar patrones globales de obesidad y diferencias demográficas con un stack analítico en Python."
lang: es
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
  - label: "Resultado"
    value: "Panel interactivo"
  - label: "Foco del análisis"
    value: "Patrones globales y demográficos"
  - label: "Despliegue"
    value: "Render"
---

## Problema

Los datos de obesidad contienen múltiples dimensiones geográficas, demográficas y temporales que resultan difíciles de comprender únicamente mediante tablas estáticas. El proyecto transforma el conjunto de datos en un panel interactivo que permite explorar patrones y comparar visualmente grupos de población.

El público objetivo incluye analistas, estudiantes y profesionales de salud pública que necesitan una forma accesible de inspeccionar diferencias sin escribir código.

## Restricciones

Los conjuntos de datos sanitarios suelen combinar categorías, regiones, grupos de edad y periodos de información con una cobertura incompleta o desigual. Las comparaciones pueden resultar engañosas si se pasan por alto diferencias en las definiciones de población o en la disponibilidad de datos.

Un panel público también debe equilibrar flexibilidad analítica, tiempos de carga rápidos y una interfaz sencilla. La aplicación está desplegada en un nivel de alojamiento con recursos limitados, por lo que las transformaciones costosas no deberían repetirse innecesariamente en cada interacción.

El proyecto es exploratorio y no debe interpretarse como consejo médico ni como un análisis causal de la obesidad.

## Enfoque

Pandas se utiliza para limpiar, reestructurar, filtrar y resumir los datos de origen. Bokeh proporciona gráficos y controles interactivos enlazados para que los usuarios puedan examinar patrones geográficos y demográficos desde la misma aplicación.

La interfaz pone el énfasis en la comparación exploratoria en lugar de una única conclusión fija. Los usuarios pueden cambiar las dimensiones seleccionadas y observar cómo responden las distribuciones y tendencias.

La preparación de los datos se realiza antes de la visualización para que los callbacks de los gráficos operen sobre estructuras coherentes y listas para el análisis.

## Validación

El conjunto transformado se contrasta con la fuente para comprobar categorías esperadas, valores ausentes y consistencia de agregados. Se prueban filtros representativos para asegurar que los controles actualicen el subconjunto correcto y que las etiquetas de los gráficos permanezcan sincronizadas con los datos seleccionados.

La validación visual incluye revisar ejes, leyendas, unidades, estados vacíos y comportamiento responsive. También se inspeccionan valores extremos y ausentes para evitar distorsionar silenciosamente los rangos de los gráficos.

La aplicación desplegada ofrece una comprobación final de integración del arranque y de la carga de assets en el entorno de alojamiento.

## Decisiones de ingeniería

Bokeh se eligió porque permite visualización interactiva basada en Python sin necesidad de un frontend JavaScript independiente. Esto mantiene la analítica y la lógica de interfaz cerca del código de procesamiento de datos.

El proyecto separa la preparación de datos de la construcción del panel para que los cambios en el dataset no requieran reescribir cada visualización. El alojamiento en Render hace que la aplicación sea accesible directamente desde el portfolio.

El repositorio contiene el código fuente y la definición de entorno necesarios para reproducir el panel.

## Compromisos

El panel prioriza la claridad exploratoria frente a incluir un gran número de gráficos. No pretende establecer relaciones causales ni construir un modelo predictivo de salud.

Una aplicación interactiva alojada con Python es conveniente, pero puede sufrir arranques en frío más lentos que una visualización completamente estática. Un uso mayor de caché o extractos precalculados podría mejorar la respuesta con datasets de mayor tamaño.

## Siguientes pasos

El trabajo futuro podría añadir documentación más clara de las fuentes de datos, descarga de datos filtrados, intervalos de confianza cuando estén disponibles, descripciones de accesibilidad más completas y pruebas automatizadas para transformaciones y callbacks.

Un modo de resumen estático podría mejorar el tiempo de carga inicial, mientras que una página metodológica más detallada podría explicar las limitaciones de las comparaciones entre países y grupos demográficos.
