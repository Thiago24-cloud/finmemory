import React from 'react';
import Head from 'next/head';

export default function Termos() {
  return (
    <>
      <Head>
        <title>Termos de Serviço - FinMemory</title>
        <meta name="description" content="Termos de Serviço do FinMemory. Leia antes de utilizar o serviço." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
        <h1 style={{ color: '#2ECC49', marginBottom: '0.25rem' }}>Termos de Serviço - FinMemory</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '2rem' }}>Última atualização: 21/01/2026</p>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>1. Aceitação dos Termos</h2>
          <p>Ao acessar ou utilizar o FinMemory, você concorda com estes Termos de Serviço. Caso não concorde, não utilize o serviço.</p>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>2. Descrição do Serviço</h2>
          <p>O FinMemory oferece uma plataforma para gerenciamento de histórico financeiro, sincronizando notas fiscais do Gmail e organizando suas transações.</p>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>3. Cadastro e Segurança</h2>
          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
            <li>Você deve fornecer informações verdadeiras e manter seus dados atualizados.</li>
            <li>O acesso ao serviço é realizado via autenticação Google OAuth.</li>
            <li>Você é responsável por manter a confidencialidade das suas credenciais.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>4. Uso Permitido</h2>
          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
            <li>Não utilize o FinMemory para atividades ilícitas ou que violem direitos de terceiros.</li>
            <li>O serviço é destinado ao uso pessoal e não comercial.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>5. Privacidade</h2>
          <p>O tratamento dos dados segue a Política de Privacidade do FinMemory.</p>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>6. Limitação de Responsabilidade</h2>
          <p>O FinMemory não se responsabiliza por danos decorrentes do uso ou da impossibilidade de uso do serviço, incluindo falhas técnicas ou indisponibilidade.</p>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>7. Modificações nos Termos</h2>
          <p>Estes termos podem ser alterados a qualquer momento. O uso contínuo do serviço após alterações implica aceitação das novas condições.</p>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>8. Contato</h2>
          <p>Para dúvidas ou solicitações, entre em contato pelo e-mail: <a href="mailto:suporte@finmemory.com" style={{ color: '#2ECC49' }}>suporte@finmemory.com</a></p>
        </section>
      </main>
    </>
  );
}
