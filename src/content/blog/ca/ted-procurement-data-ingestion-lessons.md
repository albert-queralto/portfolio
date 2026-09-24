---
title: "Què va fallar en ingerir dades de contractació pública de TED"
description: "Els problemes de model de dades i fiabilitat que van donar forma al pipeline d'ingestió TED de TenderWise, des de versions d'avisos i lots fins a camps multilingües, reintents i criteris de qualificació semiestructurats."
date: 2026-10-01
publishAt: 2026-10-01T08:00:00+02:00
lang: ca
translationKey: ted-procurement-data-ingestion-lessons
tags: ["Data Engineering", "ETL", "PostgreSQL", "Celery", "Procurement", "SaaS"]
draft: false
cover: "/og/ted-procurement-data-ingestion-lessons.png"
featured: false
project: "tenderwise"
---

Quan vaig començar a construir **TenderWise**, ingerir avisos de contractació pública europea semblava la part fàcil.

Buscar a TED, recuperar un avís, parsejar alguns camps i desar-los a PostgreSQL.

Després, puntuar l'oportunitat.

Com més treballava amb les dades d'origen, més evident es feia que la capa d'ingestió no era un simple detall de fontaneria.

Formava part del model de decisió del producte.

Si la font s'interpreta incorrectament, tot el que ve després pot estar equivocat amb una confiança aparent molt alta.

Aquests són els modes de fallada que van canviar l'arquitectura.

## Problema 1: un resultat de cerca no és la font de veritat

TenderWise utilitza la TED Search API per descobrir avisos.

Però les dades de descoberta no són suficients per a l'avaluació completa.

Per això tracto l'XML canònic de TED com la font autoritativa dels detalls de l'oportunitat.

El pipeline va passar a ser:

```text
TED Search API
    |
número de publicació
    |
    v
XML canònic
    |
    v
checksum
    |
    v
versió de la font
    |
    v
normalització
    |
    v
oportunitat
```

La distinció importa perquè TenderWise necessita més que un títol i una data límit.

Necessita evidència d'origen per a elements com:

- codis CPV,
- països,
- valor del contracte,
- lots,
- criteris de selecció,
- i requisits de qualificació.

## Problema 2: els avisos canvien

Un avís de contractació pública no és necessàriament immutable.

Correccions i versions posteriors poden modificar detalls útils.

Sobreescriure simplement la fila anterior de la base de dades destruiria l'historial que explica per què ha canviat una recomanació.

Per això TenderWise calcula un checksum SHA-256 del contingut canònic de la font.

Conceptualment:

```python
checksum = sha256(xml_payload.encode("utf-8")).hexdigest()
```

Si el checksum ja existeix per al número de publicació, el camí d'ingestió pot evitar reprocessament innecessari.

Si és diferent, l'aplicació pot desar una nova versió de la font.

Això dona procedència al sistema:

```text
recomanació
    |
basada en
    |
estat de l'oportunitat
    |
derivat de
    |
versió específica de l'avís font
```

Això es torna especialment important quan un usuari pregunta per què l'avaluació d'ahir és diferent de la d'avui.

## Problema 3: un avís pot contenir múltiples oportunitats

El meu primer model mental estava massa centrat en l'avís.

Un avís TED pot descriure múltiples lots.

Aquests lots poden diferir en abast, valor, geografia o requisits.

Per tant, tractar tot l'avís com una única oportunitat pot combinar fets que haurien de continuar separats.

El model intern de TenderWise va passar a orientar-se als lots.

Un lot normalitzat conté camps com:

```text
ID del lot
títol
descripció
comprador
països
codis CPV
valor estimat
moneda
data límit
idioma d'origen
requisits
```

La unitat d'ingestió ja no és:

> He descarregat un avís.

És:

> He produït una o més oportunitats comercials normalitzades a partir d'un avís versionat.

## Problema 4: la geografia no és un únic codi net

La interfície i els perfils d'empresa no haurien de necessitar entendre totes les representacions utilitzades per un dataset upstream.

La lògica posterior no hauria de preocupar-se de si una font utilitza una representació de codi de país mentre l'aplicació n'espera una altra.

Aquesta conversió pertany a la normalització.

Sembla trivial, però els errors de normalització són especialment perillosos perquè produeixen desajustos silenciosos.

Una empresa pot configurar Espanya com a país objectiu i, tot i així, perdre oportunitats espanyoles si les dues capes discrepen sobre la representació del país.

La mateixa regla general s'aplica més enllà de la geografia:

> La variabilitat externa ha d'aturar-se a la frontera d'ingestió.

## Problema 5: els codis CPV són jeràrquics

El matching de CPV també és més subtil que una igualtat.

Una empresa interessada en una família de serveis més àmplia no hauria necessàriament de perdre un avís només perquè aquest utilitza un codi descendent més específic.

Per això TenderWise normalitza els valors CPV i permet matching significatiu per prefix de família.

