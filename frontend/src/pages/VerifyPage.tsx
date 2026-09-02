import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight, MailCheck } from "lucide-react";

export default function VerifyPage() {
  // A-1: the backend fake verification endpoint (/domains/verify-contact) has
  // been removed — it always claimed "verified" without verifying anything.
  // This page now explains the real situation honestly and routes the user to
  // the proper RAA resend action available in their dashboard.
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-2 mb-6">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-900 rounded-xl font-black text-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">Ekstensi<span className="text-emerald-400">.id</span></span>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700/80 text-center space-y-6">
          <div className="py-4 space-y-5">
            <div className="w-16 h-16 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mx-auto border border-sky-500/30">
              <MailCheck className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">Verifikasi Email Kontak</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                Verifikasi email kontak (ICANN RAA) untuk domain Anda diproses langsung oleh registrar melalui tautan resmi yang dikirim ke email Anda. Bila email tersebut belum diterima atau tautannya kedaluwarsa, Anda dapat mengirim ulang email verifikasi dari halaman detail domain di dashboard.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <Link
                to="/dashboard"
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Ke Dashboard Domain <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[11px] text-slate-500">
                Sudah login di dashboard? Buka detail domain Anda lalu pilih <span className="text-slate-300 font-semibold">Kirim Ulang Verifikasi</span>.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} Ekstensi.id — ICANN Accredited Domain Registrar Management.
        </p>
      </div>
    </div>
  );
}