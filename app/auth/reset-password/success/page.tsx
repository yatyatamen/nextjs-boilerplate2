"use client"

import Link from "next/link"
import { Button, Card } from "@/components/ui/primitives"
import { CheckCircle2, ArrowLeft } from "lucide-react"

const BACKGROUND_IMAGE =
  "https://jmlhdtltucwhxrrunenl.supabase.co/storage/v1/object/public/pics/Screenshot%202026-07-14%201459121.png"

export default function ResetPasswordSuccessPage() {
  return (
    <div
      className="min-h-screen w-full text-zinc-100 font-sans antialiased flex flex-col justify-center p-6 relative overflow-hidden"
      style={{
        backgroundImage: `url('${BACKGROUND_IMAGE}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <main className="relative z-10 mx-auto w-full max-w-md">
        <Card className="relative overflow-hidden rounded-xl border border-[#14B8A6]/30 bg-zinc-900/80 p-8 shadow-2xl shadow-[#14B8A6]/20">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-emerald-500/15 p-3 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white">
              Password reset successful
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Link href="/" className="mt-6 w-full">
              <Button className="w-full">Go to sign in</Button>
            </Link>
            <Link href="/auth/forgot-password" className="mt-3 inline-flex items-center gap-2 text-sm text-[#14B8A6] hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to forgot password
            </Link>
          </div>
        </Card>
      </main>
    </div>
  )
}
