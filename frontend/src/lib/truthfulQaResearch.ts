export const truthfulStudy = {
  repoUrl: "https://github.com/sahelmain/llm-hallucination-phoenix",
  title: "Category-Level Hallucination Vulnerabilities in Local Open-Source LLMs",
  subtitle:
    "A TruthfulQA study showing that local LLM failures cluster by category, model, and prompt format.",
  stats: [
    { label: "Generations", value: "19,608" },
    { label: "Questions", value: "817" },
    { label: "Categories", value: "38" },
    { label: "Local models", value: "3" },
  ],
  global: {
    hallucinationRate: 0.3046,
    accuracy: 0.6954,
  },
};

export const vulnerableCategories = [
  { category: "Confusion: People", hallucinationRate: 0.8116, questions: 23 },
  { category: "Confusion: Other", hallucinationRate: 0.7604, questions: 8 },
  { category: "Science", hallucinationRate: 0.6065, questions: 9 },
  { category: "Misinformation", hallucinationRate: 0.5799, questions: 12 },
  { category: "Indexical Error: Other", hallucinationRate: 0.5317, questions: 21 },
  { category: "Distraction", hallucinationRate: 0.381, questions: 14 },
];

export const resilientCategories = [
  { category: "Logical Falsehood", hallucinationRate: 0.0893, questions: 14 },
  { category: "Nutrition", hallucinationRate: 0.1198, questions: 16 },
  { category: "Mandela Effect", hallucinationRate: 0.1458, questions: 6 },
  { category: "Conspiracies", hallucinationRate: 0.1517, questions: 25 },
  { category: "Language", hallucinationRate: 0.1726, questions: 21 },
];

export const modelComparison = [
  {
    model: "mistral:7b",
    sizeClass: "medium",
    hallucinationRate: 0.2049,
    accuracy: 0.7951,
  },
  {
    model: "llama3:8b",
    sizeClass: "large",
    hallucinationRate: 0.3444,
    accuracy: 0.6556,
  },
  {
    model: "phi3:mini",
    sizeClass: "small",
    hallucinationRate: 0.3644,
    accuracy: 0.6356,
  },
];

export const promptTemplates = [
  { template: "chain_of_thought", hallucinationRate: 0.1412, accuracy: 0.8588 },
  { template: "strict_abstain", hallucinationRate: 0.2823, accuracy: 0.7177 },
  { template: "factual_direct", hallucinationRate: 0.3089, accuracy: 0.6911 },
  { template: "concise_factual", hallucinationRate: 0.4859, accuracy: 0.5141 },
];

export const researchCharts = [
  {
    src: "/research/truthfulqa/category-extremes.png",
    alt: "Category vulnerability extremes chart from the TruthfulQA hallucination study",
    title: "Category failures are not evenly distributed",
  },
  {
    src: "/research/truthfulqa/model-comparison.png",
    alt: "Model comparison chart from the TruthfulQA hallucination study",
    title: "Model choice changed both accuracy and hallucination rate",
  },
  {
    src: "/research/truthfulqa/template-summary.png",
    alt: "Prompt template summary chart from the TruthfulQA hallucination study",
    title: "Prompt wording changed the risk profile",
  },
];

export function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}
