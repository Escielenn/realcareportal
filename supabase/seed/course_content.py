"""Parse Real Care's course scripts (content/courses/*.md) into lessons and quiz questions.

Quiz files: numbered questions, lettered options ("A)" or "A."), then an "Answer Key"
(or "Clave de Respuestas") listing "B — explanation" per question, or a "1  B" table.
"""
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "content", "courses")


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def parse_quiz(name):
    text = read(name)
    m = re.search(r"^(Answer Key|Clave de Respuestas?)\s*$", text, re.M | re.I)
    body, key = (text[: m.start()], text[m.end():]) if m else (text, "")
    questions = []
    for block in re.split(r"(?m)^(?=\d+\.\s)", body):
        qm = re.match(r"(\d+)\.\s+(.*?)\n(.*)", block, re.S)
        if not qm:
            continue
        prompt = qm.group(2).strip()
        opts = re.findall(r"(?m)^([A-D])[\).]\s+(.+?)\s*$", qm.group(3))
        if len(opts) < 2:
            continue
        questions.append({"prompt": prompt, "options": [o[1] for o in opts], "letters": [o[0] for o in opts]})
    answers = re.findall(r"(?m)^([A-D])\s+[—–-]\s+(.+?)\s*$", key)
    if not answers:  # table form: "1<TAB>B"
        answers = [(a, "") for _, a in re.findall(r"(?m)^(\d+)\s+([A-D])\s*$", key)]
    if len(answers) != len(questions):
        raise ValueError(f"{name}: {len(questions)} questions but {len(answers)} answers")
    out = []
    for q, (letter, expl) in zip(questions, answers):
        idx = q["letters"].index(letter)
        answer_text = q["options"][idx]
        explanation = expl if expl and expl.strip() != answer_text.strip() else ""
        out.append((q["prompt"], q["options"], idx, explanation))
    return out


def transcript(name):
    """Voiceover script as lesson Markdown: drop the title block and read-time line, keep paragraphs."""
    lines = read(name).splitlines()
    keep, started = [], False
    for ln in lines:
        s = ln.strip()
        if not started:
            # skip title, "Voiceover Script", "Covers Units", "Real Care, Inc.", "Estimated Read Time"
            if not s or re.match(r"(Real Care, Inc\.|QMAP|Voiceover|Guion|Covers Units|Cubre|Estimated|Tiempo estimado)", s, re.I) or len(s) < 60:
                continue
            started = True
        keep.append(s)
    md = "\n".join(keep)
    return re.sub(r"\n{3,}", "\n\n", md).strip()


def pair(en_name, es_name):
    en, es = parse_quiz(en_name), parse_quiz(es_name)
    if len(en) != len(es):
        raise ValueError(f"{en_name}/{es_name} lengths differ")
    for i, (a, b) in enumerate(zip(en, es)):
        if a[2] != b[2]:
            raise ValueError(f"{en_name} q{i+1}: answer differs between languages")
    return [(a[0], b[0], a[1], b[1], a[2], a[3], b[3]) for a, b in zip(en, es)]


if __name__ == "__main__":
    for p in ["01-Employee-Orientation", "02-Documentation-Compliance", "03-Respite-Training", "04-Injection-Admin"]:
        qs = pair(f"{p}-Quiz-EN.md", f"{p}-Quiz-ES.md")
        t = transcript(f"{p}-Voiceover-EN.md")
        print(p, len(qs), "questions; transcript", len(t), "chars;", t[:70].replace("\n", " "))
    for n in (1, 2, 3):
        qs = parse_quiz(f"qmap-{n}-quiz-en.md")
        print("qmap", n, len(qs), [q[2] for q in qs])
    for n in (2, 3):
        print("qmap vo", n, transcript(f"qmap-{n}-voiceover-en.md")[:80].replace("\n", " "))
