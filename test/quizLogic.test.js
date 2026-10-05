import test from "node:test";
import assert from "node:assert/strict";
import { midtermCaseStudyBank } from "../questions.js";
import { calculateBalancedAllocation, calculateDifficultyAllocation, resetQuestionHistory, selectBalancedQuestions } from "../quizLogic.js";

const allChapters = Array.from({ length: 15 }, (_, index) => index + 1);

function makeBank(questionsPerChapter = 40) {
  return allChapters.flatMap((chapter) => Array.from({ length: questionsPerChapter }, (_, index) => ({
    id: `ch${String(chapter).padStart(2, "0")}-q${String(index + 1).padStart(3, "0")}`,
    chapter,
    options: [],
  })));
}

function chapterCounts(questions) {
  return questions.reduce((counts, question) => {
    counts[question.chapter] = (counts[question.chapter] ?? 0) + 1;
    return counts;
  }, {});
}

const bank600 = makeBank(40);

test("midterm special bank contains 300 application-focused case-study questions", () => {
  const midtermChapters = [1, 2, 3, 4, 6, 8, 9, 12];
  assert.equal(midtermCaseStudyBank.length, 300);
  assert.ok(midtermCaseStudyBank.every((question) => question.caseStudy === true));
  assert.ok(midtermCaseStudyBank.every((question) => question.options.length === 4));
  assert.ok(midtermCaseStudyBank.every((question) => !/which chapter concept|which chapter does/i.test(question.prompt)));
  assert.deepEqual(
    Object.fromEntries(["easy", "normal", "hard"].map((difficulty) => [difficulty, midtermCaseStudyBank.filter((question) => question.difficulty === difficulty).length])),
    { easy: 45, normal: 180, hard: 75 },
  );
  assert.deepEqual(
    Object.fromEntries(midtermChapters.map((chapter) => [chapter, midtermCaseStudyBank.filter((question) => question.chapter === chapter).length])),
    Object.fromEntries([1, 2, 3, 4].map((chapter) => [chapter, 38]).concat([6, 8, 9, 12].map((chapter) => [chapter, 37]))),
  );
});

test("difficulty-aware selection targets the 15/60/25 midterm mix", () => {
  const result = selectBalancedQuestions({
    questionBank: midtermCaseStudyBank,
    selectedChapters: [1, 2, 3, 4, 6, 8, 9, 12],
    count: 30,
    difficultyMix: { easy: 0.15, normal: 0.6, hard: 0.25 },
    random: () => 0.37,
  });
  assert.deepEqual(result.difficultyAllocation, { easy: 5, normal: 18, hard: 7 });
  assert.equal(result.questions.length, 30);
  assert.equal(new Set(result.questions.map((question) => question.id)).size, 30);
  assert.deepEqual(
    Object.fromEntries(["easy", "normal", "hard"].map((difficulty) => [difficulty, result.questions.filter((question) => question.difficulty === difficulty).length])),
    { easy: 5, normal: 18, hard: 7 },
  );
  assert.deepEqual(Object.values(result.allocation).sort((a, b) => a - b), [3, 3, 4, 4, 4, 4, 4, 4]);
});

test("difficulty allocation rounds short quizzes to an exact count", () => {
  assert.deepEqual(calculateDifficultyAllocation(10, { easy: 0.15, normal: 0.6, hard: 0.25 }), { easy: 2, normal: 6, hard: 2 });
});

test("30 questions across all 15 chapters gives exactly 2 per chapter", () => {
  const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: allChapters, count: 30, random: () => 0.37 });
  assert.equal(result.questions.length, 30);
  assert.deepEqual(Object.values(result.allocation), Array(15).fill(2));
  assert.deepEqual(Object.values(chapterCounts(result.questions)), Array(15).fill(2));
});

test("30 questions across 3 chapters gives exactly 10 per chapter", () => {
  const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: [1, 7, 15], count: 30, random: () => 0.37 });
  assert.equal(result.questions.length, 30);
  assert.deepEqual(Object.values(result.allocation), [10, 10, 10]);
  assert.deepEqual(Object.values(chapterCounts(result.questions)), [10, 10, 10]);
});

test("20 questions across 4 chapters gives exactly 5 per chapter", () => {
  const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: [2, 4, 6, 8], count: 20, random: () => 0.37 });
  assert.equal(result.questions.length, 20);
  assert.deepEqual(Object.values(result.allocation), [5, 5, 5, 5]);
  assert.deepEqual(Object.values(chapterCounts(result.questions)), [5, 5, 5, 5]);
});

test("uneven 20-question allocation across 3 chapters is 6, 7, and 7 in random order", () => {
  const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: [1, 2, 3], count: 20, random: () => 0.37 });
  assert.equal(result.questions.length, 20);
  assert.deepEqual(Object.values(result.allocation).sort((a, b) => a - b), [6, 7, 7]);
  assert.deepEqual(Object.values(chapterCounts(result.questions)).sort((a, b) => a - b), [6, 7, 7]);

  const earlyExtras = calculateBalancedAllocation([1, 2, 3], 20, undefined, () => 0.01);
  const lateExtras = calculateBalancedAllocation([1, 2, 3], 20, undefined, () => 0.99);
  assert.notDeepEqual(earlyExtras, lateExtras);
});

test("10 questions across all 15 chapters randomly represents 10 different chapters", () => {
  const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: allChapters, count: 10, random: () => 0.37 });
  assert.equal(result.questions.length, 10);
  assert.equal(new Set(result.questions.map((question) => question.chapter)).size, 10);
  assert.deepEqual(Object.values(result.allocation).sort((a, b) => a - b), Array(10).fill(1));
});

test("one selected chapter supplies every requested question", () => {
  const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: [3], count: 10, random: () => 0.37 });
  assert.equal(result.questions.length, 10);
  assert.deepEqual([...new Set(result.questions.map((question) => question.chapter))], [3]);
  assert.equal(new Set(result.questions.map((question) => question.id)).size, 10);
});

test("unseen history is exhausted before questions repeat", () => {
  let history = {};
  const quizzes = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: [3], count: 10, history, random: () => 0.37 });
    quizzes.push(result.questions.map((question) => question.id));
    history = result.history;
  }
  assert.equal(new Set(quizzes.slice(0, 4).flat()).size, 40);
  assert.equal(new Set(quizzes[4]).size, 10);
  assert.equal(new Set(quizzes.flat()).size, 40);
});

test("question-history reset starts selection over cleanly", () => {
  const first = selectBalancedQuestions({ questionBank: bank600, selectedChapters: [3], count: 10, random: () => 0.37 });
  const reset = resetQuestionHistory();
  const afterReset = selectBalancedQuestions({ questionBank: bank600, selectedChapters: [3], count: 10, history: reset, random: () => 0.37 });
  assert.deepEqual(reset, {});
  assert.deepEqual(first.questions.map((question) => question.id), afterReset.questions.map((question) => question.id));
});

test("a 600-question bank remains compatible and always returns the exact requested count", () => {
  assert.equal(bank600.length, 600);
  for (const count of [10, 20, 30, 50, 100]) {
    const result = selectBalancedQuestions({ questionBank: bank600, selectedChapters: allChapters, count, random: () => 0.37 });
    assert.equal(result.questions.length, count);
    assert.equal(new Set(result.questions.map((question) => question.id)).size, count);
  }
});
