---
title: "Del notebook a producció: desplegant un detector d'anomalies"
description: "Lliçons d'emportar el treball de detecció d'anomalies sobre sèries temporals ambientals en temps real més enllà dels experiments de model cap a un flux operatiu interpretable."
date: 2026-12-08
publishAt: 2026-12-08T08:00:00+02:00
lang: ca
translationKey: notebook-to-production-anomaly-detector
tags:
  [
    "Machine Learning",
    "Anomaly Detection",
    "MLOps",
    "Time Series",
    "FastAPI",
    "Explainability",
  ]
draft: false
cover: "/og/notebook-to-production-anomaly-detector.png"
featured: false
---

Construir un detector d'anomalies en un notebook i operar-lo sobre dades en temps real són dos problemes d'enginyeria molt diferents.

En un notebook puc assumir:

```text
el dataset ja existeix
les columnes són estables
els timestamps són nets
les etiquetes estan disponibles
el model s'executa quan jo li demano
```

En un sistema de monitoratge operatiu, cap d'aquestes suposicions està garantida.

Aquesta diferència es va fer especialment clara mentre treballava amb dades de sèries temporals ambientals i de sistemes d'aigua en temps real.

Un detector d'esdeveniments de contaminació que vaig desenvolupar va assolir **més d'un 80% de capacitat de detecció**, però obtenir un model útil només era una part de la feina.

El repte real era crear un sistema la sortida del qual es pogués interpretar i sobre la qual es pogués actuar.

## Comença definint un esdeveniment

Un error habitual en detecció d'anomalies és començar per l'algoritme.

Jo prefereixo començar per l'esdeveniment.

Per a un sistema de monitoratge operatiu necessito definir:

```text
Què compta com a anomalia?
Quan comença?
Quan acaba?
Quanta antelació és útil?
Quin nivell de falses alarmes poden tolerar els operadors?
```

La precisió a nivell de punt sovint respon la pregunta equivocada.

Suposem que un esdeveniment de contaminació dura 30 minuts i produeix 30 mostres anòmales.

Un detector que n'identifica 29 té un recall alt a nivell de mostra.

Un detector que només identifica una mostra primerenca encara pot detectar correctament l'esdeveniment des del punt de vista operatiu.

En canvi, detectar 20 mostres quan l'esdeveniment ja és evident pot aportar poc valor.

La mètrica ha de reflectir la decisió real.

## La validació de sèries temporals ha de continuar sent temporal

Com amb els models de factures, dividir files aleatòriament és perillós.

Les observacions properes en una sèrie temporal estan altament correlacionades.

Si finestres adjacents del mateix esdeveniment físic apareixen tant al conjunt d'entrenament com al de validació, l'avaluació es torna massa optimista.

Prefereixo dividir per blocs temporals o esdeveniments amb significat perquè el model hagi de generalitzar a períodes que no ha vist.

Conceptualment:

```text
període operatiu passat   -> entrenament
període operatiu posterior -> validació
esdeveniments futurs      -> avaluació
```

Si les etiquetes estan basades en esdeveniments, els esdeveniments complets haurien de quedar en un únic costat de la divisió.

## El pipeline de dades forma part del detector

Un model d'anomalies desplegat no rep un DataFrame de pandas d'un notebook.

Rep dades operatives.

Això pot implicar:

- feeds d'API,
- fitxers FTP,
- bases de dades de sensors,
- fonts hidrològiques,
- fonts meteorològiques,
- i ingestió programada.

Abans de la inferència, el sistema necessita una gestió previsible de:

- mostres absents,
- timestamps duplicats,
- observacions retardades,
- valors fora de rang,
- canvis d'unitats,
- caigudes de sensors,
- i canvis d'esquema.

En cas contrari, el model comença a detectar problemes del pipeline de dades en lloc del procés físic.

Alguns d'aquests problemes encara poden merèixer una alerta, però s'haurien de poder distingir dels esdeveniments ambientals reals.

## El feature engineering ha de sobreviure al streaming

Les característiques d'un notebook són fàcils de calcular quan tot el dataset és visible.

Les característiques de producció necessiten una interpretació causal.

Per a una predicció al temps \(t\), cada característica ha de poder-se calcular amb informació disponible a \(t\) o abans.

Les característiques de sèries temporals poden incloure:

- mitjanes mòbils,
- variabilitat mòbil,
- taxes de canvi,
- valors amb retard,
- diferències entre sensors,
- i desviació respecte del comportament esperat.

La implementació de producció ha de reproduir les mateixes definicions de finestra i el mateix preprocessament utilitzats durant l'entrenament.

Una diferència d'una sola fila en un càlcul mòbil pot crear un model que tècnicament és "el mateix" però operativament és diferent.

