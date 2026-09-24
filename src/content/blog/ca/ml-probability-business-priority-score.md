---
title: "De la probabilitat de ML a una puntuació de prioritat de negoci"
description: "Per què Payrithm no ordena simplement les factures per probabilitat de pagament tardà i com combino el risc calibrat de ML amb el valor, la urgència i l'activitat de cobrament."
date: 2026-10-28
publishAt: 2026-10-28T08:00:00+02:00
lang: ca
translationKey: ml-probability-business-priority-score
tags:
  [
    "Machine Learning",
    "Product Engineering",
    "Fintech",
    "Decision Systems",
    "Explainability",
  ]
draft: false
cover: "/og/ml-probability-business-priority-score.png"
featured: false
project: "payrithm"
---

Un model de machine learning pot respondre una pregunta important i, tot i així, no dir a l'usuari què ha de fer.

**Payrithm** estima la probabilitat que una factura es pagui tard.

Suposem que el model retorna:

```text
Factura A: risc de pagament tardà del 90%
Factura B: risc de pagament tardà del 65%
```

Si Payrithm fos només un tauler de prediccions, ordenar per probabilitat seria suficient.

Però la pregunta real de producte és:

> En quina factura hauria de treballar primer l'equip de cobraments?

No són problemes equivalents.

## La probabilitat mesura risc, no importància

Considerem:

| Factura | Probabilitat de retard |   Import | Estat                 |
| ------- | ---------------------: | -------: | --------------------- |
| A       |                    90% |    150 € | Venç d'aquí a 25 dies |
| B       |                    65% | 48.000 € | Vençuda               |

La factura A té un risc predit més alt.

La factura B pot tenir una prioritat operativa més alta.

Un equip financer no assigna l'atenció només segons la probabilitat.

El valor en risc i la sensibilitat temporal també importen.

Per això Payrithm manté separats dos conceptes:

```text
predicció de ML
      |
      v
probabilitat de pagament tardà


política de negoci
      |
      v
prioritat de cobrament
```

El segon consumeix el primer.

No el substitueix.

## El model de prioritat actual

La puntuació de prioritat explicable combina quatre senyals normalitzats:

\[
Priority =
0.45P(\text{late}) +
0.25A +
0.25U +
0.05R
\]

on:

- \(P\) = probabilitat predita de pagament tardà,
- \(A\) = import relatiu de la factura,
- \(U\) = urgència segons la data de venciment,
- \(R\) = pressió dels recordatoris.

Actualment, els pesos expressen una política de producte:

```text
45% risc
25% valor
25% urgència
5% activitat de recordatoris
```

Els pesos exactes poden evolucionar.

El que importa arquitectònicament és que continuïn sent visibles.

## Per què la probabilitat rep el pes més gran

El classificador de pagament tardà estima si és probable que la factura requereixi atenció.

Això mereix una influència considerable.

Però donar-li el 100% del rànquing implicaria:

> A l'equip de cobraments només li importa la probabilitat.

Així no funcionen les operacions financeres.

Una factura de 100 € amb un risc molt alt i una factura de 50.000 € amb un risc moderat generen decisions diferents.

Per tant, la puntuació de machine learning continua sent una entrada important sense confondre-la amb l'objectiu de negoci complet.

## Comparar imports de factures entre monedes

L'import brut introdueix un altre problema.

Aquests valors no són directament comparables:

```text
10.000 EUR
10.000 USD
10.000 GBP
```

Payrithm evita fingir que són idèntics.

Sense una política de tipus de canvi fiable, el càlcul de prioritat utilitza el **percentil de l'import de la factura dins de la seva pròpia moneda**.

Per exemple:

```python
amount_percentile = (
    invoices
    .groupby("currency")["amount"]
    .rank(pct=True)
)
```

La pregunta passa a ser:

> Quina mida té aquesta factura en comparació amb altres factures denominades en la mateixa moneda?

Això produeix un senyal normalitzat entre zero i u sense inventar cap tipus de canvi.

## La urgència canvia cada dia

La probabilitat de pagament tardà es genera a partir de la informació disponible en el moment d'emissió.

La urgència és operativa.

Una factura emesa fa tres setmanes pot estar ara a punt d'arribar a la data de venciment.

Una altra pot haver vençut ja.

Per això Payrithm calcula la urgència de venciment de manera separada del model.

Una funció simplificada és:

```python
days_to_due = (due_date - today).days

urgency = min(
    1.0,
    max(0.0, (30 - days_to_due) / 30),
)
```

