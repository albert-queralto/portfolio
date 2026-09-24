---
title: "Per què TenderWise separa rellevància i qualificació"
description: "Per què TenderWise avalua la rellevància estratègica i la qualificació obligatòria per separat en lloc de reduir les decisions de contractació pública a una única puntuació opaca de coincidència."
date: 2026-11-24
publishAt: 2026-11-24T08:00:00+02:00
lang: ca
translationKey: tenderwise-relevance-vs-qualification
tags:
  [
    "Decision Systems",
    "Procurement",
    "SaaS",
    "Explainability",
    "Product Engineering",
  ]
draft: false
cover: "/og/tenderwise-relevance-vs-qualification.png"
featured: false
project: "tenderwise"
---

Una licitació pot ser una oportunitat comercial excel·lent i, alhora, ser impossible que una empresa s'hi presenti.

També pot passar el contrari.

Una empresa pot complir tots els requisits formals d'una licitació que no té cap motiu estratègic per perseguir.

Sembla obvi.

També significa que una única "puntuació de coincidència amb la licitació" és conceptualment incorrecta.

Per això **TenderWise** manté **rellevància** i **qualificació** com a dos eixos de decisió separats.

## La contractació pública conté diverses preguntes diferents

Quan un equip de licitacions obre una oportunitat, es pot preguntar:

```text
És en un dels nostres mercats objectiu?
L'abast CPV encaixa amb els nostres serveis?
El contracte és prou gran per justificar l'esforç?
Complim els requisits de facturació?
Tenim les certificacions exigides?
Tenim prou experiència comparable?
```

Algunes d'aquestes preguntes descriuen atractiu.

Altres descriuen elegibilitat.

Col·lapsar-les massa aviat destrueix informació útil.

Per això TenderWise separa quatre etapes:

```text
descoberta
    |
    v
rellevància
    |
    v
qualificació
    |
    v
execució de la licitació
```

Cada una té una feina diferent.

## La descoberta decideix si l'oportunitat ha d'entrar al feed

Abans de puntuar, un perfil d'empresa pot definir filtres durs com:

- països objectiu,
- països exclosos,
- famílies CPV objectiu,
- CPV exclosos,
- valors de contracte preferits,
- i moneda preferida.

La semàntica de matching és deliberadament explícita.

Dins d'una dimensió, diverses alternatives poden coincidir.

Entre dimensions, els requisits configurats han de sobreviure.

Les exclusions tenen prioritat sobre les inclusions.

L'objectiu encara no és assignar una puntuació matisada.

És respondre:

> Aquesta oportunitat ha d'entrar al procés de decisió?

## La rellevància pregunta si l'oportunitat és estratègicament atractiva

Quan una oportunitat supera la descoberta, TenderWise calcula una puntuació de rellevància.

Les dimensions poden incloure:

- alineació CPV,
- geografia,
- valor del contracte,
- alineació de serveis,
- i alineació d'indústria.

Els pesos típics del disseny actual són:

```text
CPV               35
geografia         20
valor contracte   15
serveis           20
indústries        10
```

Només participen les dimensions configurades.

Això és important.

Si una empresa no ha configurat mai indústries objectiu, aquesta absència no hauria de reduir artificialment la puntuació de rellevància de totes les licitacions.

Conceptualment:

$$
Relevance =
\frac{\sum w_i s_i}{\sum w_i}
$$

on el denominador només conté dimensions actives.

La sortida també conserva:

- punts forts,
- avisos,
- bloquejos,
- desglossament de la puntuació,
- i suficiència de l'evidència.

Un número sense aquest context no és suficient.

## La qualificació fa una pregunta diferent

La qualificació parteix dels requisits obligatoris de la licitació.

Alguns exemples són:

- facturació anual mínima,
- certificacions,
- mida mínima de l'equip,
- i experiència en contractes comparables.

Cada requisit pot produir un estat com:

```text
PASS
FAIL
UNKNOWN
NOT_APPLICABLE
```

L'estat més important sovint és `UNKNOWN`.

Suposem que una licitació exigeix ISO 9001.

El perfil d'empresa no inclou ISO 9001.

Això podria significar:

```text
l'empresa no la té
```

o:

```text
el perfil és incomplet
```

No són equivalents.

Per això TenderWise es nega a convertir silenciosament evidència absent en una fallada.

## Per què UNKNOWN importa

Per als requisits obligatoris, un mapping simplificat de scoring és:

```text
PASS       -> 100
UNKNOWN    -> 50
FAIL       -> 0
```

