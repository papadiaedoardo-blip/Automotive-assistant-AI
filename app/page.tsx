"use client";

import { useEffect, useRef, useState } from "react";
import { DOCUMENTI, type CodiceDocumento, type Pratica } from "@/lib/pratica.ts";
import type { MessaggioChat } from "@/lib/vista.ts";
import type { Immagine } from "@/lib/assistente.ts";

const CHIAVE = "praticaId";
const euro = (n: number) =>
  n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Ridimensiona la foto lato client per contenere peso e costi. */
async function preparaFoto(file: File): Promise<Immagine> {
  const bitmap = await createImageBitmap(file);
  const scala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scala);
  canvas.height = Math.round(bitmap.height * scala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { media_type: "image/jpeg", data: dataUrl.split(",")[1] };
}

export default function Home() {
  const [id, setId] = useState<string | null>(null);
  const [pratica, setPratica] = useState<Pratica | null>(null);
  const [mancanti, setMancanti] = useState<string[]>([]);
  const [messaggi, setMessaggi] = useState<MessaggioChat[]>([]);
  const [testo, setTesto] = useState("");
  const [foto, setFoto] = useState<File[]>([]);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  async function nuova() {
    const r = await fetch("/api/pratiche", { method: "POST" });
    const { id } = await r.json();
    try { localStorage.setItem(CHIAVE, id); } catch {}
    setId(id);
    setMessaggi([]);
    setPratica(null);
  }

  useEffect(() => {
    let salvato: string | null = null;
    try { salvato = localStorage.getItem(CHIAVE); } catch {}
    if (!salvato) { void nuova(); return; }
    fetch(`/api/pratiche/${salvato}`).then(async (r) => {
      if (!r.ok) return nuova();
      const d = await r.json();
      setId(salvato);
      setPratica(d.pratica);
      setMancanti(d.mancanti);
      setMessaggi(d.messaggi);
    });
  }, []);

  useEffect(() => fondo.current?.scrollIntoView({ behavior: "smooth" }), [messaggi, attesa]);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!id || attesa || (!testo.trim() && foto.length === 0)) return;
    setErrore(null);
    setAttesa(true);
    const immagini = await Promise.all(foto.map(preparaFoto));
    setMessaggi((m) => [...m, { ruolo: "utente", testo: testo.trim(), foto: immagini.length }]);
    const daInviare = testo.trim();
    setTesto("");
    setFoto([]);
    try {
      const r = await fetch(`/api/pratiche/${id}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testo: daInviare, immagini }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.errore ?? "Errore");
      setMessaggi((m) => [...m, { ruolo: "assistente", testo: d.risposta, foto: 0 }]);
      setPratica(d.pratica);
      setMancanti(d.mancanti);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore");
      setMessaggi((m) => m.slice(0, -1));
      setTesto(daInviare);
    } finally {
      setAttesa(false);
    }
  }

  return (
    <main className="app">
      <section className="box chat">
        <header>
          <h1>Vendi la tua auto</h1>
          <button onClick={nuova} disabled={attesa}>Nuova pratica</button>
        </header>
        <div className="messaggi">
          {messaggi.length === 0 && (
            <p className="vuoto">
              Ciao! Scrivimi che auto vuoi vendere (marca, modello, anno, km) oppure carica una
              foto del Documento Unico: al resto penso io, fino al fascicolo per il passaggio di
              proprietà.
            </p>
          )}
          {messaggi.map((m, i) => (
            <div key={i} className={`msg ${m.ruolo}`}>
              {m.foto > 0 && <div className="foto">📎 {m.foto} foto</div>}
              {m.testo}
            </div>
          ))}
          {attesa && <div className="msg assistente muted">Sto lavorando…</div>}
          <div ref={fondo} />
        </div>
        {errore && <div className="errore">{errore}</div>}
        {foto.length > 0 && (
          <div className="allegati">
            {foto.map((f) => f.name).join(", ")}{" "}
            <button type="button" onClick={() => setFoto([])}>Rimuovi</button>
          </div>
        )}
        <form className="invio" onSubmit={invia}>
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => setFoto(Array.from(e.target.files ?? []).slice(0, 4))}
          />
          <button type="button" onClick={() => inputFoto.current?.click()} aria-label="Allega foto">
            📷
          </button>
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) invia(e);
            }}
            placeholder="Scrivi un messaggio…"
            rows={1}
          />
          <button className="primario" disabled={attesa || !id}>Invia</button>
        </form>
      </section>

      <aside className="box pannello">
        <PannelloPratica pratica={pratica} mancanti={mancanti} />
      </aside>
    </main>
  );
}

function PannelloPratica({ pratica, mancanti }: { pratica: Pratica | null; mancanti: string[] }) {
  if (!pratica) return <p className="muted">Pratica in preparazione…</p>;
  const { veicolo, venditore, acquirente, stima, accordo, costi_passaggio } = pratica;
  const pronta = pratica.stato === "pronta_per_agenzia";
  return (
    <>
      <h2>Fascicolo</h2>
      <span className={`stato ${pronta ? "ok" : "attesa"}`}>
        {pronta ? "Pronto per l'agenzia" : "In raccolta"}
      </span>
      {pronta && (
        <p>
          <a className="bottone" href={`/fascicolo/${pratica.id}`} target="_blank">
            Apri il fascicolo
          </a>
        </p>
      )}

      <h2>Auto</h2>
      {veicolo ? (
        <dl>
          <dt>Targa</dt><dd>{veicolo.targa}</dd>
          <dt>Modello</dt><dd>{veicolo.marca} {veicolo.modello} {veicolo.versione ?? ""}</dd>
          <dt>Anno</dt><dd>{veicolo.anno_immatricolazione}</dd>
          <dt>Km</dt><dd>{veicolo.km.toLocaleString("it-IT")}</dd>
          <dt>Potenza</dt><dd>{veicolo.potenza_kw ? `${veicolo.potenza_kw} kW` : "—"}</dd>
        </dl>
      ) : <p className="muted">Ancora da inserire</p>}

      <h2>Prezzo</h2>
      {stima ? (
        <p>Stima: {euro(stima.minimo)} – {euro(stima.massimo)}</p>
      ) : <p className="muted">Nessuna stima</p>}
      {accordo && <p>Concordato: <strong>{euro(accordo.prezzo_concordato)}</strong></p>}
      {costi_passaggio && (
        <p className="muted">Costi passaggio stimati: {euro(costi_passaggio.totale)}</p>
      )}

      <h2>Persone</h2>
      <dl>
        <dt>Venditore</dt><dd>{venditore?.nome_o_ragione_sociale ?? "—"}</dd>
        <dt>Acquirente</dt><dd>{acquirente?.nome_o_ragione_sociale ?? "—"}</dd>
      </dl>

      <h2>Documenti</h2>
      <ul className="checklist">
        {(Object.keys(DOCUMENTI) as CodiceDocumento[]).map((k) => (
          <li key={k}>
            {pratica.documenti[k] === "mancante" ? "○" : "✓"} {DOCUMENTI[k]}
          </li>
        ))}
      </ul>

      {!pronta && mancanti.length > 0 && (
        <>
          <h2>Cosa manca</h2>
          <ul>{mancanti.map((m) => <li key={m}>{m}</li>)}</ul>
        </>
      )}
    </>
  );
}
