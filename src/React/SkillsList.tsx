import { useId, useState, type ReactNode } from "react";

type SkillCategory = {
  title: string;
  summary: string;
  items: string[];
  icon: ReactNode;
};

const iconClass = "h-6 w-6 shrink-0 text-[var(--sec)]";

const categories: SkillCategory[] = [
  {
    title: "Data & analytics",
    summary: "Turn messy operational data into trustworthy signals.",
    items: [
      "Time-series cleaning, feature engineering, and exploratory analysis",
      "Statistical modelling, validation, and interpretable reporting",
      "Visualisation and decision tools with Plotly, Bokeh, Power BI, and Streamlit",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass} aria-hidden="true">
        <path d="M3 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3Zm3 4h2v2H6V7Zm0 4h2v2H6v-2Zm0 4h2v2H6v-2Zm4-8h8v2h-8V7Zm0 4h8v2h-8v-2Zm0 4h8v2h-8v-2Z" />
      </svg>
    ),
  },
  {
    title: "Machine-learning systems",
    summary: "Develop models that survive contact with production data.",
    items: [
      "Supervised learning and deep learning with scikit-learn, PyTorch, and TensorFlow",
      "Time-series prediction, anomaly detection, and model interpretation with SHAP",
      "Model-serving APIs, monitoring hooks, reproducible training, and containerisation",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass} aria-hidden="true">
        <path d="M9 2h6v2h2a3 3 0 0 1 3 3v2h2v6h-2v2a3 3 0 0 1-3 3h-2v2H9v-2H7a3 3 0 0 1-3-3v-2H2V9h2V7a3 3 0 0 1 3-3h2V2Zm-2 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H7Zm2 3h6v6H9V9Z" />
      </svg>
    ),
  },
  {
    title: "Data platforms & pipelines",
    summary: "Move data reliably from source systems to applications.",
    items: [
      "API, FTP, file, and scheduled ingestion workflows",
      "PostgreSQL, PostGIS, Databricks, and structured analytical storage",
      "Apache Airflow scheduling, ETL automation, and data-quality checks",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass} aria-hidden="true">
        <path d="M12 2c5 0 9 1.57 9 3.5v13c0 1.93-4 3.5-9 3.5s-9-1.57-9-3.5v-13C3 3.57 7 2 12 2Zm7 11.22c-1.7.8-4.2 1.28-7 1.28s-5.3-.48-7-1.28v2.28c0 .65 2.45 2 7 2s7-1.35 7-2v-2.28Zm0-5c-1.7.8-4.2 1.28-7 1.28S6.7 9.02 5 8.22v2.28c0 .65 2.45 2 7 2s7-1.35 7-2V8.22ZM12 4C7.45 4 5 5.35 5 6s2.45 2 7 2 7-1.35 7-2-2.45-2-7-2Zm7 14.22c-1.7.8-4.2 1.28-7 1.28s-5.3-.48-7-1.28v.28c0 .65 2.45 2 7 2s7-1.35 7-2v-.28Z" />
      </svg>
    ),
  },
  {
    title: "Software engineering",
    summary: "Package analytical work into usable, maintainable products.",
    items: [
      "Python services with FastAPI and Flask",
      "React and TypeScript interfaces for model configuration and results",
      "Docker, Linux, Git, testing, and clean architectural boundaries",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass} aria-hidden="true">
        <path d="m8.7 16.7-4.7-4.7 4.7-4.7 1.4 1.4L6.8 12l3.3 3.3-1.4 1.4Zm6.6 0-1.4-1.4 3.3-3.3-3.3-3.3 1.4-1.4 4.7 4.7-4.7 4.7ZM10.2 19l2-14h2l-2 14h-2Z" />
      </svg>
    ),
  },
];

export default function SkillsList() {
  const [openItem, setOpenItem] = useState<string | null>(categories[0].title);
  const baseId = useId();

  return (
    <div className="space-y-3" aria-label="Core capabilities">
      {categories.map((category) => {
        const isOpen = openItem === category.title;
        const panelId = `${baseId}-${category.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

        return (
          <section
            key={category.title}
            className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]"
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenItem(isOpen ? null : category.title)}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--white-icon-tr)]"
              >
                <span className="mt-0.5">{category.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--white)]">{category.title}</span>
                  <span className="mt-0.5 block text-sm text-[var(--white-icon)]">
                    {category.summary}
                  </span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className={`mt-1 h-5 w-5 shrink-0 text-[var(--white-icon)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <path d="m12 15.17 6.36-6.36-1.41-1.42L12 12.34 7.05 7.39 5.64 8.81 12 15.17Z" />
                </svg>
              </button>
            </h3>
            <div
              id={panelId}
              aria-hidden={!isOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <ul className="space-y-2 border-t border-[var(--border)] px-5 py-4 text-sm leading-relaxed text-[var(--white-icon)]">
                  {category.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sec)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
