import { NicknameForm } from "@/features/auth/ui/NicknameForm";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <main className="w-full max-w-md">
        <h1 className="font-display text-2xl text-center mb-4">도파민또</h1>
        <NicknameForm />
      </main>
    </div>
  );
}
