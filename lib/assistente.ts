// L'assistente AI: un ciclo di tool use con Claude che compila la pratica.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  DOCUMENTI,
  calcolaCostiPassaggio,
  elementiMancanti,
  type CodiceDocumento,
  type Pratica,
} from "./pratica.ts";
import type { Conversazione } from "./store.ts";

const MODELLO = "claude-opus-5-5";
const MAX_GIRI = 12;

const SISTEMA = `Sei l'assistente di una piattaforma italiana per la compravendita di auto usate.
Aiuti un privato a vendere la propria auto e porti la pratica fino al fascicolo pronto per il passaggio di proprietà.

Come lavori:
- Parli in italiano, con frasi semplici e cordiali. Una o due domande per volta.
- Raccogli nell'ordine: dati dell'auto, stima del prezzo, dati del venditore, acquirente e prezzo concordato, documenti.
- Registra ogni informazione con lo strumento giusto appena la hai. Non chiedere di nuovo ciò che è già registrato.
- Se l'utente carica la foto di un documento (Documento Unico, carta d'identità, tessera sanitaria), leggi i dati, riassumili all'utente e chiedi conferma prima di registrarli. Segna il documento come "caricato". Non inventare mai dati illeggibili: chiedili.
- La stima del prezzo è una tua valutazione indicativa basata su marca, modello, anno, km e condizioni: dillo chiaramente, perché non hai accesso a quotazioni di mercato in tempo reale.
- Quando conosci la potenza in kW, calcola i costi del passaggio con lo strumento apposito e spiegali.
- Il passaggio di proprietà non lo fa la piattaforma: il fascicolo va a un'agenzia di pratiche auto partner, che autentica la firma del venditore e trascrive al PRA entro 60 giorni. Spiegalo quando serve.
- Quando non manca nulla, usa segna_pronta_per_agenzia e spiega i prossimi passi (appuntamento per la firma autenticata, pagamento, consegna).
- Non dare consigli legali o fiscali definitivi: indica quando qualcosa va verificato con l'agenzia.`;

// --- Definizione degli strumenti ------------------------------------------

const testoONull = z.string().nullable();

const schemi = {
  registra_veicolo: z.strictObject({
    targa: z.string().describe("Targa italiana, maiuscola senza spazi"),
    telaio: testoONull.describe("Numero di telaio (VIN), se noto"),
    marca: z.string(),
    modello: z.string(),
    versione: testoONull,
    anno_immatricolazione: z.number().int(),
    km: z.number().int(),
    alimentazione: z.string().describe("benzina, diesel, GPL, metano, ibrida, elettrica"),
    potenza_kw: z.number().nullable().describe("Potenza in kW (campo P.2 del DU)"),
    condizioni: z.string().describe("Breve descrizione di carrozzeria, interni, meccanica"),
  }),
  registra_persona: z.strictObject({
    ruolo: z.enum(["venditore", "acquirente"]),
    tipo: z.enum(["privato", "azienda"]),
    nome_o_ragione_sociale: z.string(),
    codice_fiscale_o_piva: z.string(),
    indirizzo_residenza: z.string(),
    provincia_residenza: z.string().describe("Sigla della provincia, es. MI"),
    email: testoONull,
    telefono: testoONull,
  }),
  registra_stima: z.strictObject({
    minimo: z.number().describe("Euro"),
    massimo: z.number().describe("Euro"),
    motivazione: z.string(),
  }),
  calcola_costi_passaggio: z.strictObject({
    potenza_kw: z.number(),
    maggiorazione_provinciale: z
      .number()
      .nullable()
      .describe("Tra 0 e 0.3; null se non nota (si usa 0.3, il valore più diffuso)"),
  }),
  aggiorna_documento: z.strictObject({
    documento: z.enum(Object.keys(DOCUMENTI) as [CodiceDocumento, ...CodiceDocumento[]]),
    stato: z.enum(["mancante", "caricato", "verificato"]),
  }),
  registra_accordo: z.strictObject({
    prezzo_concordato: z.number().describe("Euro"),
    data_consegna_prevista: testoONull.describe("Data ISO AAAA-MM-GG"),
  }),
  segna_pronta_per_agenzia: z.strictObject({}),
};

type NomeStrumento = keyof typeof schemi;

const descrizioni: Record<NomeStrumento, string> = {
  registra_veicolo: "Registra o aggiorna i dati dell'auto in vendita.",
  registra_persona: "Registra o aggiorna i dati anagrafici del venditore o dell'acquirente.",
  registra_stima: "Registra la stima indicativa del prezzo di vendita.",
  calcola_costi_passaggio:
    "Calcola i costi indicativi del passaggio di proprietà (IPT, emolumenti ACI, diritti, bollo).",
  aggiorna_documento: "Aggiorna lo stato di un documento della checklist.",
  registra_accordo: "Registra il prezzo concordato tra venditore e acquirente.",
  segna_pronta_per_agenzia:
    "Segna il fascicolo come pronto per l'agenzia. Fallisce elencando cosa manca.",
};

