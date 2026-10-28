#!/usr/bin/env python3
"""Convert Gravity Forms JSON exports (form definitions only, never entries) into portal form definitions.

Usage: python3 scripts/convert_gravity_forms.py
Reads content/gravity-forms/*.json, writes content/forms/<slug>.json and docs/forms-conversion-report.md.

Mapping (Phase 2, T206):
- section and page breaks start a new portal section
- text/phone/textarea/number/date/time/select/radio/checkbox/fileupload map one to one
  (number with currency format -> currency; "Signature" text -> signature)
- list fields -> repeater, or a month grid when the first column is the day and the others are Y/N style codes
- html: instruction blocks -> collapsible instructions; short notes -> info blocks;
  headers and scripts dropped; script-driven grids replaced by native fields from WIDGETS below
- visibility "hidden" fields are dropped (they held raw JSON for the old JS grids);
  "administrative" fields are dropped from the provider form and listed in the report as staff-only
- conditional logic -> show_if rules
Everything English-only is copied to the Spanish label and listed in the report as needing translation.
"""
import html as htmllib
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "content", "gravity-forms")
OUT = os.path.join(ROOT, "content", "forms")

# Which export becomes which portal form (newest version of each, matching PHASE-2 T207's list).
TITLES = {
    "real-care-log-notes": "Real Care Log Notes", "weekly-log-notes": "Weekly Log Notes", "dsp-timesheet": "DSP/SCC Provider Timesheet",
    "scc-log-notes": "SCC Log Notes", "residential-tracking": "Residential Tracking Record", "medicaid-attendance": "Medicaid Residential Attendance Record",
    "incident-report-full": "Incident Report (full)", "standard-goal-tracking": "Standard Goal Tracking", "nmt-trips": "NMT Trips Tracking",
    "menu-tracking": "Menu Tracking", "fire-disaster-drill": "Fire / Disaster Drill / Safety Plan", "community-account-record": "Community Account Record",
}
# Text fields that hold the person's name on forms where the label is just "Name".
PREFILL_NAME = {("COMMUNITY-ACCOUNT-RECORD_currency-logic_gravityforms-export.json", 1)}
# Lists whose day-by-day columns are answered with these codes (from the form's own note: "Y = Yes, N = No, R = Refused").
DAY_CODES = {"RESIDENTIAL-TRACKING_Grid-List_autoadd_gravityforms-export.json": ["Y", "N", "R"]}

FORMS = [
    # slug, file, title_es, category, per_individual, self_start
    ("real-care-log-notes", "REAL-CARE-INC-LOG-NOTES_gravityforms-export.json", "Notas de registro de Real Care", "daily", True, True),
    ("weekly-log-notes", "WEEKLY-LOG-NOTES_three-page_gravityforms-export.json", "Notas de registro semanales", "daily", True, False),
    ("dsp-timesheet", "dsp_timesheet_json.json", "Hoja de horas DSP/SCC", "timesheet", False, False),
    ("scc-log-notes", "scc_log_notes_json.json", "Notas de registro SCC", "daily", True, True),
    ("residential-tracking", "RESIDENTIAL-TRACKING_Grid-List_autoadd_gravityforms-export.json", "Registro de seguimiento residencial", "monthly", True, False),
    ("medicaid-attendance", "medicaid_attendance_gf.json", "Registro de asistencia residencial de Medicaid", "monthly", True, False),
    ("incident-report-full", "INCIDENT-REPORT_gravityforms-export.json", "Informe de incidente (completo)", "incident", True, True),
    ("standard-goal-tracking", "goal_tracking_gf_json.json", "Seguimiento estándar de metas", "daily", True, False),
    ("nmt-trips", "gravityforms-export-2025-12-04.json", "Registro de viajes NMT", "monthly", True, False),
    ("menu-tracking", "menu_tracking_json.json", "Registro de menú", "monthly", True, False),
    ("fire-disaster-drill", "FIRE-DISASTER-SAFETY_gravityforms-export.json", "Simulacro de incendio y desastre / Plan de seguridad", "safety", False, False),
    ("community-account-record", "COMMUNITY-ACCOUNT-RECORD_currency-logic_gravityforms-export.json", "Registro de cuenta comunitaria", "monthly", True, False),
]
SKIPPED = {
    "ATTENDANCE-RECORD_gravityforms-export.json": "Older version of the Medicaid Residential Attendance Record (Dec 2025 export used).",
    "RESIDENTIAL-TRACKING-FORM_full-month_gravityforms-export.json": "Superseded by the Grid List version (1,342 fields; the grid version covers the same month in 21).",
    "SCC-LOG-NOTES-ONLY_gravityforms-export.json": "Older version of SCC Log Notes (Dec 2025 export used).",
    "SCC-TIMESHEETS-ONLY_gravityforms-export.json": "Older version of the DSP/SCC timesheet (Dec 2025 export used).",
    "MENU-TRACKING_gravityforms-export.json": "Older version of Menu Tracking (Dec 2025 export used).",
}

