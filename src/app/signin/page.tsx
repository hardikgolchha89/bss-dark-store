import { signIn } from "@/auth";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold">BSS Darkstore</h1>
        <p className="mt-1 text-sm text-neutral-500">Sign in to continue.</p>
        <ErrorNote searchParams={searchParams} />
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-6"
        >
          <button className="w-full rounded border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50">
            Continue with Google
          </button>
        </form>
        <p className="mt-4 text-xs text-neutral-400">Access is limited to approved accounts.</p>
      </div>
    </div>
  );
}

async function ErrorNote({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  const msg =
    error === "AccessDenied"
      ? "That account isn't on the allowlist. Ask an admin to add you."
      : "Sign-in failed. Please try again.";
  return <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{msg}</p>;
}
