import React from 'react';

// Alterado para Home para combinar com index.js, mas Dashboard também funciona
export default function Home() {
  return (
    <div style={{ 
      fontFamily: 'sans-serif', 
      padding: '50px', 
      textAlign: 'center',
      backgroundColor: '#f4f4f9',
      minHeight: '100vh', // minHeight é melhor que height para evitar cortes
      margin: 0
    }}>
      <h1 style={{ color: '#2ecc71' }}>💸 FinMemory Dashboard</h1>
      <p style={{ fontSize: '1.2rem' }}>O seu app de finanças está online!</p>
      
      <div style={{ 
        marginTop: '20px', 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        display: 'inline-block',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <strong>Status:</strong> Conectando ao Supabase...
      </div>
    </div>
  );
}
