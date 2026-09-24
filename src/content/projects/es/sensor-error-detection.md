---
title: "Detección y localización de errores de sensores con RNNs"
description: "Un pipeline de redes neuronales recurrentes con modelos LSTM y GRU para detectar y localizar fallos en flujos multivariantes de sensores."
lang: es
translationKey: sensor-error-detection
order: 3
featured: false
draft: false
status: "Completed"
category: "Machine Learning"
focus: "Deep learning · Series temporales"
image: "/Sensor_Error_Detection_and_Localization_with_RNNs.png"
source: "https://github.com/albert-queralto/Sensor_Error_Detection_and_Localization_with_RNNs"
technologies:
  - Python
  - PyTorch
  - LSTM
  - GRU
  - Time series
metrics:
  - label: "Tipo de problema"
    value: "Detección multivariante de fallos"
  - label: "Familias de modelos"
    value: "LSTM + GRU"
  - label: "Salida"
    value: "Detección + localización"
---

## Problema

Los sistemas de monitorización industrial y ambiental dependen de múltiples sensores que producen mediciones correlacionadas a lo largo del tiempo. Un sensor defectuoso puede distorsionar análisis posteriores, provocar falsas alarmas u ocultar un evento operativo real.

El proyecto explora cómo las redes neuronales recurrentes pueden detectar cuándo un flujo de sensor se vuelve anómalo e identificar qué sensor es responsable. Los usuarios previstos son ingenieros y analistas encargados de mantener sistemas fiables de monitorización multivariante.

## Restricciones

Los fallos de sensores son temporales, no simples eventos tabulares aislados. Un valor sospechoso puede identificarse únicamente por su relación con observaciones anteriores y con el comportamiento simultáneo de otros sensores.

Los ejemplos de fallos pueden ser mucho menos frecuentes que las observaciones normales, lo que crea un problema de aprendizaje desequilibrado. Distintos tipos de fallo también pueden producir síntomas similares, y un mismo sensor puede comportarse de forma diferente bajo condiciones operativas cambiantes.

El proyecto es experimental y no un servicio de monitorización desplegado, por lo que la evaluación se centra en el comportamiento de los modelos y el rendimiento comparativo en lugar de la latencia de producción o la disponibilidad de infraestructura.

## Enfoque

Los datos se organizan como secuencias multivariantes adecuadas para redes neuronales recurrentes. Se entrenan arquitecturas LSTM y GRU para aprender dependencias temporales y relaciones entre sensores.

El pipeline separa dos tareas relacionadas: detectar si una secuencia contiene un error de sensor y localizar el sensor afectado. La preparación de datos incluye construcción de secuencias, escalado de variables, generación de objetivos y separación entre entrenamiento y evaluación.

Comparar modelos LSTM y GRU ayuda a valorar si la complejidad adicional de las puertas de una LSTM aporta suficiente beneficio para los datos y la longitud de secuencia seleccionados.

## Validación

Los modelos se evalúan sobre secuencias reservadas que no se utilizan durante el entrenamiento. La evaluación considera tanto si se detectan los fallos como si se identifica correctamente el sensor afectado.

Como las observaciones normales pueden dominar el dataset, las métricas sensibles a cada clase son más informativas que la accuracy por sí sola. Las matrices de confusión y el comportamiento por clase ayudan a revelar si un modelo funciona bien en todos los sensores o únicamente en los patrones de fallo más frecuentes.

El repositorio contiene el análisis reproducible y los experimentos de modelo utilizados para comparar arquitecturas y configuraciones de entrenamiento.

## Decisiones de ingeniería

PyTorch se utiliza para definir explícitamente las arquitecturas recurrentes y el bucle de entrenamiento. Esto hace visibles la gestión del estado oculto, las formas de las secuencias, la optimización y el comportamiento de evaluación en lugar de ocultarlos tras una abstracción de alto nivel.

El proyecto mantiene separadas lógicamente la preparación de datos, la definición del modelo, el entrenamiento y la evaluación para que cada etapa pueda inspeccionarse y modificarse. Una configuración reproducible y semillas aleatorias fijas son importantes al comparar modelos recurrentes.

Se utilizan diagnósticos visuales junto con métricas resumidas para inspeccionar el comportamiento del entrenamiento y los errores del modelo.

## Compromisos

El proyecto se centra en arquitecturas LSTM y GRU en lugar de probar todos los métodos posibles de series temporales. Baselines estadísticos más sencillos y arquitecturas de secuencia más recientes podrían aportar comparaciones adicionales útiles.

El pipeline experimental todavía no incluye una API de inferencia en streaming, un registro persistente de modelos, detección automática de drift ni una interfaz de alertas orientada a operadores.

## Siguientes pasos

Una siguiente versión más sólida añadiría baselines no recurrentes, validación cruzada temporal, optimización de umbrales y una comparación más clara entre errores de detección y localización.

Para uso en producción, el modelo podría empaquetarse detrás de un servicio FastAPI, conectarse a una fuente de datos en streaming, monitorizarse para detectar data drift e integrarse con una interfaz de alertas que muestre el sensor afectado y las evidencias de soporte.
