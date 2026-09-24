import type { Locale } from "@/i18n/config";

interface FlagshipText {
  eyebrow: string;
  heading: string;
  summary: string;
  highlights: string[];
  calloutLabel: string;
  calloutText: string;
  imageAlt: string;
}

const text: Record<Locale, Record<"payrithm" | "tenderwise", FlagshipText>> = {
  en: {
    payrithm: {
      eyebrow: "Flagship project · Machine learning SaaS",
      heading: "Payrithm turns invoice history into collection decisions.",
      summary: "An accounts-receivable intelligence platform that predicts late payments, estimates payment timing, forecasts incoming cash, and converts model outputs into prioritized collection workflows.",
      highlights: ["Uses chronological model validation to prevent future information from leaking into training.", "Evaluates probability quality with ROC-AUC, calibration, and the Brier score.", "Combines risk, invoice value, urgency, and reminder activity into an explainable collection-priority score."],
      calloutLabel: "End-to-end ML product",
      calloutText: "Data ingestion, asynchronous processing, model training, prediction APIs, monitoring, and a decision-focused frontend.",
      imageAlt: "Payrithm accounts-receivable dashboard showing invoice risk and collection priorities",
    },
    tenderwise: {
      eyebrow: "Flagship project · Procurement SaaS",
      heading: "TenderWise turns public-procurement noise into bid/no-bid action.",
      summary: "A multilingual SaaS for European public procurement that ingests TED notices, scores opportunities against company profiles, separates strategic relevance from qualification readiness, and coordinates bid preparation.",
      highlights: ["Stores canonical TED notice history so source changes and failed-ingestion retries remain traceable.", "Keeps relevance and qualification as separate decision axes before returning BID, REVIEW, or NO_BID.", "Adds a team bid workspace with stages, internal deadlines, assignments, seeded checklists, comments, and notifications.", "Runs as a Dockerized SaaS with workspaces, roles, billing limits, audit logs, backups, and optional queued AI briefs."],
      calloutLabel: "Production procurement SaaS",
      calloutText: "React/Vite frontend, FastAPI API, PostgreSQL with pgvector, Redis/Celery workers, scheduled TED ingestion, billing, audit, backups, and optional AI briefs.",
      imageAlt: "TenderWise procurement dashboard showing TED opportunity scores, qualification evidence, and bid workspace progress",
    },
  },
  ca: {
    payrithm: {
      eyebrow: "Projecte principal · SaaS de machine learning",
      heading: "Payrithm transforma l’historial de factures en decisions de cobrament.",
      summary: "Una plataforma d’intel·ligència de comptes a cobrar que prediu pagaments tardans, estima quan es cobrarà, projecta entrades de caixa i converteix els resultats dels models en fluxos de cobrament prioritzats.",
      highlights: ["Utilitza validació cronològica per evitar que informació futura entri a l’entrenament.", "Avalua la qualitat de les probabilitats amb ROC-AUC, calibratge i Brier score.", "Combina risc, import de factura, urgència i activitat de recordatoris en una puntuació de prioritat explicable."],
      calloutLabel: "Producte ML end-to-end",
      calloutText: "Ingestió de dades, processament asíncron, entrenament de models, APIs de predicció, monitoratge i frontend orientat a decisions.",
      imageAlt: "Tauler de Payrithm amb risc de factures i prioritats de cobrament",
    },
    tenderwise: {
      eyebrow: "Projecte principal · SaaS de contractació pública",
      heading: "TenderWise transforma el soroll de la contractació pública en decisions bid/no-bid.",
      summary: "Un SaaS multilingüe per a contractació pública europea que ingereix anuncis TED, puntua oportunitats segons perfils d’empresa, separa rellevància estratègica i qualificació, i coordina la preparació d’ofertes.",
      highlights: ["Conserva l’historial canònic dels anuncis TED perquè els canvis de font i els reintents quedin traçables.", "Manté rellevància i qualificació com eixos separats abans de retornar BID, REVIEW o NO_BID.", "Afegeix un espai de treball d’ofertes amb etapes, terminis interns, assignacions, checklists, comentaris i notificacions.", "Funciona com a SaaS Dockeritzat amb espais de treball, rols, límits de facturació, logs d’auditoria, còpies de seguretat i resums d’IA opcionals."],
      calloutLabel: "SaaS de contractació en producció",
      calloutText: "Frontend React/Vite, API FastAPI, PostgreSQL amb pgvector, workers Redis/Celery, ingestió TED programada, facturació, auditoria, backups i resums d’IA opcionals.",
      imageAlt: "Tauler de TenderWise amb puntuacions d’oportunitats TED, evidència de qualificació i progrés de l’oferta",
    },
  },
  es: {
    payrithm: {
      eyebrow: "Proyecto principal · SaaS de machine learning",
      heading: "Payrithm convierte el historial de facturas en decisiones de cobro.",
      summary: "Una plataforma de inteligencia de cuentas por cobrar que predice pagos tardíos, estima cuándo se cobrará, proyecta entradas de caja y convierte los resultados del modelo en flujos de cobro priorizados.",
      highlights: ["Utiliza validación cronológica para evitar que información futura se filtre al entrenamiento.", "Evalúa la calidad de las probabilidades con ROC-AUC, calibración y Brier score.", "Combina riesgo, importe de factura, urgencia y actividad de recordatorios en una puntuación de prioridad explicable."],
      calloutLabel: "Producto ML end-to-end",
      calloutText: "Ingesta de datos, procesamiento asíncrono, entrenamiento de modelos, APIs de predicción, monitorización y frontend orientado a decisiones.",
      imageAlt: "Panel de Payrithm con riesgo de facturas y prioridades de cobro",
    },
    tenderwise: {
      eyebrow: "Proyecto principal · SaaS de contratación pública",
      heading: "TenderWise convierte el ruido de la contratación pública en decisiones bid/no-bid.",
      summary: "Un SaaS multilingüe para contratación pública europea que ingiere anuncios TED, puntúa oportunidades según perfiles de empresa, separa relevancia estratégica y cualificación, y coordina la preparación de ofertas.",
      highlights: ["Conserva el historial canónico de anuncios TED para mantener trazables los cambios de origen y los reintentos fallidos.", "Mantiene relevancia y cualificación como ejes separados antes de devolver BID, REVIEW o NO_BID.", "Añade un espacio de trabajo de ofertas con etapas, plazos internos, asignaciones, listas de control, comentarios y notificaciones.", "Funciona como SaaS Dockerizado con espacios de trabajo, roles, límites de facturación, registros de auditoría, copias de seguridad y resúmenes de IA opcionales."],
      calloutLabel: "SaaS de contratación en producción",
      calloutText: "Frontend React/Vite, API FastAPI, PostgreSQL con pgvector, workers Redis/Celery, ingesta TED programada, facturación, auditoría, backups y resúmenes de IA opcionales.",
      imageAlt: "Panel de TenderWise con puntuaciones de oportunidades TED, evidencias de cualificación y progreso de ofertas",
    },
  },
  de: {
    payrithm: {
      eyebrow: "Flaggschiff-Projekt · Machine-Learning-SaaS",
      heading: "Payrithm macht aus Rechnungshistorien konkrete Inkassoentscheidungen.",
      summary: "Eine Accounts-Receivable-Plattform, die verspätete Zahlungen prognostiziert, Zahlungszeitpunkte schätzt, Zahlungseingänge vorhersagt und Modellergebnisse in priorisierte Inkasso-Workflows überführt.",
      highlights: ["Verwendet chronologische Modellvalidierung, um Informationsleckagen aus der Zukunft zu vermeiden.", "Bewertet die Qualität von Wahrscheinlichkeiten mit ROC-AUC, Kalibrierung und Brier Score.", "Kombiniert Risiko, Rechnungswert, Dringlichkeit und Erinnerungsaktivität zu einem erklärbaren Prioritätswert."],
      calloutLabel: "End-to-End-ML-Produkt",
      calloutText: "Datenaufnahme, asynchrone Verarbeitung, Modelltraining, Prognose-APIs, Monitoring und ein entscheidungsorientiertes Frontend.",
      imageAlt: "Payrithm-Dashboard mit Rechnungsrisiko und Inkassoprioritäten",
    },
    tenderwise: {
      eyebrow: "Flaggschiff-Projekt · Procurement-SaaS",
      heading: "TenderWise macht aus öffentlicher Ausschreibungsflut klare Bid/No-Bid-Entscheidungen.",
      summary: "Ein mehrsprachiges SaaS für europäische öffentliche Beschaffung, das TED-Bekanntmachungen einliest, Chancen gegen Unternehmensprofile bewertet, strategische Relevanz von Qualifikation trennt und die Angebotsvorbereitung koordiniert.",
      highlights: ["Speichert kanonische TED-Versionen, damit Quelländerungen und fehlgeschlagene Ingestion-Versuche nachvollziehbar bleiben.", "Behandelt Relevanz und Qualifikation als getrennte Entscheidungsachsen vor BID, REVIEW oder NO_BID.", "Bietet einen Angebotsarbeitsbereich mit Phasen, internen Fristen, Aufgaben, Checklisten, Kommentaren und Benachrichtigungen.", "Läuft als Dockerisiertes SaaS mit Workspaces, Rollen, Abrechnungslimits, Audit-Logs, Backups und optionalen KI-Briefings."],
      calloutLabel: "Produktionsreifes Procurement-SaaS",
      calloutText: "React/Vite-Frontend, FastAPI-API, PostgreSQL mit pgvector, Redis/Celery-Worker, geplante TED-Ingestion, Billing, Audit, Backups und optionale KI-Briefings.",
      imageAlt: "TenderWise-Dashboard mit TED-Chancenbewertungen, Qualifikationsnachweisen und Angebotsfortschritt",
    },
  },
};

