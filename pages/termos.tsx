import React from 'react';

export default function Termos() {
  return (
    <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#667eea' }}>Termos de Serviço - FinMemory</h1>
      <p>Última atualização: 21/01/2026</p>
      <section>
        <h2>1. Aceitação dos Termos</h2>
        <p>Ao acessar ou utilizar o FinMemory, você concorda com estes Termos de Serviço. Caso não concorde, não utilize o serviço.</p>
      </section>
      <section>
        <h2>2. Descrição do Serviço</h2>
        <p>O FinMemory oferece uma plataforma para gerenciamento de histórico financeiro, sincronizando notas fiscais do Gmail e organizando suas transações.</p>
      </section>
      <section>
        <h2>3. Cadastro e Segurança</h2>
        <ul>
          <li>Você deve fornecer informações verdadeiras e manter seus dados atualizados.</li>
          <li>O acesso ao serviço é realizado via autenticação Google OAuth.</li>
          <li>Você é responsável por manter a confidencialidade das suas credenciais.</li>
        </ul>
      </section>
      <section>
        <h2>4. Uso Permitido</h2>
        <ul>
          <li>Não utilize o FinMemory para atividades ilícitas ou que violem direitos de terceiros.</li>
          <li>O serviço é destinado ao uso pessoal e não comercial.</li>
        </ul>
      </section>
      <section>
        <h2>5. Privacidade</h2>
        <p>O tratamento dos dados segue a <a href="/privacidade" style={{ color: '#764ba2' }}>Política de Privacidade</a> do FinMemory.</p>
      </section>
      <section>
        <h2>6. Limitação de Responsabilidade</h2>
        <p>O FinMemory não se responsabiliza por danos decorrentes do uso ou da impossibilidade de uso do serviço, incluindo falhas técnicas ou indisponibilidade.</p>
      </section>
      <section>
        <h2>7. Modificações nos Termos</h2>
        <p>Estes termos podem ser alterados a qualquer momento. O uso contínuo do serviço após alterações implica aceitação das novas condições.</p>
      </section>
      <section>
        <h2>8. Contato</h2>
        <p>Para dúvidas ou solicitações, entre em contato pelo e-mail: suporte@finmemory.com</p>
      </section>
    </main>
  );
}
