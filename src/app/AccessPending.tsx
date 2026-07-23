import { signOut } from "@/auth";

// Shown to a signed-in user who isn't approved yet (or was blocked). Replaces
// the whole app for them — no nav, no data.
export default function AccessPending({ email, blocked }: { email: string; blocked: boolean }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        {blocked ? (
          <>
            <h1 className="text-lg font-semibold">Access denied</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Your access to Darkstore Ops has been turned off. If you think this is a mistake,
              contact an admin.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Access requested</h1>
            <p className="mt-2 text-sm text-neutral-500">
              You&apos;re signed in as <span className="font-medium">{email}</span>. An admin needs to
              approve your access before you can use Darkstore Ops. You&apos;ll be in as soon as
              they do — just refresh this page.
            </p>
          </>
        )}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
          className="mt-6"
        >
          <button className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
