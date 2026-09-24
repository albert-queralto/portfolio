---
title: "Validació temporal per a la predicció de pagaments tardans"
description: "Per què predir pagaments tardans requereix més que una divisió cronològica train/test i com reconstrueixo què es podia saber realment quan s'hauria fet cada predicció de Payrithm."
date: 2026-09-05
lang: ca
translationKey: temporal-validation-late-payment-prediction
tags: ["Machine Learning", "Time Series", "Scikit-learn", "Fintech", "MLOps"]
draft: false
cover: "/og/temporal-validation-late-payment-prediction.png"
featured: false
project: "payrithm"
---

Predir si una factura es pagarà tard sembla un problema estàndard de classificació binària.

No ho és.

La part difícil no és ajustar el classificador. La part difícil és assegurar-se que el model mai no aprengui d'informació que només estaria disponible després del moment en què se suposa que ha de fer la predicció.

Mentre construïa **Payrithm**, aquesta es va convertir en la restricció més important del pipeline de machine learning.

La pregunta que faig servir per a cada característica és:

> Hauria pogut calcular aquest valor al final de la data d'emissió de la factura?

Si la resposta és no, aquesta característica no pertany al model de predicció en el moment d'emissió.

## El temps apareix dues vegades en el problema

Un conjunt de dades de factures conté diverses dates diferents:

- data d'emissió,
- data de venciment,
- data de pagament,
- dates de recordatoris,
- i dates de disputes.

És temptador pensar que ordenar els registres per `issue_date` resol la fuga temporal de dades.

No és així.

Considerem dues factures del mateix client:

```text
Factura A
emesa: 1 de gener
pagada: 15 de març

Factura B
emesa: 1 de febrer
```

La factura A ja existia quan es va emetre la factura B.

Però el resultat final del seu pagament encara no es coneixia.

Si calculo la taxa històrica de pagaments tardans del client per a la factura B utilitzant el pagament de març de la factura A, estic introduint informació del futur.

Això crea dos rellotges diferents:

```text
l'esdeveniment va passar
vs.
el resultat es va conèixer
```

Aquesta distinció és fàcil de passar per alt.

## Reconstruir el coneixement històric

Per a cada factura nova en el moment \(t\), una factura anterior només pot contribuir a les característiques d'historial resolt del client quan:

```text
data d'emissió anterior < t
AND
data de pagament anterior < t
```

La segona condició és la important.

Conceptualment:

```python
known_history = customer_invoices[
    (customer_invoices["issue_date"] < cutoff)
    & customer_invoices["paid_date"].notna()
    & (customer_invoices["paid_date"] < cutoff)
]
```

A partir d'aquests registres puc calcular de manera segura característiques com:

- nombre de factures històriques resoltes,
- taxa històrica de pagaments tardans,
- retard mitjà de pagament,
- retard màxim de pagament,
- i durada mitjana entre emissió i pagament.

Això significa que cada factura rep una instantània històrica adequada a la seva pròpia data de predicció.

La taula d'entrenament no és simplement un conjunt de dades de factures.

És un conjunt de dades d'**estats històrics**.

## Per què un `groupby` sobre tot el conjunt de dades és perillós

L'enfocament còmode seria una cosa com:

```python
df.groupby("customer_id")["paid_late"].mean()
```

Això produeix una característica de risc del client que sembla raonable.

També és incorrecta per a una predicció històrica.

El càlcul pot incloure:

- factures emeses més tard,
- factures pagades més tard,
- i potencialment la mateixa factura objectiu.

L'avaluació del model pot semblar excel·lent perquè la característica conté una versió comprimida del futur.

Per això la fuga de dades és tan perillosa en conjunts de dades empresarials: sovint sembla feature engineering perfectament legítim.

## Els clients sense historial han de continuar dins de les dades

Una altra complicació són els clients que encara no tenen historial resolt.

Eliminar-los fa que el problema de modelatge sigui més fàcil, però que l'aplicació sigui menys útil.

Un client acabat d'adquirir és precisament un dels casos en què el comportament de pagament és més incert.

Per això Payrithm diferencia entre:

```text
customer_late_rate = 0
```

i:

```text
customer_late_rate = desconegut perquè no existeix historial
```

Faig servir un indicador `history_available` i permeto que el pipeline de preprocessament imputi els agregats històrics que falten.

El model encara pot utilitzar informació disponible en el moment d'emissió, com ara:

- import,
- condicions de pagament,
- moneda,
- sector,
- mes d'emissió,
- i dia de la setmana,

alhora que entén que les característiques d'historial del client no estaven disponibles.

