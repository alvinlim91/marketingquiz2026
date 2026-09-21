# Marketing MCQ Practice

This is a dependency-free local study app based only on **The Modern Marketing Playbook** by Doreen Kum and Howie Lau.

## Run locally

The bundled runtime is enough; no install step is required:

```bash
node server.mjs
```

Then open <http://localhost:3000>.

## Question bank

Questions live separately from the UI in [`questions.js`](./questions.js). The exported `questionBank` uses this schema:

```js
{
  id: "ch03-q001",
  chapter: 3,
  page: "46–47", // printed textbook page, not PDF page
  prompt: "...",
  options: [
    { id: "a", text: "...", explanation: "..." },
    { id: "b", text: "...", explanation: "..." },
    { id: "c", text: "...", explanation: "..." },
    { id: "d", text: "...", explanation: "..." }
  ],
  correctId: "b"
}
```

When adding a question, verify the printed page number inside the PDF first. Keep the correct answer as a stable option ID; the UI randomizes option order safely at quiz start.

The setup screen supports selecting any combination of the 15 chapters. The selector allocates questions as evenly as possible across the selected chapters; when the count is smaller than the number of selected chapters, it randomly chooses which chapters are represented. The remainder in an uneven allocation is also random.

The app stores per-chapter encountered-question IDs in `localStorage` so new sessions prefer questions that have not appeared recently. The setup screen includes **Reset question history**. The history is only a repetition aid and is safe to clear from the browser if needed.

The pure balancing and selection rules are in [`quizLogic.js`](./quizLogic.js), with automated coverage in [`test/quizLogic.test.js`](./test/quizLogic.test.js). The tests use a synthetic 600-question bank to verify compatibility with 40 questions per chapter.
