# SkinToUrl Do Dex — Web 2.0.0

Site: https://happiness6769.github.io/skintourl-do-dex-skins/

Aplicação estática executada integralmente no navegador e hospedada no GitHub Pages. Seleciona uma textura PNG de 64 × 64 ou 64 × 32 (até 2 MB), publica na pasta `skins/` usando a API GitHub e fornece links públicos para uso em NPCs. Nenhum aplicativo local é necessário.

## Publicar e usar

1. Escolha o PNG no site.
2. Conecte um token fine-grained de uma conta com escrita neste repositório, limitado a ele, com `Contents: Read and write`.
3. Clique em Publicar skin no GitHub. O PNG se torna público.
4. Aguarde a verificação e clique em Copiar URL. Cole o link completo no campo de skin por URL do Easy NPC.

Alternativa sem informar token ao site: use Baixar PNG preparado, abra o envio na página do GitHub, envie na pasta `skins/` e volte ao site para Verificar publicação. Esse fluxo usa sua sessão do GitHub e também exige acesso de escrita.

O token permanece apenas na memória da aba e é enviado exclusivamente para `api.github.com`. Não há tokens embutidos, persistência de credenciais, servidor próprio, serviço externo de imagens nem uploads anônimos. Visitantes podem abrir e copiar links sem login. Recarregar a aba desconecta a conta.

## Links e verificação

O endereço do site é HTML: não o use como skin. Use os links `.png` que o site libera após conferir HTTP, Content-Type, assinatura/CRC do PNG, dimensões, decodificação e SHA-256. As novas URLs usam 24 caracteres do hash no nome; colisões não sobrescrevem conteúdo. A URL GitHub Pages é preferida, com GitHub Raw como alternativa verificada. Publicar no Pages pode levar alguns minutos.

A configuração usa o proprietário e o repositório do endereço atual do site, evitando referências fixas ao nome anterior da conta. Renomear a conta/repositório ou remover arquivos pode invalidar URLs já compartilhadas. Não há garantia de hospedagem eterna. Remoção de um arquivo não apaga automaticamente cópias e histórico Git.

O PNG roxo `2258fe98de19ee34ec6c001e.png` é uma amostra de teste, não a skin de uma pessoa. Seu endereço antigo foi preservado. A listagem agrupa os dois nomes dessa mesma amostra.

## Easy NPC 1.21.1

O fluxo fornece texturas humanoides PNG 64 × 64/64 × 32. O validador da branch 1.21.1 do Easy NPC lê a imagem remota e verifica suas dimensões. O resultado dentro do jogo também depende da conexão, versão do mod e configuração do cliente/servidor. Consulte o log do cliente se o PNG abre no navegador mas não no jogo.

Referência: https://github.com/MarkusBordihn/BOs-Easy-NPC/blob/1.21.1/config-ui/Common/src/main/java/de/markusbordihn/easynpc/configui/validator/RemoteImageValidator.java

## Testes

`node --test tests/core.test.mjs` valida PNGs, URLs curtas, autenticação, conteúdo enviado, duplicatas, colisões e rejeição de HTML/links locais. Não usa credenciais reais nem envia arquivos durante os testes automatizados.
