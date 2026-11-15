// The one list of provider types. Keep in step with public.provider_type_list() in the database.
// RCI Provider: an alternate contractor status (Jason, Nov 14, 2026).
export const PROVIDER_TYPES = ["host_home", "family_caregiver", "scc_dsp", "nmt", "rci_provider"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_TYPE_LABEL: Record<ProviderType, { en: string; es: string; short: string }> = {
  host_home: { en: "Host Home", es: "Hogar anfitrión", short: "Host Home" },
  family_caregiver: { en: "Family Caregiver", es: "Cuidador familiar", short: "Family Caregiver" },
  scc_dsp: { en: "SCC/DSP", es: "SCC/DSP", short: "SCC/DSP" },
  nmt: { en: "NMT", es: "NMT", short: "NMT" },
  rci_provider: { en: "RCI Provider", es: "Proveedor RCI", short: "RCI Provider" },
};

/** [value, English label] pairs for checkboxes and selects. */
export const PROVIDER_TYPE_OPTIONS: [ProviderType, string][] = PROVIDER_TYPES.map((t) => [t, PROVIDER_TYPE_LABEL[t].en]);

export function isProviderType(v: string): v is ProviderType {
  return (PROVIDER_TYPES as readonly string[]).includes(v);
}

/** Keeps only known types, in list order, without repeats. */
export function cleanProviderTypes(values: Iterable<string>): ProviderType[] {
  const set = new Set(Array.from(values, (v) => String(v)));
  return PROVIDER_TYPES.filter((t) => set.has(t));
}

// Words people (and Wix contact labels) use for each type. Lowercase keys.
// On the live Wix site, "FCG" and "Family Caregiver" are the same type (Jason, Nov 14, 2026).
export const PROVIDER_TYPE_WORDS: Record<string, ProviderType> = {
  "host home": "host_home", host_home: "host_home", hhp: "host_home",
  "family caregiver": "family_caregiver", family_caregiver: "family_caregiver", fc: "family_caregiver", fcg: "family_caregiver",
  scc: "scc_dsp", dsp: "scc_dsp", "scc/dsp": "scc_dsp", scc_dsp: "scc_dsp",
  nmt: "nmt",
  "rci provider": "rci_provider", rci_provider: "rci_provider", rci: "rci_provider",
};

/** Maps free-text labels (Wix labels, a roster column) to provider types. Unknown words are ignored. */
export function typesFromWords(words: Iterable<string>): ProviderType[] {
  const out: string[] = [];
  for (const w of words) {
    const t = PROVIDER_TYPE_WORDS[String(w).trim().toLowerCase()];
    if (t) out.push(t);
  }
  return cleanProviderTypes(out);
}
