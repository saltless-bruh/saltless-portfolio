/**
 * napping's "model". It is vibe-coded on purpose and only PRETENDS to be one: a multinomial naive
 * Bayes classifier, trained at build time from `brain/examples.json`, that sorts a message into a
 * category. It never writes a reply. Every reply is a fixed line the owner wrote, so a prompt
 * injection can at worst pick the wrong joke. Pure, with no Node imports: it is built and tested in
 * Node and runs in the browser.
 */
export type Brain = {
  labels: string[];
  /** log P(label) */
  prior: number[];
  /** log P(feature | label), per label, for every feature seen in training */
  vocab: Record<string, number[]>;
  /** log P(feature | label) for a feature never seen with that label (Laplace) */
  unseen: number[];
};

/** Lowercase words and adjacent word pairs: "ignore previous" says more than either word alone. */
export function features(text: string): string[] {
  const words = text.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const pairs = words.slice(1).map((w, i) => `${words[i]} ${w}`);
  return [...words, ...pairs];
}

const r = (x: number): number => Number(x.toFixed(3));

export function train(examples: Record<string, string[]>): Brain {
  const labels = Object.keys(examples).sort();
  const counts = labels.map(() => new Map<string, number>());
  const totals = labels.map(() => 0);
  const vocab = new Set<string>();
  labels.forEach((label, li) => {
    for (const x of examples[label]!) {
      for (const f of features(x)) {
        counts[li]!.set(f, (counts[li]!.get(f) ?? 0) + 1);
        totals[li]!++;
        vocab.add(f);
      }
    }
  });
  const n = labels.reduce((s, l) => s + examples[l]!.length, 0);
  const denom = labels.map((_, li) => totals[li]! + vocab.size);
  const table: Record<string, number[]> = {};
  for (const f of [...vocab].sort()) table[f] = labels.map((_, li) => r(Math.log(((counts[li]!.get(f) ?? 0) + 1) / denom[li]!)));
  return {
    labels,
    prior: labels.map((l) => r(Math.log(examples[l]!.length / n))),
    vocab: table,
    unseen: labels.map((_, li) => r(Math.log(1 / denom[li]!))),
  };
}

/** The most likely label. Words it has never seen say nothing; with nothing to go on, the prior decides. */
export function classify(b: Brain, text: string): string {
  return decide(b, text).label;
}

/**
 * The label and how sure it is: the gap, in log-probability, between the best label and the
 * runner-up. Zero means it had nothing to go on and only the prior spoke.
 */
export function decide(b: Brain, text: string): { label: string; gap: number } {
  const score = [...b.prior];
  for (const f of features(text)) {
    const p = b.vocab[f];
    if (!p) continue;
    p.forEach((v, i) => { score[i]! += v; });
  }
  let best = 0;
  score.forEach((s, i) => { if (s > score[best]!) best = i; });
  const runnerUp = Math.max(...score.filter((_, i) => i !== best));
  return { label: b.labels[best]!, gap: score[best]! - runnerUp };
}