## Els llindars són decisions de producte

Molts models d'anomalies produeixen una puntuació contínua.

L'alerta necessita un llindar.

Aquest llindar determina un compromís:

```text
llindar més baix
    -> sensibilitat més alta
    -> més falses alarmes

llindar més alt
    -> menys falses alarmes
    -> més esdeveniments no detectats
```

No existeix un valor universalment correcte.

Els operadors sovint es preocupen tant per la càrrega de falses alarmes com pel recall del model de machine learning.

Un detector que troba totes les anomalies però envia una alerta cada cinc minuts acabarà sent ignorat.

Per tant, la selecció del llindar pertany a la validació i a la revisió operativa, no a una constant arbitrària escollida després de l'entrenament.

## Les explicacions importen en monitoratge

Una alerta d'anomalia sense context obliga l'operador a començar la seva pròpia investigació des de zero.

He utilitzat SHAP per ajudar a interpretar les prediccions del model.

L'objectiu no és fingir que l'atribució de característiques demostra causalitat.

És aportar informació de suport com ara:

- quines variables han contribuït més,
- quins senyals han canviat de manera inusual,
- en quina direcció s'han mogut,
- i com difereix el patró actual del comportament esperat.

Això pot convertir:

> anomaly score = 0.91

en:

> la conductivitat i la terbolesa s'han desplaçat fora del seu patró conjunt habitual mentre que la resta de senyals monitorats s'han mantingut comparativament estables.

La segona sortida és molt més accionable.

## Empaqueta el model com un sistema

Un model de producció necessita una interfície repetible.

Això pot significar un servei FastAPI o una altra frontera d'aplicació capaç d'exposar operacions com:

```text
carregar configuració del model
enviar finestra d'observacions
executar inferència
retornar puntuació
retornar explicació
retornar metadades del model
```

L'aplicació també ha de saber quina versió del model ha produït el resultat.

La reproduïbilitat requereix més que desar:

```text
model.pkl
```

Les metadades útils inclouen:

- versió del model,
- configuració de característiques,
- període d'entrenament,
- llindar,
- esquema d'entrada,
- scaler o preprocessor,
- i mètriques d'avaluació.

La predicció només és reproduïble si el seu preprocessament i la seva configuració també ho són.

## La configuració es converteix en un problema de producte

Quan existeixen diversos models, editar fitxers de configuració manualment deixa d'escalar.

He construït eines amb Streamlit i FastAPI al voltant de configuració, migració i visualització de models.

Aquesta capa importa perquè el machine learning operatiu normalment implica més d'un investigador.

Arriba un moment en què algú ha de poder respondre:

```text
Quin model està actiu?
Quins sensors utilitza?
Quin llindar està configurat?
Quan es va entrenar?
Com està rendint?
```

Un registre de models no necessita començar sent una enorme plataforma MLOps.

Ha de fer explícit l'estat.

## El monitoratge també hauria d'incloure les entrades

La precisió del model pot degradar-se mentre l'API continua perfectament sana.

Per tant, el monitoratge de producció necessita dos nivells.

### Salut del sistema

```text
servei disponible
latència d'inferència
arribada de dades
tasques programades saludables
base de dades accessible
```

### Salut del model

```text
distribució d'entrada
valors absents
distribució de puntuacions
freqüència d'alertes
detecció d'esdeveniments observats
falses alarmes
deriva de característiques
```

Una resposta `200 OK` només em diu que el programari s'ha executat.

No em diu que la predicció continuï sent útil.

## El feedback tanca el bucle

Les anomalies ambientals són especialment difícils perquè les etiquetes poden arribar tard i la revisió d'experts importa.

Un flux operatiu hauria de conservar:

```text
timestamp de predicció
puntuació d'anomalia
decisió de llindar
versió del model
avaluació de l'operador
resultat confirmat de l'esdeveniment
```

Això crea l'evidència necessària per avaluar el detector més endavant.

Sense aquesta connexió, el machine learning desplegat es converteix en un flux de prediccions sense cap mecanisme d'aprenentatge a llarg termini.

## Què va canviar respecte del notebook

El model va continuar sent important.

Però la seva importància relativa es va reduir.

El sistema de producció també necessitava:

```text
ingestió fiable
validació temporal
càlcul causal de característiques
gestió de llindars
versionat
interpretabilitat
APIs
eines de configuració
monitoratge
feedback
```

Aquestes peces determinen si el detector sobreviu al contacte amb dades operatives reals.

Aquesta és la lliçó més gran que he extret del treball aplicat de detecció d'anomalies.

Un notebook demostra que un model pot trobar un patró.

Un sistema de producció ha de demostrar que aquest patró pot convertir-se en una decisió fiable.
