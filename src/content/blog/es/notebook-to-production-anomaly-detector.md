---
title: "Del notebook a producción: desplegando un detector de anomalías"
description: "Lecciones al llevar el trabajo de detección de anomalías sobre series temporales ambientales en tiempo real más allá de los experimentos de modelo hacia un flujo operativo interpretable."
date: 2026-12-08
publishAt: 2026-12-08T08:00:00+02:00
lang: es
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

Construir un detector de anomalías en un notebook y operarlo sobre datos en tiempo real son dos problemas de ingeniería muy diferentes.

En un notebook puedo asumir:

```text
el dataset ya existe
las columnas son estables
los timestamps están limpios
las etiquetas están disponibles
el modelo se ejecuta cuando se lo pido
```

En un sistema de monitorización operativo, ninguna de esas suposiciones está garantizada.

Esa diferencia se hizo especialmente clara mientras trabajaba con datos de series temporales ambientales y de sistemas de agua en tiempo real.

Un detector de eventos de contaminación que desarrollé alcanzó **más de un 80% de capacidad de detección**, pero obtener un modelo útil era solo una parte del trabajo.

El reto real era crear un sistema cuya salida pudiera interpretarse y sobre la que se pudiera actuar.

## Empieza definiendo un evento

Un error habitual en detección de anomalías es empezar por el algoritmo.

Prefiero empezar por el evento.

Para un sistema de monitorización operativo necesito definir:

```text
¿Qué cuenta como anomalía?
¿Cuándo empieza?
¿Cuándo termina?
¿Cuánta antelación resulta útil?
¿Qué nivel de falsas alarmas pueden tolerar los operadores?
```

La precisión a nivel de punto suele responder la pregunta equivocada.

Supongamos que un evento de contaminación dura 30 minutos y produce 30 muestras anómalas.

Un detector que identifica 29 de ellas tiene un recall alto a nivel de muestra.

Un detector que identifica solo una muestra temprana puede seguir detectando correctamente el evento desde el punto de vista operativo.

Por el contrario, detectar 20 muestras cuando el evento ya es evidente puede aportar poco valor.

La métrica tiene que reflejar la decisión real.

## La validación de series temporales debe seguir siendo temporal

Como ocurre con los modelos de facturas, dividir filas aleatoriamente es peligroso.

Las observaciones cercanas de una serie temporal están altamente correlacionadas.

Si ventanas adyacentes del mismo evento físico aparecen tanto en entrenamiento como en validación, la evaluación se vuelve demasiado optimista.

Prefiero dividir por bloques temporales o eventos con significado para que el modelo tenga que generalizar a periodos que no ha visto.

Conceptualmente:

```text
periodo operativo pasado    -> entrenamiento
periodo operativo posterior -> validación
eventos futuros             -> evaluación
```

Si las etiquetas están basadas en eventos, los eventos completos deberían permanecer en un único lado de la división.

## El pipeline de datos forma parte del detector

Un modelo de anomalías desplegado no recibe un DataFrame de pandas procedente de un notebook.

Recibe datos operativos.

Eso puede implicar:

- feeds de API,
- archivos FTP,
- bases de datos de sensores,
- fuentes hidrológicas,
- fuentes meteorológicas,
- e ingestión programada.

Antes de la inferencia, el sistema necesita una gestión predecible para:

- muestras ausentes,
- timestamps duplicados,
- observaciones retrasadas,
- valores fuera de rango,
- cambios de unidades,
- caídas de sensores,
- y cambios de esquema.

De lo contrario, el modelo empieza a detectar problemas del pipeline de datos en lugar del proceso físico.

Algunos de esos problemas pueden seguir mereciendo una alerta, pero deberían distinguirse de los eventos ambientales reales.

## El feature engineering debe sobrevivir al streaming

Las características de un notebook son fáciles de calcular cuando todo el dataset está visible.

Las características de producción necesitan una interpretación causal.

Para una predicción en el instante \(t\), cada característica debe poder calcularse con información disponible en \(t\) o antes.

Las características de series temporales pueden incluir:

- medias móviles,
- variabilidad móvil,
- tasas de cambio,
- valores retardados,
- diferencias entre sensores,
- y desviación respecto al comportamiento esperado.

La implementación de producción debe reproducir las mismas definiciones de ventana y el mismo preprocesamiento utilizados durante el entrenamiento.

Una diferencia de una sola fila en un cálculo móvil puede crear un modelo que técnicamente sea "el mismo" pero operativamente sea diferente.

## Los umbrales son decisiones de producto

Muchos modelos de anomalías producen una puntuación continua.

La alerta necesita un umbral.

