/**
 * Pure quiz-selection logic. Keeping this separate from the DOM makes the
 * balancing and no-repeat rules easy to test as the bank grows.
 */

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function asChapterNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`Invalid chapter: ${value}`);
  return number;
}

function capacityFor(chapter, capacities) {
  if (!capacities) return Number.POSITIVE_INFINITY;
  const value = capacities[chapter] ?? capacities[String(chapter)];
  return value === undefined ? Number.POSITIVE_INFINITY : Number(value);
}

/**
 * Allocate an exact number of questions across chapters.
 *
 * When count is below the number of selected chapters, one question is
 * allocated to a random subset. Otherwise every chapter receives the same
 * base allocation and the remainder is assigned to a random subset.
 * Optional capacities let the current bank (or a future bank) redistribute
 * an allocation that a chapter cannot satisfy.
 */
export function calculateBalancedAllocation(chapterNumbers, count, capacities, random = Math.random) {
  const chapters = [...new Set(chapterNumbers.map(asChapterNumber))];
  const requested = Number(count);
  if (!chapters.length) throw new Error("Select at least one chapter.");
  if (!Number.isInteger(requested) || requested < 1) throw new Error("Question count must be a positive integer.");

  const allocatableChapters = chapters.filter((chapter) => capacityFor(chapter, capacities) >= 1);
  const totalCapacity = allocatableChapters.reduce((sum, chapter) => sum + capacityFor(chapter, capacities), 0);
  if (requested > totalCapacity) throw new Error(`Only ${totalCapacity} unique questions are available for this selection.`);

  const represented = requested < allocatableChapters.length
    ? shuffle(allocatableChapters, random).slice(0, requested)
    : allocatableChapters;
  const allocation = Object.fromEntries(represented.map((chapter) => [chapter, 0]));

  if (requested < represented.length) {
    represented.forEach((chapter) => { allocation[chapter] = 1; });
    return allocation;
  }

  const base = Math.floor(requested / represented.length);
  const remainder = requested % represented.length;
  represented.forEach((chapter) => { allocation[chapter] = base; });
  shuffle(represented, random).slice(0, remainder).forEach((chapter) => { allocation[chapter] += 1; });

  // If the current bank has a smaller chapter pool than a balanced target,
  // move the overflow to the least-filled chapters with spare capacity.
  let overflow = 0;
  represented.forEach((chapter) => {
    const capacity = capacityFor(chapter, capacities);
    if (allocation[chapter] > capacity) {
      overflow += allocation[chapter] - capacity;
      allocation[chapter] = capacity;
    }
  });
  while (overflow > 0) {
    const minimum = Math.min(...represented.filter((chapter) => allocation[chapter] < capacityFor(chapter, capacities)).map((chapter) => allocation[chapter]));
    const candidates = represented.filter((chapter) => allocation[chapter] === minimum && allocation[chapter] < capacityFor(chapter, capacities));
    if (!candidates.length) throw new Error("The selected chapters cannot satisfy this question count.");
    const chapter = shuffle(candidates, random)[0];
    allocation[chapter] += 1;
    overflow -= 1;
  }
  return allocation;
}

function cloneHistory(history = {}) {
  return Object.fromEntries(Object.entries(history).map(([chapter, ids]) => [chapter, Array.isArray(ids) ? [...new Set(ids)] : []]));
}

function pickChapterQuestions(pool, needed, historyIds, random) {
  if (needed > pool.length) throw new Error("A chapter cannot supply enough unique questions for this quiz.");
  const seen = new Set(historyIds);
  const unseen = shuffle(pool.filter((question) => !seen.has(question.id)), random);
  const chosen = unseen.slice(0, needed);
  if (chosen.length < needed) {
    const chosenIds = new Set(chosen.map((question) => question.id));
    const repeatCandidates = shuffle(pool.filter((question) => !chosenIds.has(question.id)), random);
    chosen.push(...repeatCandidates.slice(0, needed - chosen.length));
  }
  if (chosen.length !== needed || new Set(chosen.map((question) => question.id)).size !== needed) {
    throw new Error("Could not select the requested number of unique questions.");
  }
  return chosen;
}

/**
 * Select a quiz with balanced chapters, unseen-question preference, and no
 * duplicate question IDs inside one quiz. History is returned for persistence.
 */
export function selectBalancedQuestions({ questionBank, selectedChapters, count, history = {}, random = Math.random }) {
  const chapters = [...new Set(selectedChapters.map(asChapterNumber))];
  const pools = new Map(chapters.map((chapter) => [chapter, questionBank.filter((question) => Number(question.chapter) === chapter)]));
  const capacities = Object.fromEntries(chapters.map((chapter) => [chapter, pools.get(chapter).length]));
  const allocation = calculateBalancedAllocation(chapters, count, capacities, random);
  const nextHistory = cloneHistory(history);
  const selected = [];

  for (const [chapterText, needed] of Object.entries(allocation)) {
    const chapter = Number(chapterText);
    const pool = pools.get(chapter) ?? [];
    const chosen = pickChapterQuestions(pool, needed, nextHistory[chapter] ?? [], random);
    nextHistory[chapter] = [...new Set([...(nextHistory[chapter] ?? []), ...chosen.map((question) => question.id)])];
    selected.push(...chosen);
  }

  return {
    questions: shuffle(selected, random),
    allocation,
    history: nextHistory,
  };
}

export function resetQuestionHistory() {
  return {};
}
