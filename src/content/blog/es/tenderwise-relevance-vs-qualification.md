---
title: "Por qué TenderWise separa relevancia y cualificación"
description: "Por qué TenderWise evalúa la relevancia estratégica y la cualificación obligatoria por separado en lugar de reducir las decisiones de contratación pública a una única puntuación opaca de coincidencia."
date: 2026-11-24
publishAt: 2026-11-24T08:00:00+02:00
lang: es
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

Una licitación puede ser una excelente oportunidad comercial y, aun así, ser imposible que una empresa se presente.

También puede ocurrir lo contrario.

Una empresa puede cumplir todos los requisitos formales de una licitación que no tiene ningún motivo estratégico para perseguir.

Suena obvio.

También significa que una única "puntuación de coincidencia con la licitación" es conceptualmente incorrecta.

Por eso **TenderWise** mantiene **relevancia** y **cualificación** como ejes de decisión separados.

## La contratación pública contiene varias preguntas diferentes

Cuando un equipo de licitaciones abre una oportunidad, puede preguntarse:

```text
¿Está en uno de nuestros mercados objetivo?
¿El alcance CPV encaja con nuestros servicios?
¿El contrato es suficientemente grande para justificar el esfuerzo?
¿Cumplimos los requisitos de facturación?
¿Tenemos las certificaciones exigidas?
¿Tenemos suficiente experiencia comparable?
```

Algunas de esas preguntas describen atractivo.

Otras describen elegibilidad.

Colapsarlas demasiado pronto destruye información útil.

Por eso TenderWise separa cuatro etapas:

```text
descubrimiento
    |
    v
relevancia
    |
    v
cualificación
    |
    v
ejecución de la licitación
```

Cada una tiene un trabajo diferente.

## El descubrimiento decide si la oportunidad debe entrar en el feed

Antes de puntuar, un perfil de empresa puede definir filtros duros como:

- países objetivo,
- países excluidos,
- familias CPV objetivo,
- CPV excluidos,
- valores de contrato preferidos,
- y moneda preferida.

La semántica de matching es deliberadamente explícita.

Dentro de una dimensión, pueden coincidir alternativas.

Entre dimensiones, los requisitos configurados tienen que sobrevivir.

Las exclusiones prevalecen sobre las inclusiones.

El objetivo todavía no es asignar una puntuación matizada.

Es responder:

> ¿Debería esta oportunidad entrar en el proceso de decisión?

## La relevancia pregunta si la oportunidad es estratégicamente atractiva

Cuando una oportunidad supera el descubrimiento, TenderWise calcula una puntuación de relevancia.

Las dimensiones pueden incluir:

- alineación CPV,
- geografía,
- valor del contrato,
- alineación de servicios,
- y alineación de industria.

Los pesos típicos del diseño actual son:

```text
CPV               35
geografía         20
valor contrato    15
servicios         20
industrias        10
```

Solo participan las dimensiones configuradas.

Eso es importante.

Si una empresa nunca ha configurado industrias objetivo, esa ausencia no debería reducir artificialmente la puntuación de relevancia de todas las licitaciones.

Conceptualmente:

$$
Relevance =
\frac{\sum w_i s_i}{\sum w_i}
$$

donde el denominador contiene únicamente dimensiones activas.

La salida también conserva:

- fortalezas,
- advertencias,
- bloqueos,
- desglose de la puntuación,
- y suficiencia de la evidencia.

Un número sin ese contexto no es suficiente.

## La cualificación plantea una pregunta diferente

La cualificación parte de los requisitos obligatorios de la licitación.

Algunos ejemplos son:

- facturación anual mínima,
- certificaciones,
- tamaño mínimo del equipo,
- y experiencia en contratos comparables.

Cada requisito puede producir un estado como:

```text
PASS
FAIL
UNKNOWN
NOT_APPLICABLE
```

El estado más importante suele ser `UNKNOWN`.

Supongamos que una licitación exige ISO 9001.

El perfil de empresa no incluye ISO 9001.

Eso podría significar:

```text
la empresa no la tiene
```

o:

```text
el perfil está incompleto
```

No son equivalentes.

Por eso TenderWise se niega a convertir silenciosamente la falta de evidencia en un fallo.

## Por qué UNKNOWN importa

Para requisitos obligatorios, un mapping simplificado de scoring es:

```text
PASS       -> 100
UNKNOWN    -> 50
FAIL       -> 0
```

La contribución numérica exacta importa menos que la distinción semántica.

Un criterio obligatorio desconocido suele significar:

```text
REVIEW
```

