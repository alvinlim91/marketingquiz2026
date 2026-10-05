import test from "node:test";
import assert from "node:assert/strict";
import { midtermCaseStudyBank } from "../questions.js";
import { calculateBalancedAllocation, resetQuestionHistory, selectBalancedQuestions } from "../quizLogic.js";

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

test("midterm special bank contains 25 case-study questions for each covered chapter", () => {
  const midtermChapters = [1, 2, 3, 4, 6, 8, 9, 12];
  assert.equal(midtermCaseStudyBank.length, 200);
  assert.ok(midtermCaseStudyBank.every((question) => question.caseStudy === true));
  assert.deepEqual(
    Object.fromEntries(midtermChapters.map((chapter) => [chapter, midtermCaseStudyBank.filter((question) => question.chapter === chapter).length])),
    Object.fromEntries(midtermChapters.map((chapter) => [chapter, 25])),
  );
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