const base = {
  payrithm: {
    id: "payrithm",
    title: "Payrithm",
    technologies: ["Python", "FastAPI", "scikit-learn", "React", "PostgreSQL", "Celery", "Redis", "Docker"],
    image: "/projects/payrithm/payrithm.png",
    links: [
      { href: "/projects/payrithm/", type: "case", primary: true, external: false },
      { href: "/blog/payrithm/", type: "article", primary: false, external: false },
      { href: "https://payrithm.albertqueralto.dev", type: "app", primary: false, external: true },
      { href: "https://github.com/albert-queralto/invoice-late-predictor-enterprise", type: "source", primary: false, external: true },
    ],
  },
  tenderwise: {
    id: "tenderwise",
    title: "TenderWise",
    technologies: ["React", "TypeScript", "FastAPI", "PostgreSQL", "pgvector", "Celery", "Redis", "Docker", "Stripe", "Ollama"],
    image: "/projects/tenderwise/tenderwise.png",
    links: [
      { href: "/projects/tenderwise/", type: "case", primary: true, external: false },
      { href: "/blog/tenderwise/", type: "article", primary: false, external: false },
      { href: "https://tenderwise.albertqueralto.dev/", type: "app", primary: false, external: true },
      { href: "https://github.com/albert-queralto/tender-wise", type: "source", primary: false, external: true },
    ],
  },
} as const;

export function getFlagships(locale: Locale) {
  return (["payrithm", "tenderwise"] as const).map((id) => ({ ...base[id], ...text[locale][id] }));
}
