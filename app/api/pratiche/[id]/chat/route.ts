import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { leggi, salva } from "@/lib/store.ts";
import { elementiMancanti } from "@/lib/pratica.ts";
import { rispondi } from "@/lib/assistente.ts";

export const maxDuration = 300;

const Richiesta = z.object({
  testo: z.string().max(4000),
  immagini: z
    .array(
      z.object({
        media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
        data: z.string().max(8_000_000),
      }),
    )
    .max(4)
    .default([]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const record = await leggi(id).catch(() => null);
  if (!record) return Response.json({ errore: "Pratica non trovata" }, { status: 404 });

  const corpo = Richiesta.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return Response.json({ errore: "Richiesta non valida" }, { status: 400 });

  try {
    const risposta = await rispondi(
      record.pratica,
      record.conversazione,
      corpo.data.testo,
      corpo.data.immagini,
    );
    await salva(record);
    return Response.json({
      risposta,
      pratica: record.pratica,
      mancanti: elementiMancanti(record.pratica),
    });
  } catch (e) {
    console.error(e);
    let errore = "Errore dell'assistente, riprova.";
    if (e instanceof Anthropic.AuthenticationError) errore = "Chiave API Anthropic mancante o non valida.";
    else if (e instanceof Error && /authentication method|api ?key|credential/i.test(e.message))
      errore = "Chiave API Anthropic mancante: impostala in .env.local.";
    else if (e instanceof Anthropic.RateLimitError) errore = "Troppe richieste, riprova tra poco.";
    return Response.json({ errore }, { status: 502 });
  }
}
