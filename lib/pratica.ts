// Modello dati di una pratica di vendita e regole di completezza.
// Nessuna dipendenza da Node o Next: è testabile da solo.

export type StatoDocumento = "mancante" | "caricato" | "verificato";

export type Veicolo = {
  targa: string;
  telaio: string | null;
  marca: string;
  modello: string;
  versione: string | null;
  anno_immatricolazione: number;
  km: number;
  alimentazione: string;
  potenza_kw: number | null;
  condizioni: string;
};

export type Persona = {
  tipo: "privato" | "azienda";
  nome_o_ragione_sociale: string;
  codice_fiscale_o_piva: string;
  indirizzo_residenza: string;
  provincia_residenza: string;
  email: string | null;
  telefono: string | null;
};

export type Stima = {
  minimo: number;
  massimo: number;
  motivazione: string;
};

export type Accordo = {
  prezzo_concordato: number;
  data_consegna_prevista: string | null;
};

export type CostiPassaggio = {
  ipt: number;
  emolumenti_aci: number;
  diritti_motorizzazione: number;
  imposta_bollo: number;
  totale: number;
  note: string;
};

export type Pratica = {
  id: string;
  creata_il: string;
  aggiornata_il: string;
  stato: "in_raccolta" | "pronta_per_agenzia";
  veicolo: Veicolo | null;
  venditore: Persona | null;
  acquirente: Persona | null;
  stima: Stima | null;
  accordo: Accordo | null;
  costi_passaggio: CostiPassaggio | null;
  documenti: Record<CodiceDocumento, StatoDocumento>;
};

export const DOCUMENTI = {
  documento_unico:
    "Documento Unico (DU), oppure certificato di proprietà e carta di circolazione per i veicoli più vecchi",
  identita_venditore: "Documento d'identità del venditore",
  codice_fiscale_venditore: "Codice fiscale / tessera sanitaria del venditore",
  identita_acquirente: "Documento d'identità dell'acquirente",
  codice_fiscale_acquirente: "Codice fiscale / tessera sanitaria dell'acquirente",
} as const;

export type CodiceDocumento = keyof typeof DOCUMENTI;

export function nuovaPratica(id: string, adesso = new Date()): Pratica {
  const documenti = Object.fromEntries(
    Object.keys(DOCUMENTI).map((k) => [k, "mancante"]),
  ) as Record<CodiceDocumento, StatoDocumento>;
  return {
    id,
    creata_il: adesso.toISOString(),
    aggiornata_il: adesso.toISOString(),
    stato: "in_raccolta",
    veicolo: null,
    venditore: null,
    acquirente: null,
    stima: null,
    accordo: null,
    costi_passaggio: null,
    documenti,
  };
}

/** Cosa manca perché il fascicolo possa andare all'agenzia di pratiche auto. */
export function elementiMancanti(p: Pratica): string[] {
  const mancanti: string[] = [];
  if (!p.veicolo) mancanti.push("Dati del veicolo");
  if (!p.venditore) mancanti.push("Dati del venditore");
  if (!p.acquirente) mancanti.push("Dati dell'acquirente");
  if (!p.accordo) mancanti.push("Prezzo concordato");
  for (const [codice, stato] of Object.entries(p.documenti)) {
    if (stato === "mancante") mancanti.push(DOCUMENTI[codice as CodiceDocumento]);
  }
  return mancanti;
}

// Valori indicativi per il passaggio di proprietà di un'autovettura usata tra privati.
// Da verificare con l'agenzia partner: la maggiorazione IPT varia per provincia.
export const TARIFFE = {
  ipt_fissa_fino_53kw: 150.81,
  ipt_per_kw_oltre_53kw: 3.5119,
  maggiorazione_provinciale_default: 0.3,
  emolumenti_aci: 27,
  diritti_motorizzazione: 10.2,
  imposta_bollo: 32,
};

const arrotonda = (n: number) => Math.round(n * 100) / 100;

export function calcolaCostiPassaggio(
  potenzaKw: number,
  maggiorazioneProvinciale = TARIFFE.maggiorazione_provinciale_default,
): CostiPassaggio {
  if (!(potenzaKw > 0)) throw new Error("La potenza in kW deve essere positiva");
  if (maggiorazioneProvinciale < 0 || maggiorazioneProvinciale > 0.3) {
    throw new Error("La maggiorazione provinciale è tra 0% e 30%");
  }
  const base =
    potenzaKw <= 53
      ? TARIFFE.ipt_fissa_fino_53kw
      : TARIFFE.ipt_per_kw_oltre_53kw * potenzaKw;
  const ipt = arrotonda(base * (1 + maggiorazioneProvinciale));
  const totale = arrotonda(
    ipt + TARIFFE.emolumenti_aci + TARIFFE.diritti_motorizzazione + TARIFFE.imposta_bollo,
  );
  return {
    ipt,
    emolumenti_aci: TARIFFE.emolumenti_aci,
    diritti_motorizzazione: TARIFFE.diritti_motorizzazione,
    imposta_bollo: TARIFFE.imposta_bollo,
    totale,
    note: `Stima indicativa con maggiorazione IPT del ${Math.round(
      maggiorazioneProvinciale * 100,
    )}%. Escluso il compenso dell'agenzia. Da confermare con l'agenzia.`,
  };
}
