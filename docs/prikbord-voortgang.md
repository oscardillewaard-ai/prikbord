# Prikbord: voortgang en overdracht

Elke mijlpaal krijgt een nieuwe chat (afspraak met Oscar, 8 nov 2026). Dit
bestand is het geheugen tussen die chats. Leidend blijft
`docs/prikbord-spec.md`. Afwijkingen staan in `docs/prikbord-afwijkingen.md`;
lees vooral A3 (eigen repo, andere paden), A4 (categorieën nooit wissen), A5
(de worker wordt gebouwd met `npm run worker`) en A6 (de Nominatim-pauze geldt
per worker-exemplaar; voorgesteld). Alle mijlpalen M0 t/m M5 zijn gebouwd; zie
"Na M5: handig om te weten" onderaan.

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
| M3 samen | klaar en gedeployd (9 nov, samen met M4), staat op `main`. De worker staat nog niet; Oscar zet hem neer en test dan met twee telefoons | `ccr-fc257cf9-70gzqa` |
| M4 link, foto en kaart | klaar en gedeployd (9 nov, akkoord van Oscar), staat op `main`; testlijst voor de telefoon hieronder. A6 voorgesteld | `ccr-80bc7fbf-gcraqb` |
| M5 afronden | klaar (9 nov), **wacht op akkoord van Oscar**; nog niet gedeployd. Testlijst voor de telefoon hieronder | `ccr-f626df03-9jb4ek` |

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
- **A5 (de worker bouwen uit de kern plus validate.js en merge.js):** "Akkoord met a5" (na M3).
- **Verder zonder worker:** "Kan je verder gaan zonder de worker? Dan doe ik dat als ik thuis ben." M4 mag dus beginnen voordat de worker staat en voordat M3 met twee telefoons getest is. Testen gaat tot die tijd met de nep-worker (`npm run nep-worker`, of `startWorker()` in de rooktest). Gevolg: vindt Oscar bij de test met twee telefoons iets in M3, dan lossen we dat op in een latere chat.
- **V8, deploy M4:** "deploy M4" (na "Geef prompt"). `main` is fast-forward gezet van `9ba15fc` (M2) naar `39c5582` (M4); workflow-run 5 (lint, tests, deploy). Daarmee staat ook **M3** live (M4 bouwt erop voort). Zonder worker is dat onschuldig: borden blijven op de telefoon, en "Samen prikken" vraagt om het adres van een sync-server. Wel ziet Oscar na het bijwerken één keer "Wat is er nieuw" met versie 3 én 4, inclusief "Samen prikken!", wat pas werkt als de worker staat. Ook nu niet zelf bekeken: deze cloudsessie kan `github.io` niet openen. Dat doet Oscar met de testlijst van M4.

## Nagelezen in de documentatie (via curl)

- **Cloudflare Workers-limieten** (developers.cloudflare.com/workers/platform/limits, nagelezen op 9 nov 2026): gratis plan 10 ms CPU-tijd per verzoek (wachten op KV telt niet mee) en 100.000 verzoeken per dag. Gaat een verzoek over de 10 ms, dan geeft Cloudflare "Error 1102: Worker exceeded resource limits", en in het dashboard staat dat onder Metrics → Errors → Invocation Statuses als "Exceeded CPU Time Limits".

- **Cloudflare KV-limieten** (developers.cloudflare.com/kv/platform/limits): gratis plan 100.000 reads per dag, 1.000 writes per dag, 1 write per seconde op dezelfde sleutel, 1 GB opslag per account, max. 25 MiB per waarde, sleutel max. 512 bytes. Komt overeen met §6.3.
- **KV is "uiteindelijk consistent"** (developers.cloudflare.com/kv/concepts/how-kv-works): "Changes are usually immediately visible in the Cloudflare global network location at which they are made. Changes may take up to 60 seconds or more to be visible in other global network locations". Ook op dezelfde locatie is dat "not guaranteed". Gevolg: meestal zie je een wijziging binnen een paar tellen, soms pas na een minuut. Het opnieuw sturen uit §6.3 vangt verloren schrijfacties op, en de convergentietest moet ook verouderde reads nabootsen.
- **Nominatim-beleid** (operations.osmfoundation.org/policies/nominatim): absoluut max. 1 verzoek per seconde voor alle gebruikers samen. De app identificeren met een Referer of User-Agent (een e-mailadres is niet verplicht). Duidelijke bronvermelding. Uit te zetten zonder app-update. Bij voorkeur via een proxy met cache. Autocomplete is verboden, net als systematische zoekopdrachten. Nieuw sinds de spec: een sectie "Usage in LLMs". Daarin staat dat het publieke API alleen gebruikt mag worden als "the application developer has made a deliberate, informed decision to use it and is directly responsible for complying with this policy". Dat is Oscar: hij koos Nominatim zelf in de spec, en dit is hem verteld.

- **Cache API van Cloudflare** (developers.cloudflare.com/workers/runtime-apis/cache, nagelezen op 9 nov 2026): "Workers deployed to custom domains have access to functional cache operations", en in de editor van het dashboard en de Playground doet de cache niets. Over een `*.workers.dev`-adres zegt de pagina niets duidelijks. Uit mijn kennis: daar doet `cache.put` mogelijk niets. Daarom onthoudt de worker zoekantwoorden óók in zijn eigen geheugen (per exemplaar), en werkt zoeken zonder cache gewoon (alleen vaker naar Nominatim, nog steeds hooguit 1 per seconde).
- **KV met foto's** (developers.cloudflare.com/kv/api/write-key-value-pairs en read-key-value-pairs, 9 nov 2026): een waarde mag een `ArrayBuffer` zijn, metadata hooguit 1024 bytes, en `getWithMetadata(sleutel, { type: 'arrayBuffer' })` werkt voor één sleutel. Max. 25 MiB per waarde, dus 1,5 MB per foto is ruim.
- **Een variabele zetten in het dashboard** (developers.cloudflare.com/workers/configuration/environment-variables, 9 nov 2026): Workers & Pages → de worker → Settings → Variables and Secrets → Add → Type, naam en waarde → Deploy. Zo zet Oscar `ZOEKEN = uit`.
- **Durable Objects** (developers.cloudflare.com/durable-objects/platform/pricing, 9 nov 2026): ook op het gratis plan, alleen met SQLite-opslag. Zie het alternatief bij A6.