YN = [{"value": "Y", "en": "Yes", "es": "Sí"}, {"value": "N", "en": "No", "es": "No"}]
RES_CODES = [
    {"value": "E", "en": "Enrollment / admission date", "es": "Fecha de inscripción / admisión"},
    {"value": "X", "en": "Client in residence", "es": "Cliente en la residencia"},
    {"value": "H", "en": "Hospital day / nursing home", "es": "Día de hospital / asilo"},
    {"value": "R", "en": "Respite", "es": "Relevo"},
    {"value": "V", "en": "Visit to family, friends or special program", "es": "Visita a familia, amigos o programa especial"},
    {"value": "I", "en": "Ineligible day", "es": "Día no elegible"},
    {"value": "T", "en": "Termination / discharge date", "es": "Fecha de terminación / alta"},
    {"value": "VT", "en": "Visit with transportation", "es": "Visita con transporte"},
    {"value": "J", "en": "Jail", "es": "Cárcel"},
]


def col(cid, typ, en, es=None, **kw):
    d = {"id": cid, "type": typ, "label_en": en, "label_es": es or en}
    d.update(kw)
    return d


# Script-driven HTML grids from the old intranet, rebuilt as native portal fields.
# Key: (export file, html field id) -> list of portal fields. Also lists GF field ids the widget replaces.
WIDGETS = {
    ("dsp_timesheet_json.json", 5): ([{
        "id": "entries", "type": "repeater", "label_en": "Direct care service entries", "label_es": "Servicios de atención directa",
        "required": True, "help_en": "One row per visit or shift. Hours calculate from Time In and Time Out.",
        "help_es": "Una fila por visita o turno. Las horas se calculan con la hora de entrada y salida.",
        "columns": [
            col("date", "date", "Date", "Fecha"), col("initials", "text", "Client initials", "Iniciales del cliente"),
            col("service", "select", "Service type", "Tipo de servicio", options=[{"value": v, "en": v, "es": v} for v in ["PRS", "DSP", "SCC", "MSP", "Other"]]),
            col("in", "time", "Time in", "Entrada"), col("out", "time", "Time out", "Salida"),
            col("hours", "hours", "Total hours", "Horas", **{"from": ["in", "out"]}), col("trips", "number", "# of trips", "Viajes"),
        ],
        "totals": ["hours", "trips"],
    }], [6, 7]),
    ("medicaid_attendance_gf.json", 8): ([{
        "id": "residential_days", "type": "daygrid", "label_en": "Residential services by day", "label_es": "Servicios residenciales por día",
        "cell": "code", "codes": RES_CODES, "rows": [{"id": "res", "en": "Residential", "es": "Residencial"}],
        "help_en": "Choose X for each day the person was in residence, or one of the special codes.",
        "help_es": "Elija X para cada día que la persona estuvo en la residencia, o uno de los códigos especiales.",
    }], [11]),
    ("medicaid_attendance_gf.json", 9): ([], []),  # the codes legend is built into the grid above
    ("medicaid_attendance_gf.json", 12): ([{
        "id": "transport_days", "type": "daygrid", "label_en": "Transportation trips (approved NMT providers only)", "label_es": "Viajes de transporte (solo proveedores NMT aprobados)",
        "cell": "check", "rows": [{"id": "am", "en": "AM trip", "es": "Viaje de la mañana"}, {"id": "pm", "en": "PM trip", "es": "Viaje de la tarde"}],
        "help_en": "Maximum 2 trips per day (one there, one back).", "help_es": "Máximo 2 viajes por día (ida y vuelta).",
    }], [13]),
    ("gravityforms-export-2025-12-04.json", 100): ([{
        "id": "trips", "type": "daygrid", "label_en": "Trips by day", "label_es": "Viajes por día", "cell": "check", "required": True,
        "rows": [{"id": "am", "en": "AM trip provided", "es": "Viaje de la mañana"}, {"id": "pm", "en": "PM trip provided", "es": "Viaje de la tarde"}],
    }], [25]),
    ("gravityforms-export-2025-12-04.json", 99): ([], []),
    ("menu_tracking_json.json", 6): ([{
        "id": "menu", "type": "repeater", "label_en": "Meals served", "label_es": "Comidas servidas", "required": True,
        "help_en": "Add a row for each day.", "help_es": "Agregue una fila para cada día.",
        "columns": [col("date", "date", "Date", "Fecha"), col("breakfast", "text", "Breakfast", "Desayuno"), col("lunch", "text", "Lunch", "Almuerzo"),
                    col("dinner", "text", "Dinner", "Cena"), col("snacks", "text", "Snacks", "Refrigerios")],
    }], [7]),
    ("RESIDENTIAL-TRACKING_Grid-List_autoadd_gravityforms-export.json", 999): ([], []),
}

