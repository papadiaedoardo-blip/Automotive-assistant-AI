// Archivio delle pratiche su file JSON: sufficiente per il prototipo,
// da sostituire con un database (PostgreSQL) nell'MVP.
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { nuovaPratica, type Pratica } from "./pratica.ts";

export type Conversazione = Anthropic.Beta.BetaMessageParam[];

type Record_ = { pratica: Pratica; conversazione: Conversazione };

const CARTELLA = path.join(process.cwd(), "data", "pratiche");

function percorso(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Id pratica non valido");
  return path.join(CARTELLA, `${id}.json`);
}

export async function creaPratica(): Promise<Pratica> {
  const record: Record_ = { pratica: nuovaPratica(randomUUID()), conversazione: [] };
  await salva(record);
  return record.pratica;
}

export async function leggi(id: string): Promise<Record_ | null> {
  try {
    return JSON.parse(await fs.readFile(percorso(id), "utf8")) as Record_;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function salva(record: Record_): Promise<void> {
  await fs.mkdir(CARTELLA, { recursive: true });
  record.pratica.aggiornata_il = new Date().toISOString();
  await fs.writeFile(percorso(record.pratica.id), JSON.stringify(record));
}
