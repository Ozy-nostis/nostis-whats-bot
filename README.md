# nostis-whats-bot (BotBrinzy)

Bot de automação para WhatsApp com painel de controle web integrado, suporte a perfis, campanhas de mensagens/figurinhas e rastreamento de métricas.

## Instalação de dependências

```bash
bun install
```

## Execução em modo de desenvolvimento

```bash
bun start
```

O dashboard estará disponível em: `http://localhost:3000`

## Compilação para Executável (.exe) Standalone

Para gerar o executável autossuficiente (`dist/BotBrinzy.exe`) contendo todo o frontend embutido em memória:

```bash
bun run build
```

O executável gerado salva todos os dados de forma persistente em `%APPDATA%\BotBrinzy` (sessão de autenticação, regras, perfis, campanhas, métricas) e arquivos temporários em `%TEMP%\BotBrinzy`.
