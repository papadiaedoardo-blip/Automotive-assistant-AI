import { test } from "node:test";
import assert from "node:assert/strict";
import { eseguiStrumento } from "../lib/assistente.ts";
import { nuovaPratica, DOCUMENTI } from "../lib/pratica.ts";

const persona = {
  tipo: "privato", nome_o_ragione_sociale: "Mario Rossi", codice_fiscale_o_piva: "RSSMRA80A01F205X",
  indirizzo_residenza: "Via Roma 1, Milano", provincia_residenza: "MI", email: null, telefono: null,
};

test("il flusso completo porta la pratica a pronta", () => {
  const p = nuovaPratica("x");
  assert.throws(() => eseguiStrumento(p, "segna_pronta_per_agenzia", {}), /Manca/);
  eseguiStrumento(p, "registra_veicolo", {
    targa: "ab 123 cd", telaio: null, marca: "Volkswagen", modello: "Golf", versione: null,
    anno_immatricolazione: 2018, km: 90000, alimentazione: "diesel", potenza_kw: 85, condizioni: "buone",
  });
  assert.equal(p.veicolo?.targa, "AB123CD");
  eseguiStrumento(p, "registra_persona", { ruolo: "venditore", ...persona });
  eseguiStrumento(p, "registra_persona", { ruolo: "acquirente", ...persona, nome_o_ragione_sociale: "Anna Bianchi" });
  eseguiStrumento(p, "registra_accordo", { prezzo_concordato: 12500, data_consegna_prevista: null });
  const costi = JSON.parse(eseguiStrumento(p, "calcola_costi_passaggio", { potenza_kw: 85, maggiorazione_provinciale: null }));
  assert.ok(costi.totale > 0);
  for (const d of Object.keys(DOCUMENTI)) eseguiStrumento(p, "aggiorna_documento", { documento: d, stato: "caricato" });
  eseguiStrumento(p, "segna_pronta_per_agenzia", {});
  assert.equal(p.stato, "pronta_per_agenzia");
});

test("input non valido viene rifiutato", () => {
  const p = nuovaPratica("x");
  assert.throws(() => eseguiStrumento(p, "registra_stima", { minimo: 10, massimo: 5, motivazione: "x" }));
  assert.throws(() => eseguiStrumento(p, "aggiorna_documento", { documento: "boh", stato: "caricato" }));
  assert.throws(() => eseguiStrumento(p, "inesistente", {}));
});
