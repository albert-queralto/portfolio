---
title: "Catalunya Weather Portal"
description: "An authenticated React portal for Catalonia weather planning, combining Meteocat station history, map-based alerts, air-quality signals, and activity recommendations."
order: 4
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Weather planning portal"
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
  - label: "Product type"
    value: "Authenticated planning portal"
  - label: "Data signals"
    value: "Meteocat, forecasts, air quality"
  - label: "Interfaces"
    value: "Maps, charts, recommender"
---

## Problem

Weather decisions in Catalonia often depend on more than a single forecast. A useful planning tool needs to combine Meteocat station observations, regional warnings, local air-quality signals, and practical activity context in one place.

This project turns those fragmented signals into a weather-planning portal. The public page introduces the product as a calm desk for regional forecasts, air quality, Meteocat warnings, and weather-aware activity choices across Catalonia.

## Constraints

The application depends on several live and historical data sources, so it has to handle missing station values, unavailable hourly air-quality observations, empty alert periods, upstream failures, and Meteocat rate limits.

Map-based workflows add geographic complexity: coordinates, station metadata, comarca boundaries, nearby-station comparisons, and user-selected locations all need to stay synchronized across charts, controls, and recommendation results.

Authentication also matters. The portal includes login, registration, profiles, protected user workflows, and admin-oriented screens, so API calls must preserve token state while keeping errors visible and recoverable.

## Approach

The deployed frontend is a Vite React and TypeScript application using React Router, Material UI, Leaflet/react-leaflet, and Recharts. A shared API client talks to a `/api/v1` backend so feature screens can request JSON data through consistent fetch and error-handling paths.

The authenticated home flow centers on an activity recommender. Users can select a location manually or through browser geolocation, tune radius, forecast horizon, planning window, result limit, and air-quality sensitivity, then view nearby recommendations on a Leaflet map.

The station tools expose Meteocat data through both a station explorer and a Catalunya map. Users can select stations, variables, and date ranges, inspect trends, daily min/average/max charts, missing-data indicators, nearby station comparisons, microclimate insights, and forecast accuracy summaries.

The portal also includes an air-quality map for PM2.5, PM10, CO, CO2, NO2, SO2, ozone, and UV index, plus a Meteocat SMP episodes view that colors comarques by warning danger level for today and tomorrow.

## Validation

Validation covers route access, token persistence, login and registration flows, protected user screens, and selected admin operations. API responses should fail clearly when upstream weather services return empty data, invalid payloads, or quota errors.

Weather-specific checks include representative Meteocat stations, station variables, date ranges, missing intervals, air-quality pollutants, open SMP alert periods, map overlays, and recommendation runs with different radii and planning windows.

Frontend validation focuses on loading states, empty states, chart formatting, map marker placement, comarca coloring, recommendation grouping, and whether user feedback events are sent with the weather and ranking context needed for later analysis.

## Engineering decisions

React Router separates the portal into public, authenticated, and admin-oriented workflows. Material UI provides consistent forms, buttons, chips, modals, and navigation controls across a large surface area.

Leaflet is used for interactive maps because station selection, user location, comarca overlays, and pollutant markers are core interactions rather than decorative elements. Recharts handles station histories, air-quality hourly series, missing-data summaries, and forecast accuracy comparisons.

The backend API remains the anti-corruption layer around Meteocat, air-quality, recommendation, user, and model endpoints. Keeping those integrations server-side makes it easier to normalize schemas, protect provider configuration, and cache or replace upstream services later.

## Tradeoffs

The current version prioritizes an integrated planning experience over deep meteorological modeling. It brings together useful signals for daily decisions, but it should not be treated as an official warning system or a substitute for primary Meteocat guidance.

Fetching live maps, station metadata, historical values, alerts, and air-quality observations gives the interface breadth, but it also creates latency and rate-limit pressure. Stronger caching and precomputed summaries would improve resilience.

The recommendation loop captures user actions such as views, saves, completions, dismissals, and ratings, but the quality of personalization depends on continued event volume and careful evaluation of ranking behavior.

## Next steps

The next version should add automated API and browser tests, stronger route protection for every admin-only screen, response caching, deployment documentation, and monitoring for upstream provider failures.

Further improvements could include saved locations, notification preferences, richer accessibility checks for maps and charts, improved forecast-snapshot collection, more explicit data-source methodology, and a production analytics loop for recommendation quality.
