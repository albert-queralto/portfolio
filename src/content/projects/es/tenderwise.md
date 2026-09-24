---
title: "TenderWise"
description: "Un SaaS multilingüe de contratación pública que ingiere anuncios TED, puntúa oportunidades según perfiles de empresa, separa relevancia de cualificación y coordina la preparación de ofertas."
lang: es
translationKey: tenderwise
order: 2
featured: true
draft: false
status: "Deployed"
category: "Web"
focus: "SaaS de contratación · Soporte a decisiones"
image: "/projects/tenderwise/tenderwise.png"
ogImage: "/og/tenderwise.png"
article: "/blog/tenderwise/"
source: "https://github.com/albert-queralto/tender-wise"
preview: "https://tenderwise.albertqueralto.dev/"
technologies:
  - React
  - TypeScript
  - Vite
  - FastAPI
  - PostgreSQL
  - pgvector
  - Redis
  - Celery
  - Docker
  - Stripe
  - Ollama
metrics:
  - label: "Dominio"
    value: "Contratación pública europea"
  - label: "Modelo de decisión"
    value: "Relevancia + cualificación"
  - label: "Arquitectura"
    value: "SaaS multiservicio"
---

## El problema

Los equipos de contratación pública deben decidir rápidamente si una licitación merece preparar una oferta, pero el material de origen es denso, multilingüe y operacionalmente incómodo.

Los anuncios TED contienen señales valiosas sobre alcance, ubicación, categorías CPV, plazos, contexto del comprador, valor del contrato y requisitos obligatorios. TenderWise convierte ese flujo en un espacio de trabajo donde los equipos pueden decidir qué perseguir y coordinar el trabajo necesario para preparar una oferta.

## Mi enfoque

TenderWise separa descubrimiento, soporte a la decisión y ejecución de la oferta.

El sistema ingiere anuncios TED, los normaliza en oportunidades estructuradas, los compara con perfiles de empresa y después evalúa dos preguntas distintas:

- ¿La oportunidad es estratégicamente relevante?
- ¿Puede la empresa cumplir los requisitos obligatorios conocidos?

Estos dos ejes alimentan una recomendación determinista `BID`, `REVIEW` o `NO_BID`. La IA puede explicar y resumir el contenido de la licitación, pero no sustituye la recomendación basada en reglas.

## Ingesta de TED

El backend se integra con la TED Search API y almacena el XML TED canónico para que el historial de anuncios siga siendo trazable. Los registros parseados se convierten en lotes y oportunidades normalizados que pueden filtrarse por geografía, códigos CPV, preferencias de valor, plazos, fuente, estado y watchlist.

TenderWise también almacena versiones de anuncios y el estado de ingestas fallidas. Esto permite reintentar errores transitorios y destacar cambios cuando evoluciona un anuncio de origen.

## Relevancia y cualificación

Los perfiles de empresa definen qué importa a cada workspace: países objetivo, preferencias CPV, exclusiones, valores de contrato, capacidades, certificaciones y otras evidencias de cualificación.

La puntuación de relevancia responde si la oportunidad debe formar parte del feed del equipo. La puntuación de cualificación responde si el equipo parece capaz de cumplir los requisitos obligatorios ya extraídos del anuncio.

Mantener estos conceptos separados hace que la recomendación sea más fácil de auditar. Una licitación puede resultar estratégicamente atractiva y, aun así, requerir revisión porque un requisito obligatorio es desconocido o falta evidencia.

## Espacio de trabajo de la oferta

Cuando una oportunidad merece perseguirse o revisarse, TenderWise crea un espacio colaborativo para la oferta.

El workspace controla fases del workflow, plazos internos, roles nominados del equipo de oferta, tareas de preparación, checklists iniciales de requisitos, responsables, progreso de completitud y comentarios del equipo. Esto mantiene el sistema de decisión conectado con el trabajo operativo necesario antes de presentar la oferta.

## Operaciones SaaS

TenderWise incluye la infraestructura de producto alrededor del workflow:

- Miembros del workspace y permisos basados en roles
- Onboarding inicial
- Estado de suscripción de Stripe y límites de uso
- Logs de auditoría para acciones que modifican el workspace
- Notificaciones dentro de la aplicación para facturación, TED y eventos de oferta
- Visibilidad del estado de producción y copias programadas de PostgreSQL

Estas piezas hacen que el proyecto sea más que un parser de licitaciones. Se comporta como una aplicación SaaS mantenible con límites operativos, cuotas y vías de recuperación.

## Informes opcionales con IA

Los informes de IA sobre licitaciones se encolan mediante Celery en lugar de bloquear el navegador. Cuando está habilitado, TenderWise puede generar un resumen ejecutivo, puntos clave, riesgos, incógnitas, siguientes pasos sugeridos y explicaciones en lenguaje sencillo de los requisitos.

El proveedor de IA es configurable: puede utilizarse un contenedor local de Ollama en Docker Compose o el worker puede llamar a un proveedor compatible con OpenAI. Los informes cacheados se marcan como obsoletos cuando cambia el modelo o la configuración del proveedor.

## Arquitectura

El despliegue de producción utiliza un stack compartido de Nginx y Certbot para `tenderwise.albertqueralto.dev`.

Detrás de esa capa pública, la aplicación React es servida por un contenedor web y redirige las peticiones API a FastAPI. PostgreSQL con pgvector almacena datos de la aplicación, Redis coordina jobs de Celery, Celery Beat programa trabajo en segundo plano y los workers gestionan ingesta TED, correo, digests, reintentos y generación con IA.

Solo el servicio web se une a la red pública del proxy. La base de datos, Redis, API, worker, scheduler, proceso de backup y servicio opcional de Ollama permanecen en la red privada de Docker Compose de TenderWise.

## Estado actual

TenderWise está desplegado como un proyecto SaaS orientado a producción. El siguiente trabajo de producto es refinar el onboarding, ajustar los pesos de scoring con usuarios reales, ampliar la monitorización operativa y seguir mejorando el espacio de trabajo de ofertas según cómo los equipos de contratación preparan realmente sus presentaciones.