no:

```text
NO_BID
```

Esto evita que el software afirme una certeza que la evidencia no respalda.

## Consideremos cuatro licitaciones

La separación se ve más clara en una matriz.

### Licitación A

```text
Relevancia:      92
Cualificación:   95
```

La oportunidad encaja con el mercado de la empresa y se cumplen los criterios obligatorios conocidos.

Una recomendación `BID` es plausible.

### Licitación B

```text
Relevancia:      91
Cualificación:   20
```

Comercialmente excelente.

Pero falla un requisito obligatorio.

Esto no debería convertirse en una puntuación combinada alta solo porque la relevancia es fuerte.

La respuesta probable es `NO_BID`.

### Licitación C

```text
Relevancia:      45
Cualificación:   98
```

La empresa es capaz de realizar el trabajo.

Simplemente no es especialmente atractiva.

Es un motivo diferente para no presentarse.

### Licitación D

```text
Relevancia:      82
Cualificación:   65
Evidencia obligatoria: UNKNOWN
```

Aquí es exactamente donde `REVIEW` aporta valor.

El sistema tiene suficiente evidencia para decir que la licitación parece prometedora, pero no suficiente para tomar la decisión automáticamente.

## La recomendación sigue siendo determinista

TenderWise acaba combinando ambos ejes en una recomendación.

Una versión simplificada contiene reglas como:

```text
fecha límite cerrada             -> NO_BID
bloqueo duro de relevancia       -> NO_BID
fallo obligatorio de cualificación -> NO_BID
relevancia muy baja              -> NO_BID
cualificación muy baja           -> NO_BID
evidencia obligatoria desconocida -> REVIEW
alta relevancia + preparación    -> BID
en otro caso                     -> REVIEW
```

Esto es deliberadamente comprensible.

Las decisiones de licitación pueden consumir días de trabajo humano costoso.

Un `BID` automático incorrecto desperdicia recursos.

Un `NO_BID` automático incorrecto puede ocultar ingresos.

Cuando la incertidumbre sigue siendo material, la revisión es una funcionalidad y no un fallo.

## Por qué no dejo que la IA tome la decisión

TenderWise puede generar opcionalmente un brief de licitación con IA.

El brief puede explicar:

- resumen,
- puntos clave,
- riesgos,
- incógnitas,
- siguientes pasos,
- y requisitos de cualificación.

Pero no puede modificar:

```text
relevance
qualification
requirement status
BID / REVIEW / NO_BID
```

La capa de IA recibe el resultado determinista como contexto.

Explica el entorno de decisión.

No se convierte en la autoridad de decisión.

Esa frontera es especialmente importante en contratación pública porque la evidencia de origen debe seguir siendo trazable.

## La separación mejora el debugging

Supongamos que un usuario dice:

> Esta licitación debería haber quedado más arriba.

Con una sola puntuación opaca tengo que hacer ingeniería inversa de lo ocurrido.

Con capas separadas puedo preguntar:

```text
¿Se filtró durante el descubrimiento?
¿La relevancia CPV era baja?
¿El valor del contrato era desconocido?
¿Falló un requisito obligatorio?
¿Faltaba evidencia?
```

Cada capa tiene una responsabilidad interpretable.

Eso facilita localizar bugs y discutir recomendaciones con los usuarios.

## La separación también mejora la iteración de producto

Imaginemos que los usuarios me dicen que la geografía debería importar menos y la alineación de servicios más.

Eso cambia la relevancia.

No cambia cómo deberían evaluarse los requisitos de facturación anual.

Del mismo modo, mejorar el parsing de certificaciones debería afectar a la cualificación sin cambiar las preferencias estratégicas de mercado.

Los conceptos independientes pueden evolucionar de forma independiente.

Esa es una propiedad potente en un producto que todavía está aprendiendo de usuarios reales.

## El principio de diseño más amplio

La separación relevancia/cualificación no es específica de TenderWise.

Representa una regla general de los sistemas de decisión:

> Separa "¿Lo quiero?" de "¿Puedo hacerlo?"

Los sistemas de selección de personal podrían separar interés del candidato y elegibilidad.

Los sistemas de crédito podrían separar valor del cliente y restricciones de underwriting.

Los sistemas de selección de proyectos podrían separar valor estratégico y viabilidad de ejecución.

Preguntas diferentes merecen estados diferentes.

TenderWise es más fácil de explicar precisamente porque no fuerza todo dentro de un único número mágico.

La recomendación final es útil porque el razonamiento que hay debajo sigue siendo visible.
