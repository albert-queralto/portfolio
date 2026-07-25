---
title: "Spanish Energy Data Pipeline"
description: "An automated pipeline that gathers Spanish electricity-price and renewable-generation data and stores structured results for analysis."
order: 5
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "Data ingestion · Automation"
image: "/web_scraping_esios.png"
source: "https://github.com/albert-queralto/scraping-energy-prices-spain"
technologies:
  - Python
  - REST API
  - PostgreSQL
  - Selenium
metrics:
  - label: "Pipeline type"
    value: "Automated ingestion"
  - label: "Storage"
    value: "PostgreSQL"
  - label: "Acquisition"
    value: "REST APIs + browser automation"
---

## Problem

Electricity-market analysis requires consistent historical data from several sources, but public energy information is often distributed across APIs, downloadable files, and interactive websites.

This project automates the acquisition of Spanish electricity-price and renewable-generation data and stores it in a structured database so analysts can work from a repeatable dataset instead of collecting information manually.

## Constraints

External sources can change schemas, page structure, identifiers, or availability without notice. Some information is accessible through REST APIs, while other data requires browser automation.

Time zones, timestamps, duplicate observations, missing periods, and inconsistent units must be handled carefully. Re-running the pipeline should not create duplicate records or corrupt previously collected history.

Credentials and provider-specific configuration need to remain outside the repository.

## Approach

Python ingestion jobs retrieve data from the available REST endpoints and use Selenium where browser interaction is necessary. Responses are parsed into normalized records before being inserted into PostgreSQL.

The pipeline separates extraction, transformation, validation, and persistence. This makes source-specific logic easier to replace and allows data-quality checks to run before database writes.

Database tables provide a stable analytical layer for later visualization, statistical analysis, and model development.

## Validation

Each run checks required fields, timestamp parsing, numeric conversion, expected units, and duplicate keys. Date-range completeness can be inspected to identify missing hourly or daily observations.

Database queries verify that reruns are idempotent and that row counts and date boundaries match the requested extraction period. Source totals or selected observations can be compared manually against the original provider.

Failures should be explicit so partial extractions are not mistaken for complete data.

## Engineering decisions

PostgreSQL is used as the persistent analytical store because it supports reliable constraints, indexing, date queries, and integration with Python tools.

API access is preferred when available because it is more stable than scraping. Selenium is isolated to the sources that require browser behavior, limiting the most fragile part of the pipeline.

The code is organized around source adapters and repeatable execution rather than a single notebook-only workflow.

## Tradeoffs

Browser automation introduces maintenance overhead and can break when a website changes. A production pipeline would add retries, structured logging, alerting, and stronger source contracts.

The project focuses on ingestion and storage rather than orchestration at enterprise scale. It does not yet include a complete data catalog, lineage system, or distributed processing layer.

## Next steps

The pipeline could be scheduled with Apache Airflow or another orchestrator, with automated alerts for missing periods, schema changes, and repeated failures.

Additional improvements include containerized execution, migration-managed database schemas, data-quality reports, incremental backfills, integration tests against sample responses, and a public dashboard built from the stored data.
