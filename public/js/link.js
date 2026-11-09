// Een link op een briefje (§5.5), puur: geen DOM, geen opslag.
// Alleen http(s). Op het bord staat alleen het domein ("🔗 ah.nl").

import { schoonLink } from './validate.js'

// Het eerste adres uit een geplakt berichtje ("Kijk: https://… leuk!").
const URL_IN_TEKST = /https?:\/\/[^\s<>"']+/i
// Zonder http ervoor, maar wel een domein: "ah.nl/allerhande/recept".
const KAAL_DOMEIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i

// Wat iemand intypt of plakt, als nette link. Geeft '' terug bij een leeg
// vakje (= geen link) en undefined als het geen http(s)-link kan zijn.
export function linkUitInvoer(tekst) {
  const t = String(tekst ?? '').trim()
  if (!t) return ''
  const gevonden = t.match(URL_IN_TEKST)
  if (gevonden) {
    // Leestekens aan het eind horen meestal bij de zin, niet bij de link.
    return schoonLink(gevonden[0].replace(/[).,!?;:]+$/, ''))
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^[^:/]+:\d/.test(t)) return undefined // javascript:, mailto: …
  if (KAAL_DOMEIN.test(t)) return schoonLink(`https://${t}`)
  return undefined
}

// Het domein voor op het briefje, zonder "www.": https://www.ah.nl/… → ah.nl
export function domeinVan(link) {
  try {
    return new URL(link).hostname.replace(/^www\d?\./i, '')
  } catch {
    return ''
  }
}
