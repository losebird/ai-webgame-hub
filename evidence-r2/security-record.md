# Security record (r2)

Browser: Playwright Chromium. Servers: wrangler dev --local, two origins, no Cloudflare account.

## Environment
- node v26.7.0
- platform darwin arm64

## Steps
- [wrangler 8787] [wrangler:info] Ready on http://127.0.0.1:8787
- [wrangler 8788] [wrangler:info] Ready on http://127.0.0.1:8788
- home zh 1440 title=游戏 · WebGame url=http://127.0.0.1:8787/zh/
- after lang switch url=http://127.0.0.1:8787/en/ title=Games · WebGame
- register after click url=http://127.0.0.1:8787/en/ body=

  WebGame
  
    Games
    Upload
    Rules
    中文
    ada
       
         
         Log out
       
  


  
  
      
        Browser games, with the prompt still attached.
   
- registered url=http://127.0.0.1:8787/en/
- uploaded html url=http://127.0.0.1:8787/en/g/OxGk4ssSmL913fOo
- zip marker=zip-ran
- likes=1
- remix prefilled starts="One-screen dodge game. The player is a lantern. "
- sandbox=allow-scripts allow-pointer-lock
- iframe probe={"cookie":"throw:SecurityError","parentRead":"throw:SecurityError","parentWrite":"throw:SecurityError"}
- parent before=http://127.0.0.1:8787/en/g/Cv6beZQGT4atutPA
- parent after=http://127.0.0.1:8787/en/g/Cv6beZQGT4atutPA
- game status=200 set-cookie=absent
- game csp=default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors http://127.0.0.1:8787; sandbox allow-scripts allow-pointer-lock
- direct top origin=https://example.com cookie=""
- evil-direct top output=ready
- evil-direct set-cookie=absent
- game-origin fetch hub api status=403
- bad zip notice=This zip has no index.html at the root or inside a single top folder. Nothing was saved.
- traversal notice=This zip contains a path that escapes its folder. Nothing was saved.

## Console
- [desktop error] Permissions policy violation: focus-without-user-activation is not allowed in this document.
- [desktop error] Permissions policy violation: focus-without-user-activation is not allowed in this document.
- [desktop error] Permissions policy violation: focus-without-user-activation is not allowed in this document.
- [desktop error] Permissions policy violation: focus-without-user-activation is not allowed in this document.
- [desktop error] Unsafe attempt to initiate navigation for frame with URL 'http://127.0.0.1:8787/en/g/Cv6beZQGT4atutPA' from frame with URL 'http://127.0.0.1:8788/run/Cv6beZQGT4atutPA/'. The frame attempting navigation of the top-level window is sandboxed, but the flag of 'allow-top-navigation' or 'allow-top-navigation-by-user-activation' is not set.

- [desktop error] Unsafe attempt to initiate navigation for frame with URL 'http://127.0.0.1:8787/en/g/Cv6beZQGT4atutPA' from frame with URL 'http://127.0.0.1:8788/run/Cv6beZQGT4atutPA/'. The frame attempting navigation of the top-level window is sandboxed, but the flag of 'allow-top-navigation' or 'allow-top-navigation-by-user-activation' is not set.

- [desktop pageerror] Failed to read the 'cookie' property from 'Document': The document is sandboxed and lacks the 'allow-same-origin' flag.

## D1 follow-up (top-level GAME_ORIGIN, no self-navigation probe)

Request: `GET http://127.0.0.1:8788/run/M2OOajon-Zphy1Ge/`

Response headers:
- set-cookie: absent
- content-security-policy includes `sandbox allow-scripts allow-pointer-lock` and `frame-ancestors http://127.0.0.1:8787`
- CSP does not include allow-same-origin, allow-top-navigation, allow-popups, or allow-forms

Playwright Chromium on that URL:
- `document.cookie` → throw:SecurityError
- `window.open(hub)` → null
- `top.location = https://example.com/hijack` did not throw, but the page URL stayed on the game origin (navigation did not complete)
- `location.origin` still reported `http://127.0.0.1:8788`. Chromium does not expose the string `"null"` for this top-level CSP sandbox; cookie access is still denied. Iframe sandbox remains the stronger isolation (opaque unique origin + blocked parent/top).

JSON: `evidence-r2/d1-direct.json`

## Game origin → hub API

`POST http://127.0.0.1:8787/api/games/x/play` with `Origin: http://127.0.0.1:8788` → 403 Forbidden origin.

