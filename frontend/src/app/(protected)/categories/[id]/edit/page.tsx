import { redirect } from "next/navigation";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = Number(id);

  if (!Number.isFinite(parsed)) {
    redirect("/categories");
  }

  redirect(`/categories?edit=${parsed}`);
}
