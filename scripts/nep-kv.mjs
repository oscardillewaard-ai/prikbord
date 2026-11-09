// Een nep-KV in het geheugen (een Map), met de functies van Cloudflare KV die
// de worker gebruikt: get, getWithMetadata, put en list. Voor de tests en de
// lokale nep-worker. Telt lees- en schrijfacties (zoals het gratis plan).
// Waarden zijn tekst of bytes (foto's), net als bij KV; lezen kan als
// "text", "json" of "arrayBuffer".
export function nepKv() {
  const data = new Map() // sleutel → { value: string | Uint8Array, metadata }
  const tel = { lees: 0, schrijf: 0 }
  function uit(v, type) {
    if (v === undefined) return null
    if (type === 'arrayBuffer') {
      const b = typeof v === 'string' ? new TextEncoder().encode(v) : v
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    }
    const tekst = typeof v === 'string' ? v : new TextDecoder().decode(v)
    return type === 'json' ? JSON.parse(tekst) : tekst
  }
  const soort = (opties) => (typeof opties === 'string' ? opties : opties?.type)
  return {
    data,
    tel,
    async get(sleutel, opties) {
      tel.lees++
      return uit(data.get(sleutel)?.value, soort(opties))
    },
    async getWithMetadata(sleutel, opties) {
      tel.lees++
      const e = data.get(sleutel)
      return { value: uit(e?.value, soort(opties)), metadata: e?.metadata ?? null }
    },
    async put(sleutel, value, opties = {}) {
      tel.schrijf++
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value.slice(0)) : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)) : null
      data.set(sleutel, { value: bytes || String(value), metadata: opties.metadata ?? null })
    },
    async list() {
      tel.lees++
      return { keys: [...data.keys()].map((name) => ({ name })), list_complete: true }
    },
  }
}
