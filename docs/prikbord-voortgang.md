# Prikbord: voortgang en overdracht

Elke mijlpaal krijgt een nieuwe chat (afspraak met Oscar, 8 nov 2026). Dit
bestand is het geheugen tussen die chats. Leidend blijft
`docs/prikbord-spec.md`. Afwijkingen staan in `docs/prikbord-afwijkingen.md`;
lees vooral A3 (eigen repo, andere paden).

**Bij een nieuwe chat:**
- Kies de cloudomgeving **"Tezt"**. Die laat naast de package registries ook
  `developers.cloudflare.com` en `operations.osmfoundation.org` door.
- Een nieuwe sessie start vanaf `main`. Werk dat nog niet op `main` staat,
  zit op de werkbranch van de vorige mijlpaal (zie de tabel). Merge die eerst
  in je eigen werkbranch.
- Haal `oscardillewaard-ai/Tezt` erbij (alleen lezen) voor de bestanden uit §3
  van de spec en voor Leaflet.
- Lees externe sites met `curl` in Bash. WebFetch gaat niet via de proxy van
  de sessie en blijft de toegestane hosts weigeren.

## Status

| Mijlpaal | Status | Werkbranch in `prikbord` |
| --- | --- | --- |
| M0 lezen en plan | klaar, akkoord van Oscar (8 nov) | `ccr-dd7e09d5-7p41e5` |
| M1 fundament en uiterlijk | nog niet begonnen | |
| M2 het bord | nog niet begonnen | |
| M3 samen | nog niet begonnen | |
| M4 link, foto en kaart | nog niet begonnen | |
| M5 afronden | nog niet begonnen | |

## Plan uit M0: wat ik overneem en waar ik afwijk

1. **Van Tarapp:** network-first `sw.js`, `updateViaCache: 'none'`, `reg.update()` bij terugkomen, herladen via `reloadWhenIdle`, `CHANGELOG` met `seenVersion`, `requestPersistence`, export via `navigator.share` met download als terugval, "Nu bijwerken", de iOS-meta-tags, fonts met OFL in `fonts/`, iconen via sharp.
2. **Van Parkenjacht:** groepscode (`getRandomValues`, base64url), de `#koppel=`-link (met bordnaam `n` erbij), sync-lus met "gewijzigd"-vlag en max. 3 keer opnieuw sturen, statusbolletje, worker met CORS-lijst, validatie (`clean`), `findKv` en de statuspagina met neerzet-stappen in gewone taal. Leaflet uit `vendor/`.
3. **Anders, zoals de spec vraagt:** per veld samenvoegen in plaats van per park, met een vaste keuze bij een gelijk tijdstip. Parkenjacht houdt dan de eigen waarde, en dat is niet commutatief. Verder: alleen gewijzigde briefjes versturen, `rev` als hash, `?sinds=`, 1,5 s bundelen, en een mislukte KV-`put` afvangen met een status waarop de app het opnieuw probeert.
4. **A1:** caches alleen opruimen als ze met `prikbord-` beginnen.
5. **A2:** de statuspagina van de worker schrijft niet bij elk bezoek naar KV.
6. **A3:** een eigen repo, met eigen deploy, lint en tests.
7. **Puur en testbaar:** `merge`, `layout`, `seed`, `validate` en de koppel-link zonder DOM en zonder opslag, met `now` als argument. Tests via `node --test tests/*.test.mjs`.
8. **Grote PUT's:** de eerste koppeling van een groot bord gaat in delen van onder de 256 KB.
9. **Overdracht:** dit bestand per mijlpaal bijwerken, met aan het eind een startprompt voor de volgende chat.

## Besluiten van Oscar

8 nov 2026:

- **M0:** "Klinkt allemaal goed": akkoord met het plan, A1, A2 en de aannames.
- **V1, lint in Tezt:** vervallen door de eigen repo. `npm run lint` in Tezt is nog steeds rood door Tarapp (`useEmoji`), en dat is niet aangepakt.
- **V2, cache-bug in Tarapp en Parkenjacht:** ja, repareren. Gedaan in Tezt, commit `3cf0159` op branch `ccr-dd7e09d5-7p41e5` (Tarapp 34, Parkenjacht 4). Getest in Chromium. **Nog niet gedeployd**: daar is apart akkoord van Oscar voor nodig.
- **V3, volgorde in M1:** eerst het skelet plus 3 stijlvoorstellen (screenshots op 390 px), dan kiest Oscar, en pas daarna het scheur-en-prik-moment in de gekozen stijl. Allemaal in de M1-chat.
- **V4, eigen repo:** ja → `oscardillewaard-ai/prikbord` (zie A3).
- **Netwerk:** de cloudomgeving "Tezt" is aangemaakt.

## Nagelezen in de documentatie (8 nov 2026, via curl)