const strumenti: Anthropic.Beta.BetaTool[] = (Object.keys(schemi) as NomeStrumento[]).map(
  (nome) => {
    const { $schema: _, ...schema } = z.toJSONSchema(schemi[nome]) as Record<string, unknown>;
    return {
      name: nome,
      description: descrizioni[nome],
      strict: true,
      input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
    };
  },
);

/** Esegue uno strumento sulla pratica; restituisce il testo del risultato. */
export function eseguiStrumento(pratica: Pratica, nome: string, input: unknown): string {
  if (!(nome in schemi)) throw new Error(`Strumento sconosciuto: ${nome}`);
  const n = nome as NomeStrumento;
  const dati = schemi[n].parse(input);
  switch (n) {
    case "registra_veicolo": {
      const v = dati as z.infer<typeof schemi.registra_veicolo>;
      pratica.veicolo = { ...v, targa: v.targa.replace(/\s/g, "").toUpperCase() };
      return "Veicolo registrato.";
    }
    case "registra_persona": {
      const { ruolo, ...persona } = dati as z.infer<typeof schemi.registra_persona>;
      pratica[ruolo] = persona;
      return `Dati ${ruolo} registrati.`;
    }
    case "registra_stima": {
      const s = dati as z.infer<typeof schemi.registra_stima>;
      if (s.minimo > s.massimo) throw new Error("Il minimo supera il massimo");
      pratica.stima = s;
      return "Stima registrata.";
    }
    case "calcola_costi_passaggio": {
      const c = dati as z.infer<typeof schemi.calcola_costi_passaggio>;
      pratica.costi_passaggio = calcolaCostiPassaggio(
        c.potenza_kw,
        c.maggiorazione_provinciale ?? undefined,
      );
      return JSON.stringify(pratica.costi_passaggio);
    }
    case "aggiorna_documento": {
      const d = dati as z.infer<typeof schemi.aggiorna_documento>;
      pratica.documenti[d.documento] = d.stato;
      return `Documento "${DOCUMENTI[d.documento]}": ${d.stato}.`;
    }
    case "registra_accordo": {
      pratica.accordo = dati as z.infer<typeof schemi.registra_accordo>;
      return "Accordo registrato.";
    }
    case "segna_pronta_per_agenzia": {
      const mancanti = elementiMancanti(pratica);
      if (mancanti.length > 0) {
        throw new Error(`Non ancora pronta. Manca: ${mancanti.join("; ")}`);
      }
      pratica.stato = "pronta_per_agenzia";
      return "Fascicolo pronto per l'agenzia.";
    }
  }
}

// --- Ciclo di conversazione -----------------------------------------------

export type Immagine = {
  media_type: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

let client: Anthropic | null = null;

/**
 * Aggiunge il messaggio dell'utente, fa girare l'assistente finché non risponde
 * e restituisce il testo della risposta. Modifica `pratica` e `conversazione`
 * (sempre e solo in coda: la cronologia non viene mai riscritta).
 */
export async function rispondi(
  pratica: Pratica,
  conversazione: Conversazione,
  testo: string,
  immagini: Immagine[] = [],
): Promise<string> {
  conversazione.push({
    role: "user",
    content: [
      ...immagini.map((img) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.media_type, data: img.data },
      })),
      { type: "text" as const, text: testo || "(foto allegata)" },
    ],
  });

  client ??= new Anthropic();
  const risposte: string[] = [];
  for (let giro = 0; giro < MAX_GIRI; giro++) {
    const statoPratica = JSON.stringify({ ...pratica, mancanti: elementiMancanti(pratica) });
    const risposta = await client.beta.messages.create({
      model: MODELLO,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Stato attuale della pratica:\n${statoPratica}` },
      ],
      tools: strumenti,
      messages: conversazione,
    });

    conversazione.push({ role: "assistant", content: risposta.content });
    for (const b of risposta.content) if (b.type === "text") risposte.push(b.text);

    if (risposta.stop_reason === "refusal") {
      risposte.push("Non posso aiutarti con questa richiesta.");
      break;
    }
    if (risposta.stop_reason !== "tool_use") break;

    const risultati: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const b of risposta.content) {
      if (b.type !== "tool_use") continue;
      try {
        risultati.push({
          type: "tool_result",
          tool_use_id: b.id,
          content: eseguiStrumento(pratica, b.name, b.input),
        });
      } catch (e) {
        risultati.push({
          type: "tool_result",
          tool_use_id: b.id,
          content: e instanceof Error ? e.message : String(e),
          is_error: true,
        });
      }
    }
    conversazione.push({ role: "user", content: risultati });
  }

  return risposte.join("\n\n").trim();
}
