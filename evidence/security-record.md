# Security record

Browser: system Google Chrome via Playwright. Server: local Node process, not a public URL.

## Steps
- home 1440 title=Games · Ace Shelf url=http://127.0.0.1:44585/
- play count after iframe load=1
- after arrow keys url=http://127.0.0.1:44585/g/G-_yqpvx-vnd
- registered url=http://127.0.0.1:44585/
- uploaded html url=http://127.0.0.1:44585/g/Y6iH54HFXl3y
- zip marker=zip-ran
- likes=1
- likes after reload=1
- remix prefilled starts="One-screen dodge game. The player is a lantern. " parent=G-_yqpvx-vnd
- child=http://127.0.0.1:44585/g/OlV4fcTLeDDu parent still lists remix
- sandbox=allow-scripts allow-pointer-lock
- probe={"cookie":"throw:SecurityError","parentRead":"throw:SecurityError","parentWrite":"throw:SecurityError"}
- parent before=http://127.0.0.1:44585/g/llChgJBcUUg6
- parent after=http://127.0.0.1:44585/g/llChgJBcUUg6
- game status=200 set-cookie=absent
- game csp=default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'
- bad zip notice=This zip has no index.html at the root or inside a single top folder. Nothing was saved.
- traversal notice=This zip contains a path that escapes its folder. Nothing was saved.

## Console
- [desktop error] Unsafe attempt to initiate navigation for frame with origin 'http://127.0.0.1:44585' from frame with URL 'http://127.0.0.1:44585/run/llChgJBcUUg6/'. The frame attempting navigation of the top-level window is sandboxed, but the flag of 'allow-top-navigation' or 'allow-top-navigation-by-user-activation' is not set.

- [desktop error] Unsafe attempt to initiate navigation for frame with origin 'http://127.0.0.1:44585' from frame with URL 'http://127.0.0.1:44585/run/llChgJBcUUg6/'. The frame attempting navigation of the top-level window is sandboxed, but the flag of 'allow-top-navigation' or 'allow-top-navigation-by-user-activation' is not set.

