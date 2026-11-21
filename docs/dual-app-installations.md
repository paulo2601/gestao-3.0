# Duas instalações do Gestão 3.0 (proposta em branch)

Esta branch prepara duas variantes de build, sem alterar a branch main.

## Builds
- Principal: `npm run build` — mantém o manifesto, ícone e nome existentes.
- Secundária: `GESTAO_APP_VARIANT=secondary npm run build` — publica nome Gestão 3.0 — 2, ícone verde e manifesto próprio.

No Windows PowerShell: `$env:GESTAO_APP_VARIANT='secondary'; npm run build`.

**Atenção:** cada build substitui o conteúdo de `dist/`. Configure **dois projetos/domínios de publicação separados**, com o mesmo código e as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Não publique os dois builds no mesmo domínio/caminho.

## Isolamento
O Supabase utiliza `storageKey` diferente por variante. Para isolamento completo, utilize **origens HTTPS diferentes**, pois isso também separa cookies, cache, service workers e demais dados locais. O segundo usuário deve ter cadastro e permissões próprias no mesmo projeto Supabase.

## Antes de publicar
1. Verificar os dois builds com `npm run typecheck`, `npm run test` e `npm run build` em CI/local.
2. Gerar ícones PNG 192 e 512 para a variante secundária se o navegador Android exigir PNG para instalação; o SVG verde atual é provisório.
3. Configurar os dois domínios autorizados em Supabase Auth (Site URL/Redirect URLs conforme os fluxos de convite e recuperação).
4. Testar login simultâneo, logout independente, recuperação de senha, passkey, cache e atualizações.
5. Testar a instalação de ambas as variantes no mesmo Samsung.
6. Revisar antes de abrir/mesclar PR na main.

Nenhum deploy é realizado automaticamente por esta documentação.
