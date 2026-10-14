import { notFound } from "next/navigation";
import { leggi } from "@/lib/store.ts";
import { DOCUMENTI, elementiMancanti, type CodiceDocumento, type Persona } from "@/lib/pratica.ts";
import { Stampa } from "./stampa.tsx";

const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function SchedaPersona({ titolo, p }: { titolo: string; p: Persona | null }) {
  return (
    <>
      <h2>{titolo}</h2>
      {p ? (
        <dl>
          <dt>Nome / ragione sociale</dt><dd>{p.nome_o_ragione_sociale}</dd>
          <dt>Codice fiscale / P. IVA</dt><dd>{p.codice_fiscale_o_piva}</dd>
          <dt>Residenza</dt><dd>{p.indirizzo_residenza} ({p.provincia_residenza})</dd>
          <dt>Contatti</dt><dd>{[p.email, p.telefono].filter(Boolean).join(" · ") || "—"}</dd>
        </dl>
      ) : <p className="muted">Mancante</p>}
    </>
  );
}

export default async function Fascicolo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await leggi(id).catch(() => null);
  if (!record) notFound();
  const { veicolo, venditore, acquirente, accordo, costi_passaggio, documenti } = record.pratica;
  const mancanti = elementiMancanti(record.pratica);

  return (
    <main className="box pannello" style={{ maxWidth: 760, margin: "16px auto" }}>
      <p style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="muted">Pratica {id.slice(0, 8)}</span>
        <Stampa />
      </p>
      <h1 style={{ fontSize: 22 }}>Fascicolo per il passaggio di proprietà</h1>
      <p className="muted">
        Documento preparato dalla piattaforma per l&apos;agenzia di pratiche auto. Non sostituisce
        l&apos;atto di vendita autenticato.
      </p>
      {mancanti.length > 0 && (
        <p className="errore">Incompleto. Manca: {mancanti.join("; ")}</p>
      )}

      <h2>Veicolo</h2>
      {veicolo ? (
        <dl>
          <dt>Targa</dt><dd>{veicolo.targa}</dd>
          <dt>Telaio</dt><dd>{veicolo.telaio ?? "—"}</dd>
          <dt>Marca e modello</dt><dd>{veicolo.marca} {veicolo.modello} {veicolo.versione ?? ""}</dd>
          <dt>Immatricolazione</dt><dd>{veicolo.anno_immatricolazione}</dd>
          <dt>Chilometri</dt><dd>{veicolo.km.toLocaleString("it-IT")}</dd>
          <dt>Alimentazione</dt><dd>{veicolo.alimentazione}</dd>
          <dt>Potenza</dt><dd>{veicolo.potenza_kw ? `${veicolo.potenza_kw} kW` : "—"}</dd>
        </dl>
      ) : <p className="muted">Mancante</p>}

      <SchedaPersona titolo="Venditore" p={venditore} />
      <SchedaPersona titolo="Acquirente" p={acquirente} />

      <h2>Accordo</h2>
      {accordo ? (
        <dl>
          <dt>Prezzo</dt><dd>{euro(accordo.prezzo_concordato)}</dd>
          <dt>Consegna prevista</dt><dd>{accordo.data_consegna_prevista ?? "—"}</dd>
        </dl>
      ) : <p className="muted">Mancante</p>}

      <h2>Documenti</h2>
      <ul>
        {(Object.keys(DOCUMENTI) as CodiceDocumento[]).map((k) => (
          <li key={k}>{DOCUMENTI[k]}: {documenti[k]}</li>
        ))}
      </ul>

      {costi_passaggio && (
        <>
          <h2>Costi indicativi del passaggio</h2>
          <dl>
            <dt>IPT</dt><dd>{euro(costi_passaggio.ipt)}</dd>
            <dt>Emolumenti ACI</dt><dd>{euro(costi_passaggio.emolumenti_aci)}</dd>
            <dt>Diritti Motorizzazione</dt><dd>{euro(costi_passaggio.diritti_motorizzazione)}</dd>
            <dt>Imposta di bollo</dt><dd>{euro(costi_passaggio.imposta_bollo)}</dd>
            <dt>Totale</dt><dd><strong>{euro(costi_passaggio.totale)}</strong></dd>
          </dl>
          <p className="muted">{costi_passaggio.note}</p>
        </>
      )}

      {veicolo && venditore && acquirente && accordo && (
        <>
          <h2>Bozza della dichiarazione di vendita</h2>
          <p>
            Il/la sottoscritto/a <strong>{venditore.nome_o_ragione_sociale}</strong> (C.F.{" "}
            {venditore.codice_fiscale_o_piva}), residente in {venditore.indirizzo_residenza}, dichiara
            di aver venduto a <strong>{acquirente.nome_o_ragione_sociale}</strong> (C.F.{" "}
            {acquirente.codice_fiscale_o_piva}), residente in {acquirente.indirizzo_residenza}, il
            veicolo {veicolo.marca} {veicolo.modello} targato <strong>{veicolo.targa}</strong>
            {veicolo.telaio ? `, telaio ${veicolo.telaio},` : ""} per il prezzo di{" "}
            {euro(accordo.prezzo_concordato)}.
          </p>
          <p className="muted">
            La firma del venditore va autenticata presso l&apos;agenzia, il Comune o un notaio. La
            trascrizione al PRA va richiesta entro 60 giorni.
          </p>
        </>
      )}
    </main>
  );
}
