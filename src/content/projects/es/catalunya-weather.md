---
title: "Portal meteorológico de Cataluña"
description: "Un portal React autenticado para planificar actividades en Cataluña, combinando histórico de estaciones Meteocat, alertas sobre mapa, señales de calidad del aire y recomendaciones de actividades."
lang: es
translationKey: catalunya-weather
order: 4
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Portal de planificación meteorológica"
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
  - label: "Tipo de producto"
    value: "Portal de planificación autenticado"
  - label: "Señales de datos"
    value: "Meteocat, previsiones, calidad del aire"
  - label: "Interfaces"
    value: "Mapas, gráficos, recomendador"
---

## Problema

Las decisiones meteorológicas en Cataluña suelen depender de algo más que una única previsión. Una herramienta de planificación útil debe combinar observaciones de estaciones Meteocat, avisos regionales, señales locales de calidad del aire y contexto práctico de actividades en un mismo lugar.

Este proyecto convierte esas señales fragmentadas en un portal de planificación meteorológica. La página pública presenta el producto como un espacio centralizado para previsiones regionales, calidad del aire, avisos Meteocat y decisiones de actividades adaptadas al tiempo en Cataluña.

## Restricciones

La aplicación depende de varias fuentes de datos en tiempo real e históricas, por lo que debe gestionar valores de estación ausentes, observaciones horarias de calidad del aire no disponibles, periodos sin alertas, fallos de proveedores externos y límites de peticiones de Meteocat.

Los flujos basados en mapas añaden complejidad geográfica: coordenadas, metadatos de estaciones, límites comarcales, comparaciones de estaciones cercanas y ubicaciones seleccionadas por el usuario deben permanecer sincronizados entre gráficos, controles y resultados de recomendación.

La autenticación también importa. El portal incluye inicio de sesión, registro, perfiles, flujos protegidos de usuario y pantallas orientadas a administración, por lo que las llamadas a la API deben preservar el estado del token manteniendo los errores visibles y recuperables.

## Enfoque

El frontend desplegado es una aplicación Vite React y TypeScript que utiliza React Router, Material UI, Leaflet/react-leaflet y Recharts. Un cliente API compartido se comunica con un backend `/api/v1` para que las pantallas funcionales soliciten datos JSON mediante rutas consistentes de fetch y gestión de errores.

El flujo principal autenticado gira alrededor de un recomendador de actividades. Los usuarios pueden seleccionar una ubicación manualmente o mediante la geolocalización del navegador, ajustar radio, horizonte de previsión, ventana de planificación, límite de resultados y sensibilidad a la calidad del aire, y después visualizar recomendaciones cercanas en un mapa Leaflet.

Las herramientas de estaciones exponen datos Meteocat mediante un explorador de estaciones y un mapa de Cataluña. Los usuarios pueden seleccionar estaciones, variables y rangos de fechas, inspeccionar tendencias, gráficos diarios de mínimo/media/máximo, indicadores de datos ausentes, comparaciones de estaciones cercanas, información de microclima y resúmenes de precisión de previsiones.

El portal también incluye un mapa de calidad del aire para PM2.5, PM10, CO, CO2, NO2, SO2, ozono e índice UV, además de una vista de episodios SMP de Meteocat que colorea las comarcas según el nivel de peligro de los avisos para hoy y mañana.

## Validación

La validación cubre acceso a rutas, persistencia del token, flujos de inicio de sesión y registro, pantallas protegidas de usuario y determinadas operaciones de administración. Las respuestas de la API deben fallar de forma clara cuando los servicios meteorológicos externos devuelven datos vacíos, payloads inválidos o errores de cuota.

Las comprobaciones específicas de meteorología incluyen estaciones Meteocat representativas, variables de estación, rangos de fechas, intervalos ausentes, contaminantes de calidad del aire, periodos de alerta SMP abiertos, overlays de mapa y ejecuciones del recomendador con distintos radios y ventanas de planificación.

La validación frontend se centra en estados de carga, estados vacíos, formato de gráficos, colocación de marcadores, coloreado de comarcas, agrupación de recomendaciones y en si los eventos de feedback se envían con el contexto meteorológico y de ranking necesario para análisis posteriores.

## Decisiones de ingeniería

React Router separa el portal en flujos públicos, autenticados y orientados a administración. Material UI ofrece formularios, botones, chips, modales y controles de navegación coherentes en una superficie funcional amplia.

Leaflet se utiliza para mapas interactivos porque la selección de estaciones, la ubicación del usuario, los overlays de comarcas y los marcadores de contaminantes son interacciones centrales y no elementos decorativos. Recharts gestiona históricos de estaciones, series horarias de calidad del aire, resúmenes de datos ausentes y comparaciones de precisión de previsiones.

La API backend actúa como capa anticorrupción alrededor de Meteocat, calidad del aire, recomendaciones, usuarios y endpoints de modelos. Mantener estas integraciones en el servidor facilita normalizar esquemas, proteger la configuración de proveedores y aplicar caché o sustituir servicios externos más adelante.

## Compromisos

La versión actual prioriza una experiencia integrada de planificación frente a una modelización meteorológica profunda. Reúne señales útiles para decisiones diarias, pero no debe tratarse como un sistema oficial de alertas ni como sustituto de la orientación primaria de Meteocat.

Cargar mapas en vivo, metadatos de estaciones, valores históricos, alertas y observaciones de calidad del aire da amplitud a la interfaz, pero también genera latencia y presión sobre los límites de peticiones. Un caching más fuerte y resúmenes precalculados mejorarían la resiliencia.

El bucle de recomendación registra acciones de usuario como visualizaciones, guardados, completados, descartes y valoraciones, pero la calidad de la personalización depende de acumular suficiente volumen de eventos y evaluar cuidadosamente el comportamiento del ranking.

## Siguientes pasos

La siguiente versión debería añadir pruebas automatizadas de API y navegador, protección de rutas más sólida para todas las pantallas exclusivas de administración, caché de respuestas, documentación de despliegue y monitorización de fallos de proveedores externos.

Otras mejoras podrían incluir ubicaciones guardadas, preferencias de notificación, comprobaciones de accesibilidad más completas para mapas y gráficos, mejor recogida de snapshots de previsión, metodología de fuentes de datos más explícita y un bucle de analítica en producción para la calidad de recomendaciones.
