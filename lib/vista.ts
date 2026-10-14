// Trasforma la conversazione salvata nei messaggi visibili nella chat.
import type { Conversazione } from "./store.ts";

export type MessaggioChat = { ruolo: "utente" | "assistente"; testo: string; foto: number };

export function messaggiVisibili(conversazione: Conversazione): MessaggioChat[] {
  const out: MessaggioChat[] = [];
  for (const m of conversazione) {
    if (typeof m.content === "string") {
      out.push({ ruolo: m.role === "user" ? "utente" : "assistente", testo: m.content, foto: 0 });
      continue;
    }
    const testo = m.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n\n")
      .trim();
    const foto = m.content.filter((b) => b.type === "image").length;
    if (!testo && !foto) continue; // risultati degli strumenti, ragionamento
    out.push({ ruolo: m.role === "user" ? "utente" : "assistente", testo, foto });
  }
  return out;
}
