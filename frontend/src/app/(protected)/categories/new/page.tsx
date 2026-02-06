import { redirect } from "next/navigation";

export default function NewCategoryPage() {
  redirect("/categories?create=1");
}
