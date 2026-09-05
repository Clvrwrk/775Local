const DAY_MS = 86_400_000;

export function buildRolloutPlan({ categoryCount, companyCount }) {
  if (!Number.isInteger(categoryCount) || categoryCount < 500)
    throw new Error("categoryCount must include at least the first 500 categories");
  if (!Number.isInteger(companyCount) || companyCount < 1)
    throw new Error("companyCount must be a positive integer");
  return [
    { round: 1, name: "Seed", categoryCount: 10, resultPolicy: "top_10_serp", listingTarget: 100 },
    {
      round: 2,
      name: "Top 50",
      categoryCount: 50,
      resultPolicy: "top_10_serp",
      listingTarget: 500,
    },
    {
      round: 3,
      name: "Top 100",
      categoryCount: 100,
      resultPolicy: "top_10_serp",
      listingTarget: 1_000,
    },
    {
      round: 4,
      name: "Top 500",
      categoryCount: 500,
      resultPolicy: "top_10_serp",
      listingTarget: 5_000,
    },
    {
      round: 5,
      name: "Complete directory",
      categoryCount,
      resultPolicy: "all_found_companies",
      listingTarget: companyCount,
    },
  ];
}

export function forecastEnrichmentDeadline({
  categoryCount,
  completedCategoryCount,
  batchSize = 20,
  runsPerDay = 1,
  from,
  deadline,
}) {
  if (!Number.isInteger(categoryCount) || categoryCount < 0)
    throw new Error("categoryCount must be a non-negative integer");
  if (
    !Number.isInteger(completedCategoryCount) ||
    completedCategoryCount < 0 ||
    completedCategoryCount > categoryCount
  )
    throw new Error("completedCategoryCount must be between zero and categoryCount");
  if (!Number.isInteger(batchSize) || batchSize < 1)
    throw new Error("batchSize must be a positive integer");
  if (!Number.isInteger(runsPerDay) || runsPerDay < 1)
    throw new Error("runsPerDay must be a positive integer");
  const start = new Date(from);
  const due = new Date(deadline);
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(due.valueOf()) || due <= start)
    throw new Error("from and deadline must be valid increasing dates");
  const remainingCategories = Math.max(0, categoryCount - completedCategoryCount);
  const runsRequired = Math.ceil(remainingCategories / batchSize);
  const calendarDaysRequired = runsRequired === 0 ? 0 : Math.ceil(runsRequired / runsPerDay);
  const availableRunDays = Math.max(0, Math.ceil((due.valueOf() - start.valueOf()) / DAY_MS));
  const availableRuns = availableRunDays * runsPerDay;
  const estimatedCompletion = new Date(start.valueOf() + calendarDaysRequired * DAY_MS);
  return {
    remainingCategories,
    runsRequired,
    calendarDaysRequired,
    availableRuns,
    slackRuns: availableRuns - runsRequired,
    estimatedCompletion: estimatedCompletion.toISOString(),
    onTrack: runsRequired <= availableRuns,
  };
}
