// Een nep-KV in het geheugen (een Map), met de functies van Cloudflare KV die
// de worker gebruikt: get, getWithMetadata, put en list. Voor de tests en de
// lokale nep-worker. Telt lees- en schrijfacties (zoals het gratis plan).
export function nepKv() {
  const data = new Map() // sleutel → { value, metadata }
  const tel = { lees: 0, schrijf: 0 }
  const uit = (v, type) => (v === undefined ? null : type === 'json' ? JSON.parse(v) : v)
  return {
    data,
    tel,
    async get(sleutel, opties) {
      tel.lees++
      const type = typeof opties === 'string' ? opties : opties?.type
      return uit(data.get(sleutel)?.value, type)
    },
    async getWithMetadata(sleutel, opties) {
      tel.lees++
      const type = typeof opties === 'string' ? opties : opties?.type
      const e = data.get(sleutel)
      return { value: uit(e?.value, type), metadata: e?.metadata ?? null }
    },
    async put(sleutel, value, opties = {}) {
      tel.schrijf++
      data.set(sleutel, { value: String(value), metadata: opties.metadata ?? null })
    },
    async list() {
      tel.lees++
      return { keys: [...data.keys()].map((name) => ({ name })), list_complete: true }
    },
  }
}