report = []
needs_es = []


def strip_html(s):
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s or "", flags=re.S | re.I)
    s = re.sub(r"<\s*br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(p|div|h\d|li|tr)>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "\n- ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = htmllib.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n\n", s)
    return "\n".join(line.strip() for line in s.strip().splitlines())


def instructions_from(content):
    """Turn an instructions HTML block into [{title, steps}] blocks, splitting on headings."""
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", content, flags=re.S | re.I)
    parts = re.split(r"<h[2-4][^>]*>(.*?)</h[2-4]>", body, flags=re.S | re.I)
    blocks = []
    lead = strip_html(parts[0])
    for i in range(1, len(parts), 2):
        title = strip_html(parts[i]).strip(" :")
        text = parts[i + 1] if i + 1 < len(parts) else ""
        items = [strip_html(x) for x in re.findall(r"<li[^>]*>(.*?)</li>", text, flags=re.S | re.I)]
        paras = [strip_html(x) for x in re.findall(r"<p[^>]*>(.*?)</p>", text, flags=re.S | re.I)]
        steps = [s for s in (paras + items) if s] or ([strip_html(text)] if strip_html(text) else [])
        if title and steps:
            blocks.append({"title": title, "steps": [re.sub(r"\s+", " ", s) for s in steps][:14]})
    if not blocks and lead:
        blocks.append({"title": "How to fill out this form", "steps": [x.strip("- ").strip() for x in lead.split("\n") if x.strip()][:12]})
    return blocks


def fid(gf_id):
    return "f" + str(gf_id).replace(".", "_")


def options(field):
    return [{"value": str(c.get("value") or c.get("text")), "en": strip_html(c.get("text", "")), "es": strip_html(c.get("text", ""))} for c in (field.get("choices") or [])]


def guess_col(name, i):
    n = name.lower()
    cid = re.sub(r"[^a-z0-9]+", "_", n).strip("_")[:24] or f"c{i}"
    if re.search(r"\bdate\b|^day\b", n): return col(cid, "date", name)
    if re.search(r"time in|start|time out|end time|\btime\b", n): return col(cid, "time", name)
    if re.search(r"\$|amount|balance|addition|expenditure|deposit|withdraw|cost|\+|=|- \(", n): return col(cid, "currency", name)
    if re.search(r"#|number|miles|trips|qty|count|hours", n): return col(cid, "number", name)
    m = re.search(r"\(([A-Z](?:/[A-Z])+)\)", name)
    if m:
        return col(cid, "select", name, options=[{"value": c, "en": c, "es": c} for c in m.group(1).split("/")])
    return col(cid, "text", name)


def convert_list(field, form_file):
    names = [i.get("name") or i.get("label") or f"Column {k + 1}" for k, i in enumerate(field.get("inputs") or [])]
    label = re.sub(r"\s*[—-]\s*Daily Grid$", "", strip_html(field.get("label", ""))) or "Entries"
    if not names:
        names = ["Entry"]
    first = names[0].lower()
    rest = names[1:]
    coded = [n for n in rest if re.search(r"\(([A-Z](?:/[A-Z])+)\)", n)]
    if (first.startswith("day") or first.startswith("date (1")) and form_file in DAY_CODES:
        codes = DAY_CODES[form_file]
        legend = {"Y": ("Yes, done", "Sí, hecho"), "N": ("No", "No"), "R": ("Refused", "Rechazó")}
        gridcols = [n for n in rest if not re.search(r"desc", n, re.I)]
        rows = [{"id": re.sub(r"[^a-z0-9]+", "_", re.sub(r"\(.*?\)", "", n).lower()).strip("_") or f"r{i}", "en": re.sub(r"\s*\((Y/N/R)\)", "", n).strip(), "es": re.sub(r"\s*\((Y/N/R)\)", "", n).strip()} for i, n in enumerate(gridcols)]
        seen = set()
        for r in rows:
            while r["id"] in seen: r["id"] += "_2"
            seen.add(r["id"])
        report.append(f"- {form_file}: day-by-day lists became month grids with codes {'/'.join(codes)}; 'Other (desc)' columns became a notes box. R is read as 'Refused' (from the form's note).")
        out = [{"id": fid(field["id"]), "type": "daygrid", "label_en": label, "label_es": label, "cell": "code", "rows": rows,
                "codes": [{"value": c, "en": legend.get(c, (c, c))[0], "es": legend.get(c, (c, c))[1]} for c in codes]}]
        if len(gridcols) < len(rest):
            out.append({"id": fid(field["id"]) + "_other", "type": "textarea", "label_en": "Other (describe)", "label_es": "Otro (describa)"})
        return out
    if first.startswith("day") or first.startswith("date (1"):
        if coded and len(coded) >= len([n for n in rest if not n.lower().startswith("total")]):
            codes = sorted({c for n in coded for c in re.search(r"\(([A-Z](?:/[A-Z])+)\)", n).group(1).split("/")}, key=["Y", "N", "R"].index if all(c in "YNR" for n in coded for c in re.search(r"\(([A-Z](?:/[A-Z])+)\)", n).group(1).split("/")) else str)
            rows = [{"id": re.sub(r"[^a-z0-9]+", "_", re.sub(r"\(.*?\)", "", n).lower()).strip("_"), "en": re.sub(r"\s*\(.*?\)", "", n).strip(), "es": re.sub(r"\s*\(.*?\)", "", n).strip()} for n in coded]
            if set(codes) == {"Y", "N"}:
                report.append(f"- {form_file}: list '{label}' became a month grid with check marks.")
                return {"id": fid(field["id"]), "type": "daygrid", "label_en": label, "label_es": label, "cell": "check", "rows": rows}
            legend = {"Y": ("Yes, done", "Sí, hecho"), "N": ("No", "No"), "R": ("Refused", "Rechazó")}
            report.append(f"- {form_file}: list '{label}' became a month grid with codes {'/'.join(codes)} (R read as 'Refused'; confirm).")
            return {"id": fid(field["id"]), "type": "daygrid", "label_en": label, "label_es": label, "cell": "code", "rows": rows,
                    "codes": [{"value": c, "en": legend.get(c, (c, c))[0], "es": legend.get(c, (c, c))[1]} for c in codes]}
    cols = [guess_col(n, i) for i, n in enumerate(names)]
    seen = set()
    for c in cols:
        while c["id"] in seen: c["id"] += "_2"
        seen.add(c["id"])
    totals = [c["id"] for c in cols if c["type"] in ("currency", "number") and not re.search(r"balance", c["label_en"], re.I)]
    out = {"id": fid(field["id"]), "type": "repeater", "label_en": label, "label_es": label, "columns": cols}
    if totals: out["totals"] = totals
    return out


def convert_condition(cl, known):
    if not cl or not cl.get("rules"): return None
    ops = {"is": "is", "isnot": "isnot", ">": ">", "<": "<", "contains": "contains"}
    rules = []
    for r in cl["rules"]:
        op = ops.get(r.get("operator"))
        target = fid(str(r.get("fieldId")).split(".")[0])
        if not op or target not in known:
            return "UNSUPPORTED"
        rules.append({"field": target, "op": op, "value": str(r.get("value", ""))})
    return {"logic": cl.get("logicType", "all"), "action": cl.get("actionType", "show"), "rules": rules}


def convert(slug, file, title_es, category, per_individual, self_start):
    data = json.load(open(os.path.join(SRC, file)))
    form = [v for k, v in data.items() if k != "version"][0] if isinstance(data, dict) else data[0]
    title = TITLES.get(slug) or strip_html(form["title"]).title()
    sections = [{"title_en": "", "title_es": "", "fields": []}]
    instructions = []
    staff_only, dropped, known = [], [], set()
    replaced = {rid for (f, _), (_, ids) in WIDGETS.items() if f == file for rid in ids}
    name_prefilled = False

    def new_section(t):
        if sections[-1]["fields"] or sections[-1]["title_en"]:
            sections.append({"title_en": t, "title_es": t, "fields": []})
        else:
            sections[-1]["title_en"] = sections[-1]["title_es"] = t
        if t: needs_es.append(f"{slug}: section '{t}'")

    for f in form["fields"]:
        t, gid, label = f["type"], f["id"], strip_html(f.get("label", ""))
        if gid in replaced:
            dropped.append(f"{label} (replaced by a native grid)"); continue
        if (file, gid) in WIDGETS:
            fields, _ = WIDGETS[(file, gid)]
            for w in fields:
                sections[-1]["fields"].append(w); known.add(w["id"])
            continue
        vis = f.get("visibility") or "visible"
        if vis == "hidden":
            dropped.append(f"{label} (hidden helper field)"); continue
        if vis == "administrative":
            staff_only.append(label); continue
        if t in ("section", "page"):
            new_section(label if t == "section" else (label or ""))
            continue
        if t == "html":
            c = f.get("content", "")
            if "<script" in c.lower():
                dropped.append(f"{label or 'HTML block'} (script)"); continue
            if re.search(r"form header|submission info", label, re.I):
                dropped.append(f"{label} (decoration)"); continue
            if re.search(r"instruction|how to", label + c[:300], re.I) and len(c) > 400:
                instructions += instructions_from(c); continue
            text = strip_html(c)
            if text:
                field = {"id": fid(gid), "type": "info", "label_en": "", "label_es": "", "body_en": text, "body_es": text}
                sections[-1]["fields"].append(field); needs_es.append(f"{slug}: note '{text[:40]}…'")
            continue
        base = {"id": fid(gid), "label_en": label, "label_es": label}
        if f.get("isRequired"): base["required"] = True
        desc = strip_html(f.get("description", ""))
        if desc: base["help_en"] = base["help_es"] = desc
        if t in ("text", "phone"):
            if (file, gid) in PREFILL_NAME or per_individual and not name_prefilled and re.search(r"^(client|individual|resident|member|person receiving services)('?s)?( name)?$|^name of (client|individual)", label, re.I):
                field = {"id": fid(gid), "type": "prefill", "source": "individual.full_name", "label_en": label, "label_es": "Persona"}
                name_prefilled = True
            elif re.search(r"signature", label, re.I):
                field = {**base, "type": "signature"}
            else:
                field = {**base, "type": "phone" if t == "phone" else "text"}
        elif t == "textarea": field = {**base, "type": "textarea"}
        elif t == "number" and re.search(r"\(auto|auto-calculated", label, re.I):
            dropped.append(f"{label} (the portal counts this itself)"); continue
        elif t == "number":
            field = {**base, "type": "currency" if f.get("numberFormat") == "currency" else "number"}
        elif t in ("date", "time"): field = {**base, "type": t}
        elif t == "select": field = {**base, "type": "select", "options": options(f)}
        elif t == "radio": field = {**base, "type": "radio", "options": options(f)}
        elif t == "checkbox": field = {**base, "type": "checkboxes", "options": options(f)}
        elif t == "fileupload": field = {**base, "type": "file"}
        elif t == "list":
            field = convert_list(f, file)
            if isinstance(field, list):
                for x in field:
                    sections[-1]["fields"].append(x); known.add(x["id"])
                continue
        else:
            report.append(f"- {file}: field {gid} '{label}' has type '{t}', not converted."); continue
        cond = convert_condition(f.get("conditionalLogic"), known)
        if cond == "UNSUPPORTED":
            report.append(f"- {file}: field '{label}' has conditional logic that needs hand work (shown always for now).")
        elif cond:
            field["show_if"] = cond
        sections[-1]["fields"].append(field); known.add(field["id"])
        if field.get("label_en"): needs_es.append(f"{slug}: '{field['label_en'][:50]}'")

    sections = [s for s in sections if s["fields"]]
    for s in sections:
        if not s["title_en"]:
            s["title_en"] = s["title_es"] = "Details" if s is sections[0] else "More details"
    if not instructions:
        instructions = [{"title": "How to fill out this form", "steps": ["Answer each question.", "Check your answers.", "Sign and submit."]}]
    schema = {"instructions_en": instructions, "instructions_es": [{"title": "Cómo llenar este formulario", "steps": ["Conteste cada pregunta.", "Revise sus respuestas.", "Firme y envíe."]}], "sections": sections}
    meta = {"slug": slug, "title_en": title, "title_es": title_es, "category": category, "per_individual": per_individual or name_prefilled,
            "self_start": self_start, "source": file, "gf_form_id": form.get("id"),
            "fields": sum(len(s["fields"]) for s in sections), "gf_fields": len(form["fields"]), "staff_only": staff_only, "dropped": dropped}
    return meta, schema


def main():
    os.makedirs(OUT, exist_ok=True)
    metas = []
    for slug, file, title_es, cat, per, selfs in FORMS:
        meta, schema = convert(slug, file, title_es, cat, per, selfs)
        json.dump({"meta": meta, "schema": schema}, open(os.path.join(OUT, slug + ".json"), "w"), indent=1, ensure_ascii=False)
        metas.append(meta)
    lines = ["# Gravity Forms conversion report", "",
             "Generated by `scripts/convert_gravity_forms.py` from the Gravity Forms exports in `content/gravity-forms/` (form definitions only; no entries).",
             "Each converted form is loaded into the portal as a **draft** (not assignable) until Real Care compares it with the original and signs off.", "",
             "| Portal form | Source export | GF fields | Portal fields | Staff-only fields left out |", "| --- | --- | --- | --- | --- |"]
    for m in metas:
        lines.append(f"| {m['title_en']} (`{m['slug']}`) | {m['source']} | {m['gf_fields']} | {m['fields']} | {', '.join(m['staff_only']) or '—'} |")
    lines += ["", "## Not converted", ""] + [f"- **{k}**: {v}" for k, v in SKIPPED.items()]
    lines += ["", "## Needs a person to check", ""] + (sorted(set(report)) or ["- Nothing flagged."])
    lines += ["", "## Removed during conversion", ""]
    for m in metas:
        if m["dropped"]: lines.append(f"- **{m['title_en']}**: " + "; ".join(m["dropped"]))
    lines += ["", "## Spanish", "",
              f"The intranet forms are English only. {len(needs_es)} labels and notes show English in the Spanish view until they are translated. Instructions have a short Spanish version.",
              "", "## Sign-off", "", "| Form | Checked against the original by | Date |", "| --- | --- | --- |"]
    lines += [f"| {m['title_en']} | | |" for m in metas]
    open(os.path.join(ROOT, "docs", "forms-conversion-report.md"), "w").write("\n".join(lines) + "\n")
    print(f"converted {len(metas)} forms; {len(report)} items flagged")
    for m in metas: print(f"  {m['slug']:28} {m['gf_fields']:4} -> {m['fields']:3}  staff-only:{len(m['staff_only'])} dropped:{len(m['dropped'])}")


if __name__ == "__main__":
    sys.exit(main())