Una factura lluny de la data de venciment rep poca urgència.

A mesura que s'acosta el termini, la urgència augmenta.

Un cop vençuda, el senyal es manté alt.

Aquest senyal no s'hauria d'injectar al classificador del moment d'emissió perquè encara no existia quan es va fer la predicció.

Pertany a la capa operativa.

## La pressió dels recordatoris també hi pertany

El mateix argument s'aplica als recordatoris.

Saber quants recordatoris s'han enviat és útil per decidir què fer avui.

No és informació vàlida per predir el risc el dia en què es va emetre una factura.

Payrithm pot normalitzar l'activitat actual de recordatoris, per exemple:

```python
reminder_pressure = min(
    1.0,
    reminders_sent / 3,
)
```

i incorporar-la a la puntuació de prioritat.

Per tant, el model i el flux de treball operen en moments temporals diferents.

## Per què no vaig començar amb un segon model de rànquing de caixa negra

Seria possible entrenar un altre model per generar una puntuació de prioritat de cobrament.

Deliberadament, no vaig fer que aquest fos el primer disseny.

Una cua operativa ha de poder respondre:

> Per què aquesta factura està per sobre d'aquella altra?

Amb la fórmula actual, la resposta és visible:

```text
risc predit alt
+
factura gran respecte de la seva moneda
+
ja vençuda
+
diversos recordatoris previs
```

L'usuari no necessita un sistema d'explicació complex per entendre l'ordre de la cua.

Aquesta simplicitat té valor.

## La política pot canviar sense reentrenar el model

La separació també fa que el sistema sigui adaptable.

Imaginem una empresa que entra temporalment en una situació de restricció de flux de caixa.

Pot donar més importància al valor de les factures.

La política de prioritat podria passar de:

```text
risc:          45%
import:        25%
urgència:      25%
recordatoris:   5%
```

cap a un component d'import més fort.

El classificador de pagament tardà no necessita reentrenar-se.

No ha canviat res sobre el comportament de pagament dels clients.

Només ha canviat la política de decisió actual del negoci.

Aquesta és una distinció útil:

> Els models descriuen el món. Les regles de decisió descriuen què volem fer al respecte.

No haurien de ser automàticament el mateix artefacte.

## La calibració esdevé més important quan la probabilitat entra en una fórmula

Payrithm avalua la qualitat de la probabilitat amb ROC-AUC, anàlisi de calibració i Brier score.

La calibració importa aquí perquè la probabilitat no només s'utilitza per ordenar.

Rep un pes numèric en una decisió posterior.

Si un model produeix 0,90 per a esdeveniments que només succeeixen el 60% de les vegades, la fórmula de prioritat dona massa pes al risc.

Per això m'importen totes dues coses:

```text
qualitat del rànquing
i
qualitat de la probabilitat
```

Un model amb gran capacitat discriminativa però mal calibrat encara pot distorsionar les decisions posteriors.

## L'explicabilitat existeix en dos nivells

En realitat hi ha dues explicacions dins del sistema.

La primera és:

> Per què el model ha predit una probabilitat alta?

Això es pot investigar mitjançant diagnòstics del model i interpretació de característiques.

La segona és:

> Per què aquesta factura és al capdamunt de la cua de cobrament?

Aquesta explicació és molt més senzilla.

Els mateixos components de prioritat la responen.

Un usuari podria veure:

```text
Risc de pagament tardà   0.82
Import relatiu           0.91
Urgència de venciment    1.00
Pressió de recordatoris  0.67
--------------------------------
Puntuació de prioritat   ...
```

La decisió de negoci continua sent inspeccionable.

## Predir no és prendre decisions

Aquest patró s'estén més enllà dels comptes a cobrar.

Un model de frau pot estimar la probabilitat de frau sense determinar tota la cua d'investigació.

Un model de manteniment pot estimar el risc de fallada sense decidir quan s'ha d'aturar un equip.

Per tant, la lliçó arquitectònica que vaig portar a Payrithm és més àmplia:

> Una sortida de ML sovint hauria de ser una entrada d'un sistema explícit de decisió, no la decisió final en si mateixa.

La feina del classificador és estimar el risc de pagament de la manera més precisa i honesta possible.

La feina de la capa de prioritat és traduir aquest risc al context operatiu d'avui.

Mantenir aquestes responsabilitats separades fa que totes dues siguin més fàcils d'avaluar, modificar i explicar.
