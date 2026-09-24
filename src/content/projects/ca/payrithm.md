---
title: "Payrithm"
description: "Una plataforma d'intel·ligència de comptes a cobrar que prediu pagaments tardans, estima quan es pagaran les factures, projecta cobraments de caixa i prioritza la feina de recobrament."
lang: ca
translationKey: payrithm
order: 1
featured: true
draft: false
status: "In progress"
category: "Machine Learning"
focus: "SaaS ML · Operacions financeres"
image: "/projects/payrithm/payrithm.png"
ogImage: "/og/payrithm.png"
article: "/blog/payrithm/"
source: "https://github.com/albert-queralto/invoice-late-predictor-enterprise"
preview: "https://payrithm.albertqueralto.dev/"
technologies:
  - Python
  - FastAPI
  - scikit-learn
  - React
  - TypeScript
  - PostgreSQL
  - Celery
  - Redis
  - Docker
metrics:
  - label: "Tasques de predicció"
    value: "Classificació + regressió"
  - label: "Validació"
    value: "Holdout cronològic"
  - label: "Arquitectura"
    value: "SaaS multiservici"
---

## El problema

Els equips de comptes a cobrar poden haver de gestionar centenars o milers de factures obertes sense saber quines tenen més probabilitat de pagar-se tard.

Tractar totes les factures igual malgasta capacitat de recobrament. Payrithm està dissenyat per identificar el risc aviat i convertir-lo en una cua operativa clara.

## El meu enfocament

Payrithm utilitza dos models de machine learning relacionats:

- Un classificador estima la probabilitat que una factura es pagui tard.
- Un regressor estima el retard del pagament respecte de la data de venciment.

El sistema separa les variables disponibles en el moment d'emissió dels senyals operatius en temps real. Això evita que l'estat actual de morositat, recordatoris futurs i informació final del pagament introdueixin data leakage durant l'entrenament.

## Preparació de dades

El pipeline d'importació valida identificadors, imports de factura, monedes, dates d'emissió, dates de venciment i dates de pagament abans que els registres es converteixin en exemples d'entrenament.

Les variables d'històric de client es reconstrueixen segons el que se sabia en la data d'emissió de cada factura. Només s'inclouen resultats que ja eren coneguts abans d'aquella data.

## Validació

La part més recent de les factures resoltes forma el període d'avaluació. Les factures anteriors formen el període d'entrenament.

Aquesta partició cronològica reprodueix la direcció real del desplegament: entrenar amb el passat i predir factures futures.

El classificador s'avalua amb:

- ROC-AUC per a la qualitat del rànquing
- Brier score per a la qualitat de les probabilitats
- Anàlisi de calibratge
- Un baseline de probabilitat constant

El model de regressió s'avalua amb error absolut mitjà i un baseline basat en la mediana del retard.

## Convertir prediccions en decisions

La puntuació final de recobrament combina:

- Probabilitat de pagament tardà
- Percentil de l'import de la factura dins de la seva moneda
- Urgència segons la data de venciment
- Pressió de recordatoris

Mantenir aquesta fórmula separada del model fa que la política de negoci sigui ajustable i permet als usuaris entendre per què una factura apareix a les primeres posicions de la cua.

## Arquitectura

L'aplicació separa frontend, API, serveis d'aplicació, workers en segon pla, capa de persistència i pipeline de machine learning.

Això permet que les importacions i l'entrenament de models siguin asíncrons mentre l'API continua responent amb fluïdesa.

## Estat actual

Els mòduls principals de l'aplicació estan implementats. Els següents passos són completar l'avaluació de producció, publicar les mètriques finals dels models, ampliar el monitoratge i recollir feedback de possibles usuaris.
