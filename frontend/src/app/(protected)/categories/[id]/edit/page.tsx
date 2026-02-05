import { CategoryEditorScreen } from "@/components/categories/category-editor-screen";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = Number(id);

  return <CategoryEditorScreen categoryId={Number.isFinite(parsed) ? parsed : undefined} />;
}
