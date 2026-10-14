import { creaPratica } from "@/lib/store.ts";

export async function POST() {
  const pratica = await creaPratica();
  return Response.json({ id: pratica.id });
}