## Aannames die ik aanhoud (tenzij Oscar anders zegt)

Nieuw in M5 (afronden):

- **"Pas laden als ze in beeld komen"** = als een polaroidje binnen 1200 px van het scherm komt (ongeveer anderhalf scherm vooruit). Met 400 px marge zag je bij snel scrollen vaker lege polaroidjes, en haperde het meer (gemeten, zie het logboek). Foto's die klaar zijn, verschijnen samen zodra het scrollen 150 ms stilvalt (en anders na hooguit 0,7 s), want elke losse foto die tíjdens het scrollen verschijnt, laat de browser het hele bord opnieuw tekenen.
- **Duimnagel:** op het bord, in de Gedaan-doos en op het schrijfvel een vierkant van 480 × 480 uit het midden van de foto (zoals het polaroidje hem toch al toont), JPEG 0,8, ± 30 KB. Groot geopend de hele foto (ook die van "Gedaan!"). Eén keer gemaakt en bewaard in IndexedDB (store `duimen`, alleen op deze telefoon, niet in de back-up en niet naar de worker). Bij het maken één tegelijk, zodat het scrollen er niet onder lijdt. In vrij, helemaal ingezoomd (2,5×), is de duimnagel iets minder scherp dan de hele foto; open het briefje voor de scherpe versie.
- **IndexedDB versie 2** (de store `duimen` erbij). Een tabblad met de oude versie (4) laat de database los zodra de nieuwe hem opent (dat zat er al in sinds M4). Getest in de rooktest: een telefoon met foto's uit versie 4 houdt ze, en krijgt duimnagels.
- **Hele foto's:** hooguit 8 tegelijk in het geheugen (object-URL's); wat niet meer op het scherm staat, wordt vrijgegeven. Duimnagels blijven (ze zijn klein).
- **Vrij met het toetsenbord:** een pijltje = 20 eenheden (± 15 px bij zoom 1), met Shift 80. Elke stap is een gewone wijziging (dus gebundeld naar de anderen), het briefje komt bovenop de stapel en houdt de focus. Schermlezers horen via `aria-describedby` hoe het werkt. Geen "tok" per stap (dat werd een mitrailleur).
- **Plek kiezen met het toetsenbord:** de kaart heeft `role="application"` (anders mag `aria-label` er niet op, en geven schermlezers de pijltjes niet door). Pijltjes schuiven, + en − zoomen (dat doet Leaflet al), Enter of spatie zet de punaise in het midden.
- **Contrastnormen:** de handschriftinkt minstens 7 : 1 (AAA), want een handschrift leest lastiger; kleine lettertjes minstens 4,5 : 1 (AA). Voor de chips en tabjes is gerekend met de gemiddelde kurkkleur, omdat het kurk gevlekt is: een benadering, geen meting per pixel. De vrolijke kleuren (punaises, nieuw-stickertje) zijn niet veranderd.
- **axe-core** (4.14.0, MPL-2.0) is een devDependency: het draait alleen in de rooktest en de deploy-workflow installeert het mee (`npm ci`), maar het komt niet in `public/`. De regels van WCAG 2.2 A en AA plus de "best practices" van axe. axe kan geen tekst controleren die op een achtergrondafbeelding staat (het papier, het kurk); daarvoor is `tests/contrast.test.mjs`.
- **Het proefbord** (`docs/m5/prikbord-backup-proefbord-300.json`) is een gewone back-up met één bord "🧪 Proefbord (300)": 300 briefjes van "Ik", Tara en Sam, 40 met een getekende foto (1600 × 1200, even groot in beeldpunten als een echte foto, maar een klein bestand). Terugzetten voegt het toe naast je eigen borden. Opnieuw maken: `node scripts/proefbord.mjs` (geeft wel een nieuw bord-id, dus dan staat het er twee keer).

Nieuw in M4 (link, foto en kaart):

