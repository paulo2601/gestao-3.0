# Gestão 3.0 — instalação dupla no Android

## Hospedagem confirmada

O aplicativo principal usa o Cloudflare **Workers Static Assets**, no Worker `gestao-3-0`, URL:
`https://gestao-3-0.pauloroberto-87.workers.dev/`.

O projeto usa `wrangler.jsonc` com assets `./dist`. Não migrar o aplicativo principal para Pages.

## Compilação e publicação da segunda versão

A branch `feature/dual-app-installations` contém:
- `wrangler.secondary.jsonc`: nome de Worker `gestao-3-0-2`, sem tocar no original.
- `GESTAO_APP_VARIANT=secondary`: gera nome, manifesto e ícone verde da segunda versão.
- Chave Supabase distinta apenas para a segunda versão. A primeira preserva a chave padrão atual para evitar deslogar usuários existentes.

Exemplo Linux/macOS/CI:
```sh
npm install --no-package-lock
npm run typecheck
npm run test
npm run build:secondary
npx wrangler deploy --config wrangler.secondary.jsonc
```

O endereço previsto para a segunda instalação, **somente após deploy**, será `https://gestao-3-0-2.pauloroberto-87.workers.dev/` (confirmar após publicar). O deploy ainda não foi executado nesta etapa.

Ambos devem usar o **mesmo projeto Supabase**, com as mesmas variáveis de build `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca incluir `service_role` no front-end.

## Pendências de validação antes de publicar

1. Conferir `npm run typecheck`, `npm run test`, `npm run build` e build secundário.
2. Confirmar que os ícones PNG 192 e 512 gerados pelo script são válidos e aparecem corretamente na instalação Android.
3. Conferir se a nova URL precisa constar nas Redirect URLs do Supabase Auth (recuperação de senha, convites, passkeys).
4. Testar logins distintos simultâneos, logout, atualização de sessão, permissões e recuperação.
5. Confirmar que ambos são instaláveis no Samsung e recebem atualização sem interferência.
6. Só depois aprovar merge/publicação.

A branch `main` e o Worker `gestao-3-0` devem permanecer intactos até aprovação explícita.
