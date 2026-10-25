'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error?.message || 'Erro crítico global',
        digest: error?.digest,
        stack: error?.stack,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, backgroundColor: '#020617', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Falha temporária no aplicativo</h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '420px', marginBottom: '24px' }}>
            Registramos o erro automaticamente. Clique abaixo para recarregar o painel.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              backgroundColor: '#10b981',
              color: '#020617',
              fontWeight: 700,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Recarregar ERBots
          </button>
        </div>
      </body>
    </html>
  );
}
