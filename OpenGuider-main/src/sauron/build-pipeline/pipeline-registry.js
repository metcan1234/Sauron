const PIPELINE_REGISTRY = {
  "corporate-web-v1": {
    id: "corporate-web-v1",
    label: "Kurumsal Web Sitesi",
    projectType: "corporate-web",
    phases: [
      {
        phase: 1,
        goal: "Verify Next.js scaffold and run npm install if package.json exists",
        complexityHint: "low",
        verification: { command: "npm install" },
      },
      {
        phase: 2,
        goal: "Implement page content, SEO metadata, and navigation from web brief",
        complexityHint: "medium",
      },
      {
        phase: 3,
        goal: "Add contact form, accessibility fixes, and responsive polish",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Run quality checklist and production build",
        complexityHint: "low",
        verification: { command: "npm run build" },
      },
    ],
  },
  "corporate-web-v2": {
    id: "corporate-web-v2",
    label: "Kurumsal Web Sitesi v2",
    projectType: "corporate-web",
    phases: [
      { phase: 1, goal: "Verify Next.js scaffold and install dependencies", complexityHint: "low", verification: { command: "npm install" } },
      { phase: 2, goal: "Implement localized layout, navigation, and SEO metadata", complexityHint: "medium" },
      { phase: 3, goal: "Build page content from web brief and site-data module", complexityHint: "medium" },
      { phase: 4, goal: "Add contact form, accessibility, and responsive polish", complexityHint: "low" },
      { phase: 5, goal: "Run production build and quality checklist", complexityHint: "low", verification: { command: "npm run build" } },
    ],
  },
  "corporate-web-v3": {
    id: "corporate-web-v3",
    label: "Kurumsal Web Sitesi v3",
    projectType: "corporate-web",
    phases: [
      { phase: 1, goal: "Verify Next.js scaffold and install dependencies", complexityHint: "low", verification: { command: "npm install" } },
      { phase: 2, goal: "Generate lib/site-data.ts from industry brief", complexityHint: "medium" },
      { phase: 3, goal: "Run corporate visual verification", complexityHint: "low", verification: { command: "node scripts/verify-corporate-visual.js" } },
      { phase: 4, goal: "Implement localized pages and navigation", complexityHint: "medium" },
      { phase: 5, goal: "Add contact form and accessibility fixes", complexityHint: "low" },
      { phase: 6, goal: "Run production build", complexityHint: "low", verification: { command: "npm run build" } },
    ],
  },
  "self-improve-feature-v1": {
    id: "self-improve-feature-v1",
    label: "Sauron Self-Improve",
    projectType: "electron-core",
    phases: [
      {
        phase: 1,
        goal: "Plan the change: list target files and acceptance criteria (no code yet)",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Implement the feature or fix with minimal diff",
        complexityHint: "medium",
      },
      {
        phase: 3,
        goal: "Run tests and fix failures",
        complexityHint: "low",
        verification: { command: "npm test" },
      },
    ],
  },
  "bridge-agent-v1": {
    id: "bridge-agent-v1",
    label: "Bridge Agent",
    projectType: "bridge-extension",
    phases: [
      {
        phase: 1,
        goal: "Implement bridge changes and run npm test",
        complexityHint: "medium",
        verification: { command: "npm test" },
      },
      {
        phase: 2,
        goal: "Compile extension and verify VSIX packaging smoke",
        complexityHint: "low",
        verification: { command: "npm run compile" },
      },
    ],
  },
  "monorepo-stack-v1": {
    id: "monorepo-stack-v1",
    label: "Tam Sauron Stack",
    projectType: "monorepo-stack",
    phases: [
      {
        phase: 1,
        goal: "Verify monorepo layout and install dependencies in OpenGuider-main and bridge",
        complexityHint: "low",
        verification: { command: "npm test" },
      },
      {
        phase: 2,
        goal: "Align Cline fork exports with Bridge capabilities",
        complexityHint: "high",
      },
      {
        phase: 3,
        goal: "Run full stack smoke tests",
        complexityHint: "medium",
        verification: { command: "npm test" },
      },
    ],
  },
};

function getPipeline(pipelineId) {
  return PIPELINE_REGISTRY[pipelineId] || null;
}

function listPipelines() {
  return Object.values(PIPELINE_REGISTRY).map((p) => ({
    id: p.id,
    label: p.label,
    projectType: p.projectType,
    phaseCount: p.phases.length,
  }));
}

module.exports = {
  PIPELINE_REGISTRY,
  getPipeline,
  listPipelines,
};
