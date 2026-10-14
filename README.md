# Auto Assistente: prototipo "vendo la mia auto"

Prototipo di una piattaforma con assistente AI per la compravendita di auto usate.
Copre un solo caso: un privato vende la propria auto, dalla descrizione (o dalla foto del
Documento Unico) fino al fascicolo pronto per l'agenzia di pratiche auto che farà il
passaggio di proprietà.

## Cosa fa

- Chat in italiano con un assistente basato su Claude (`claude-opus-5-5`).
- L'assistente registra man mano dati dell'auto, stima indicativa del prezzo, venditore,
  acquirente, prezzo concordato e documenti, usando strumenti con schema rigido.
- Legge le foto dei documenti (DU, carta d'identità, tessera sanitaria) e chiede conferma
  prima di registrare i dati.
- Calcola i costi indicativi del passaggio (IPT, emolumenti ACI, diritti, bollo).
- Pannello laterale con lo stato della pratica e cosa manca.
- Fascicolo stampabile (o salvabile in PDF) con riepilogo e bozza della dichiarazione di vendita.

## Limiti noti

- La stima del prezzo è una valutazione del modello, senza quotazioni di mercato reali.
- Tariffe del passaggio indicative (`lib/pratica.ts`, `TARIFFE`): da verificare con l'agenzia.
- Le pratiche sono salvate in file JSON in `data/pratiche/` (nell'MVP: PostgreSQL).
- Nessun login, nessun invio reale all'agenzia, nessun pagamento.

## Avvio

Serve Node.js 22 o superiore e una chiave API di Anthropic.

```bash
npm install
cp .env.example .env.local   # poi inserisci ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Test e controlli:

```bash
npm test
npm run typecheck
npm run build
```

## Struttura

- `lib/pratica.ts`: modello della pratica, checklist, calcolo dei costi
- `lib/assistente.ts`: prompt, strumenti e ciclo di conversazione con Claude
- `lib/store.ts`: archivio su file
- `app/page.tsx`: chat e pannello pratica
- `app/fascicolo/[id]/page.tsx`: fascicolo per l'agenzia
- `app/api/pratiche/...`: API
