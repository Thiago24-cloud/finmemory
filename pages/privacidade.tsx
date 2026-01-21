import React from 'react';

export default function Privacidade() {
  return (
    <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#764ba2' }}>Política de Privacidade - FinMemory</h1>
      <p>Última atualização: 21/01/2026</p>
      <section>
        <h2>1. Introdução</h2>
        <p>O FinMemory valoriza a privacidade dos seus usuários e está comprometido em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações.</p>
      </section>
      <section>
        <h2>2. Informações Coletadas</h2>
        <ul>
          <li><strong>Dados de cadastro:</strong> Nome, e-mail, identificador do Google.</li>
          <li><strong>Dados de acesso:</strong> Tokens de autenticação para integração com o Gmail.</li>
          <li><strong>Dados financeiros:</strong> Informações de notas fiscais extraídas do Gmail.</li>
        </ul>
      </section>
      <section>
        <h2>3. Uso das Informações</h2>
        <ul>
          <li>Gerenciar sua conta e histórico financeiro.</li>
          <li>Sincronizar e processar notas fiscais do Gmail.</li>
          <li>Melhorar a experiência do usuário e oferecer suporte.</li>
        </ul>
      </section>
      <section>
        <h2>4. Compartilhamento de Dados</h2>
        <p>O FinMemory não compartilha seus dados pessoais com terceiros, exceto quando exigido por lei ou para garantir o funcionamento do serviço (ex: Supabase).</p>
      </section>
      <section>
        <h2>5. Segurança</h2>
        <p>Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração ou destruição.</p>
      </section>
      <section>
        <h2>6. Direitos do Usuário</h2>
        <ul>
          <li>Acessar, corrigir ou excluir seus dados pessoais.</li>
          <li>Solicitar informações sobre o tratamento dos seus dados.</li>
        </ul>
      </section>
      <section>
        <h2>7. Alterações nesta Política</h2>
        <p>Esta política pode ser atualizada periodicamente. Recomendamos que você revise regularmente.</p>
      </section>
      <section>
        <h2>8. Contato</h2>
        <p>Em caso de dúvidas, entre em contato pelo e-mail: suporte@finmemory.com</p>
      </section>
    </main>
  );
}
