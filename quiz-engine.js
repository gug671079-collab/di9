"use strict";

(() => {
  const content = typeof module !== "undefined" && module.exports
    ? require("./quiz-content.js") : window.CloudQuizContent;
  const modules = content.modules.map(({id, label, dimensions}) => ({
    id, label, axes: dimensions.map(dimension => dimension.id)
  }));
  const axes = Object.fromEntries(content.modules.flatMap(module =>
    module.dimensions.map(({id, label, questionIds}) =>
      [id, {label, module: module.id, questionCount: questionIds.length}])
  ));
  const axisKeys = modules.flatMap(module => module.axes);
  const ranks = {low: 0, mid: 1, high: 2};
  const tierLabels = {low: "低", mid: "中", high: "高"};

  // Keep the original authoring IDs across revisions, even for unfinished questions.
  const slots = content.modules.flatMap(module =>
    module.dimensions.flatMap(axis => axis.questionIds.map(id => ({id, axis: axis.id, module: module.id})))
  ).sort((a, b) => a.id.localeCompare(b.id));
  const main = slots.map(slot => {
    const row = content.questions.find(item => item.id === slot.id);
    const options = [0, 1, 2].map(i => typeof row?.options?.[i] === "string" ? row.options[i] : "");
    const scoresValid = row?.scores?.length === 3 && [1, 2, 3].every(n => row.scores.includes(n));
    return {
      ...slot, text: typeof row?.text === "string" ? row.text : "", options,
      scores: scoresValid ? [...row.scores] : [1, 2, 3],
      configured: row?.axis === slot.axis && row.options?.length === 3 && scoresValid
    };
  });
  const schools = content.schools;
  function nonblank(value) {
    return typeof value === "string" && value.trim().length > 0;
  }
  const questionsReady = content.questions.length === main.length && main.every(q =>
    q.configured && nonblank(q.text) && q.options.every(nonblank) && new Set(q.options.map(o => o.trim())).size === 3);
  const schoolIDs = new Set();
  const patterns = new Set();
  const schoolsReady = schools.length > 0 && schools.every(school => {
    if (!nonblank(school.id) || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(school.id) ||
        !nonblank(school.title) || !nonblank(school.reason) ||
        !axisKeys.every(axis => Object.hasOwn(ranks, school.levels?.[axis]))) return false;
    const pattern = axisKeys.map(axis => ranks[school.levels[axis]]).join("");
    if (schoolIDs.has(school.id) || patterns.has(pattern)) return false;
    schoolIDs.add(school.id);
    patterns.add(pattern);
    return true;
  });
  const ready = questionsReady && schoolsReady && !content.previewOnly;

  function closestSchool(levels) {
    let closest = null, bestDistance = Infinity, mostExact = -1;
    for (const school of schools) {
      let distance = 0, exact = 0;
      for (const axis of axisKeys) {
        const difference = Math.abs(ranks[levels[axis]] - ranks[school.levels[axis]]);
        distance += difference;
        if (difference === 0) exact++;
      }
      // Retaining the earlier row is the last tie-breaker.
      if (distance < bestDistance || (distance === bestDistance && exact > mostExact)) {
        closest = school;
        bestDistance = distance;
        mostExact = exact;
      }
    }
    return closest;
  }

  function getState(answers = []) {
    if (!Array.isArray(answers) || Array.from(answers).some(value =>
      !Number.isInteger(value) || value < 0 || value > 2)) {
      throw new TypeError("答案必须是 0、1、2 中的选项编号。");
    }
    if (answers.length > main.length) throw new RangeError("答案超过本轮题数。");
    const scores = Object.fromEntries(axisKeys.map(axis => [axis, 0]));
    const levels = Object.fromEntries(axisKeys.map(axis => [axis, null]));
    const answeredPerAxis = Object.fromEntries(axisKeys.map(axis => [axis, 0]));
    answers.forEach((choice, index) => {
      const q = main[index];
      scores[q.axis] += q.scores[choice];
      const count = axes[q.axis].questionCount;
      if (++answeredPerAxis[q.axis] === count) {
        const sum = scores[q.axis];
        const midpoint = count * 2;
        levels[q.axis] = sum < midpoint ? "low" : sum === midpoint ? "mid" : "high";
      }
    });
    const nextQuestion = main[answers.length] || null;
    let result = null;
    if (!nextQuestion) {
      const school = ready ? closestSchool(levels) : null;
      const traits = school ? axisKeys.map(axis => axes[axis].label + " · " + tierLabels[levels[axis]]) : [];
      result = {id: school?.id ?? null, title: school?.title ?? "", reason: school?.reason ?? "", scores, levels, traits};
    }
    return {nextQuestion, completed: !nextQuestion, result, totalQuestions: main.length, scores, levels};
  }

  // Invalidate progress even when an editor adjusts a single option directly in JS.
  let hash = 2166136261;
  for (const character of JSON.stringify([content.modules, content.questions, schools])) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  const revision = "schools-v1-" + (hash >>> 0).toString(16).padStart(8, "0");
  const api = {modules, axes, main, schools, getState, ready, revision, readiness: {questionsReady, schoolsReady}};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.CloudQuiz = api;
})();

