// Allow running Golden Eval without a live PostgreSQL instance or AI_DATABASE_URL.
if (!process.env.AI_DATABASE_URL && !process.env.DATABASE_URL && !process.env.AI_V2_DATABASE_URL) {
  process.env.AI_DATABASE_URL = "postgresql://eval:eval@localhost:5432/eval_unused";
}

async function main() {
  const [{ DEFAULT_MODEL_ID }, { resolveLanguageModel }, { GOLDEN_EVAL_SCENARIOS, runGoldenEval }] =
    await Promise.all([
      import("../models.js"),
      import("../providers.js"),
      import("./golden-eval.js"),
    ]);

  const modelId = process.env.EVAL_MODEL_ID || DEFAULT_MODEL_ID;
  const filterArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const scenarios = filterArg
    ? GOLDEN_EVAL_SCENARIOS.filter((s) => s.id.includes(filterArg))
    : GOLDEN_EVAL_SCENARIOS;

  if (scenarios.length === 0) {
    console.error(`[golden-eval] No scenario matched filter "${filterArg}".`);
    process.exit(1);
  }

  const { model } = await resolveLanguageModel(modelId);
  console.info(`[golden-eval] Running ${scenarios.length} scenario(s) on model=${modelId}...`);

  const summary = await runGoldenEval({ model, modelId, scenarios });

  for (const r of summary.reports) {
    const status = r.passed ? "PASS" : "FAIL";
    const tools = r.calledTools.length > 0 ? r.calledTools.join(" -> ") : "(none)";
    console.info(`  [${status}] ${r.scenarioId} (${r.durationMs}ms) tools=[${tools}]`);
    if (!r.passed) {
      console.error(`         Failures: ${r.failures.join(" ; ")}`);
    }
  }

  console.info(
    `[golden-eval] Summary: ${summary.passed}/${summary.total} passed (${summary.failed} failed)`,
  );
  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[golden-eval] Fatal error: ${message}`);
  process.exit(1);
});
