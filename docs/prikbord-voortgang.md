# Prikbord: voortgang en overdracht

Elke mijlpaal krijgt een nieuwe chat (afspraak met Oscar, 8 nov 2026). Dit
bestand is het geheugen tussen die chats. Leidend blijft
`docs/prikbord-spec.md`. Afwijkingen staan in `docs/prikbord-afwijkingen.md`;
lees vooral A3 (eigen repo, andere paden), A4 (categorieën nooit wissen) en
A5 (de worker wordt gebouwd met `npm run worker`).

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
| M1 fundament en uiterlijk | klaar en gedeployd (8 nov, akkoord van Oscar), staat op `main`; testlijst voor de telefoon hieronder | `ccr-d21b9af2-gogh6f` |
| M2 het bord | klaar en gedeployd (9 nov, akkoord van Oscar), staat op `main`; testlijst voor de telefoon hieronder | `ccr-eb14dc7d-18clpv` |
| M3 samen | klaar, wacht op Oscar: worker neerzetten en testen met twee telefoons (nog niet gedeployd) | `ccr-fc257cf9-70gzqa` |
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
- **V6, deploy M1:** "Pages staat aan, deploy maar". `main` is fast-forward gezet naar `7370f1d`; workflow-run 1 (lint, tests, deploy). Live op `https://oscardillewaard-ai.github.io/prikbord/`. Deze cloudsessie kan `github.io` niet openen (de proxy weigert de host), dus de live site is niet door mij bekeken; dat doet Oscar met de testlijst.
- **V5, stijl (M1):** "Bord a maar schoolschrift op de briefjes". Uitgewerkt als: van A het kurk, de houten lijst, de kop, de tabbalk, de knoppen en de bolle punaises (die horen bij het bord); van C het papier: kleuren, lijntjes, de gaatjes van de scheurlijn bovenaan, de licht gescheurde onderkant, Caveat vet in balpenblauw. Het scheurblokje is ook kladblokpapier (het is tenslotte een stapel briefjes). De punaises van C (speldenknoppen) en de lijst van C zijn niet gebruikt; dat is mijn invulling, Oscar kan het omgooien.

9 nov 2026:

- **V7, deploy M2:** "Deploy en geef prompt". `main` is fast-forward gezet naar `99d6957` (M2 deel 2); workflow-run 3 (lint, tests, deploy). Live op `https://oscardillewaard-ai.github.io/prikbord/` (versie 2). Ook nu niet zelf bekeken: deze cloudsessie kan `github.io` niet openen. Dat doet Oscar met de testlijst van M2.
- **A4 (categorieën nooit wissen):** "A4 akkoord" (bij de start van M3).

## Nagelezen in de documentatie (via curl)

- **Cloudflare Workers-limieten** (developers.cloudflare.com/workers/platform/limits, nagelezen op 9 nov 2026): gratis plan 10 ms CPU-tijd per verzoek (wachten op KV telt niet mee) en 100.000 verzoeken per dag. Gaat een verzoek over de 10 ms, dan geeft Cloudflare "Error 1102: Worker exceeded resource limits", en in het dashboard staat dat onder Metrics → Errors → Invocation Statuses als "Exceeded CPU Time Limits".

- **Cloudflare KV-limieten** (developers.cloudflare.com/kv/platform/limits): gratis plan 100.000 reads per dag, 1.000 writes per dag, 1 write per seconde op dezelfde sleutel, 1 GB opslag per account, max. 25 MiB per waarde, sleutel max. 512 bytes. Komt overeen met §6.3.
- **KV is "uiteindelijk consistent"** (developers.cloudflare.com/kv/concepts/how-kv-works): "Changes are usually immediately visible in the Cloudflare global network location at which they are made. Changes may take up to 60 seconds or more to be visible in other global network locations". Ook op dezelfde locatie is dat "not guaranteed". Gevolg: meestal zie je een wijziging binnen een paar tellen, soms pas na een minuut. Het opnieuw sturen uit §6.3 vangt verloren schrijfacties op, en de convergentietest moet ook verouderde reads nabootsen.
- **Nominatim-beleid** (operations.osmfoundation.org/policies/nominatim): absoluut max. 1 verzoek per seconde voor alle gebruikers samen. De app identificeren met een Referer of User-Agent (een e-mailadres is niet verplicht). Duidelijke bronvermelding. Uit te zetten zonder app-update. Bij voorkeur via een proxy met cache. Autocomplete is verboden, net als systematische zoekopdrachten. Nieuw sinds de spec: een sectie "Usage in LLMs". Daarin staat dat het publieke API alleen gebruikt mag worden als "the application developer has made a deliberate, informed decision to use it and is directly responsible for complying with this policy". Dat is Oscar: hij koos Nominatim zelf in de spec, en dit is hem verteld.

## Aannames die ik aanhoud (tenzij Oscar anders zegt)

Nieuw in M3 (samen):

- **Wie ben jij?** Bij een nieuwe installatie meteen bij de eerste start (met "Later"). Wie al een bord had uit M1 of M2, krijgt de vraag niet ongevraagd na de update: hij komt bij delen of koppelen (anders heet je bij de anderen "Ik"), en staat altijd onder Meer → Wie ben ik. De gekozen naam komt op elk bord waar je nog "Ik" heette, en is de standaard voor nieuwe borden. Per bord kun je een andere naam en kleur kiezen.
- **Kleur:** automatisch de eerste vrije op dat bord. Twee mensen die precies tegelijk koppelen, kunnen dezelfde kleur krijgen; aanpassen kan, en bij de kleurkeuze staat de eerste letter van wie die kleur al heeft.
- **Een leeg beginbord ruimen we op bij het koppelen:** een bord zonder briefjes, niet gedeeld, en met naam, emoji en categorieën nooit aangepast. Anders heeft Tara na haar eerste koppel-link twee borden die "Thuis" heten. Er gaat niets verloren.
- **Koppel-link op de iPhone:** een link in WhatsApp opent in Safari, niet in de app op het beginscherm, en die twee bewaren hun briefjes apart (uit mijn kennis van iOS, niet getest). Daarom staat er in Safari een tip met "Link kopiëren", en in de app "Ik heb een koppel-link" om te plakken. Het hele berichtje plakken mag ook.
- **Koppelen vraagt internet:** het bord wordt eerst opgehaald, want voor "Wie ben jij?" zijn de leden nodig. Lukt dat niet, dan een melding met "Opnieuw proberen". Staat het bord nog niet op de server (de ander deelde zonder internet), dan zegt de app dat in gewone taal.
- **Bundelen:** 1,5 s na de laatste wijziging, maar nooit later dan 6 s na de eerste. Anders kan een lange reeks hartjes het versturen eindeloos uitstellen.
- **Peilen:** "er gebeurde iets" = een eigen wijziging of iets van een ander. Het openen van de app telt niet mee, dus dan wordt er elke 30 s gepeild tot er iets gebeurt (zo staat het in §6.3). Gevolg voor de test: opent Oscar net de app en prikt Tara iets, dan kan het tot 30 s duren. Het actieve bord wordt ook gepeild als je op Meer of in de Gedaan-doos staat.
- **Statusbolletje:** alleen op gedeelde borden. Het wordt pas geel als een ronde langer dan een halve seconde duurt; anders knippert het elke 10 s.
- **Meldingen:** alleen voor nieuwe briefjes van anderen ("📌 Tara prikte …"), niet voor hartjes, verplaatsen of gedaan; dat zouden er te veel worden. Een melding met "Ongedaan maken" wordt niet weggedrukt: de melding van de sync wacht even.
- **Nieuw-stickertje:** op briefjes van anderen die binnenkwamen terwijl je weg was of keek. Het gaat eraf als je het briefje opent, of de volgende keer nadat het in beeld was (bij wegklikken van de app of wisselen van bord). Bij het koppelen zelf krijgt niets een stickertje, anders is alles "nieuw".
- **Bord verlaten:** is het bord niet gedeeld, dan zijn alle briefjes weg; dat staat duidelijk in de vraag. Wie zijn laatste bord verlaat, krijgt een vers bord "Thuis". Bij de anderen blijf je als lid bestaan (leden worden nooit weggehaald), dus "💞 Iedereen zin" telt je nog mee. Dat wil Oscar misschien anders.
- **Een ander haalt het briefje weg dat jij groot open hebt:** het sluit, met "🗑️ Dit briefje is net door een ander weggehaald". Past een ander het aan terwijl je kijkt, dan wordt het bijgewerkt. Tijdens het schrijven gebeurt er niets; prik je een briefje dat intussen weg is, dan wordt het een nieuw briefje (zoals al in M1).
- **Kapotte opslag:** gaat `prikbord.v1` kapot, dan blijven de koppelingen in `prikbord.sync` staan, maar de borden zijn weg. Terughalen kan nu alleen met de koppel-link. Idee voor later: "bord terughalen" vanuit zo'n losse koppeling.
- **Een bord dat al op de telefoon stond** (bijv. uit een back-up) voegt bij het koppelen samen, zonder opnieuw "Wie ben jij?" te vragen.
- **Sync-verzoeken** hebben een time-out van 20 s. Bij het wegklikken van de app gaat een wijziging die nog wachtte meteen mee (als `keepalive`); lukt dat niet, dan de volgende keer.
- **`DEFAULT_SYNC_URL` is nog leeg:** bij "Bord delen" vul je het adres van de worker in (alleen https, of localhost om te testen). De koppel-link neemt het adres mee, dus de tweede telefoon hoeft niets in te vullen. Zodra de worker staat, komt het adres in `public/js/app.js` en verdwijnt het veld.

