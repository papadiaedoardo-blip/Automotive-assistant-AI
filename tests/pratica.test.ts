import { test } from "node:test";
import assert from "node:assert/strict";
import { calcolaCostiPassaggio, elementiMancanti, nuovaPratica } from "../lib/pratica.ts";

test("IPT fissa fino a 53 kW con maggiorazione 30%", () => {
  const c = calcolaCostiPassaggio(50);
  assert.equal(c.ipt, 196.05);
  assert.equal(c.totale, 196.05 + 27 + 10.2 + 32);
});

test("IPT per kW oltre 53 kW", () => {
  assert.equal(calcolaCostiPassaggio(100, 0).ipt, 351.19);
  assert.equal(calcolaCostiPassaggio(100).ipt, 456.55);
});

test("maggiorazione fuori range rifiutata", () => {
  assert.throws(() => calcolaCostiPassaggio(100, 0.5));
  assert.throws(() => calcolaCostiPassaggio(0));
});

test("una pratica nuova elenca tutto ciò che manca", () => {
  const m = elementiMancanti(nuovaPratica("x"));
  assert.ok(m.includes("Dati del veicolo"));
  assert.ok(m.includes("Prezzo concordato"));
  assert.equal(m.length, 9);
});
