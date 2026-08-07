# Diretrizes de Desenvolvimento e Proteção do Projeto (Crane Pro)

## 1. Regra da Fronteira Restrita de Módulos (Domain Isolation Rule)
- Sempre que você for implementar ou modificar uma funcionalidade solicitada pelo usuário, você DEVE alterar APENAS os arquivos do módulo correspondente dentro do repositório:
  - Autenticação e Login: `/src/modules/auth/` e `src/auth.js`
  - Empresas: `/src/modules/companies/`
  - Ativos Técnicos: `/src/modules/assets/`
  - Agendamento / Calendário: `/src/modules/scheduling/`
  - Relatórios Finalizados: `/src/modules/reports/`
  - Checklist: `/src/modules/checklist/`
- É ESTRITAMENTE PROIBIDO modificar arquivos de outros módulos não relacionados à tarefa atual sem permissão explícita.

## 2. Validação Obrigatória de Regressão (Anti-Regression Rule)
- Antes de declarar qualquer tarefa concluída ou propor finalizar uma alteração, você DEVE obrigatoriamente executar o comando de teste:
  `npm test`
- Todos os testes devem passar (100% pass) antes de confirmar o término da tarefa.
- Se algum teste falhar ou se o build falhar (`npm run build`), você deve corrigir imediatamente o efeito colateral antes de entregar o resultado.

## 3. Preservação de Contratos de Interface e Funções Globais
- Para não quebrar o HTML existente, se uma função global (`window.funcao`) for necessária, ela deve apenas delegar para o módulo correspondente isolado em `/src/modules/`.