La contribució numèrica exacta és menys important que la distinció semàntica.

Un criteri obligatori desconegut sovint significa:

```text
REVIEW
```

no:

```text
NO_BID
```

Això evita que el programari afirmi una certesa que l'evidència no suporta.

## Considerem quatre licitacions

La separació es veu més clara en una matriu.

### Licitació A

```text
Rellevància:    92
Qualificació:   95
```

L'oportunitat encaixa amb el mercat de l'empresa i els criteris obligatoris coneguts es compleixen.

Una recomanació `BID` és plausible.

### Licitació B

```text
Rellevància:    91
Qualificació:   20
```

Comercialment excel·lent.

Però falla un requisit obligatori.

Això no hauria de convertir-se en una puntuació combinada alta només perquè la rellevància és forta.

La resposta probable és `NO_BID`.

### Licitació C

```text
Rellevància:    45
Qualificació:   98
```

L'empresa és capaç d'executar la feina.

Simplement no és especialment atractiva.

És una raó diferent per no presentar-se.

### Licitació D

```text
Rellevància:    82
Qualificació:   65
Evidència obligatòria: UNKNOWN
```

És exactament aquí on `REVIEW` té valor.

El sistema té prou evidència per dir que la licitació sembla prometedora, però no prou per prendre la decisió automàticament.

## La recomanació continua sent determinista

TenderWise acaba combinant tots dos eixos en una recomanació.

Una versió simplificada conté regles com:

```text
data límit tancada             -> NO_BID
bloqueig dur de rellevància    -> NO_BID
fallada obligatòria qualificació -> NO_BID
rellevància molt baixa         -> NO_BID
qualificació molt baixa        -> NO_BID
evidència obligatòria desconeguda -> REVIEW
rellevància alta + preparació  -> BID
altrament                      -> REVIEW
```

Això és deliberadament comprensible.

Les decisions de licitació poden consumir dies de feina humana costosa.

Un `BID` automàtic incorrecte malgasta recursos.

Un `NO_BID` automàtic incorrecte pot ocultar ingressos.

Quan la incertesa continua sent material, la revisió és una funcionalitat i no una fallada.

## Per què no deixo que la IA prengui la decisió

TenderWise pot generar opcionalment un brief de licitació amb IA.

El brief pot explicar:

- resum,
- punts clau,
- riscos,
- incògnites,
- passos següents,
- i requisits de qualificació.

Però no pot modificar:

```text
relevance
qualification
requirement status
BID / REVIEW / NO_BID
```

La capa d'IA rep el resultat determinista com a context.

Explica l'entorn de decisió.

No es converteix en l'autoritat de decisió.

Aquesta frontera és especialment important en contractació pública perquè l'evidència d'origen ha de continuar sent traçable.

## La separació millora el debugging

Suposem que un usuari diu:

> Aquesta licitació hauria d'haver quedat més amunt.

Amb una única puntuació opaca he de fer enginyeria inversa del que ha passat.

Amb capes separades puc preguntar:

```text
Es va filtrar durant la descoberta?
La rellevància CPV era baixa?
El valor del contracte era desconegut?
Va fallar un requisit obligatori?
Faltava evidència?
```

Cada capa té una responsabilitat interpretable.

Això facilita localitzar bugs i discutir recomanacions amb els usuaris.

## La separació també millora la iteració de producte

Imaginem que els usuaris em diuen que la geografia hauria de pesar menys i l'alineació de serveis, més.

Això canvia la rellevància.

No canvia com s'han d'avaluar els requisits de facturació anual.

De la mateixa manera, millorar el parsing de certificacions hauria d'afectar la qualificació sense canviar les preferències estratègiques de mercat.

Els conceptes independents poden evolucionar de manera independent.

Aquesta és una propietat potent en un producte que encara està aprenent d'usuaris reals.

## El principi de disseny més ampli

La separació rellevància/qualificació no és específica de TenderWise.

Representa una regla general dels sistemes de decisió:

> Separa "Ho vull?" de "Ho puc fer?"

Els sistemes de selecció de personal podrien separar interès del candidat i elegibilitat.

Els sistemes de crèdit podrien separar valor del client i restriccions d'underwriting.

Els sistemes de selecció de projectes podrien separar valor estratègic i viabilitat d'execució.

Preguntes diferents mereixen estat diferent.

TenderWise és més fàcil d'explicar precisament perquè no força tot a dins d'un únic número màgic.

La recomanació final és útil perquè el raonament que hi ha a sota continua sent visible.