## El conjunt d'avaluació ha de provenir del futur

Després de construir característiques temporalment vàlides, la divisió train/test ha de preservar la mateixa direcció.

Payrithm ordena les factures resoltes per data d'emissió i utilitza aproximadament el **20%** més recent com a període d'avaluació.

Conceptualment:

```text
més antic -------------------------------------- més recent

|                 entrenament                  | avaluació |
```

El model mai no s'entrena amb una factura emesa després d'una factura del conjunt d'avaluació.

Això respon la pregunta que realment m'interessa:

> Si hagués entrenat aquest model al final del període històric d'entrenament, com hauria funcionat amb les factures que van arribar a continuació?

És una pregunta molt més realista que preguntar com funciona el model després de barrejar aleatòriament l'historial de l'empresa.

## El preprocessament també pot provocar fuga de dades

La fuga temporal no es limita a les característiques.

Suposem que calculo valors medians sobre tot el conjunt de dades i després el divideixo.

El període d'avaluació ja haurà influït en el preprocessament de l'entrenament.

El mateix problema s'aplica a:

- imputació,
- mapatges de categories,
- escalat,
- selecció de característiques,
- i calibratge.

Aquesta és una de les raons per les quals mantinc el preprocessament dins del pipeline de scikit-learn.

El pipeline només s'ajusta amb les dades d'entrenament.

Els registres d'avaluació es transformen utilitzant paràmetres apresos del passat.

## Ordenar bé els casos és només la meitat del problema

Payrithm utilitza un classificador de gradient boosting per estimar:

\[
P(\text{pagament tardà} \mid X)
\]

ROC-AUC em diu si el model tendeix a situar les factures pagades tard per sobre de les factures pagades a temps.

Però Payrithm utilitza després la probabilitat mateixa en altres parts del sistema.

Un risc predit del 80% hauria de significar més que:

> Aquesta factura té un risc alt.

Idealment hauria de significar que les factures que reben probabilitats semblants acaben pagant-se tard aproximadament el 80% de les vegades.

Això fa que el calibratge sigui important.

## El calibratge també ha de respectar el temps

Un flux habitual de calibratge utilitza validació creuada aleatòria.

En predicció temporal, això pot recrear el mateix problema que intentava eliminar.

Si cal calibratge, el període de calibratge també ha d'estar després del període d'entrenament del model i abans del període final d'avaluació.

Conceptualment:

```text
passat                                      futur
|--------- entrenament --------| calibratge | avaluació |
```

Cada etapa avança cap endavant.

Res no aprèn cap enrere.

## Comparar amb una baseline de probabilitat

Un model de machine learning també ha de superar alguna cosa més simple.

Per a la probabilitat de pagament tardà, una baseline deliberadament avorrida és:

```text
predir la taxa històrica de pagaments tardans de l'entrenament
per a cada factura d'avaluació
```

Avalúo la qualitat de les probabilitats amb el Brier score:

\[
\frac{1}{N}\sum_{i=1}^{N}(p_i-y_i)^2
\]

i el comparo amb aquesta baseline.

Si el model no pot superar el predictor basat en la taxa base històrica sobre factures futures, desplegar-lo simplement perquè l'entrenament ha acabat correctament no tindria sentit.

## La validesa temporal continua després del desplegament

Un holdout cronològic no posa fi al problema.

El comportament de pagament canvia. La composició de clients canvia. Les condicions de pagament canvien. Les condicions econòmiques canvien. La proporció de clients sense historial també pot canviar.

Per a cada execució d'entrenament vull conservar informació com:

- límits del període d'entrenament,
- límits del període d'avaluació,
- prevalença de pagaments tardans,
- ROC-AUC,
- Brier score,
- Brier score de la baseline,
- versió de les característiques,
- i versió del model.

Això proporciona a les futures execucions d'entrenament una base significativa amb què comparar-se.

## La lliçó més general

La forma més perillosa de fuga de dades no és una columna òbviament incorrecta anomenada `target`.

És una característica que sembla raonable però que conté silenciosament coneixement del futur.

Per tant, els models temporals necessiten una definició més exigent de correcció:

> Una fila d'entrenament hauria de reproduir l'estat d'informació que hauria existit en el moment real de la predicció.

Quan vaig començar a tractar la reconstrucció de l'estat històric com una part del model —i no només de la preparació de dades—, la resta del pipeline de Payrithm es va tornar molt més fàcil de raonar.

L'objectiu no és crear la mètrica offline més impressionant.

És construir una avaluació en la qual estigui disposat a confiar quan arribi la factura següent.