Nieuw in M2 (het bord):

- **Filters worden niet bewaard.** Bij elke start staat het bord weer op "Alles", zodat je nooit per ongeluk de helft van het bord mist. Sorteren en netjes/vrij worden wél per telefoon en per bord onthouden (`apparaat.sorteer`, `apparaat.weergave`). Eén filter geldt voor het bord én de Gedaan-doos.
- **Combinatie van filters:** categorieën onderling = "of" (Recepten of Uit eten), samen met "💞 Iedereen zin" = "en". Verborgen categorieën staan alleen in de filterbalk als er nog briefjes van zijn.
- **"💞 Iedereen zin"** = elk lid in `bord.leden` gaf een hartje. Met één lid (M2) is dat dus "ik gaf een hartje". In M3 tellen ook leden die het bord verlieten mee (leden worden nooit weggehaald); misschien wil Oscar dat anders.
- **Dubbeltik zet een hartje alleen áán**, net als Instagram. Uitzetten kan met de hartje-knop op het geopende briefje. Een enkele tik wacht 250 ms; met het toetsenbord (Enter) opent een briefje meteen. In de Gedaan-doos opent een tik meteen (daar geen dubbeltik).
- **Een nieuw of teruggehangen briefje dat niet door het filter komt**, zet het filter op "Alles", anders zie je het niet landen.
- **Gedaan:** de datum mag niet in de toekomst liggen (`max` = vandaag). "Ongedaan maken" staat 5 tellen in de melding. Een foto bij "Gedaan!" komt in M4 (foto's horen daar); het formulier heeft er nog geen knop voor.
- **"Terughangen" heeft twee betekenissen**, allebei letterlijk "terug op het bord": op een geopend briefje sluit het (zoals in M1), in de Gedaan-doos haalt het een briefje uit de doos. Daar heet sluiten "Sluiten".
- **Trek een briefje 🎲** staat alleen op het bord, niet in de Gedaan-doos (iets trekken wat al gedaan is, heeft weinig zin). Het getrokken briefje heeft precies de twee knoppen uit de spec; voor bewerken of gedaan tik je het daarna gewoon aan.
- **Vrij, maten:** het bord is 1000 eenheden breed, een briefje 230 (4 per rij). Bij zoom 1 is een briefje 170 px, net als netjes op een telefoon. Standaard zie je het hele bord in de breedte (op 390 px is een briefje dan ~86 px, de letter ~11 px: een overzicht, zoals een echt prikbord van een afstandje). Inzoomen tot 2,5×. Zoom en positie worden niet bewaard.
- **Vrij, eerste lege plek:** in vakjes van 245 × 235 eenheden, rij voor rij, met de vaste maat van een vakje in plaats van de gemeten hoogte. Zo komt elke telefoon op dezelfde plek uit (de letter kan per toestel net anders vallen). Een vakje telt als bezet als een briefje er voor 70% overheen hangt.
- **Vrij, vastzetten:** bij de eerste sleepbeweging krijgen álle briefjes zonder vrije plek hun huidige plek vast (`vrij` met tijdstempel). Anders kan een briefje verspringen als je er een ander bovenop legt. Gevolg voor M3: de eerste sleepbeweging op een bord verandert elk briefje één keer. Dat is één gebundelde PUT, daarna alleen nog het gesleepte briefje. Nagerekend (8 nov, met de echte modelfuncties): 300 briefjes van 80 tekens met vrije plek, stapel en twee hartjes = ~125 KB; 300 volle briefjes (500 tekens) = ~248 KB, net onder de 256 KB. M3 moet zo'n grote PUT dus in delen kunnen sturen (dat stond al in het plan uit M0, punt 8). Het neergezette briefje komt bovenop (`stapel` = hoogste + 1).
- **Vrij, toetsenbord:** briefjes verplaatsen met het toetsenbord kan nog niet. Iets voor de toegankelijkheid in M5.
- **Netjes of vrij** staat als schakelaar rechts in de kop (alleen op het bord). Sorteren is de eerste chip in de filterbalk (niet in vrij: daar ligt de plek vast). 🎲 staat vast rechts naast de chips.
- **Categorie-editor:** de kleur kies je uit de 10 papierkleuren (zie M1), de emoji typ je of kies je uit 24 voorstellen. Nooit wissen, alleen verbergen (A4). Minstens één categorie moet zichtbaar blijven. Een briefje in een verborgen categorie houdt bij bewerken die categorie (het tabje staat er dan gewoon bij).
- **Laatste back-up** staat onder Meer (`apparaat.laatsteBackup`, alleen op deze telefoon). Bij het deelmenu telt hij als gemaakt zodra het deelmenu "gelukt" zegt; of het bestand echt bewaard is, weet de app niet.

Nieuw in M1, deel 2 (scheur-en-prik-moment):

- **Standaardcategorie van een nieuw briefje** is de laatst gebruikte op dit bord (`apparaat.laatsteCat`, per telefoon), anders de eerste. Het blokje heeft al die papierkleur, zodat het vel dat je afscheurt dezelfde kleur heeft als het briefje.
- **De 5 tellen "Ongedaan maken"** lopen vanaf het moment dat de melding verschijnt, dus na de valanimatie (~0,5 s). Anders hou je minder dan 5 tellen over.
- **Trillen bij de tok** (8 ms, `navigator.vibrate`) waar de browser dat kan. Op de iPhone gebeurt er niets (zie M0).
- **Toetsenbord op de iPhone:** het tekstvak krijgt focus nog binnen de tik op het blokje, anders komt het toetsenbord niet omhoog. Bij een concept na herstart lukt dat niet (geen tik); dan tik je zelf in het vel. Niet getest op een iPhone.
- **Nieuw briefje terwijl je ver naar beneden gescrold bent:** het bord schuift onder het vel naar boven, zodat je het briefje ziet landen. Werkt in Chromium met de pagina op slot (`overflow: hidden`); in Safari nog niet gezien.
- **Geluid** komt uit de Web Audio API (geen bestanden). Op de iPhone volgt dat de stilteschakelaar: staat die op stil, dan hoor je niets (uit mijn kennis, niet getest).
- **Snippers en "rrrits"** komen ook bij het heropenen van een concept via het blokje: het ligt op het blokje klaar, dus je scheurt het er opnieuw af.

Nieuw in M1, deel 1:

- **Papierkleur als naam, niet als kleurcode.** Een categorie bewaart `zon`, `lucht`, `salie` … (10 kleuren, `PAPIER` in `validate.js`); de stijl bepaalt de tint. Zo blijft de inkt op elke kleur leesbaar (M5) en verandert een stijlwissel alle briefjes netjes mee. Gevolg voor M2: de categorie-editor kiest uit die 10 kleuren, niet uit een vrije kleurkiezer. Punaisekleuren werken net zo (`PUNAISE`, 8 kleuren).
- **Wie ben jij?** In M1 heet het enige lid "Ik" (kleur rood). Een naam kiezen bij de eerste start hoort bij de leden (M3), of eerder als Oscar dat wil.
- **Weghalen en de app wegklikken:** binnen de 5 tellen "Ongedaan maken" naar de achtergrond gaan, zet de grafsteen meteen. Je had het al bevestigd, en een briefje dat na het weghalen terugkomt, is verwarrender.
- **Enkele tik opent meteen** (M1). Zodra dubbeltik = hartje komt (M2), wacht een enkele tik ~250 ms.
- **Back-up exporteren en importeren zit al in M1** (regel 8 van §4.1 hoort bij het skelet). Importeren voegt per veld samen via `merge.js`, dat dus al af en getest is. "Met of zonder foto's" komt in M4.
- **Toast als popover**, zodat een melding ook boven een open venster ligt. Popover werkt vanaf Safari 17; op oudere iPhones staat de melding gewoon onderin (niet getest op een echte oude iPhone).
- **Minimale iOS-versie:** `color-mix()` (punaises, iOS 16.2+), `:has()` (focusrand, iOS 15.4+) en `<dialog>` (iOS 15.4+). Op ouder dan 16.2 missen alleen de schaduwtinten van de punaises. Uit mijn kennis, niet nagemeten op een toestel.

Uit M0:

- **Dubbeltik = hartje** (§5.5) betekent dat een enkele tik ongeveer 250 ms wacht voordat het briefje opent. Instagram doet dat ook. Uitproberen in M2.
- **Trillen:** voor zover ik weet heeft Safari op de iPhone geen Vibration API (niet getest). Optillen trilt dan alleen op Android.
- **Nominatim-User-Agent (M4):** `Prikbord/1.0 (+https://github.com/oscardillewaard-ai/prikbord)`, zonder e-mailadres.
- **Tests in de deploy-workflow:** ja, nu het een eigen repo is (A3). Lint en `node --test` houden de deploy tegen. De Playwright-rooktest draait lokaal.
- **Handschriftletter:** Caveat (vet, 700) is gekozen via de stijl (V5). Patrick Hand en Caveat 500 zijn weg.
- **Pages:** uit mijn kennis, niet nagelezen: op het gratis GitHub-plan werkt Pages alleen voor publieke repo's. `prikbord` is publiek.

## Bevindingen buiten Prikbord

- **Cache-bug in Tarapp en Parkenjacht:** gerepareerd in Tezt (`3cf0159`), nog niet gedeployd (zie V2).
- **De statuspagina van Parkenjacht** schrijft bij elk bezoek naar KV. Niet aangepakt, en Prikbord doet het anders (A2).
- **`npm run lint` in Tezt is rood** door Tarapp (sinds `9d838b1`). Niet aangepakt. De deploy van Tezt draait geen lint.

## Logboek

### M3 (9 nov 2026): samen

- **Gedaan, in volgorde van de spec (§8):**
  - **Worker** (`proxy/prikbord-sync-worker.js`, gebouwd uit `proxy/prikbord-worker-kern.js` met de echte `validate.js` en `merge.js`, zie A5): `GET /bord/<code>` (volledige stand + `rev`), `GET …?sinds=<rev>` (kort `{ rev, ongewijzigd: true }`), `PUT /bord/<code>` met alleen de gewijzigde briefjes (per veld samenvoegen, alleen schrijven als er echt iets veranderde, volledige stand terug). `rev` = SHA-256 van de opgeslagen stand, bewaard als KV-metadata in dezelfde schrijfactie. Mislukte KV-put of -get → 503 `{ opnieuw: true }` met `Retry-After`. Max. 256 KB per PUT (413), één groepscode = één bord (409), CORS alleen voor `https://oscardillewaard-ai.github.io` en localhost. Statuspagina op `/` in gewone taal, zonder schrijfactie (A2; `?schrijftest=1` schrijft wel). Eigen binding `PRIKBORD`, met dezelfde terugval als Parkenjacht (de eerste KV-binding) plus een waarschuwing. De neerzet-stappen staan bovenin het bestand en hieronder.
  - **Sync-motor** (`public/js/sync.js`, zonder DOM): onthoudt de laatste stand van de server; wat de telefoon nieuwer heeft, is het verschil. Er is dus geen "gewijzigd"-vlag die kwijt kan raken: na elk antwoord (en na een herstart) wordt het verschil opnieuw uitgerekend. Alleen gewijzigde briefjes, categorieën en leden gaan mee, in delen onder de 200 KB met 1,1 s ertussen (KV: 1 schrijfactie per seconde). Na elk antwoord: heeft de telefoon nog iets nieuwers, dan opnieuw sturen (max. 3 keer per ronde); bij 503 na 1 à 2,5 s opnieuw. Eén ronde per bord tegelijk.
  - **Meerdere borden** (§5.1): tik op de bordnaam bovenin → alle borden, met wie erop zit, de syncstatus en "n nieuw"; "Nieuw bord" (thuis-categorieën of leeg), "Ik heb een koppel-link". Onder Meer: naam en emoji van het bord, bord verlaten (alleen van deze telefoon). Filter en 🎲 gaan bij wisselen terug naar "Alles".
  - **Koppel-link** `…/#koppel=<base64url van { u, r, n }>`: delen via het deelmenu (anders kopiëren), met "Iedereen met deze link kan meekijken en prikken". Openen geeft "Bord 'Thuis' toevoegen?", de link verdwijnt uit de adresbalk, en er gaat niets verloren (staat het bord er al, dan samenvoegen). Plakken werkt ook, het hele berichtje mag.
  - **Leden** (§5.1): "Wie ben jij?" bij de eerste start, naam en punaisekleur per bord onder Meer → Wie ben ik, en "Dit ben ik al" bij het koppelen, zodat een tweede toestel hetzelfde lid is en hartjes niet dubbel tellen.
  - **Peilen** (§6.3): 1,5 s bundelen (max. 6 s), elke 10 s als er de laatste 5 minuten iets gebeurde en anders 30 s, alleen het actieve bord en alleen als de app in beeld is; meteen bij terugkomen en bij `online`; bij het openen alle gedeelde borden één keer.
  - **Statusbolletje** naast de bordnaam: groen (gesynchroniseerd om …), geel (bezig), grijs (offline: "je wijzigingen gaan mee zodra het weer lukt"), oranje (fout, in gewone taal). De tekst staat ook onder Meer → Samen prikken en in de bordenlijst.
  - **Meldingen** (§5.1): "📌 Tara prikte 'Sushi in Den Haag'", "📌 2 nieuwe briefjes sinds je vorige bezoek", een rood NIEUW-stickertje op briefjes die je nog niet zag (per telefoon, `apparaat.nieuw`), en een tellertje in de kop als er op een ander bord iets nieuws hangt.
- **Nieuw in het datamodel:** `zetLid`, `zetInfo` en `ledenVan` (`model.js`), `apparaat.naam` en `apparaat.nieuw` (in plaats van het ongebruikte `apparaat.gezien`), en `prikbord.sync` = `{ url, borden: { bordId: { u, r } } }` met `schoonSync` en `schoonAdres` (`validate.js`).
- **Release:** versie 3 (`APP_VERSION`, `CACHE` = `prikbord-v3`, `CHANGELOG`), `sync.js` in `SHELL`.
- **Getest:**
  - `npm test`: 80 groen (was 50). Nieuw: `tests/worker.test.mjs` (12: het gebouwde bestand past bij de bronnen, statuspagina zonder schrijfactie, CORS, paden, `sinds`/`ongewijzigd`, geen schrijfactie als er niets verandert, per veld samenvoegen, grafsteen wint, validatie van id's, velden, lengtes, links en coördinaten, 409, 413, mislukte KV-put en -get, en dat een overschreven schrijfactie opvalt door de hash), `tests/sync.test.mjs` (14: verschil, in delen, koppel-link heen en terug ook met emoji en é, groepscode, sync-adres, peilen, en de motor tegen de echte worker: delen, koppelen, alleen gewijzigde briefjes, offline, 503, Dit ben ik al, verlaten), `tests/convergentie.test.mjs` en `tests/kv-dag.test.mjs` (hieronder).
  - **Convergentie** (§9): 3 telefoons met de echte motor en de echte worker, elk met een eigen klok (4 s achter, 2,5 s voor), willekeurige bewerkingen met de echte modelfuncties (tekst, categorie, hartjes, slepen, gedaan, verwijderen, nieuwe briefjes, categorieën, leden, bordnaam), soms offline. De nep-KV geeft in 25% van de leesacties een verouderde stand (dan overschrijft een PUT die van een ander, precies het geval van twee gelijktijdige PUT's) en laat 10% van de schrijfacties mislukken. Drie varianten: 1500 rondes om de beurt (geseed, herhaalbaar: 461 verouderde leesacties, 91 mislukte en 984 geslaagde schrijfacties), 3 × 400 rondes waarin de telefoons tegelijk synchroniseren, en 600 rondes met een klok in hele seconden (vaak precies hetzelfde tijdstip, met als slot drie verschillende bordnamen op exact hetzelfde moment). Na afloop: alle telefoons en de server exact dezelfde stand, én die stand is gelijk aan álle bewerkingen samen (niets kwijt, niets verzonnen).
  - **Ter controle bewust kapotgemaakt:** (1) `rev` als vaste waarde, zoals een teller die niet ziet dat hij overschreven is: convergentietest rood. (2) De onthouden serverstand deelt objecten met de telefoon: de convergentietest bleef groen, omdat de fout zich herstelt zodra een ander iets wijzigt. Daarom een gerichte test erbij ("een briefje van een ander aanpassen gaat mee, ook als verder niemand iets doet"), en die gaat rood. (3) Bij een gelijk tijdstip de eigen waarde houden (zoals Parkenjacht): eerst bleef hij groen, want elk gelijkspel werd later overschreven. Met de grove klok en het slot op hetzelfde tijdstip gaat hij rood. (`tests/merge.test.mjs` uit M1 ving deze al.)
  - **KV op een drukke dag** (`tests/kv-dag.test.mjs`, nagebootste tijd met de echte motor en worker): 2 borden, 5 mensen, 504 bewerkingen (Thuis: Oscar en Tara elk 8 keer 4 minuten; Groepsreis: een planavond van een uur met 5 mensen tegelijk, de helft reeksen van 3 hartjes, plus losse momenten; één keer de eerste sleepbeweging op 120 briefjes) = **343 KV-schrijfacties** en **2.366 KV-leesacties**. Het gratis plan heeft 1.000 schrijfacties per dag, gedeeld met Parkenjacht: zo'n dag kost dus een derde. Een gewone dag kost veel minder (geschat, niet gemeten). Foto's (M4) kosten straks elk één schrijfactie extra.
  - **Rekentijd van de worker** (gemeten in Node op deze cloudcomputer, niet op Cloudflare): een PUT met één gewijzigd briefje kost ~2 ms bij 100 briefjes, ~6 ms bij 300 korte briefjes en ~8 ms bij 300 volle briefjes (500 tekens). De grens is 10 ms CPU per verzoek. Een gewoon bord zit er ruim onder; een propvol bord komt in de buurt. Zonder de opgeslagen stand opnieuw te controleren scheelt het maar ~20%, dus dat heb ik niet gedaan. Oscar kan de echte rekentijd zien in het dashboard; zie "Als het ooit knelt" hieronder.
  - `npm run lint`: schoon.
  - `npm run rooktest`: 152 van 152 (was 107). Nieuw: "Wie ben jij?" bij de eerste start, en 43 controles met twee en drie browsers op één bord via de echte worker op deze computer (`scripts/nep-worker.mjs`, met een nep-KV): delen (adres zonder https geweigerd, groepscode niet in `prikbord.v1`, bolletje groen, "Gesynchroniseerd om"), koppel-link openen ("Bord 'Thuis' toevoegen?", weg uit de adresbalk, Wie ben jij, het lege beginbord opgeruimd, eigen kleur), een briefje van Tara bij Oscar binnen 15 s zonder iets te doen (6,8 s gemeten), de melding, het stickertje (weg na openen) en Tara's punaisekleur, hartjes van allebei, tegelijk tekst en hartje op hetzelfde briefje (allebei bewaard, exact dezelfde stand), 💞 Iedereen zin met twee leden, offline prikken (bolletje grijs, de tekst, Oscar heeft het nog niet) en weer online (het komt aan, bolletje groen), koppel-link plakken (ook een foute), Dit ben ik al (zelfde lid, geen derde lid, hartjes niet dubbel), een nieuw bord en terug wisselen, bord verlaten (Oscar houdt alles), en een kapotte koppel-link.
  - **Aangepast in de rooktest, met reden:** de eerste start toont nu "Wie ben jij?" (§5.1). Blok 1 en 9b vullen daarom eerst een naam in, en "Geprikt door Ik" werd "Geprikt door Oscar". Wat ze controleren, is niet veranderd.
  - **Fouten die ik zelf vond:** tijdens het uitproberen kreeg Tara na haar eerste koppel-link twee borden "Thuis" (opgelost: een leeg, nooit gebruikt beginbord wordt opgeruimd). In mijn eigen nieuwe rooktest zaten twee fouten (Oscar stond nog op het tabblad Meer; Esc tijdens de "van het bord"-animatie wordt bewust genegeerd); de app was daar niet fout.
- **Niet getest:** alles op echte telefoons (zie de testlijst hieronder), de echte Cloudflare (deze sessie kan er niet bij en ik heb niets neergezet), het deelmenu met de koppel-link, of Safari en de app op het beginscherm echt apart opslaan, `keepalive` bij het wegklikken op de iPhone, de time-out (`AbortSignal.timeout`, voor zover ik weet vanaf iOS 16; op ouder geen time-out maar verder werkt alles), het echte gedrag van KV (een wijziging is soms pas na een minuut overal zichtbaar; de convergentietest bootst dat na, maar het blijft een nabootsing), en de rekentijd op Cloudflare zelf. Foto-endpoints en hun tests horen bij M4.

### De worker neerzetten (voor Oscar)

Dit staat ook bovenin `proxy/prikbord-sync-worker.js`. Het is gratis en kost ± 10 minuten.

1. Ga naar dash.cloudflare.com en log in (hetzelfde account als Parkenjacht mag).
2. **Opslag maken:** Storage & Databases → KV → Create, noem hem `prikbord`. Neem niet die van Parkenjacht: zo werkt de een gewoon door als de ander stuk gaat.
3. **Worker maken:** Workers & Pages → Create → Worker (begin met "Hello World"), noem hem `prikbord` en klik Deploy. Klik daarna "Edit code", haal alles weg, plak de hele inhoud van `proxy/prikbord-sync-worker.js` erin en klik Deploy. (Op GitHub: open het bestand, klik "Raw", selecteer alles en kopieer.)
4. **Opslag koppelen:** worker → Settings → Bindings → Add → KV namespace. Variable name: `PRIKBORD`, kies de namespace `prikbord` en klik Deploy (of Save).
5. **Controleren:** open het adres van de worker in je browser. Ik verwacht `https://prikbord.oscar-dillewaard.workers.dev`, net als bij Parkenjacht, maar dat is een aanname. Daar staat in gewone taal of alles klopt. Met `?schrijftest=1` erachter test hij ook schrijven (dat kost één van de 1.000 schrijfacties per dag).
6. **Stuur me het adres**, dan zet ik het als `DEFAULT_SYNC_URL` in de app. Daarna hoeft niemand meer een adres in te vullen.

**Als het ooit knelt:** in het dashboard van de worker staat onder Metrics hoeveel verzoeken er zijn, en onder Metrics → Errors → Invocation Statuses of er verzoeken over de 10 ms rekentijd gingen ("Exceeded CPU Time Limits"). Bij de KV-namespace staat, voor zover ik weet, hoeveel schrijfacties er per dag zijn. Gaat het mis, dan raakt er niets kwijt: de app houdt de wijziging in het verschil en probeert het bij elke peiling opnieuw, met een oranje bolletje. Dan zijn er drie uitwegen: de opgeslagen stand niet opnieuw controleren (~20% sneller), het bord in KV opknippen (meer werk), of het betaalde plan van Cloudflare ($5 per maand, uit mijn kennis, niet nagelezen).

### Te testen met twee telefoons (na de deploy van M3)

Telefoon 1 = Oscar, telefoon 2 = Tara (of een tweede toestel). Op een iPhone met het Prikbord op het beginscherm: open een koppel-link via de app (bordnaam → "Ik heb een koppel-link" → plakken), niet via Safari.

1. Na het bijwerken: verschijnt één keer "Er hangt iets nieuws op het prikbord!" met versie 3?
2. Telefoon 1: Meer → Wie ben ik → je naam en een kleur. Kloppen je punaises daarna?
3. Telefoon 1: Meer → Samen prikken → Maak een koppel-link. Opent het deelmenu (WhatsApp, Berichten)? Hoe ziet het berichtje eruit?
4. Telefoon 2: open de link (of plak hem in de app). "Bord 'Thuis' toevoegen?" → Toevoegen → Wie ben jij → je naam. Staan alle briefjes er? Heb je geen tweede, leeg "Thuis"?
5. Telefoon 2 prikt iets. Komt het binnen ~30 s op telefoon 1, met "📌 Tara prikte …" en een NIEUW-stickertje? Is het stickertje weg na openen?
6. Allebei een hartje op hetzelfde briefje; daarna 💞 Iedereen zin.
7. Tegelijk: telefoon 1 past de tekst van een briefje aan, telefoon 2 geeft hetzelfde briefje een hartje. Staan daarna allebei op beide telefoons?
8. Vrij: versleep een briefje op telefoon 1. Glijdt het op telefoon 2 naar dezelfde plek?
9. Gedaan en weghalen op telefoon 1: verdwijnt het briefje op telefoon 2 (weghalen pas na de 5 tellen "Ongedaan maken")?
10. Vliegtuigmodus op telefoon 2, iets prikken: wordt het bolletje grijs? Vliegtuigmodus uit: komt het briefje bij telefoon 1?
11. App op telefoon 1 een tijdje dicht, telefoon 2 prikt twee briefjes, app weer open: "📌 2 nieuwe briefjes sinds je vorige bezoek"?
12. Een derde toestel (bijv. een iPad) van jezelf: koppelen → "Dit ben ik al" → tellen je hartjes niet dubbel?
13. Nieuw bord maken en wisselen via de bordnaam bovenin. Heeft alleen het gedeelde bord een bolletje?
14. Na een dag: hoeveel schrijfacties staan er bij de KV-namespace in het dashboard (als dat daar staat)?

### M2 (8 nov 2026): het bord

- **Gedaan, in volgorde van de spec (§8):**
  - **Filters en sorteren (§5.6):** filterbalk onder de kop (blijft staan bij scrollen): sorteerchip, Alles, 💞 Iedereen zin en een chip per categorie in de papierkleur. Het bord wordt niet meer bij elke wijziging opnieuw opgebouwd: bestaande briefjes blijven staan en schuiven met een veertje naar hun nieuwe plek, wat niet door het filter komt vervaagt waar het hangt. Na het schuiven wordt ook de volgorde in de pagina gelijkgetrokken (tabvolgorde, schermlezers). Met een filter zonder resultaat: een vriendelijk "Niks gevonden" met "Alles laten zien".
  - **Categorie-editor (§5.6):** Meer → Categorieën. Toevoegen, hernoemen, emoji (typen of kiezen), kleur, volgorde (▲▼) en verbergen/weer laten zien, met een voorbeeldbriefje dat meekleurt. Per veld met tijdstempel (`zetCat`, `nieuweCat`, `verschuifCat` in `model.js`).
  - **Hartjes (§5.4, §5.5):** dubbeltik geeft een hartje met een kloppend hart op het briefje; kleine hartjes onderaan in de kleur van wie ze gaf (max. 5, dan "+n"); hartje-knop op het geopende briefje (`zetHart`, `hartjesVan`).
  - **Gedaan-doos (§5.8):** "Gedaan! ✅" vraagt datum (standaard vandaag) en "Hoe was het?". Dan springt de punaise eruit (plop), valt het briefje naar de Gedaan-doos in de tabbalk, stuitert het doosje en volgt er confetti. De doos is een plakboek met plakband, per maand, nieuwste eerst, met teller ("6 dingen samen gedaan 🎉", met filter "1 van de 6 …"). Vanuit de doos: aanpassen, terughangen (de punaise prikt hem terug op het bord) en weghalen.
  - **Trek een briefje 🎲 (§5.7):** binnen de filters; het bord schudt, één briefje wiebelt los en komt groot naar voren met "Nog eens" (altijd een ander, als er meer zijn) en "Sluiten".
  - **Vrij (§5.2):** `js/vrij.js` doet de vingers: lang drukken (300 ms) tilt op (schaduw groeit, punaise los, kort trillen op Android), slepen, loslaten prikt opnieuw met tok en wiebelende buren; dicht bij de rand schuift het bord mee. Eén vinger over het kurk schuift, knijpen zoomt rond je vingers, plus knoppen +, − en ⤢ (ook met één hand te doen). Muis en touchpad: scrollen schuift, ctrl+scrollen zoomt. Filters dimmen in plaats van te verschuiven. Het bord heeft zijn eigen kurk met een houten rand, op een donkere muur.
  - **Back-up:** "Laatste back-up" onder Meer; de rooktest controleert dat hartjes, gedaan, vrije plekken en categorieën heen en terug gaan.
- **Nieuwe pure modules en functies:** `filter.js` (filter, sorteren, trekken, de doos per maand), in `layout.js` `legVrij`/`eersteLegePlek` en de camera (`pasCamera`, `zoomRond`), in `model.js` hartjes en categorieën, in `validate.js` `apparaat.sorteer` en `apparaat.laatsteBackup` (oude opslag zonder die velden blijft werken). Animaties erbij in `beweging.js` (`hartPop`, `schudLos`, `valInDoos`, `confetti`, `stuiter`, `popIn`), `geometrie` werkt nu ook op een geschaald bord. Geluid `plop()`.
- **Release:** versie 2 (`APP_VERSION`, `CACHE` = `prikbord-v2`, `CHANGELOG`), `filter.js` en `vrij.js` in `SHELL`.
- **Twee fouten die de tests vingen:**
  - Na het schuiven over het bord negeerde de app 400 ms lang álle klikken in het venster, ook op de zoomknoppen. Nu alleen klikken op briefjes (dat is waarvoor het bedoeld was: na slepen mag een briefje niet opengaan).
  - De confetti was er wel, maar te klein en te bleek tussen het pastelpapier, en de melding lag eroverheen. Nu fellere kleuren, hoger, en de melding komt pas na het feestje. Dat zag ik pas in een screenshot op echte snelheid.
- **Getest:**
  - `npm test`: 50 groen (was 37). Nieuw: `tests/filter.test.mjs` (filters, Iedereen zin, sorteren, trekken: 3000 keer, eerlijk verdeeld en nooit twee keer hetzelfde, doos per maand), hartjes en categorie-editor in `model.test.mjs`, vrije plekken en camera in `layout.test.mjs` (zelfde invoer = zelfde plek, ook in andere volgorde; een nieuw briefje laat oudere niet verspringen; zoomen rond een punt houdt dat punt op zijn plek), apparaatvelden in `validate.test.mjs`.
  - `npm run lint`: schoon.
  - `npm run rooktest`: 107 van 107 (was 41). Nieuw: filters (schuiven, uit beeld, meerdere tegelijk, niks gevonden), dubbeltik (hartje, opent niet), Iedereen zin, sorteren (linksboven én tabvolgorde, onthouden), hartje-knop aan en uit, Gedaan (datum vandaag, notitie, confetti, ongedaan maken, doos per maand met teller, filters in de doos, aanpassen, terughangen), Trek (binnen het filter, Nog eens = ander, Sluiten), categorie-editor (toevoegen, volgorde, hernoemen, verbergen, het schrijfvel, verborgen categorie houdt kleur en blijft gekozen bij bewerken), back-up heen en terug op een nieuwe telefoon, vrij met de muis (optillen, slepen precies zoals de muis ging, alles vastgezet, bovenop de stapel, tik opent wel, slepen niet, zoomknoppen, schuiven, ⤢) en met **echte aanraakpunten via CDP** (knijpen met twee vingers = ×3 bij ×3 uit elkaar, lang drukken en slepen met een vinger), filters dimmen in vrij zonder te verschuiven, nieuw briefje in vrij landt bovenaan, na herladen alles op zijn plek, en Gedaan met minder beweging (geen confetti).
  - Twee bestaande controles aangepast, met reden: "Meer toont de versie" en "service worker cachet onder prikbord-v1" hadden het versienummer 1 vast in de test. Ze lezen nu `APP_VERSION` uit `app.js`, zodat het release-ritueel de rooktest niet meer breekt. Wat ze controleren, is niet veranderd.
  - Ter controle twee keer bewust kapotgemaakt: zonder vastzetten bij het slepen gaan 2 controles rood; een dubbeltik die toch opent, laat de rooktest vastlopen (ook rood, alleen minder netjes).
- **Screenshots en filmstrip** in `docs/m2-bord/` (390 px): bord, filter, meeste hartjes, dubbeltik, open, gedaan, doos, trek, vrij, vrij slepen, vrij zoom, Meer, categorieën, nieuwe categorie, plus `gedaan-filmstrip.jpg` (8× vertraagd). Opnieuw maken: `npm run screenshots:m2`. Het demobord staat nu in `scripts/demo.mjs` (gedeeld met `npm run screenshots`).
- **Niet getest:** alles op een echte telefoon (zie de lijst hieronder), vooral de gebaren in vrij op de iPhone (Safari houdt zich voor zover ik weet aan `touch-action: none`, en `gesturestart` wordt tegengehouden; niet nagemeten), of een dubbeltik op de iPhone twee klikken geeft (zou moeten met `touch-action: manipulation`, niet nagemeten), trillen, hoe "plop" klinkt, en hoe vloeiend het schuiven is met 300 briefjes (M5).
- **Gedeployd op 9 nov** (zie V7 bij de besluiten).

### Te controleren op de telefoon (na de deploy van M2)

1. Na het bijwerken: verschijnt één keer "Er hangt iets nieuws op het prikbord!" met versie 2?
2. Filters: tik twee categorieën aan. Schuiven de briefjes vloeiend naar hun plek? Blijft de filterbalk staan als je scrolt, en kun je hem opzij vegen?
3. Dubbeltik op een briefje: klopt er een hart en komt er een klein hartje onderaan, zónder dat het briefje opengaat? Voelt een enkele tik (250 ms wachten) niet te traag?
4. Open een briefje → "Gedaan!" → typ iets → "In de doos!": plop, valt hij naar de doos, confetti? Werkt het datumveld op de iPhone (het datumwieltje)?
5. Gedaan-doos: per maand, met teller. "Terughangen": prikt de punaise hem terug op het bord?
6. 🎲 Trek een briefje, een paar keer "Nog eens".
7. Vrij: houd een briefje vast. Komt het los (op Android met een trilling) en kun je het slepen, ook tot aan de rand? Zoomt knijpen (en niet de hele pagina)? Schuift één vinger over het kurk? Verschijnt er geen menuutje of tekstselectie bij lang drukken?
8. Vrij met één hand: + en − en ⤢ linksonder.
9. Meer → Categorieën: voeg er een toe met een eigen emoji (emoji-toetsenbord), verander een kleur, schuif er een omhoog, verberg er een.
10. Back-up maken: staat er daarna "Laatste back-up: …" onder Meer?

### M1, deel 2 (8 nov 2026): gekozen stijl en het scheur-en-prik-moment

- **Stijl samengevoegd (V5):** één thema in `styles.css` (variabelen bovenin `:root`). Weg zijn: `stijl.js`, `kurk-b.svg`, `kurk-c.svg`, Patrick Hand, Caveat 500 en `scripts/contactvel.mjs`. `kurk-a.svg` heet nu `img/kurk.svg`, en de scheurrand staat in `js/randen.js` (16 varianten, gekozen via het id).
- **Scheur-en-prik-moment (§5.3):**
  - `js/beweging.js`: scheuren (het vel rukt omhoog, het blokje schokt mee, snippers dwarrelen, het vel groeit uit tot schrijfvel), prikken (het vel krimpt, een kopie van het echte briefje vliegt in een boogje naar zijn plek, de punaise komt van boven met een veertje, het papier veert even in, buren wiebelen naar afstand mee), een briefje van het bord halen en terughangen, weggooien en weghalen (het briefje valt van het scherm).
  - `js/geluid.js`: "rrrits" en "tok" met de Web Audio API, alleen als geluid aan staat.
  - Bij `prefers-reduced-motion`: geen vliegen, snippers of wiebelen, alleen vervagen.
  - De donkere achtergrond van het venster is nu een eigen element (`.laag-achter`), zodat hij mee kan vervagen. Esc en de terugknop op Android sluiten met dezelfde beweging. Tik naast een groot briefje hangt het terug; tik naast het schrijfvel doet niets (anders ben je te snel iets kwijt).
  - Schermlezers krijgen "Briefje geprikt" via een verborgen live-regio in plaats van een toast.
- **Een fout die ik zelf vond:** in de eerste versie was het vliegende briefje onzichtbaar. Een CSS-regel maakte alles in het venster `position: relative`, en dat zag ik pas in de filmstrip. De rooktest controleert nu ook dat de vlieger en de snippers echt in beeld zijn.
- **Getest:**
  - `npm test`: 37 groen.
  - `npm run lint`: schoon.
  - `npm run rooktest`: 41 van 41 geslaagd. Nieuw daarin: snippers in beeld, geluid gaat aan na de tik (AudioContext geteld), het vel krijgt de kleur van het blokje, het tekstvak heeft meteen focus, de vlieger is zichtbaar, het briefje hangt na het landen zichtbaar op het bord zonder losse resten, openen verstopt het briefje op het bord, Esc hangt het terug, en met minder beweging en geluid uit: geen snippers, geen vlieger en geen AudioContext.
  - Twee bestaande controles zijn aangepast, met reden. "Bewerken" wacht nu tot het venster dicht is in plaats van 200 ms, want het briefje vliegt eerst. De grafsteen wacht 6 s in plaats van 5,4 s, want de 5 tellen beginnen nu na de valanimatie.
- **Screenshots en filmstrip** in `docs/m1-stijl/`: `bord.jpg`, `open.jpg`, `vel.jpg` en `scheur-en-prik.jpg` (9 beelden, met alle animaties 10× vertraagd vastgelegd). Opnieuw maken: `npm run screenshots`.
- **Niet getest:** alles op een echte telefoon (zie het lijstje hieronder), hoe het geluid klinkt (Chromium headless heeft geen luidspreker; alleen dat de AudioContext wordt aangemaakt), en of de animaties vloeiend zijn op een gewone telefoon met 300 briefjes (M5).

### Te controleren op de telefoon (na de deploy van M1)

1. Openen in Safari en via "Zet op beginscherm" installeren. Icoon en naam "Prikbord" kloppen, en de app opent zonder adresbalk.
2. Tik op het blokje: hoor je "rrrits", zie je snippers, en komt het toetsenbord meteen omhoog? Staat "Prikken!" niet achter het toetsenbord?
3. Prikken: vliegt het briefje naar zijn plek, hoor je "tok" en wiebelen de buren? Op Android trilt hij even.
4. Tik op een briefje: komt het groot van het bord? Hangt "Terughangen" het netjes terug?
5. Weghalen en dan "Ongedaan maken": komt het briefje terug met punaise?
6. Half getypt briefje, app wegvegen en opnieuw openen: staat je tekst er nog?
7. Meer → geluid uit: is het stil? Meer → back-up maken: opent het deelmenu ("Bewaar in Bestanden")?
8. Instellingen → Toegankelijkheid → Beweging → "Verminder beweging" aan: alleen nog rustig vervagen?
9. Vliegtuigmodus aan en de app openen: werkt hij offline?

### M1, deel 1 (8 nov 2026): skelet en 3 stijlvoorstellen

- **Repo-fundament:** `package.json` (devDependencies oxlint, playwright 1.63.0 en sharp; scripts `lint`, `test`, `icons`, `serve`, `rooktest`, `screenshots`), `.oxlintrc.json` (negeert `public/vendor/**`), lint met `--deny-warnings`, workflow `.github/workflows/deploy-pages.yml` (push naar `main`: lint, tests, dan `public/` naar Pages). **Nog niet naar `main` gepusht**: dat is deployen, en wacht op akkoord (§8).
- **Pure modules** (`public/js/`): `seed.js` (FNV-1a + mulberry32), `layout.js` (netjes rommelig), `model.js` (datamodel en tijdstempels), `validate.js` (schema en schoonmaken), `merge.js` (per veld samenvoegen en importeren). `model.js` staat niet in het bestandsvoorstel van §6.1; ik heb het toegevoegd zodat het datamodel puur en testbaar is. Ook nieuw: `stijl.js` (tijdelijk, de drie voorstellen) en `public/img/` (kurk, papierkorrel en hout als kleine SVG's met `feTurbulence`).
- **App-skelet:** `index.html` (iOS-meta zoals Tarapp), manifest, `sw.js` (network-first, caches alleen met `prikbord-`), `store.js` (sleutel `prikbord.v1`, kapotte opslag → vers bord en de oude tekst onder `prikbord.v1.kapot`), `app.js`: bord, briefje openen, bewerken, weghalen met 5 tellen ongedaan maken, schrijfvel met concept, tabs (Kaart en Gedaan-doos als vrolijke "komt eraan"-briefjes), Meer (geluid, blijvende opslag, back-up, wat is er nieuw, nu bijwerken, versie), updates zoals `reloadWhenIdle`. Letters Caveat (500, 700) en Patrick Hand met OFL-licenties; é, ë, ï, ö, ü, € en de krullende aanhalingstekens nagemeten met fonttools (cmap van de woff2-bestanden). Icoon `scripts/prikbord-icon.svg` → `public/icons/` (palet-PNG, 512 px = 172 KB).
- **Getest:**
  - `npm test`: 37 tests groen. Daarin zitten seed (officiële FNV-1a-testvectoren), layout, validate, model, de sw-test (CACHE = APP_VERSION, SHELL compleet) en merge: 2000 geseede rondes commutatief, associatief en idempotent. Ter controle heb ik merge twee keer bewust kapotgemaakt (gelijk tijdstip en grafsteen); de tests vingen het allebei.
  - `npm run rooktest` (Playwright/Chromium, 390 px): 27 van 27 geslaagd. Dat dekt briefje prikken en herladen, bewerken, concept na herladen, ongedaan maken, grafsteen na 5 tellen, geluid bewaren, export als download, importeren dat samenvoegt, kapotte opslag, service worker, offline openen, en "Nu bijwerken" dat de cache van Tarapp laat staan.
  - `npm run lint`: schoon.
- **Niet getest:** echte iPhone en Android (toetsenbord bij het schrijfvel, deelmenu bij de back-up, "Zet op beginscherm"), blijvende opslag (Chromium headless zegt "nee"), trillen.
- **Stijlvoorstellen** in `docs/m1-stijlen/` (390 px, 2× scherp; `vergelijk-*.jpg` zet ze naast elkaar). Dat is een momentopname: de scripts en de drie stijlen staan in commit `453bfd0` en zijn daarna weggehaald.
  - **A · Klassiek kurk:** warm kurk, houten lijst, pastel blokpapier dat bovenaan echt is afgescheurd, Caveat, glimmende bolle punaises.
  - **B · Licht & luchtig:** licht honingkurk zonder lijst, zachte moderne kleuren met rafelrandjes rondom, Patrick Hand, platte punaises.
  - **C · Schoolschrift:** grof donker kurk in een stevige lijst, gelinieerd kladblokpapier met gaatjes van de scheurlijn, Caveat vet in balpenblauw, speldenknoppen.
  - Onderdelen zijn te mengen (bijv. kurk van A met papier van C).

### M0 (8 nov 2026)

- Gelezen: alle bestanden uit §3 van de spec (in Tezt).
- Nulmeting in Tezt: build groen, lint rood (3 fouten door `useEmoji` in Tarapp), deploybranch gelijk aan de werkbranch (`0c82ec8`).
- Getest: of Cache Storage gedeeld wordt over mappen op één domein (ja, Chromium), en de lint-override (werkt, maar is vervallen).
- Cloudomgeving "Tezt" aangemaakt. KV-docs en Nominatim-beleid nagelezen.
- Oscar koos voor een eigen repo. De docs zijn overgezet naar `oscardillewaard-ai/prikbord`, met A3 erbij.
- In Tezt: cache-fix voor Tarapp en Parkenjacht (`3cf0159`), getest in Chromium (vóór en na).

## Voor M4: handig om te weten

- **Nieuwe velden gaan vanzelf mee.** Wat in `VELD_SCHOON` (`validate.js`) staat, wordt per veld gesynchroniseerd; `link`, `foto` en `plek` staan er al. Pas na elke wijziging in `validate.js` of `merge.js` `npm run worker` toe, en laat Oscar de nieuwe worker in Cloudflare plakken. Anders gooit de oude worker een nieuw veld stilletjes weg (`tests/worker.test.mjs` bewaakt alleen dat het bestand in de repo klopt, niet wat er in Cloudflare staat).
- **Foto-endpoints** horen in `proxy/prikbord-worker-kern.js`: `PUT /bord/<code>/foto/<id>` (max. 1,5 MB, alleen jpeg, png en webp) en `GET` met `Cache-Control: public, max-age=31536000, immutable`, één KV-sleutel per foto (bijv. `foto:<code>:<id>`). Elke foto is één schrijfactie: tel dat mee bij de 343 van een drukke dag. De worker-tests voor de fotolimieten (§9) staan nog open. `/zoek` met de Cache API en `ZOEKEN=uit` ook.
- **Uploads en herladen:** een foto-upload moet `ui.bezig` ophogen, zodat er niet midden in herladen wordt (regel 5). De service worker laat andere sites al met rust, dus foto's van de worker moet de app zelf in IndexedDB bewaren (§6.4).
- **Bijwerken na een sync:** `naSync` → `tekenNaSync` → `render()` (keyed, zoals in M2). Een briefje dat groot openligt, wordt opnieuw getekend als het veranderde (`ui.grootVan`). Een polaroidje dat nog laadt, moet dat overleven.
- **Testen:** `tests/hulp.mjs` heeft `telefoon()` (een nep-telefoon met de echte motor tegen de echte worker), de rooktest start de worker lokaal met `startWorker()` uit `scripts/nep-worker.mjs`, en `npm run nep-worker` doet dat op poort 8787 om zelf te proberen (vul bij "Bord delen" `http://localhost:8787` in).
- **Rekentijd:** foto's worden niet samengevoegd, dus die zijn goedkoop. Een bord-PUT kost rekentijd naar de grootte van het hele bord (zie het logboek van M3).
- **`DEFAULT_SYNC_URL`** in `public/js/app.js` is nog leeg tot Oscar het adres van de worker doorgeeft.
- **Kaart en plekken:** de zoekfunctie mag alleen via de eigen worker (§6.5), met minstens 1 s tussen twee zoekopdrachten in de app én in de worker.

## Startprompt voor M4

Plak dit in een nieuwe chat met repo `oscardillewaard-ai/prikbord` en omgeving "Tezt":

```
Prikbord, mijlpaal M4 (link, foto en kaart). Je werkt in de repo oscardillewaard-ai/prikbord.
1. Merge eerst het werk uit M3 in je werkbranch (verandert niets als het al op main staat):
   git fetch origin ccr-fc257cf9-70gzqa && git merge origin/ccr-fc257cf9-70gzqa
2. Lees docs/prikbord-spec.md (leidend), docs/prikbord-afwijkingen.md (vooral A3:
   eigen repo, andere paden; A4 en A5: de worker bouw je met npm run worker) en
   docs/prikbord-voortgang.md (besluiten, aannames, logboek M1 t/m M3 en
   "Voor M4: handig om te weten").
3. Haal oscardillewaard-ai/Tezt erbij (alleen lezen) voor Leaflet uit
   public/parken/vendor/ (BSD-2, licentiebestand mee) en de kaart van Parkenjacht.
4. Doe M4 (§8 van de spec): link op een briefje, foto's (§6.4: verkleinen,
   IndexedDB, uploadwachtrij, foto-endpoints in de worker met tests voor de
   limieten), de kaart-tab en plekken kiezen op vier manieren (§5.9), met
   zoeken via Nominatim alleen via de worker (§6.5). Draai voor elke commit
   npm test, npm run lint en npm run rooktest. Werk aan het eind
   docs/prikbord-voortgang.md bij, met een startprompt voor M5.
   ⏸ Daarna wacht je op akkoord van Oscar.
```
