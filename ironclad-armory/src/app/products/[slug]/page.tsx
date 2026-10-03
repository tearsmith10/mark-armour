import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureProductImage, getProduct, listProducts } from "@/lib/products";
import { money } from "@/lib/money";
import ProductArt from "@/components/ProductArt";
import AddToCartButton from "@/components/AddToCartButton";

/* eslint-disable @next/next/no-img-element */

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const raw = await getProduct(slug);
  if (!raw) notFound();
  const product = await ensureProductImage(raw);

  const related = (await listProducts(product.category))
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);
  const soldOut = product.stock <= 0;

  return (
    <div className="container-page py-12">
      <nav className="mb-8 flex items-center gap-2 text-xs text-stone-600">
        <Link href="/products" className="hover:text-blaze-400">
          Catalog
        </Link>
        <span>/</span>
        <Link
          href={`/products?category=${encodeURIComponent(product.category)}`}
          className="hover:text-blaze-400"
        >
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-stone-400">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="card aspect-[16/10] overflow-hidden bg-ink-850 lg:aspect-[4/3]">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={`${product.name} — real photograph`}
                className="h-full w-full object-cover"
              />
            ) : (
              <ProductArt category={product.category} seed={product.sort_order} />
            )}
          </div>
          {product.image_url && (
            <p className="mt-2 text-[11px] leading-relaxed text-stone-600">
              Real photograph · {product.image_credit ?? "Wikimedia Commons"} ·{" "}
              <a
                href="https://commons.wikimedia.org/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blaze-400"
              >
                source
              </a>
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <span className="badge bg-ink-800 text-olive-400">{product.category}</span>
            {product.badge && (
              <span className="badge bg-blaze-500 text-onbrand">{product.badge}</span>
            )}
            <span
              className={`text-[11px] font-bold uppercase tracking-widest ${
                soldOut ? "text-red-400" : product.stock <= 6 ? "text-blaze-400" : "text-olive-500"
              }`}
            >
              {soldOut
                ? "Out of stock"
                : product.stock <= 6
                  ? `Only ${product.stock} left`
                  : "In stock"}
            </span>
          </div>

          <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight text-stone-100">
            {product.name}
          </h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-widest text-olive-500">
            {product.caliber}
          </p>

          <div className="mt-6 font-display text-4xl font-black text-blaze-500">
            {money(product.price_cents)}
          </div>

          <p className="mt-6 leading-relaxed text-stone-400">{product.description}</p>

          <div className="mt-8">
            <AddToCartButton product={product} disabled={soldOut} />
          </div>

          <div className="mt-8 space-y-3 border-t border-ink-700 pt-6 text-sm text-stone-500">
            {[
              ["Shipping", "Free over $500 · insured, signature required"],
              ["Transfer", "Ships to your chosen FFL dealer (NICS check on pickup)"],
              ["Requirement", "Buyer must be 18+ with photo ID verified at checkout"],
              ["Returns", "14-day defect warranty · factory inspected before dispatch"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <span className="w-24 shrink-0 text-[11px] font-bold uppercase tracking-widest text-olive-600">
                  {k}
                </span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-xl font-black uppercase tracking-tight text-stone-100">
            More in {product.category}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="card p-4 transition-colors hover:border-ink-600"
              >
                <div className="font-display text-sm font-bold text-stone-200">
                  {p.name}
                </div>
                <div className="mt-2 text-blaze-400">{money(p.price_cents)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
