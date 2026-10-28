"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitQuiz, type QuizResult } from "@/app/actions";

const L = {
  submit: { en: "Submit answers", es: "Enviar respuestas" },
  score: { en: "Your score", es: "Su calificación" },
  passed: { en: "You passed!", es: "¡Aprobó!" },
  notYet: { en: "Not quite yet", es: "Todavía no" },
  needed: { en: "needed to pass", es: "necesario para aprobar" },
  again: { en: "Try again", es: "Intentar de nuevo" },
  complete: { en: "Course complete! It's on your transcript.", es: "¡Curso completado! Ya está en su historial." },
  back: { en: "Back to course", es: "Volver al curso" },
  next: { en: "Continue", es: "Continuar" },
  answerAll: { en: "Answer every question to submit.", es: "Responda todas las preguntas para enviar." },
  correct: { en: "Correct", es: "Correcto" },
  incorrect: { en: "Not correct", es: "Incorrecto" },
};

export function QuizRunner({ lessonId, lang, questions, courseHref, nextHref }: {
  lessonId: string; lang: "en" | "es"; questions: { id: string; prompt: string; options: string[] }[]; courseHref: string; nextHref: string;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = answers.every((a) => a !== null);

  return (
    <div>
      <ol className="space-y-6">
        {questions.map((q, qi) => {
          const r = result?.results[qi];
          return (
            <li key={q.id}>
              <fieldset disabled={!!result}>
                <legend className="mb-2 font-semibold">{qi + 1}. {q.prompt}</legend>
                <div className="space-y-2">
                  {q.options.map((o, oi) => {
                    const chosen = answers[qi] === oi + 1;
                    const isRight = r && r.correct_index === oi + 1;
                    return (
                      <label key={oi} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                        r ? (isRight ? "border-green bg-green-soft" : chosen ? "border-coral bg-coral-soft" : "border-line") : chosen ? "border-teal bg-teal-soft" : "border-line hover:border-teal"}`}>
                        <input type="radio" name={q.id} className="h-5 w-5 accent-[#0f5c5f]" checked={chosen}
                          onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi + 1 : v)))} />
                        <span>{o}</span>
                      </label>
                    );
                  })}
                </div>
                {r && (
                  <p className={`mt-2 text-sm ${r.correct ? "text-green" : "text-coral"}`}>
                    <strong>{r.correct ? L.correct[lang] : L.incorrect[lang]}.</strong> {r.explanation}
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-4 text-sm text-coral">{error}</p>}

      {!result ? (
        <div className="mt-8 border-t border-line pt-5">
          <button disabled={!all || pending} className="btn-primary w-full sm:w-auto"
            onClick={() => start(async () => {
              const r = await submitQuiz(lessonId, answers as number[], lang);
              if (r.error) setError(r.error); else if (r.result) setResult(r.result);
            })}>
            {pending ? "…" : L.submit[lang]}
          </button>
          {!all && <p className="mt-2 text-sm text-muted">{L.answerAll[lang]}</p>}
        </div>
      ) : (
        <div className={`mt-8 rounded-2xl p-5 ${result.passed ? "bg-green-soft" : "bg-amber-soft"}`} role="status">
          <p className="text-sm font-semibold text-muted">{L.score[lang]}</p>
          <p className="text-3xl font-bold">{result.score}%</p>
          <p className={`font-semibold ${result.passed ? "text-green" : "text-amber"}`}>
            {result.passed ? L.passed[lang] : `${L.notYet[lang]} · ${result.pass_percent}% ${L.needed[lang]}`}
          </p>
          {result.course_complete && <p className="mt-2 font-semibold text-green">🎉 {L.complete[lang]}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {result.passed ? (
              <Link href={result.course_complete ? courseHref : nextHref} className="btn-primary">{result.course_complete ? L.back[lang] : L.next[lang]}</Link>
            ) : (
              <button className="btn-primary" onClick={() => { setResult(null); setAnswers(questions.map(() => null)); }}>{L.again[lang]}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