- **Link:** de paperclip opent een vakje op het schrijfvel. "ah.nl/recept" wordt `https://ah.nl/recept`; uit een geplakt berichtje ("Kijk! https://… leuk") halen we het adres. Alleen http(s). Op het briefje staat het domein zonder "www." ("🔗 ah.nl"), groot geopend een klikbare link (nieuw tabblad). Een link die je typte maar niet met OK bevestigde, gaat bij "Prikken!" toch mee.
- **Foto kiezen:** één knop (plakband), die het gewone fotomenu van de telefoon opent (camera of fotobibliotheek; geen `capture`, dan mag je kiezen). Eén foto per briefje, plus één bij "Gedaan!". Een nieuwe foto vervangt de oude.
- **Verkleinen:** eerst 1600 px met kwaliteit 0,8 (§6.4). Is hij dan groter dan 400 KB, dan 0,7, dan 1280 px, 1024 px en 800 px, en anders de kleinste. Een staande foto draait de browser zelf rechtop (via `<img>`, EXIF). Doorzichtige png krijgt wit eronder.
- **HEIC:** Chrome kan HEIC niet lezen; dan "Deze foto kan ik niet lezen. Is het een HEIC-foto? …". Uit mijn kennis, niet getest: Safari op de iPhone leest HEIC wél, en de iPhone geeft een foto bij `accept="image/*"` meestal al als JPEG door. Een echte HEIC heb ik niet kunnen testen (geen voorbeeldbestand in deze sessie); de rooktest gebruikt een bestand met alleen de HEIC-kop.
- **"1,5 MB"** = 1,5 × 1024 × 1024 = 1.572.864 bytes (`MAX_FOTO` in `validate.js`, voor app en worker dezelfde).
- **Uploaden:** alleen op een gedeeld bord. Wordt een bord gedeeld (of kom je op een bord dat je al had), dan gaan alle foto's van dat bord die op deze telefoon staan in de wachtrij. Elke foto kost één KV-schrijfactie, ook bij het delen: een bord met 50 foto's delen kost dus 50 schrijfacties in één keer.
- **Niet herladen tijdens een upload** (§4.1, regel 5) met een eigen teller `ui.uploads`, niet met `ui.bezig` zoals de overdracht voorstelde: `ui.bezig` blokkeert ook tikken (het blokje, slepen, 🎲), en een upload op de achtergrond mag dat niet doen.
- **Ophalen:** een foto van een ander wordt opgehaald zodra het briefje getekend wordt, en meteen in IndexedDB bewaard (de service worker cachet geen andere sites). Staat hij er nog niet (404 of offline), dan een leeg polaroidje met 📷, en na 20 s (bij de volgende peiling) of bij `online` opnieuw. Alle foto's worden meteen geladen, ook buiten beeld; pas laden als ze in beeld komen, hoort bij M5 (prestaties).
- **Opruimen:** een foto die bij geen briefje (of concept) meer hoort, gaat na twee dagen van de telefoon (bij het opstarten). In KV blijven foto's staan: er is geen endpoint om een foto weg te halen. 1 GB opslag is ± 2.500 foto's van 400 KB. Idee voor later: foto's van grafstenen opruimen.
- **Back-up:** zonder foto's gaat het zoals altijd (meteen). Met foto's kies je eerst "Met foto's (± 3,2 MB · 8 foto's)" of "Zonder foto's", met een waarschuwing over de grootte. De foto's worden alvast ingepakt terwijl je kiest, zodat het deelmenu daarna direct binnen je tik opengaat (anders weigert Safari het, uit mijn kennis). Bestandsnaam met foto's: `prikbord-backup-<datum>-met-fotos.json`. Terugzetten bewaart de foto's die er nog niet waren, en stuurt ze naar de anderen als het bord gedeeld is.
- **Kaart-tab:** filters zoals op het bord, plus "✅ Gedaan ook" (gedane briefjes grijs). De eerste keer zet de kaart alle punaises in beeld; daarna onthoudt hij per bord waar je was (niet bewaard na herstart). Zonder plekken: een briefje met uitleg. Liggen punaises dicht op elkaar (bijv. Den Haag en Delft, uitgezoomd), dan overlappen ze; inzoomen helpt. Clusteren kan later met een Leaflet-plug-in, als Oscar dat wil.
- **Punaises met het toetsenbord:** Leaflet opent met Enter alleen een popup. De app vangt Enter en spatie zelf af (de rooktest vond dit).
- **Leaflet laden** gebeurt pas als je de kaart nodig hebt (kaart-tab of een plek kiezen). Het staat wel in de offline-lijst van de service worker; offline zie je de punaises dus op een lege achtergrond (de tegels komen van een andere site).
- **Plek kiezen:** één scherm met de kaart, "🎯 Mijn locatie", en één vakje om te zoeken óf een link in te plakken. Een geplakte link (Google Maps, OpenStreetMap, Apple Kaarten, `geo:`) of twee getallen wordt meteen gebruikt, zonder zoekdienst. Bij Google gaat de punaise van de plek zelf (`!3d…!4d…`) voor het midden van de kaart (`/@…`). Een verkorte link (`maps.app.goo.gl`) kan de app niet openen (dat blokkeert de browser); dan uitleg om de lange link te kopiëren. Een link met alleen een plaatsnaam zet die naam in het zoekvakje. De naam van de plek mag je aanpassen of leeg laten; dan staan de coördinaten op het briefje ("52,0116° N, 4,3571° O").
- **Zoeken:** alleen na een tik op Zoek (of Enter), nooit tijdens het typen; de app wacht minstens 1 s tussen twee zoekopdrachten. Hooguit 5 uitkomsten in het Nederlands (`accept-language=nl`), wereldwijd (niet alleen Nederland, voor vakanties). Eén uitkomst wordt meteen gekozen. Zoeken gaat via de sync-worker van dit bord, of anders het adres dat je eerder invulde; zonder sync-server staat er uitleg en werken de andere drie manieren. Zodra `DEFAULT_SYNC_URL` gevuld is, kan iedereen zoeken.
- **Zoeken alleen voor de app:** `/zoek` weigert verzoeken zonder de juiste `Origin` (403). Anders kan elke website zijn bezoekers via Oscars worker bij Nominatim laten zoeken; CORS houdt alleen het lezen tegen, niet het verzoek zelf. Met curl kan iemand dat nog steeds nadoen, maar dan sluit `ZOEKEN=uit` het meteen af.
- **"Op de kaart"** op een geopend briefje gaat naar de kaart-tab, ingezoomd op dat briefje (zoom 16). Een gedaan briefje zet daarbij "Gedaan ook" aan.


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

### M5 (9 nov 2026): afronden

