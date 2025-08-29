import React, { useState } from "react";

const CategoryIcons = {
  "Data Science": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6 text-[var(--sec)] opacity-70"
    >
      <path d="M3 3C2.44772 3 2 3.44772 2 4V20C2 20.5523 2.44772 21 3 21H21C21.5523 21 22 20.5523 22 20V4C22 3.44772 21.5523 3 21 3H3ZM6 7H8V9H6V7ZM6 11H8V13H6V11ZM6 15H8V17H6V15ZM10 7H18V9H10V7ZM10 11H18V13H10V11ZM10 15H18V17H10V15Z"></path>
    </svg>
  ),
  "Machine Learning Engineering": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6 text-[var(--sec)] opacity-70"
    >
      <path d="M12 2C6.486 2 2 6.486 2 12c0 4.991 3.657 9.128 8.438 9.878.617.113.844-.267.844-.594 0-.293-.011-1.07-.017-2.099-3.338.726-4.042-1.61-4.042-1.61-.561-1.426-1.371-1.807-1.371-1.807-1.121-.766.085-.75.085-.75 1.24.088 1.894 1.273 1.894 1.273 1.103 1.889 2.894 1.344 3.6 1.028.112-.799.432-1.345.785-1.656-2.665-.303-5.467-1.367-5.467-6.084 0-1.344.469-2.445 1.236-3.306-.124-.303-.536-1.523.117-3.176 0 0 1.008-.323 3.301 1.26a11.42 11.42 0 0 1 3.003-.404c1.018.005 2.045.138 3.003.404 2.292-1.583 3.299-1.26 3.299-1.26.655 1.653.243 2.873.119 3.176.77.861 1.236 1.962 1.236 3.306 0 4.728-2.807 5.777-5.479 6.075.444.382.84 1.139.84 2.297 0 1.659-.016 2.995-.016 3.401 0 .33.225.711.85.59C18.348 21.125 22 16.991 22 12c0-5.514-4.486-10-10-10Z"></path>
    </svg>
  ),
  "Big Data & Cloud": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6 text-[var(--sec)] opacity-70"
    >
      <path d="M6 19h13a4 4 0 0 0 0-8h-.26A6.5 6.5 0 0 0 6.34 6.34 6.5 6.5 0 0 0 6 19Zm0-2a4.5 4.5 0 0 1 .43-9 4.5 4.5 0 0 1 8.35-2.14 6.5 6.5 0 0 1 5.17 11.14H6Z"></path>
    </svg>
  ),
  "Software Development": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6 text-[var(--sec)] opacity-70"
    >
      <path d="M4 4h16v2H4V4Zm0 14h16v2H4v-2Zm2-7h12v2H6v-2Z"></path>
    </svg>
  ),
};


const SkillsList = () => {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const skills = {
    "Data Science": [
      "Data cleaning & preprocessing (Numpy, Pandas)",
      "Exploratory Data Analysis (EDA)",
      "Statistical modeling & hypothesis testing (Scipy, Statsmodels)",
      "Data visualization (Matplotlib, Seaborn, Plotly, Bokeh)",
      "Dashboards (Power BI, Tableau)"
    ],
    "Machine Learning Engineering": [
      "Supervised & unsupervised learning (Scikit-learn)",
      "Deep Learning (PyTorch, TensorFlow, Keras)",
      "Model deployment (FastAPI, Flask, Streamlit)",
      "MLOps (MLflow, Docker, CI/CD)"
    ],
    "Big Data & Cloud": [
      "Data pipelines with Airflow & Spark",
      "Cloud platforms (AWS, GCP, Azure)",
      "Distributed computing & scalability",
      "Database management (SQL, NoSQL, time-series DBs)"
    ],
    "Software Development": [
      "Web apps with TypeScript & React.js",
      "Version control with Git & GitHub/GitLab",
      "Python programming for data & backend",
      "C++ for performance-critical applications",
      "Linux & shell scripting",
      "Agile software development practices",
      "Clean code & design patterns"
    ],
  };

  const toggleItem = (item: string) => {
    setOpenItem(openItem === item ? null : item);
  };

  return (
    <div className="text-left pt-3 md:pt-9">
      <h3 className="text-[var(--white)] text-3xl md:text-4xl font-semibold md:mb-6">
        What I do?
      </h3>
      <ul className="space-y-4 mt-4 text-lg">
        {Object.entries(skills).map(([category, items]) => (
          <li key={category} className="w-full">
            <div
              onClick={() => toggleItem(category)}
              className="md:w-[400px] w-full bg-[#1414149c] rounded-2xl text-left hover:bg-opacity-80 transition-all border border-[var(--white-icon-tr)] cursor-pointer overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4">
                {CategoryIcons[category]}
                <div className="flex items-center gap-2 flex-grow justify-between">
                  <div className="min-w-0 max-w-[200px] md:max-w-none overflow-hidden">
                    <span className="block truncate text-[var(--white)] text-lg">
                      {category}
                    </span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`w-6 h-6 text-[var(--white)] transform transition-transform flex-shrink-0 ${
                      openItem === category ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"></path>
                  </svg>
                </div>
              </div>

              <div
                className={`transition-all duration-300 px-4 ${
                  openItem === category
                    ? "max-h-[500px] pb-4 opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <ul className="space-y-2 text-[var(--white-icon)] text-sm">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center">
                      <span className="pl-1">•</span>
                      <li className="pl-3">{item}</li>
                    </div>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SkillsList;
