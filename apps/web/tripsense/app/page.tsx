import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f5f2] text-[#18201b]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2f7d68]">
          TripSense provider POC
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight md:text-7xl">
          Explore real places around Da Nang.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#526157]">
          Validate VietMap search and routing with OpenTripMap and Wikimedia
          enrichment before Trip CRUD begins.
        </p>
        <div className="mt-9">
          <Link
            className="inline-flex h-12 items-center justify-center rounded-md bg-[#18201b] px-5 text-sm font-semibold text-white transition hover:bg-[#2f7d68]"
            href="/explore"
          >
            Open Explore
          </Link>
        </div>
      </section>
    </main>
  );
}
