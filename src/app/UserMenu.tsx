import { auth, signOut } from "@/auth";

export default async function UserMenu() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return (
    <div className="ml-auto flex items-center gap-3 text-sm">
      <span className="text-neutral-500">{session.user.email}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50">
          Sign out
        </button>
      </form>
    </div>
  );
}
