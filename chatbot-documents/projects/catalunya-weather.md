---
title: "Catalunya Weather App"
description: "A full-stack application that collects and visualises current weather data for Catalan cities through an API-backed React interface."
order: 3
featured: false
draft: false
status: "In progress"
category: "Web"
focus: "Full-stack data product"
image: "/catalunya_weather_app.png"
source: "https://github.com/albert-queralto/catalunya_weather_app"
preview: "https://catalonia-weather-app.albertqueralto.dev"
technologies:
  - Python
  - FastAPI
  - React
  - Recharts
metrics:
  - label: "Architecture"
    value: "React + FastAPI"
  - label: "Data type"
    value: "Current weather observations"
  - label: "Geographic focus"
    value: "Catalan cities"
---

## Problem

Weather information is widely available, but generic applications often make it difficult to compare conditions across a focused regional set of locations. This project provides a dedicated interface for exploring current weather conditions in cities across Catalunya.

The application is intended as a practical full-stack data product: a Python backend gathers and exposes weather information, while a React frontend presents the results through accessible charts and summary views.

## Constraints

Weather data depends on an external provider, so the application must account for unavailable locations, incomplete responses, request failures, and provider rate limits.

Location names can be ambiguous or formatted inconsistently. The frontend also needs to remain useful across desktop and mobile screens while displaying several measurements without overwhelming the user.

Because the project is still in progress, deployment, caching, and long-term historical storage are not yet treated as final production features.

## Approach

The application uses FastAPI as an API layer between the frontend and the external weather source. The backend normalizes responses into a stable internal format so the React interface does not depend directly on a third-party schema.

The frontend provides city selection, current-condition summaries, and Recharts visualizations. Keeping the weather retrieval logic on the server protects provider credentials and gives the project one place to implement validation, caching, and error handling.

The system is structured so historical observations and forecasting features can be added without redesigning the entire user interface.

## Validation

Backend endpoints can be checked with representative Catalan locations, invalid locations, missing provider responses, and simulated upstream failures. Response schemas should remain stable even when optional weather fields are unavailable.

Frontend validation focuses on correct rendering, loading states, empty states, responsive behavior, and consistency between API values and displayed charts.

Automated tests are a planned improvement; the current stage relies primarily on endpoint checks and manual interface verification.

## Engineering decisions

FastAPI provides typed request and response models and automatically generated API documentation. React separates the user interface into reusable components, while Recharts handles responsive chart rendering.

The backend acts as an anti-corruption layer around the external weather API. This reduces coupling and makes it possible to replace the data provider later without rewriting the frontend.

Environment variables should be used for provider keys and deployment-specific configuration rather than embedding secrets in source code.

## Tradeoffs

The current version prioritizes present conditions and a clear regional experience over advanced meteorological analysis. It does not yet maintain a complete historical archive or perform local forecasting.

Using an external provider reduces implementation time but introduces availability and rate-limit dependencies. Adding a database and caching layer would improve resilience but also increase operational complexity.

## Next steps

The next version should add automated API and browser tests, response caching, stronger loading and error states, and deployment documentation.

Further improvements could include historical trends, forecast comparisons, geospatial maps, saved locations, severe-weather notifications, and a PostgreSQL or time-series database for regional observation history.
