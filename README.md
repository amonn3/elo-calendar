# elo

Protótipo local de calendário unificado, em português. Nome provisório.

## Rodar

```bash
npm ci
npm run dev
```

Abra http://localhost:5173.

## Disponível

- Calendário semanal, diário, mensal e lista da semana.
- Agendas com cores individuais e filtros de visibilidade.
- Busca por título, local e nome da agenda.
- Criar, editar e excluir eventos; escolha da conta de destino.
- Detecção de sobreposição de horários, inclusive ao salvar.
- Contas Google/Microsoft de demonstração e perfil com acesso simulado.
- Persistência no localStorage do navegador.
- Interface responsiva, navegação por teclado e modais acessíveis.

## Limites desta versão

Este é um protótipo para validação visual. Login e contas são simulados: nenhum token ou senha é solicitado. Os eventos não são enviados ao Google ou Microsoft. Para a versão real será necessário backend com sessões, armazenamento por usuário, OAuth de cada provedor e sincronização com Google Calendar API e Microsoft Graph. O fuso exibido é Fortaleza (UTC−3); a demonstração pressupõe horários desse fuso.

Para reiniciar os dados de demonstração, remova a chave `elo-demo-v1` do localStorage e recarregue a página. Os e-mails iniciais são fictícios.

## Verificar

```bash
npx tsc --noEmit
npm test
npm run build
```
