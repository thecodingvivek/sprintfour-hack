import Image from "next/image";
import GoogleSignIn from "@/components/GoogleSignIn";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left mt-8">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Welcome to Firebase Auth!
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Try signing in below to see authentication in action. The session token is automatically stored in a secure Next.js HTTP-only cookie.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 py-8 w-full items-center sm:items-start">
          <GoogleSignIn />
        </div>
      </main>
    </div>
  );
}