- **Cloudflare KV-limieten** (developers.cloudflare.com/kv/platform/limits): gratis plan 100.000 reads per dag, 1.000 writes per dag, 1 write per seconde op dezelfde sleutel, 1 GB opslag per account, max. 25 MiB per waarde, sleutel max. 512 bytes. Komt overeen met §6.3.
- **KV is "uiteindelijk consistent"** (developers.cloudflare.com/kv/concepts/how-kv-works): "Changes are usually immediately visible in the Cloudflare global network location at which they are made. Changes may take up to 60 seconds or more to be visible in other global network locations". Ook op dezelfde locatie is dat "not guaranteed". Gevolg: meestal zie je een wijziging binnen een paar tellen, soms pas na een minuut. Het opnieuw sturen uit §6.3 vangt verloren schrijfacties op, en de convergentietest moet ook verouderde reads nabootsen.
- **Nominatim-beleid** (operations.osmfoundation.org/policies/nominatim): absoluut max. 1 verzoek per seconde voor alle gebruikers samen. De app identificeren met een Referer of User-Agent (een e-mailadres is niet verplicht). Duidelijke bronvermelding. Uit te zetten zonder app-update. Bij voorkeur via een proxy met cache. Autocomplete is verboden, net als systematische zoekopdrachten. Nieuw sinds de spec: een sectie "Usage in LLMs". Daarin staat dat het publieke API alleen gebruikt mag worden als "the application developer has made a deliberate, informed decision to use it and is directly responsible for complying with this policy". Dat is Oscar: hij koos Nominatim zelf in de spec, en dit is hem verteld.

## Aannames die ik aanhoud (tenzij Oscar anders zegt)

- **Dubbeltik = hartje** (§5.5) betekent dat een enkele tik ongeveer 250 ms wacht voordat het briefje opent. Instagram doet dat ook. Uitproberen in M2.
- **Trillen:** voor zover ik weet heeft Safari op de iPhone geen Vibration API (niet getest). Optillen trilt dan alleen op Android.
- **Nominatim-User-Agent (M4):** `Prikbord/1.0 (+https://github.com/oscardillewaard-ai/prikbord)`, zonder e-mailadres.
- **Tests in de deploy-workflow:** ja, nu het een eigen repo is (A3). Lint en `node --test` houden de deploy tegen. De Playwright-rooktest draait lokaal.
- **Handschriftletter:** zowel Caveat als Patrick Hand in de stijlvoorstellen, zodat Oscar kiest.
- **Pages:** uit mijn kennis, niet nagelezen: op het gratis GitHub-plan werkt Pages alleen voor publieke repo's. `prikbord` is publiek.

## Bevindingen buiten Prikbord

- **Cache-bug in Tarapp en Parkenjacht:** gerepareerd in Tezt (`3cf0159`), nog niet gedeployd (zie V2).
- **De statuspagina van Parkenjacht** schrijft bij elk bezoek naar KV. Niet aangepakt, en Prikbord doet het anders (A2).
- **`npm run lint` in Tezt is rood** door Tarapp (sinds `9d838b1`). Niet aangepakt. De deploy van Tezt draait geen lint.

## Logboek

### M0 (8 nov 2026)

- Gelezen: alle bestanden uit §3 van de spec (in Tezt).
- Nulmeting in Tezt: build groen, lint rood (3 fouten door `useEmoji` in Tarapp), deploybranch gelijk aan de werkbranch (`0c82ec8`).
- Getest: of Cache Storage gedeeld wordt over mappen op één domein (ja, Chromium), en de lint-override (werkt, maar is vervallen).
- Cloudomgeving "Tezt" aangemaakt. KV-docs en Nominatim-beleid nagelezen.
- Oscar koos voor een eigen repo. De docs zijn overgezet naar `oscardillewaard-ai/prikbord`, met A3 erbij.
- In Tezt: cache-fix voor Tarapp en Parkenjacht (`3cf0159`), getest in Chromium (vóór en na).

## Startprompt voor M1

Plak dit in een nieuwe chat met repo `oscardillewaard-ai/prikbord` en omgeving "Tezt":

```
Prikbord, mijlpaal M1. Je werkt in de repo oscardillewaard-ai/prikbord.
1. Merge eerst het werk uit M0 in je werkbranch:
   git fetch origin ccr-dd7e09d5-7p41e5 && git merge origin/ccr-dd7e09d5-7p41e5
2. Lees docs/prikbord-spec.md (leidend), docs/prikbord-afwijkingen.md (vooral A3:
   eigen repo, andere paden) en docs/prikbord-voortgang.md (besluiten, aannames,
   nagelezen docs).
3. Haal oscardillewaard-ai/Tezt erbij (alleen lezen) voor de bestanden uit §3 van de
   spec en voor Leaflet.
4. Doe M1 zoals afgesproken (V3): eerst het skelet plus 3 stijlvoorstellen als
   screenshots op 390 px, dan wachten op mijn keuze, daarna het scheur-en-prik-moment.
   Werk aan het eind docs/prikbord-voortgang.md bij, met een startprompt voor M2.
```