La implicació pràctica és que una família configurada més àmplia pot coincidir amb una classificació més específica de l'avís dins d'aquella família.

El matching per cadena exacta produiria falsos negatius.

Fer matching ingènuament amb tots els prefixos, en canvi, produiria massa falsos positius.

La jerarquia del domini pertany a la lògica de matching.

## Problema 6: el text multilingüe necessita regles de fallback deterministes

TED és multilingüe.

Un camp que vull en un idioma pot no existir mentre sí que existeix una altra representació localitzada.

Això significa que la normalització necessita una estratègia explícita de preferència i fallback.

La part important no és intentar una traducció màgica durant la ingestió.

És assegurar-se que la capa de scoring rep un camp previsible.

Vull que el codi posterior consumeixi:

```python
opportunity.title
```

en lloc d'haver d'entendre totes les rutes XML i alternatives d'idioma que l'han produït.

## Problema 7: els criteris de qualificació només estan parcialment estructurats

Part de la informació comercialment més important d'una licitació apareix en criteris de selecció en llenguatge natural.

Alguns exemples són:

- facturació anual mínima,
- mida mínima de l'equip,
- certificació ISO,
- i nombre de contractes comparables.

Alguns es poden convertir amb seguretat en requisits estructurats.

Altres no.

L'enfocament perillós seria forçar cada frase a convertir-se en un valor estructurat.

TenderWise, en canvi, conserva la descripció original i la ruta d'origen i, quan la confiança és suficient, també crea un requisit estructurat.

Quan una regla no es pot extreure de manera fiable, es converteix en evidència per a revisió manual.

Això és deliberadament menys ambiciós que fingir que el parser ho entén tot.

## Problema 8: desconegut no vol dir zero

La informació absent crea un altre problema subtil d'ingestió.

Suposem que falta el valor del contracte.

Això no significa:

```text
valor del contracte = 0
```

De la mateixa manera, un criteri de qualificació que no es pot parsejar no significa que l'empresa no el compleixi.

TenderWise preserva estats desconeguts i avisos.

Això importa en les decisions posteriors perquè:

```text
FAIL
```

i:

```text
UNKNOWN
```

condueixen a decisions de contractació pública molt diferents.

## Problema 9: les fallades transitòries no poden fer desaparèixer licitacions

Les peticions de xarxa fallen. Els endpoints XML externs fallen. Apareixen documents inesperats. Hi ha bugs de parsing.

Un sistema d'ingestió de producció no pot ometre silenciosament aquests registres.

TenderWise persisteix l'estat d'ingestió fallida amb informació com:

```text
nombre d'intents
error
estat
propera hora de reintent
```

Els reintents utilitzen backoff exponencial acotat en lloc de colpejar repetidament un sistema upstream que ja està fallant.

Conceptualment:

```text
intent 1 -> 1 hora
intent 2 -> 2 hores
intent 3 -> 4 hores
...
limitat a un interval màxim
```

Això dona a les fallades un cicle de vida visible.

Una descàrrega trencada es converteix en un objecte operatiu que es pot inspeccionar i reintentar, en lloc d'una licitació desapareguda que ningú sap que existia.

## Problema 10: la idempotència importa

La sincronització programada revisitarà repetidament el mateix univers de contractació pública.

Això significa que el pipeline ha de tolerar la repetició.

Executar la ingestió dues vegades no hauria de crear dues còpies del mateix lot.

Reprocessar XML idèntic no hauria de crear versions artificials.

Reintentar després d'un crash del worker no hauria de deixar registres contradictoris.

Per tant, checksums, identificadors d'origen estables i upserts a la base de dades no són detalls d'optimització.

Són mecanismes de correcció.

## Què va canviar en la meva manera de pensar

Inicialment pensava que la part interessant de TenderWise començaria després de la ingestió:

```text
matching
scoring
BID / REVIEW / NO_BID
```

En realitat, la qualitat d'aquestes decisions depèn molt del que passa abans.

El sistema d'ingestió determina:

- què és una oportunitat,
- quina versió de la font representa,
- quines dades són conegudes,
- quines dades són desconegudes,
- i si una fallada continua sent recuperable.

Per tant, l'arquitectura final és molt més explícita:

```text
TED Search
    -> recuperació de la font canònica
    -> detecció de versions
    -> normalització de lots
    -> extracció de requisits
    -> oportunitat persistent
    -> matching de descoberta
    -> rellevància
    -> qualificació
```

Aquesta arquitectura és menys còmoda que desar directament una resposta de cerca a una base de dades.

També és molt més fàcil de confiar-hi.

La lliçó principal que vaig extreure de la ingestió TED és que no s'ha de permetre que les dades externes facin escapar les seves inconsistències a la resta de l'aplicació.

La normalització és on la incertesa es fa explícita.

I en un sistema de suport a decisions, la incertesa explícita és molt més segura que una precisió falsa.
