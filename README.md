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

The setup screen supports selecting any combination of the 15 chapters. The selector allocates questions as evenly as possible across the selected chapters; when the count is smaller than the number of selected chapters, it randomly chooses which chapters are represented. The remainder in an uneven allocation is also random. **MID TERM SPECIAL** is a separate mode with 200 scenario-based questions: 25 each from Chapters 1, 2, 3, 4, 6, 8, 9, and 12.

The app stores per-chapter encountered-question IDs in `localStorage` so new sessions prefer questions that have not appeared recently. An active quiz session is also saved in `localStorage` after each answer selection, submission, and question change, so refreshing or reopening the same browser can resume the exact question, score, feedback state, and selected chapters. This is device/browser-local only; clearing site data or using another browser/device will not carry the session over. The quiz screen includes **Exit & discard** for intentionally abandoning a saved session, and the setup screen includes **Reset question history**.

The pure balancing and selection rules are in [`quizLogic.js`](./quizLogic.js), with automated coverage in [`test/quizLogic.test.js`](./test/quizLogic.test.js). The tests use a synthetic 600-question bank to verify compatibility with 40 questions per chapter.
