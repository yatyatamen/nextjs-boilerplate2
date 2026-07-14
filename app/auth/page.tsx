"use client"

import { Logo } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"

export default function AuthPage() {
  return (
    <div className="min-h-screen w-full bg-[#0B0C0E] text-zinc-100 font-sans antialiased flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(20,184,166,0.04)_0%,transparent_50%)] pointer-events-none" />

      <main className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
        <section className="lg:col-span-7 hidden lg:flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Logo showText onDark />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Welcome to the Wolves portal
            <br />
            <span className="text-[#14B8A6]">Sign in to continue</span>
          </h2>
          <p className="text-sm text-zinc-400 max-w-lg leading-relaxed">
            Book sessions, view announcements, and manage your membership using your school account.
          </p>
        </section>

        <aside className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md border border-zinc-800/80 bg-zinc-900/40 p-8 backdrop-blur-md rounded-sm shadow-xl overflow-hidden">
            <div className="mb-6">
              <h3 className="text-xl font-extrabold text-white uppercase tracking-tight">Welcome back</h3>
              <p className="text-xs text-zinc-400 mt-1">Sign in with your school account or create one.</p>
            </div>

            <AuthForm />
          </div>
        </aside>
      </main>
    </div>
  )
}
