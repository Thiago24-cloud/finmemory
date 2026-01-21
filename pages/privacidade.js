import React from 'react';

export default function Privacidade() {
  return React.createElement('main', { style: { padding: '2rem', maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, sans-serif' } },
    React.createElement('h1', { style: { color: '#764ba2' } }, 'Política de Privacidade - FinMemory'),
    React.createElement('p', null, 'Última atualização: 21/01/2026'),
    React.createElement('section', null,
      React.createElement('h2', null, '1. Introdução'),
      React.createElement('p', null, 'O FinMemory valoriza a privacidade dos seus usuários e está comprometido em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '2. Informações Coletadas'),
      React.createElement('ul', null,
        React.createElement('li', null, React.createElement('strong', null, 'Dados de cadastro:'), ' Nome, e-mail, identificador do Google.'),
        React.createElement('li', null, React.createElement('strong', null, 'Dados de acesso:'), ' Tokens de autenticação para integração com o Gmail.'),
        React.createElement('li', null, React.createElement('strong', null, 'Dados financeiros:'), ' Informações de notas fiscais extraídas do Gmail.')
      )
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '3. Uso das Informações'),
      React.createElement('ul', null,
        React.createElement('li', null, 'Gerenciar sua conta e histórico financeiro.'),
        React.createElement('li', null, 'Sincronizar e processar notas fiscais do Gmail.'),
        React.createElement('li', null, 'Melhorar a experiência do usuário e oferecer suporte.')
      )
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '4. Compartilhamento de Dados'),
      React.createElement('p', null, 'O FinMemory não compartilha seus dados pessoais com terceiros, exceto quando exigido por lei ou para garantir o funcionamento do serviço (ex: Supabase).')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '5. Segurança'),
      React.createElement('p', null, 'Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração ou destruição.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '6. Direitos do Usuário'),
      React.createElement('ul', null,
        React.createElement('li', null, 'Acessar, corrigir ou excluir seus dados pessoais.'),
        React.createElement('li', null, 'Solicitar informações sobre o tratamento dos seus dados.')
      )
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '7. Alterações nesta Política'),
      React.createElement('p', null, 'Esta política pode ser atualizada periodicamente. Recomendamos que você revise regularmente.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '8. Contato'),
      React.createElement('p', null, 'Em caso de dúvidas, entre em contato pelo e-mail: suporte@finmemory.com')
    )
  );
}
