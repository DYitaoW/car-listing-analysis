import { redirect } from "next/navigation";

/** Legacy route — My checks now lives at /checks. */
export default function ListingsAliasPage() {
  redirect("/checks");
}
