import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, ShieldCheck, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

export default function VerifyPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<{ email?: string; customerId?: string; contactId?: string; message?: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function doVerify() {
      setLoading(true);
      setError("");
      try {
        const param1 = params.param1 || searchParams.get("c") || searchParams.get("id") || "";
        const param2 = params.param2 || searchParams.get("contact") || searchParams.get("reseller") || "";
        const param3 = params.param3 || searchParams.get("email") || "";

        const wild = (params as any)["*"] || "";
        const splatParts = wild ? wild.split("/").filter(Boolean) : [];

        const p1 = param1 || splatParts[0] || "";
        const p2 = param2 || splatParts[1] || "";
        const p3 = param3 || splatParts[2] || "";

        const res: any = await api.post("/domains/verify-contact", {
          param1: p1,
          param2: p2,
          param3: p3,
        });

        const resData = res?.data || res;
        setData(resData);
        setSuccess(true);
      } catch (e: any) {
        setError(e.message || "Verifikasi gagal atau tautan verifikasi telah kadaluarsa.");
      }
      setLoading(false);
    }

    doVerify();
  }, [params, searchParams]);

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
          {loading ? (
            <div className="py-10 space-y-4">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
              <h2 className="text-lg font-bold text-white">Memproses Verifikasi Email...</h2>
              <p className="text-xs text-slate-400">Mohon tunggu sebentar, kami sedang mengonfirmasi status ke server ICANN / Resellercamp.</p>
            </div>
          ) : success ? (
            <div className="py-4 space-y-5">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30 shadow-inner">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div>
                <h2 className="text-xl font-black text-white">Verifikasi Email Berhasil!</h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                  Email kontak pemilik domain Anda telah terverifikasi secara resmi sesuai standar regulasi ICANN RAA.
                </p>
              </div>

              {data?.email && (
                <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-700 text-left space-y-1 text-xs">
                  <span className="text-slate-400 font-medium block">Email Terkonfirmasi:</span>
                  <span className="font-bold text-emerald-400 text-sm block break-all">{data.email}</span>
                  {data?.customerId && (
                    <span className="text-[11px] text-slate-500 block pt-1">Customer Ref: #{data.customerId}</span>
                  )}
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/dashboard"
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Ke Dashboard Domain <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-5">
              <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
                <AlertCircle className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Verifikasi Kontak</h2>
                <p className="text-xs sm:text-sm text-rose-300 mt-1.5 leading-relaxed">
                  {error || "Tautan verifikasi tidak dapat diproses."}
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Masuk ke Akun Saya <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} Ekstensi.id — ICANN Accredited Domain Registrar Management.
        </p>
      </div>
    </div>
  );
}
