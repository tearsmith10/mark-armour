import Link from "next/link";
import { categoriesWithCounts, listProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/catalog";

export const metadata = { title: "Catalog" };

function withQuery(href: string, q?: string) {
  if (!q) return href;
  return `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const active = CATEGORIES.includes(category as (typeof CATEGORIES)[number])
    ? category
    : undefined;
  const query = (q ?? "").trim();

  const [all, cats] = await Promise.all([
    listProducts(active),
    categoriesWithCounts(),
  ]);

  const products = query
    ? all.filter((p) => {
        const needle = query.toLowerCase();
        return [p.name, p.caliber, p.category, p.description]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle));
      })
    : all;

  return (
    <div className="container-page py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-stone-100">
          {query ? `“${query}”` : (active ?? "All products")}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {products.length} item{products.length === 1 ? "" : "s"}
          {active && !query ? ` in ${active}` : ""}
          {query ? ` matching your search` : ""} · every serialized item ships to
          a licensed FFL dealer.
        </p>
        {query && (
          <Link
            href={active ? `/products?category=${encodeURIComponent(active)}` : "/products"}
            className="mt-3 inline-block text-xs font-bold uppercase tracking-widest text-blaze-500 hover:text-blaze-400"
          >
            ✕ Clear search
          </Link>
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href={withQuery("/products", query)}
          className={`chip ${!active ? "chip-active" : ""}`}
        >
          All ({cats.reduce((n, c) => n + c.n, 0)})
        </Link>
        {CATEGORIES.map((c) => {
          const count = cats.find((x) => x.category === c)?.n ?? 0;
          if (!count) return null;
          return (
            <Link
              key={c}
              href={withQuery(
                `/products?category=${encodeURIComponent(c)}`,
                query,
              )}
              className={`chip ${active === c ? "chip-active" : ""}`}
            >
              {c} ({count})
            </Link>
          );
        })}
      </div>

      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-display text-lg font-bold text-stone-300">
            {query ? "No matches." : "Nothing here yet."}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            {query
              ? "Try a shorter term — caliber, category or product name — or ask us to source it."
              : "This category is being restocked — check back shortly."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/products" className="btn-ghost">
              Browse everything
            </Link>
            <Link href="/custom" className="btn-primary">
              Request a custom build
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