- **Gedaan, in volgorde van de spec (§8):**
  - **README:** helemaal herschreven in de stijl van de secties van Tarapp en Parkenjacht (wat de app doet, installeren, de vaste afspraken, gegevens en sleutels, de sync-worker, kaart, letters en iconen, het release-ritueel en de deploy, ontwikkelen en testen). "De volledige uitleg volgt in M5" is weg.
  - **Changelog:** versie 5 (`APP_VERSION`, `CACHE` = `prikbord-v5`, `CHANGELOG`), met vier vrolijke regels. Plaatje: `docs/m5/wat-is-er-nieuw-v5.jpg`. Geen nieuwe bestanden in `public/`, dus `SHELL` is gelijk gebleven.
  - **Prestaties:** gemeten met een nieuw meetscript (`npm run prestaties`, `scripts/prestaties.mjs`, bord uit `scripts/vol-bord.mjs`): 300 briefjes (60 met foto, 20% met link, 15% met plek, hartjes van drie mensen, meestal korte en soms lange teksten), op 390 × 844 met 3× scherpte, CPU 4× vertraagd, en dan 12.000 px scrollen met een aanraakgebaar (heen en terug). Twee dingen gevonden en opgelost, zie de tabel hieronder:
    1. **Een hapering van een halve seconde tijdens het scrollen.** Een trace liet zien dat de browser twee keer de stijl van álle 3.695 elementen opnieuw uitrekende (268 ms), daarna de hele pagina opnieuw tekende. Oorzaak: de maat van het toetsenbord (`--vvh`, `--vvtop`, M4) werd bij elke `visualViewport`-scroll op `<html>` gezet, en een variabele op `<html>` raakt elk element. Nu staat hij op het venster zelf, en alleen als hij echt verandert.
    2. **Alle foto's meteen geladen, in volle grootte**: 60 foto's van 1600 × 1200 = 115 miljoen beeldpunten (± 460 MB als ze allemaal tegelijk uitgepakt zijn; een browser gooit uitgepakte foto's buiten beeld soms weg, dus dit is het slechtste geval). Nu laden ze pas als ze bijna in beeld komen (`IntersectionObserver`), op het bord als duimnagel van 480 × 480, en verschijnen ze samen als het scrollen even stilvalt.
  - **Toegankelijkheid:** axe-core (WCAG 2.2 AA) in de rooktest op 18 schermen. Op alles samen vond het één ding: de hartjesknop heette "Hartje geven" terwijl er "3" op stond (WCAG 2.5.3, en een aan/uit-knop hoort een vaste naam te hebben). Nu: "Mijn hartje, 3 in totaal" met `aria-pressed`. Zelf gevonden met het toetsenbord: na Meer → Categorieën → Esc was de focus kwijt (het scherm wordt opnieuw opgebouwd); nu komt hij terug op de knop (`houdFocus`). Nieuw: briefjes verplaatsen met de pijltjes in vrij (stond open sinds M2), het briefje met focus komt in vrij vanzelf in beeld, en in de plek-kiezer zet Enter de punaise in het midden (stond open sinds M4).
  - **Leesbare inkt op elke papierkleur:** nagerekend met de WCAG-formule (`tests/contrast.test.mjs`, leest de kleuren uit `styles.css`). De handschriftinkt haalt op alle 10 kleuren 7,96 tot 11,45 : 1 (AAA is 7). Te laag waren: de tekenteller op het schrijfvel (3,17 : 1 op koraal, nu 5,06), "Geprikt door …" (4,50, nu 5,06) en de groene datum in de Gedaan-doos (4,46, nu 5,21). Ze zijn iets donkerder; het oogt vrijwel hetzelfde.
  - **Een proefbord** om het op de eigen telefoon te voelen: `docs/m5/prikbord-backup-proefbord-300.json` (zie de testlijst).
- **Prestaties in getallen** (`npm run prestaties`, elk twee keer gemeten; op deze cloudcomputer zonder GPU, dus om te vergelijken, niet als belofte voor een telefoon):

  | | M4 (nulmeting) | alleen `--vvh` gerepareerd | M5, eerste keer | M5, tweede keer |
  | --- | --- | --- | --- | --- |
  | Starten tot het bord staat | 2,4–2,7 s | 2,5–2,7 s | 2,1–2,4 s | 2,4 s |
  | Langste hapering tijdens scrollen | **567 ms** | 50–67 ms | 133–167 ms | 200 ms |
  | Frames op tempo (p50 / p95) | 16,7 / 16,8 ms | 16,7 / 16,8 ms | 16,7 / 16,8–33,3 ms | 16,7 / 16,8 ms |
  | Lange taken (> 50 ms) tijdens 8 s scrollen | 2 | 0–1 | ± 30 | ± 20 |
  | Foto's na het starten | 60 van 60, **115 MP** | 115 MP | 4, 0,9 MP | 9, 2,1 MP |
  | Foto's na 12.000 px scrollen | 115 MP | 115 MP | 27, 6,2 MP | 33, 7,6 MP |

  "Eerste keer" = de duimnagels moeten nog gemaakt worden (net bijgewerkt, of foto's van een ander); "tweede keer" = ze liggen klaar. Eerlijk is eerlijk: met álle foto's al vooraf in het geheugen is het scrollen zelf iets strakker (0–2 lange taken), maar dat kost 15 tot 18 keer zoveel fotogeheugen. De lange taken die er nu zijn, komen vooral van het opnieuw indelen van de pagina als er foto's verschijnen ("Layerize" in Chromium, ± 50 ms bij 4× vertraagd) en van het uitpakken van de duimnagels. Het meetscript veegt 8 seconden onafgebroken; een mens pauzeert, en dan verschijnen de foto's in die pauze.
- **Geprobeerd en niet gedaan, omdat het niets opleverde** (gemeten met `--css`): de schaduw (`drop-shadow`), de gekartelde rand (`clip-path`), de papierkorrel, het scheve polaroidje of álle effecten tegelijk weghalen, het bord een eigen laag geven (`will-change`), `contain: paint`, en `content-visibility: auto` (maakte het zelfs slechter: elk briefje dat in beeld komt, moet dan alsnog getekend worden). Het uiterlijk dat Oscar koos, blijft dus precies zoals het is. Ook een marge van 400 px in plaats van 1200 px en een langere wachttijd voor het samen tonen zijn geprobeerd (400 px haperde meer).
- **Getest:**
  - `npm test`: 121 groen (was 115). Nieuw: `tests/contrast.test.mjs` (5: de formule zelf, alle papierkleuren, de inkt op elk papier en boven een lijntje, de kleine lettertjes, chips en tabjes) en de duimnagel in `tests/fotomaat.test.mjs` (het vierkant uit het midden, nooit groter dan de foto).
  - `npm run lint`: schoon.
  - `npm run rooktest`: 253 van 253 (was 219). Nieuw, blok 34 (prestaties, 9): de foto bovenaan laadt meteen, als duimnagel van 480 × 480; een foto 3.788 px onder het scherm laadt nog niet (en zijn duimnagel staat nog niet in IndexedDB); hij laadt zodra hij in beeld komt; groot geopend de hele foto van 1600 × 1200; `--vvh` staat niet op `<html>`; en de update vanaf versie 4: een telefoon met een foto in IndexedDB versie 1 houdt hem, de database wordt versie 2 met `duimen`, en de foto krijgt een duimnagel. Blok 35 (toegankelijkheid, 25): axe op 18 schermen (bord, geopend briefje, Gedaan!, schrijfvel, linkveld, plek kiezen, trek, kaart, doos, Meer, categorieën, wie ben ik, delen, wat is er nieuw, alle borden, vrij, de eerste start), de focus na sluiten (briefje en Categorieën), de naam van de hartjesknop, Enter op de kaart, en vrij met de pijltjes (stappen van 20 en 80, focus blijft, bovenop de stapel, `aria-describedby`).
  - **Ter controle bewust kapotgemaakt:** de oude tekenteller en datumkleur → de contrasttest rood (precies 3,17 en 4,46 op koraal); foto's weer meteen laden, `--vvh` weer op `<html>` en de focus niet terugzetten → 4 controles in de rooktest rood. Daarna weer heel gemaakt.
  - **Aangepast in bestaande scripts, met reden:** de rooktest en `screenshots-m4.mjs` openden IndexedDB met vaste versie 1; dat kan niet meer nu de app versie 2 gebruikt (de browser weigert dan). Ze openen hem nu zonder versie, en maken de stores alleen als de database nog niet bestond. Wat ze controleren, is niet veranderd. `screenshots-m4.mjs` daarna nog één keer gedraaid (naar een kladmap): werkt.
  - **Fouten in mijn eigen nieuwe tests** (de app was daar niet fout): Esc tijdens de openingsanimatie (wordt bewust genegeerd), een selector voor de kaart (Leaflet zet de class op het element zelf), en een hulpje dat bij een briefje `data-action` las in plaats van `data-id`. Rechtgezet zonder te veranderen wát ze controleren.
  - **Het proefbord terugzetten** in Chromium: er komt een tweede bord 🧪 bij met 300 briefjes, en van de 40 foto's laden alleen de 3 die in beeld zijn.
- **Niet getest:** alles op een echte telefoon. Vooral: hoe vloeiend het scrollen op een iPhone is. Safari tekent anders dan Chromium (uit mijn kennis: geen aparte "Layerize"-stap zoals hierboven, en het tekent met de GPU), dus de getallen hierboven zeggen weinig over Safari; de testlijst moet het uitwijzen. Verder niet getest: VoiceOver en TalkBack (axe controleert de opmaak, niet hoe het klinkt), een echt toetsenbord aan een iPad, `IntersectionObserver` in Safari met het geschaalde bord in vrij (zou moeten werken, niet nagemeten), en het downloaden van het proefbord op de iPhone (uit mijn kennis: op GitHub met "Download raw file" komt het in Bestanden).

### Te testen op de telefoon (na de deploy van M5)

Punten 1 t/m 9 kunnen zonder worker.

1. Na het bijwerken: verschijnt één keer "Er hangt iets nieuws op het prikbord!" met versie 5?
2. **Je eigen foto's:** staan de foto's op je briefjes er nog, en verschijnen ze (de allereerste keer kan dat even duren, dan worden de duimnagels gemaakt)?
3. **Proefbord binnenhalen:** open op de telefoon `https://github.com/oscardillewaard-ai/prikbord/blob/main/docs/m5/prikbord-backup-proefbord-300.json` (na de deploy; tot die tijd staat het op de werkbranch `ccr-f626df03-9jb4ek`), tik op "Download raw file" (het pijltje), en dan in het Prikbord: Meer → Terugzetten → kies het bestand. Komt er een bord "🧪 Proefbord (300)" bij? Tik op de bordnaam bovenin om erheen te gaan.
4. **Scrollen:** veeg op het proefbord een paar keer flink naar beneden en weer terug. Voelt het vloeiend? Zie je lege polaroidjes (📷), en hoe snel vullen ze zich? Doe het daarna nog een keer (app weg en opnieuw open): beter?
5. **Filteren op het proefbord:** tik een categorie aan en weer uit. Schuiven de briefjes soepel?
6. **Groot:** open een briefje met foto: is de foto scherp?
7. **Vrij op het proefbord:** zoomen en schuiven, en een briefje slepen. Soepel?
8. **Proefbord weghalen:** Meer → Bord verlaten. Is het weg, en staan je eigen borden er nog precies zo?
9. **Leesbaarheid:** de tekenteller rechtsonder op het schrijfvel, "Geprikt door …" op een geopend koraalkleurig briefje (Uit eten), en de datum op een briefje in de Gedaan-doos. Goed te lezen?
10. *(Als je wilt)* **VoiceOver:** Instellingen → Toegankelijkheid → VoiceOver aan, en veeg met één vinger door het bord. Hoor je bijvoorbeeld "Uit eten: Sushi in Den Haag, knop"? Op een geopend briefje: zegt het hartje "Mijn hartje, 2 in totaal"? (Driemaal op de zijknop drukken zet VoiceOver aan en uit, als je dat zo instelt.)
11. *(Als je wilt)* **Toetsenbord** (laptop, of iPad met toetsenbord): Tab door de app, Enter opent een briefje, Esc hangt het terug. In vrij: verplaatsen de pijltjes het briefje met focus?

### M4 (9 nov 2026): link, foto en kaart

- **Gedaan, in volgorde van de spec (§8):**
  - **Link (§5.5):** paperclip op het schrijfvel, "🔗 ah.nl" op het briefje, een klikbare link in het geopende briefje. Nieuwe pure module `js/link.js` (`linkUitInvoer`, `domeinVan`).
  - **Foto's (§6.4):** `js/photos.js` verkleint via canvas (langste zijde 1600 px, JPEG 0,8, liefst onder 400 KB; rekenwerk in de pure module `js/fotomaat.js`), bewaart als Blob in IndexedDB (database `prikbord`, store `fotos`) en houdt een uploadwachtrij bij (store `wachtrij`), zodat een offline toegevoegde foto later alsnog vertrekt, ook na een herstart. Polaroidje met plakband op het bord, in de Gedaan-doos en groot; een vriendelijk leeg polaroidje (📷) zolang hij er niet is. Ook een foto bij "Gedaan!" (§5.8). Back-up met of zonder foto's (base64 in de JSON), en terugzetten met foto's.
  - **Foto-endpoints in de worker:** `PUT /bord/<code>/foto/<id>` (max. 1,5 MB, alleen jpeg, png of webp, en de bytes moeten kloppen met het type: `fotoSoort` in `validate.js`, dus dezelfde controle in app en worker, zie A5) en `GET` met `Cache-Control: public, max-age=31536000, immutable`. Eén KV-sleutel per foto (`foto:<code>:<id>`), niet in de bordstand. Stond hij er al, dan geen tweede schrijfactie. Mislukte KV → 503 met `opnieuw`.
  - **Kaart-tab (§5.9):** Leaflet 1.9.4 uit Tezt `public/parken/vendor/` naar `public/vendor/` (met `LEAFLET-LICENSE`, BSD-2), tegels van OpenStreetMap met zichtbare "© OpenStreetMap-bijdragers". Punaises in de papierkleur van de categorie met de emoji erin, een rood randje bij "nieuw", grijs voor gedaan ("✅ Gedaan ook"). Filters werken hier ook. Tik (of Enter) op een punaise opent het briefje. `js/map.js` laadt Leaflet pas als het nodig is.
  - **Plek kiezen op vier manieren (§5.9):** (1) tikken op de kaart en de punaise verslepen, (2) "🎯 Mijn locatie", (3) een link van Google Maps, OpenStreetMap of Apple Kaarten plakken (pure module `js/plek.js`: `plekUitLink`), (4) zoeken op naam via de worker.
  - **Zoeken via Nominatim, alleen via de worker (§6.5):** `GET /zoek?q=…` met User-Agent `Prikbord/1.0 (+https://github.com/oscardillewaard-ai/prikbord)`, `format=jsonv2`, max. 5, `accept-language=nl`. Antwoorden een week onthouden (Cache API, plus een kleine cache in het geheugen; niet in KV). Minstens 1 s tussen twee vragen aan Nominatim, in de worker én in de app (zie A6 voor de kanttekening). `ZOEKEN=uit` zet het uit zonder app-update; de statuspagina zegt of zoeken aan of uit staat. Bronvermelding bij het zoeken.
- **Release:** versie 4 (`APP_VERSION`, `CACHE` = `prikbord-v4`, `CHANGELOG`). In `SHELL`: `js/fotomaat.js`, `js/link.js`, `js/map.js`, `js/photos.js`, `js/plek.js`, `vendor/leaflet.css`, `vendor/leaflet.js`.
- **Nieuw in het datamodel:** niets: `link`, `foto`, `plek` en `gedaan.foto` stonden al in `VELD_SCHOON` (M1). Het concept bewaart nu ook link, foto en plek (`schoonApparaat`). Wel nieuw in `validate.js`: `MAX_FOTO`, `FOTO_TYPES` en `fotoSoort`, dus ook de worker is veranderd: Oscar plakt bij het neerzetten meteen deze versie.
- **Getest:**
  - `npm test`: 115 groen (was 80). Nieuw: `tests/link.test.mjs` (5), `tests/plek.test.mjs` (9: Google Maps in zeven vormen, OSM, Apple, `geo:`, losse coördinaten, verkorte links, onzin, zoekuitkomsten, labels), `tests/fotomaat.test.mjs` (6: maat van een staande iPhone-foto, pogingen, soort aan de bytes, base64, foto's uit een back-up, welke foto's bij de borden horen), het concept in `validate.test.mjs`, en `tests/worker-foto-zoek.test.mjs` (14): opslaan en ophalen met de juiste headers, geen tweede schrijfactie, 404 zonder cache, precies 1,5 MB mag en 1 byte meer niet (ook een te grote `Content-Length`), alleen jpeg/png/webp en de bytes moeten kloppen, slechte id's, methodes, CORS, mislukte KV; zoeken met de juiste vraag en User-Agent, uit het geheugen bij dezelfde vraag, `ZOEKEN=uit`, alleen met de juiste `Origin`, 2 tot 200 tekens, de Cache API heen en terug, minstens 1 s tussen vragen aan Nominatim (en "even druk" bij een lange rij), en nette fouten als Nominatim druk of onbereikbaar is.
  - **Ter controle bewust kapotgemaakt:** zonder de bytes-controle gaat de foto-test rood; met 0 ms pauze gaat de zoek-test rood. Daarna weer heel gemaakt.
  - **Convergentie:** de drie telefoons zetten nu ook willekeurig links, foto's en plekken (erop, eraf, anders), en de test controleert dat die echt in de eindstand zitten. Nog steeds exact dezelfde stand op alle telefoons en de server (1500 rondes: 392 verouderde leesacties, 87 mislukte en 878 geslaagde schrijfacties).
  - **KV op een drukke dag** (`tests/kv-dag.test.mjs`, nu met foto's: bij 15% van de gewone bewerkingen een foto, uit een eigen PRNG zodat de rest van de dag gelijk blijft): **381 KV-schrijfacties**, waarvan 38 voor foto's, en **2.494 KV-leesacties**, waarvan 128 voor foto's (één keer ophalen per telefoon). De 343 schrijfacties voor briefjes zijn precies die van M3. Gratis plan: 1.000 schrijfacties per dag, samen met Parkenjacht.
  - **Rekentijd** (Node op deze cloudcomputer, niet op Cloudflare): een foto van 400 KB opslaan ± 0,7 ms, ophalen ± 0,4 ms. De grens is 10 ms.
  - `npm run lint`: schoon.
  - `npm run rooktest`: 219 van 219 (was 152). Nieuw (67): link (linkveld met focus, `javascript:` geweigerd, Enter bewaart, concept met link na herladen, "🔗 ah.nl" op het briefje, klikbare link met `target=_blank` en `noopener`, weghalen met het kruisje), foto (polaroid op het vel en het bord, JPEG in IndexedDB, **de staande iPhone-foto staat rechtop: 1200 × 1600**, kleiner dan 400 KB, niet in localStorage, een foto vol detail ook onder 400 KB, HEIC-melding), Gedaan met foto en het plakboek, back-up met en zonder foto's en terugzetten op een nieuwe telefoon, de vier manieren van plek kiezen (tikken, slepen, mijn locatie via nep-GPS, verkorte en lange Google-link zonder zoekdienst, zoeken zonder sync-server, typen zoekt niet, zoeken met User-Agent en bronvermelding, ≥ 1 s tussen twee zoekopdrachten in de app, één uitkomst meteen gekozen, `ZOEKEN=uit`), de kaart-tab (punaises in de categoriekleur, bronvermelding, tegels van OSM, zoomknoppen in het Nederlands, alles in beeld, openen met het toetsenbord, gedaan verdwijnt en komt grijs terug met "Gedaan ook", filters, niks gevonden, "Op de kaart" met het briefje in het midden), en samen: bij het delen gaan de foto's naar de worker, Tara ziet en bewaart Oscars foto, offline blijft hij zichtbaar, een offline gemaakte foto wacht in de wachtrij (ook na herladen) en vertrekt zodra je online bent, en een foto die nog niet geüpload is, geeft eerst een leeg polaroidje en verschijnt later alsnog. Plus: "Nu bijwerken" laat IndexedDB staan.
  - **Aangepast in de rooktest, met reden:** de kaarttegels worden in elke browser van de test afgevangen met een effen tegel (deze computer haalt niets bij OpenStreetMap). Bestaande controles zijn niet veranderd.
  - **Fouten die de tests vingen:** (1) een punaise op de kaart ging met het toetsenbord niet open (Leaflet opent met Enter alleen een popup). (2) Een kaart weghalen terwijl hij nog inzoomde (link plakken en meteen "Klaar") gaf een fout uit Leaflet; nu stopt de app de animatie en ruimt de kaart pas daarna op. (3) Niet alle punaises stonden helemaal in beeld: een punaise steekt 45 px boven zijn punt uit, en de kaart schoof nog na. Nu meer ruimte boven en de eerste keer zonder animatie. (4) Mijn eigen nieuwe tests hadden drie fouten (een standaardwaarde, een id die toch geldig was, en een import die het bord ernaast zet in plaats van erover), die ik heb rechtgezet zonder te veranderen wát ze controleren.
  - **Zelf gezien in screenshots:** met het toetsenbord open (± 420 px hoog) en een foto op het vel viel "Prikken!" eronder; nu begint het tekstvak met 3 regels en groeit het mee waar ruimte is (nagemeten: "Prikken!" eindigt op 415 px). Verder: "(mag leeg blijven)" was slecht leesbaar op het donkere doek, en de zoomknoppen van Leaflet hadden Engelse uitleg ("Zoom in"); allebei rechtgezet.
- **Screenshots** in `docs/m4-kaart/` (390 px): bord, open, op-de-kaart, kaart, vel, plek-zoeken, plek-gekozen, doos, backup. Opnieuw maken: `npm run screenshots:m4`. **Let op:** de kaarttegels in die plaatjes zijn nep (deze computer kan OpenStreetMap niet bereiken); op de telefoon staat daar de echte kaart.
- **Niet getest:** alles op echte telefoons (zie de testlijst hieronder): het fotomenu en de camera op de iPhone, een echte HEIC, of Safari de foto ook rechtop zet (uit mijn kennis wel, sinds Safari 13.1), "Mijn locatie" met een echte GPS en de toestemmingsvraag, de echte OSM-tegels en het slepen met een vinger, het deelmenu met een back-up van een paar MB, de echte Nominatim (deze sessie kan er niet bij; de rooktest gebruikt een nep-Nominatim met dezelfde soort antwoorden), de Cache API op Cloudflare, en de echte worker (staat nog niet).

### Te testen op de telefoon (na de deploy van M4)

Punten 1 t/m 11 kunnen ook zonder worker. Punten 12 t/m 14 pas als de worker staat (dan werken zoeken en foto's delen).

1. Na het bijwerken: verschijnt één keer "Er hangt iets nieuws op het prikbord!" met versie 4?
2. **Link:** schrijfvel → 📎 Link → plak een link (bijv. een recept uit Safari) → OK. Staat "🔗 domein" op het briefje? Open het briefje en tik op de link: opent hij?
3. **Foto:** Foto (het stukje plakband) → kies een **staande** foto uit je fotobibliotheek. Staat hij rechtop? Hoe lang zie je het ⏳ bij het verkleinen? Probeer ook de camera.
4. **HEIC:** staat je iPhone op "Hoge efficiëntie" (Instellingen → Camera → Formaten)? Dan zijn je foto's HEIC. Werkt kiezen gewoon? Ik verwacht van wel, maar heb het niet kunnen testen.
5. **Gedaan met foto:** open een briefje → Gedaan! → Foto erbij → In de doos. Staat het polaroidje in het plakboek?
6. **Plek, tikken en slepen:** 🗺️ Plek → tik op de kaart, en versleep de punaise met je vinger. Schuift de kaart niet mee terwijl je de punaise sleept? Werkt knijpen om te zoomen in het kaartje?
7. **Mijn locatie:** vraagt de iPhone om toestemming, en klopt de plek daarna?
8. **Link plakken:** in Google Maps → Delen → Link kopiëren → plakken in het zoekvakje. Vaak is dat een verkorte `maps.app.goo.gl`-link; dan zie je uitleg. Welke soort link geeft jouw Google Maps? Laat het me weten, dan kijk ik of ik er meer mee kan. Probeer ook Apple Kaarten → Deel → Kopieer.
9. **Kaart-tab:** echte kaart, punaises in de kleur van de categorie, tik opent het briefje. Zet "✅ Gedaan ook" aan: grijze punaises?
10. **Op de kaart:** open een briefje met een plek → 🗺️ Op de kaart. Sta je ingezoomd op dat briefje?
11. **Toetsenbord:** schrijfvel met een foto erop, toetsenbord open. Staat "Prikken!" nog boven het toetsenbord?
12. **Zoeken** (met worker): typ "Mauritshuis" → Zoek. Komen er uitkomsten, en zet een tik de punaise neer?
13. **Foto's samen** (met worker): Tara ziet jouw foto's. Vliegtuigmodus aan, een briefje met foto prikken, vliegtuigmodus uit: komt hij bij Tara?
14. **Back-up met foto's:** Meer → Back-up maken → Met foto's → Bewaar in Bestanden. Hoe groot werd hij? Terugzetten op een ander toestel: staan de foto's erbij?

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

Dit staat ook bovenin `proxy/prikbord-sync-worker.js`. Het is gratis en kost ± 10 minuten. Doe het het liefst op een computer: dan is het kopiëren en plakken makkelijker. De knoppen heb ik op 9 nov 2026 nagelezen in de documentatie van Cloudflare; "Edit code" ken ik uit mijn hoofd.

1. Ga naar dash.cloudflare.com en log in (hetzelfde account als Parkenjacht mag).
2. **Opslag maken:** ga naar **Workers KV** (`https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces`) → **Create instance**, noem hem `prikbord` → **Create**. Neem niet die van Parkenjacht: zo werkt de een gewoon door als de ander stuk gaat. Kies geen "KV Instant" (een bèta die we niet nodig hebben).
3. **Worker maken:** **Workers & Pages** (`https://dash.cloudflare.com/?to=/:account/workers-and-pages`) → **Create application** → **Start with Hello World!** → **Get started**, noem hem `prikbord` en klik **Deploy**.
4. **De code erin:** open het bestand op GitHub: `https://github.com/oscardillewaard-ai/prikbord/blob/main/proxy/prikbord-sync-worker.js` als M4 gedeployd is, en anders `https://github.com/oscardillewaard-ai/prikbord/blob/ccr-80bc7fbf-gcraqb/proxy/prikbord-sync-worker.js` (de versie mét foto's en zoeken). Kopieer alles (met de knop "Copy raw file", of via "Raw" en dan alles selecteren). Open in Cloudflare bij je worker de code-editor (**Edit code**), haal alles weg, plak, en klik **Deploy**.
5. **Opslag koppelen:** open de worker → tabblad **Bindings** → **Add binding** → **KV namespace** → **Add binding**. Variable name: `PRIKBORD`, kies de namespace `prikbord` en klik **Add binding**.
6. **Controleren:** open het adres van de worker in je browser. Ik verwacht `https://prikbord.oscar-dillewaard.workers.dev`, net als bij Parkenjacht, maar dat is een aanname. Daar staat in gewone taal of alles klopt, ook of plekken zoeken aan staat. Met `?schrijftest=1` erachter test hij ook schrijven (dat kost één van de 1.000 schrijfacties per dag).
7. **Stuur me het adres**, dan zet ik het als `DEFAULT_SYNC_URL` in de app. Daarna hoeft niemand meer een adres in te vullen, en kan iedereen plekken zoeken.

**Zoeken uitzetten** (bijv. als Nominatim erom vraagt, of als je het niet wilt): open de worker → **Settings** → **Variables and Secrets** → **Add**. Type: Text, Variable name: `ZOEKEN`, Value: `uit` → **Deploy**. Nagelezen in de docs op 9 nov 2026. De app zegt dan "Zoeken staat even uit"; tikken op de kaart, je locatie en een link plakken werken gewoon. Weer aan: de variabele weghalen en Deploy.

**Over Nominatim:** zoeken gaat via de openbare zoekdienst van OpenStreetMap. Hun regels (operations.osmfoundation.org/policies/nominatim) zeggen dat dat alleen mag als jij als maker er bewust voor kiest en zelf verantwoordelijk bent voor het naleven. De app houdt zich aan wat er staat (zie §6.5 en A6), maar die keuze ligt bij jou.

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

## Na M5: handig om te weten

- **Alle mijlpalen uit de spec zijn gebouwd.** Wat er nog ligt, komt van Oscar: de testlijsten (M3 met twee telefoons, M4 en M5), de worker neerzetten, en A6.
- **`DEFAULT_SYNC_URL`** in `public/js/app.js` is nog leeg. Zodra Oscar het adres van de worker geeft: daar invullen, versie ophogen (release-ritueel) en deployen na akkoord. Daarna hoeft niemand meer een adres in te vullen, en kan iedereen plekken zoeken.
- **Prestaties meten:** `npm run prestaties` (opties bovenin `scripts/prestaties.mjs`: `--tweede`, `--css '…'` om een variant te vergelijken, `--trace` voor een Chrome-trace). Elke meting twee keer doen; de ruis is een paar haperende frames. Kijk vooral naar "langste hapering" en "lange taken"; de p95 staat bijna altijd op 16,8 ms.
- **Wil Oscar het scrollen nog strakker** (als het op zijn telefoon hapert): laat de duimnagels van het hele bord meteen laden in plaats van pas in beeld. Gemeten: dan 2 lange taken in plaats van ± 20, voor 13,8 MP fotogeheugen bij 60 foto's in plaats van 2 à 8. Dat is één regel (de `rootMargin` van `fotoKijker` heel groot maken), maar het gaat tegen de letter van §8 in ("foto's pas laden als ze in beeld komen"), dus alleen als Oscar dat wil.
- **Foto's en de rooktest:** de app gebruikt IndexedDB versie 2. Een script dat de database zelf opent, moet dat zonder versie doen (`indexedDB.open('prikbord')`) en stores alleen maken als ze er nog niet zijn; anders weigert de browser.
- **Toegankelijkheid:** `scripts/axe.mjs` (`axeScan(page)`) is te gebruiken in elk Playwright-script. Een nieuw scherm? Zet er een `scan()` bij in blok 35 van de rooktest. Een nieuwe kleur op het papier? Zet hem in `tests/contrast.test.mjs`.
- **Ideeën voor later** (niet gebouwd, uit §7 van de spec en uit de mijlpalen): zoeken op tekst, linkvoorbeelden, delen vanuit een andere app, pushmeldingen, donker thema, tekenen met de vinger, clustering van punaises op de kaart, foto's van grafstenen opruimen in KV, "bord terughalen" uit een losse koppeling.
- **Nog open bij Oscar:** akkoord op M5 en de deploy; A6 (de Nominatim-pauze per worker-exemplaar, voorgesteld); de worker neerzetten (de versie van M4 is nog steeds de goede: M5 veranderde `validate.js` en `merge.js` niet); de tests met twee telefoons uit M3; de testlijsten van M4 en M5.

## Startprompt voor een volgende chat

Plak dit in een nieuwe chat met repo `oscardillewaard-ai/prikbord` en omgeving "Tezt" (bijvoorbeeld als de testlijsten iets opleveren, of als de worker staat):

```
Prikbord, na M5 (onderhoud en terugkoppeling). Je werkt in de repo oscardillewaard-ai/prikbord.
1. Merge eerst het werk uit M5 in je werkbranch (verandert niets als het al op main staat):
   git fetch origin ccr-f626df03-9jb4ek && git merge origin/ccr-f626df03-9jb4ek
2. Lees docs/prikbord-spec.md (leidend), docs/prikbord-afwijkingen.md en
   docs/prikbord-voortgang.md (besluiten, aannames, logboek M1 t/m M5, de
   testlijsten en "Na M5: handig om te weten").
3. Vraag Oscar wat hij vond bij de testlijsten (M3 met twee telefoons, M4, M5)
   en los dat op. Geeft hij het adres van de worker, zet het dan als
   DEFAULT_SYNC_URL in public/js/app.js (met het release-ritueel).
4. Draai voor elke commit npm test, npm run lint en npm run rooktest. Werk aan
   het eind docs/prikbord-voortgang.md bij. Deployen (pushen naar main) pas na
   akkoord van Oscar.
```
