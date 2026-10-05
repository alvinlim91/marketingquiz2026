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

const DIFFICULTIES = ["easy", "normal", "hard"];

function chooseHighest(candidates, score, random) {
  return shuffle(candidates, random).sort((left, right) => score(right) - score(left))[0];
}

function difficultyCapacityFor(difficulty, capacities) {
  if (!capacities) return Number.POSITIVE_INFINITY;
  const value = capacities[difficulty];
  return value === undefined ? Number.POSITIVE_INFINITY : Number(value);
}

/**
 * Allocate an exact question count across difficulty levels using weighted
 * targets, while respecting optional per-level capacities.
 */
export function calculateDifficultyAllocation(questionCount, difficultyMix, capacities, random = Math.random) {
  const requested = Number(questionCount);
  if (!Number.isInteger(requested) || requested < 1) throw new Error("Question count must be a positive integer.");
  const weights = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, Number(difficultyMix?.[difficulty] ?? 0)]));
  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (weightTotal <= 0 || Object.values(weights).some((value) => value < 0)) throw new Error("Difficulty weights must contain at least one non-negative value.");
  const totalCapacity = DIFFICULTIES.reduce((sum, difficulty) => sum + difficultyCapacityFor(difficulty, capacities), 0);
  if (requested > totalCapacity) throw new Error(`Only ${totalCapacity} unique questions are available across the difficulty levels.`);

  const raw = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, requested * weights[difficulty] / weightTotal]));
  const allocation = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, Math.min(Math.floor(raw[difficulty]), difficultyCapacityFor(difficulty, capacities))]));
  let remaining = requested - Object.values(allocation).reduce((sum, value) => sum + value, 0);
  while (remaining > 0) {
    const candidates = DIFFICULTIES.filter((difficulty) => allocation[difficulty] < difficultyCapacityFor(difficulty, capacities));
    if (!candidates.length) throw new Error("The difficulty levels cannot satisfy this question count.");
    const difficulty = [...candidates].sort((left, right) => {
      const scoreDifference = (raw[right] - allocation[right]) - (raw[left] - allocation[left]);
      return scoreDifference || DIFFICULTIES.indexOf(left) - DIFFICULTIES.indexOf(right);
    })[0];
    allocation[difficulty] += 1;
    remaining -= 1;
  }
  return allocation;
}

function allocateDifficultyMatrix(chapterAllocation, difficultyAllocation, pools, random) {
  const chapters = Object.keys(chapterAllocation).map(Number);
  const total = chapters.reduce((sum, chapter) => sum + chapterAllocation[chapter], 0);
  const matrix = {};
  const capacities = {};
  const columnTotals = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, 0]));

  for (const chapter of chapters) {
    const pool = pools.get(chapter) ?? [];
    capacities[chapter] = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, pool.filter((question) => question.difficulty === difficulty).length]));
    matrix[chapter] = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, 0]));
    let remaining = chapterAllocation[chapter];

    for (const difficulty of DIFFICULTIES) {
      const desired = Math.floor(chapterAllocation[chapter] * difficultyAllocation[difficulty] / total);
      const amount = Math.min(desired, capacities[chapter][difficulty]);
      matrix[chapter][difficulty] = amount;
      columnTotals[difficulty] += amount;
      remaining -= amount;
    }

    while (remaining > 0) {
      const candidates = DIFFICULTIES.filter((difficulty) => matrix[chapter][difficulty] < capacities[chapter][difficulty]);
      if (!candidates.length) throw new Error(`Chapter ${chapter} cannot satisfy its difficulty allocation.`);
      const difficulty = chooseHighest(candidates, (candidate) => difficultyAllocation[candidate] - columnTotals[candidate], random);
      matrix[chapter][difficulty] += 1;
      columnTotals[difficulty] += 1;
      remaining -= 1;
    }
  }

  // Repair column totals after row allocation while keeping every chapter's
  // balanced quota intact. If a selected subset cannot meet the ideal mix,
  // the closest capacity-constrained mix is returned instead of failing.
  while (true) {
    const over = DIFFICULTIES.find((difficulty) => columnTotals[difficulty] > difficultyAllocation[difficulty]);
    const under = DIFFICULTIES.find((difficulty) => columnTotals[difficulty] < difficultyAllocation[difficulty]);
    if (!over || !under) break;
    const candidates = chapters.filter((chapter) => (
      matrix[chapter][over] > 0
      && matrix[chapter][under] < capacities[chapter][under]
    ));
    if (!candidates.length) break;
    const chapter = chooseHighest(candidates, (candidate) => capacities[candidate][under] - matrix[candidate][under], random);
    matrix[chapter][over] -= 1;
    matrix[chapter][under] += 1;
    columnTotals[over] -= 1;
    columnTotals[under] += 1;
  }

  return { matrix, allocation: columnTotals };
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
export function selectBalancedQuestions({ questionBank, selectedChapters, count, history = {}, random = Math.random, difficultyMix = null }) {
  const chapters = [...new Set(selectedChapters.map(asChapterNumber))];
  const pools = new Map(chapters.map((chapter) => [chapter, questionBank.filter((question) => Number(question.chapter) === chapter)]));
  const capacities = Object.fromEntries(chapters.map((chapter) => [chapter, pools.get(chapter).length]));
  const allocation = calculateBalancedAllocation(chapters, count, capacities, random);
  let difficultyMatrix = null;
  let difficultyAllocation = null;
  if (difficultyMix) {
    const difficultyCapacities = Object.fromEntries(DIFFICULTIES.map((difficulty) => [
      difficulty,
      chapters.reduce((total, chapter) => total + (pools.get(chapter) ?? []).filter((question) => question.difficulty === difficulty).length, 0),
    ]));
    const targetDifficultyAllocation = calculateDifficultyAllocation(count, difficultyMix, difficultyCapacities, random);
    const matrixResult = allocateDifficultyMatrix(allocation, targetDifficultyAllocation, pools, random);
    difficultyMatrix = matrixResult.matrix;
    difficultyAllocation = matrixResult.allocation;
  }
  const nextHistory = cloneHistory(history);
  const selected = [];

  for (const [chapterText, needed] of Object.entries(allocation)) {
    const chapter = Number(chapterText);
    const pool = pools.get(chapter) ?? [];
    if (!difficultyMatrix) {
      const chosen = pickChapterQuestions(pool, needed, nextHistory[chapter] ?? [], random);
      nextHistory[chapter] = [...new Set([...(nextHistory[chapter] ?? []), ...chosen.map((question) => question.id)])];
      selected.push(...chosen);
      continue;
    }
    for (const difficulty of DIFFICULTIES) {
      const difficultyPool = pool.filter((question) => question.difficulty === difficulty);
      const chosen = pickChapterQuestions(difficultyPool, difficultyMatrix[chapter][difficulty], nextHistory[chapter] ?? [], random);
      nextHistory[chapter] = [...new Set([...(nextHistory[chapter] ?? []), ...chosen.map((question) => question.id)])];
      selected.push(...chosen);
    }
  }

  return {
    questions: shuffle(selected, random),
    allocation,
    difficultyAllocation,
    history: nextHistory,
  };
}

export function resetQuestionHistory() {
  return {};
}
