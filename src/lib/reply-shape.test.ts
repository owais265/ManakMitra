import assert from "node:assert/strict";
import test from "node:test";
import { APP_LANGS } from "./language.ts";
import { pickVoice, spokenSlice, voiceTag } from "./read-aloud.ts";
import { askCount, shapeNote, sourcesBelong, wantsList } from "./reply-shape.ts";

const PRODUCTS = ["ceiling fan", "cement", "helmet", "laptop", "gold jewellery", "packaged water", "toy", "electric switch"];
const FACTS = [
  "which IS number applies",
  "ISI mark process",
  "CRS registration steps",
  "HUID check",
  "hallmark fee",
  "lab for PIN 500001",
  "complaint portal",
  "FMCS for an importer",
];
const SOCIAL = ["hi", "hello", "thanks", "who are you", "good morning", "namaste", "shukriya", "ok"];

test("a fact question keeps a source and a greeting does not", () => {
  let n = 0;
  for (const product of PRODUCTS) {
    for (const fact of FACTS) {
      const q = `${product}: ${fact}?`;
      assert.equal(sourcesBelong(q), true, q);
      n += 1;
    }
  }
  for (const hi of SOCIAL) {
    assert.equal(sourcesBelong(hi), false, hi);
    assert.equal(sourcesBelong(`${hi}, example`), false, hi);
    n += 2;
  }
  assert.equal(sourcesBelong("hello, which IS number applies to a ceiling fan"), true);
  assert.equal(sourcesBelong("give an example"), false);
  assert.ok(n >= 64);
});

test("one thousand mixed asks follow the source rule without calling a model", () => {
  const langs = ["en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur", "or"];
  let seen = 0;
  for (let i = 0; i < 1000; i += 1) {
    const product = PRODUCTS[i % PRODUCTS.length];
    const fact = FACTS[i % FACTS.length];
    const lang = langs[i % langs.length];
    const factual = i % 5 !== 0;
    const query = factual
      ? `${i}. ${product} — ${fact}. Reply language token ${lang}.`
      : SOCIAL[i % SOCIAL.length];
    assert.equal(sourcesBelong(query), factual, query);
    if (factual && i % 2 === 0) assert.match(shapeNote(query), /needs sources/);
    if (!factual) assert.match(shapeNote(query), /does not need a source/);
    seen += 1;
  }
  assert.equal(seen, 1000);
});

test("points and several questions change the shape, not the evidence", () => {
  assert.equal(wantsList("explain in points"), true);
  assert.equal(wantsList("ceiling fan standard"), false);
  assert.equal(askCount("1. cement\n2. helmet\n3. laptop"), 3);
  assert.equal(askCount("What is the fan standard? And where do I complain?"), 2);
  assert.match(shapeNote("1. cement ISI\n2. helmet ISI\nin points"), /2 separate points/);
  assert.match(shapeNote("1. cement ISI\n2. helmet ISI\nin points"), /bullet list/);
  assert.match(shapeNote("cement standard"), /Stay under 130 words/);
  assert.match(shapeNote("cement standard"), /facts stay the same/);
});

test("reading uses the selected language, and the highlight stays inside the text", () => {
  for (const lang of APP_LANGS) {
    assert.equal(voiceTag(lang.id), lang.speech);
  }
  const voices = [
    { lang: "en-US", name: "Alex" },
    { lang: "hi-IN", name: "Lekha" },
    { lang: "ta-IN", name: "Tamil" },
  ];
  assert.equal(pickVoice(voices, "hi-IN")?.name, "Lekha");
  assert.equal(pickVoice(voices, "ta-IN")?.name, "Tamil");
  assert.equal(pickVoice(voices, "bn-IN"), null);
  const text = "Cement uses a catalogue row.";
  assert.deepEqual(spokenSlice(text, 0, 6), { start: 0, end: 6 });
  assert.deepEqual(spokenSlice(text, 6, 0), { start: 6, end: 11 });
  assert.deepEqual(spokenSlice(text, 99, 4), { start: text.length, end: text.length });
});
