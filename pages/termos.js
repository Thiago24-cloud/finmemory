import React from 'react';

export default function Termos() {
  return React.createElement('main', { style: { padding: '2rem', maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, sans-serif' } },
    React.createElement('h1', { style: { color: '#2ECC49' } }, 'Termos de Serviço - FinMemory'),
    React.createElement('p', null, 'Última atualização: 21/01/2026'),
    React.createElement('section', null,
      React.createElement('h2', null, '1. Aceitação dos Termos'),
      React.createElement('p', null, 'Ao acessar ou utilizar o FinMemory, você concorda com estes Termos de Serviço. Caso não concorde, não utilize o serviço.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '2. Descrição do Serviço'),
      React.createElement('p', null, 'O FinMemory oferece uma plataforma para gerenciamento de histórico financeiro, sincronizando notas fiscais do Gmail e organizando suas transações.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '3. Cadastro e Segurança'),
      React.createElement('ul', null,
        React.createElement('li', null, 'Você deve fornecer informações verdadeiras e manter seus dados atualizados.'),
        React.createElement('li', null, 'O acesso ao serviço é realizado via autenticação Google OAuth.'),
        React.createElement('li', null, 'Você é responsável por manter a confidencialidade das suas credenciais.')
      )
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '4. Uso Permitido'),
      React.createElement('ul', null,
        React.createElement('li', null, 'Não utilize o FinMemory para atividades ilícitas ou que violem direitos de terceiros.'),
        React.createElement('li', null, 'O serviço é destinado ao uso pessoal e não comercial.')
      )
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '5. Privacidade'),
      React.createElement('p', null, 'O tratamento dos dados segue a Política de Privacidade do FinMemory.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '6. Limitação de Responsabilidade'),
      React.createElement('p', null, 'O FinMemory não se responsabiliza por danos decorrentes do uso ou da impossibilidade de uso do serviço, incluindo falhas técnicas ou indisponibilidade.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '7. Modificações nos Termos'),
      React.createElement('p', null, 'Estes termos podem ser alterados a qualquer momento. O uso contínuo do serviço após alterações implica aceitação das novas condições.')
    ),
    React.createElement('section', null,
      React.createElement('h2', null, '8. Contato'),
      React.createElement('p', null, 'Para dúvidas ou solicitações, entre em contato pelo e-mail: suporte@finmemory.com')
    )
  );
}
