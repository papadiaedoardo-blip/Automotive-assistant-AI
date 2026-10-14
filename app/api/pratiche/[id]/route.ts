import { leggi } from "@/lib/store.ts";
import { elementiMancanti } from "@/lib/pratica.ts";
import { messaggiVisibili } from "@/lib/vista.ts";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const record = await leggi(id).catch(() => null);
  if (!record) return Response.json({ errore: "Pratica non trovata" }, { status: 404 });
  return Response.json({
    pratica: record.pratica,
    mancanti: elementiMancanti(record.pratica),
    messaggi: messaggiVisibili(record.conversazione),
  });
}
