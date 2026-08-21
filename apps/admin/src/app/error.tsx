"use client";

interface ErrorProps {
  error: { message?: string; stack?: string };
  reset?: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated bubbles background */}
      <div className="notfound-bubbles-bg">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="notfound-bubble" />
        ))}
      </div>
      <h2 style={{
        fontWeight: 700,
        color: '#000',
        marginBottom: 16,
        fontSize: 32,
        letterSpacing: 1,
        textShadow: '0 2px 8px #0001',
        zIndex: 1,
        lineHeight: 1.1,
      }}>
        Algo deu errado
      </h2>
      <p style={{ color: '#666', maxWidth: 340, textAlign: 'center', zIndex: 1 }}>
        Opa! O ouriço da HedHog tropeçou em um erro inesperado.<br />
        Tente novamente ou volte para o início.
      </p>
      {error?.message && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: 8,
          padding: '12px 18px',
          margin: '18px 0 0 0',
          maxWidth: 420,
          fontSize: 15,
          zIndex: 2,
          wordBreak: 'break-word',
        }}>
          {error.message}
          <br />
            <span style={{ fontSize: 13, color: '#b71c1c', display: 'block', marginTop: 6 }}>
            {
              (() => {
                // Procura por nome do arquivo.ts(x):linha:coluna na stack trace
                const match = error.stack?.match(/([\\/]?[^\\/\s]+\.(ts|tsx):\d+:\d+)/);
                return match?.[1] || 'Arquivo desconhecido';
              })()
            }
            </span>
        </div>
      )}
      {error?.stack && (
        <details style={{
          background: '#f8f9fa',
          color: '#333',
          border: '1px solid #e2e3e5',
          borderRadius: 8,
          padding: '10px 16px',
          margin: '12px 0 0 0',
          maxWidth: 420,
          fontSize: 13,
          zIndex: 2,
          wordBreak: 'break-all',
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Ver stack trace</summary>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{error.stack}</pre>
        </details>
      )}
      <button
        onClick={() => reset?.()}
        style={{
          marginTop: 24,
          padding: '10px 24px',
          background: '#555',
          color: '#fff',
          borderRadius: 24,
          textDecoration: 'none',
          fontWeight: 600,
          transition: 'background 0.2s',
          zIndex: 1,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Tentar novamente
      </button>
      <a
        href="/"
        style={{
          marginTop: 16,
          padding: '8px 20px',
          background: '#000',
          color: '#fff',
          borderRadius: 20,
          textDecoration: 'none',
          fontWeight: 600,
          transition: 'background 0.2s',
          zIndex: 1,
          display: 'inline-block',
        }}
      >
        Voltar para o início
      </a>
      <style>{`
        .notfound-bubbles-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .notfound-bubble {
          position: absolute;
          bottom: -120px;
          width: 32px;
          height: 32px;
          background: rgba(141,85,36,0.12);
          border-radius: 50%;
          animation: notfound-bubble-float 12s linear infinite;
          opacity: 0.7;
        }
        .notfound-bubble:nth-child(1) { left: 5%;  animation-delay: 0s;  width: 24px; height: 24px; }
        .notfound-bubble:nth-child(2) { left: 15%; animation-delay: 2s;  width: 18px; height: 18px; }
        .notfound-bubble:nth-child(3) { left: 25%; animation-delay: 4s;  width: 32px; height: 32px; }
        .notfound-bubble:nth-child(4) { left: 35%; animation-delay: 1s;  width: 20px; height: 20px; }
        .notfound-bubble:nth-child(5) { left: 45%; animation-delay: 3s;  width: 28px; height: 28px; }
        .notfound-bubble:nth-child(6) { left: 55%; animation-delay: 5s;  width: 22px; height: 22px; }
        .notfound-bubble:nth-child(7) { left: 65%; animation-delay: 2.5s; width: 30px; height: 30px; }
        .notfound-bubble:nth-child(8) { left: 75%; animation-delay: 6s;  width: 16px; height: 16px; }
        .notfound-bubble:nth-child(9) { left: 85%; animation-delay: 1.5s; width: 26px; height: 26px; }
        .notfound-bubble:nth-child(10) { left: 95%; animation-delay: 3.5s; width: 20px; height: 20px; }
        .notfound-bubble:nth-child(11) { left: 10%; animation-delay: 7s;  width: 18px; height: 18px; }
        .notfound-bubble:nth-child(12) { left: 20%; animation-delay: 8s;  width: 22px; height: 22px; }
        .notfound-bubble:nth-child(13) { left: 30%; animation-delay: 9s;  width: 28px; height: 28px; }
        .notfound-bubble:nth-child(14) { left: 40%; animation-delay: 10s; width: 16px; height: 16px; }
        .notfound-bubble:nth-child(15) { left: 50%; animation-delay: 11s; width: 24px; height: 24px; }
        .notfound-bubble:nth-child(16) { left: 60%; animation-delay: 12s; width: 20px; height: 20px; }
        .notfound-bubble:nth-child(17) { left: 70%; animation-delay: 13s; width: 26px; height: 26px; }
        .notfound-bubble:nth-child(18) { left: 80%; animation-delay: 14s; width: 18px; height: 18px; }
        @keyframes notfound-bubble-float {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.7;
          }
          80% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-110vh) scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