Ese umbral determina un compromiso:

```text
umbral más bajo
    -> mayor sensibilidad
    -> más falsas alarmas

umbral más alto
    -> menos falsas alarmas
    -> más eventos no detectados
```

No existe un valor universalmente correcto.

A los operadores suele preocuparles tanto la carga de falsas alarmas como el recall del modelo de machine learning.

Un detector que encuentra todas las anomalías pero envía una alerta cada cinco minutos acabará siendo ignorado.

Por tanto, la selección del umbral pertenece a la validación y a la revisión operativa, no a una constante arbitraria elegida después del entrenamiento.

## Las explicaciones importan en monitorización

Una alerta de anomalía sin contexto obliga al operador a empezar su propia investigación desde cero.

He utilizado SHAP para ayudar a interpretar las predicciones del modelo.

El objetivo no es fingir que la atribución de características demuestra causalidad.

Es proporcionar información de apoyo como:

- qué variables contribuyeron más,
- qué señales cambiaron de forma inusual,
- en qué dirección se movieron,
- y cómo difiere el patrón actual del comportamiento esperado.

Eso puede convertir:

> anomaly score = 0.91

en:

> la conductividad y la turbidez se desplazaron fuera de su patrón conjunto normal mientras que las demás señales monitorizadas permanecieron comparativamente estables.

La segunda salida es mucho más accionable.

## Empaqueta el modelo como un sistema

Un modelo de producción necesita una interfaz repetible.

Eso puede significar un servicio FastAPI u otra frontera de aplicación capaz de exponer operaciones como:

```text
cargar configuración del modelo
enviar ventana de observaciones
ejecutar inferencia
devolver puntuación
devolver explicación
devolver metadatos del modelo
```

La aplicación también debe saber qué versión del modelo produjo el resultado.

La reproducibilidad requiere más que guardar:

```text
model.pkl
```

Los metadatos útiles incluyen:

- versión del modelo,
- configuración de características,
- periodo de entrenamiento,
- umbral,
- esquema de entrada,
- scaler o preprocessor,
- y métricas de evaluación.

La predicción solo es reproducible si su preprocesamiento y su configuración también lo son.

## La configuración se convierte en un problema de producto

Cuando existen varios modelos, editar archivos de configuración manualmente deja de escalar.

He construido herramientas con Streamlit y FastAPI alrededor de la configuración, migración y visualización de modelos.

Esa capa importa porque el machine learning operativo normalmente implica a más de un investigador.

Llega un momento en que alguien necesita responder:

```text
¿Qué modelo está activo?
¿Qué sensores utiliza?
¿Qué umbral está configurado?
¿Cuándo se entrenó?
¿Cómo está rindiendo?
```

Un registro de modelos no necesita empezar siendo una enorme plataforma MLOps.

Necesita hacer explícito el estado.

## La monitorización también debería incluir las entradas

La precisión del modelo puede degradarse mientras la API sigue perfectamente sana.

Por tanto, la monitorización de producción necesita dos niveles.

### Salud del sistema

```text
servicio disponible
latencia de inferencia
llegada de datos
tareas programadas saludables
base de datos accesible
```

### Salud del modelo

```text
distribución de entrada
valores ausentes
distribución de puntuaciones
frecuencia de alertas
detección de eventos observados
falsas alarmas
deriva de características
```

Una respuesta `200 OK` solo me dice que el software se ejecutó.

No me dice que la predicción siga siendo útil.

## El feedback cierra el ciclo

Las anomalías ambientales son especialmente difíciles porque las etiquetas pueden llegar tarde y la revisión experta importa.

Un flujo operativo debería conservar:

```text
timestamp de predicción
puntuación de anomalía
decisión de umbral
versión del modelo
evaluación del operador
resultado confirmado del evento
```

Eso crea la evidencia necesaria para evaluar el detector más adelante.

Sin esa conexión, el machine learning desplegado se convierte en un flujo de predicciones sin ningún mecanismo de aprendizaje a largo plazo.

## Qué cambió respecto al notebook

El modelo siguió siendo importante.

Pero su importancia relativa disminuyó.

El sistema de producción también necesitaba:

```text
ingestión fiable
validación temporal
cálculo causal de características
gestión de umbrales
versionado
interpretabilidad
APIs
herramientas de configuración
monitorización
feedback
```

Estas piezas determinan si el detector sobrevive al contacto con datos operativos reales.

Esa es la mayor lección que he extraído del trabajo aplicado de detección de anomalías.

Un notebook demuestra que un modelo puede encontrar un patrón.

Un sistema de producción tiene que demostrar que ese patrón puede convertirse en una decisión fiable.
