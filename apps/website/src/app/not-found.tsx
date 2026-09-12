import { ArrowLeftIcon } from "@/components/theme/theme-icons";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="w-full h-screen mx-auto flex flex-col items-center justify-center max-w-205 px-6 py-14 sm:px-8 sm:py-16 gap-8">
      <div className="w-full relative flex flex-col items-center justify-center mb-6">
        <h3 className="font-bold absolute inset-0 z-10 hidden md:flex items-center justify-center font-display text-ink-faint/50 text-7xl text-center">
          Not Found
        </h3>
        <h2 className="max-w-[17ch] flex flex-col items-center justify-center w-full font-display inset-0 z-20 text-center text-[38px] font-extrabold leading-[1.12] tracking-tight text-ink sm:text-[52px]">
          Oops!
        </h2>
      </div>
      <p className="mb-9 max-w-[58ch] text-[16.5px] text-center leading-[1.7] text-ink-soft">
        We couldn&apos;t find the page you&apos;re looking for.
      </p>
      <Link
        className="inline-flex items-center gap-2 font-mono text-[12.5px] text-ink-faint transition-colors duration-200 hover:text-ink"
        href="/"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Go back home
      </Link>
    </div>
  );
}
