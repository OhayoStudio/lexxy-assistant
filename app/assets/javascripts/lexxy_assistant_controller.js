import { Controller } from "@hotwired/stimulus"

const DEFAULT_FIELD_MAPPINGS = {
  title:            "[name$='[title]']",
  subtitle:         "[name$='[subtitle]']",
  excerpt:          "[name$='[excerpt]']",
  meta_description: "[name$='[meta_description]']",
  meta_keywords:    "[name$='[meta_keywords]']",
  reading_time:     "[name$='[reading_time]']",
  status:           "[name$='[status]']"
}

export default class extends Controller {
  static targets = [ "panel", "chevron", "prompt", "generateBtn", "applyBtn", "insertBtn", "status", "output", "usage" ]
  static values  = { streamUrl: String, patchUrl: String, fields: Object, showUsage: { type: Boolean, default: true } }

  connect() {
    this._accumulated  = ""
    this._parsed       = null
    this._source       = null
    this._bodyInserted = false

    // Re-apply body just before Turbo serialises the form
    this._submitHandler = () => {
      if (!this._bodyInserted || !this._parsed?._body) return
      const lexxy = document.querySelector("lexxy-editor")
      if (lexxy) lexxy.value = this._parsed._body
    }
    this.element.closest("form")?.addEventListener("submit", this._submitHandler)
  }

  disconnect() {
    this.element.closest("form")?.removeEventListener("submit", this._submitHandler)
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  _setStatus(msg, isError = false) {
    this.statusTarget.textContent = msg
    this.statusTarget.classList.toggle("text-red-500",       isError)
    this.statusTarget.classList.toggle("dark:text-red-400",  isError)
    this.statusTarget.classList.toggle("text-gray-500",      !isError)
    this.statusTarget.classList.toggle("dark:text-gray-400", !isError)
  }

  toggle() {
    const hidden = this.panelTarget.classList.toggle("hidden")
    this.chevronTarget.textContent = hidden ? "▸" : "▾"
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  generate() {
    const prompt = this.promptTarget.value.trim()
    if (!prompt) return

    this._accumulated = ""
    this._parsed      = null
    this.outputTarget.textContent = ""
    this.outputTarget.classList.remove("hidden")
    this.usageTarget.classList.add("hidden")
    this.usageTarget.textContent = ""
    this.applyBtnTarget.classList.add("hidden")
    this.insertBtnTarget.classList.add("hidden")
    this.generateBtnTarget.disabled = true
    this._setStatus("Thinking…")

    if (this.patchUrlValue) {
      fetch(this.patchUrlValue, {
        method:  "PATCH",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content
        },
        body: `field=assistant_prompt&value=${encodeURIComponent(prompt)}`
      })
    }

    if (this._source) this._source.close()

    const ctrl = new AbortController()
    this._abortCtrl = ctrl

    fetch(this.streamUrlValue, {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content
      },
      body:   `prompt=${encodeURIComponent(prompt)}`,
      signal: ctrl.signal
    }).then(res => {
      if (!res.ok) {
        return res.text().then(t => { throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`) })
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ""
      let eventType = "data"

      const processBuffer = () => {
        const lines = buffer.split("\n")
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith("event: ")) { eventType = line.slice(7).trim(); continue }
          if (!line.startsWith("data: ")) { eventType = "data"; continue }

          const payload = line.slice(6).replace(/\\n/g, "\n")

          if (eventType === "done") {
            try { this._showUsage(JSON.parse(payload)) } catch (e) { console.warn("[lexxy-assistant] usage parse failed:", e) }
            this._onStreamEnd()
            return
          }
          if (eventType === "error") {
            this._setStatus(`Error: ${payload}`, true)
            this.generateBtnTarget.disabled = false
            return
          }

          this._accumulated += payload
          this.outputTarget.textContent = this._accumulated
          this.outputTarget.scrollTop   = this.outputTarget.scrollHeight
          this._setStatus("Writing…")
          eventType = "data"
        }
      }

      const pump = () => reader.read().then(({ done, value }) => {
        if (done) {
          if (buffer.trim()) processBuffer()
          this._onStreamEnd()
          return
        }
        buffer += decoder.decode(value, { stream: true })
        processBuffer()
        pump()
      })
      pump()
    }).catch(err => {
      if (err.name !== "AbortError") {
        this._setStatus(`Error: ${err.message}`, true)
        this.generateBtnTarget.disabled = false
        console.error(err)
      }
    })
  }

  _onStreamEnd() {
    this.generateBtnTarget.disabled = false
    this._setStatus("Done")
    this._parsed = this._parse(this._accumulated)
    this.applyBtnTarget.classList.remove("hidden")
    this.insertBtnTarget.classList.remove("hidden")
  }

  // ── Usage ──────────────────────────────────────────────────────────────────

  _showUsage(u) {
    if (!this.showUsageValue) return

    const PRICE = { input: 15.00, output: 75.00, cache_write: 3.75, cache_read: 0.30 }
    const cost =
      ((u.input_tokens                || 0) * PRICE.input        / 1_000_000) +
      ((u.output_tokens               || 0) * PRICE.output       / 1_000_000) +
      ((u.cache_creation_input_tokens || 0) * PRICE.cache_write  / 1_000_000) +
      ((u.cache_read_input_tokens     || 0) * PRICE.cache_read   / 1_000_000)

    const parts = []
    if (u.input_tokens)  parts.push(`in ${u.input_tokens.toLocaleString()}`)
    if (u.output_tokens) parts.push(`out ${u.output_tokens.toLocaleString()}`)
    if (u.cache_read_input_tokens  > 0) parts.push(`cache hit ${u.cache_read_input_tokens.toLocaleString()}`)
    if (u.cache_creation_input_tokens > 0) parts.push(`cache write ${u.cache_creation_input_tokens.toLocaleString()}`)
    if (Object.values(u).some(v => v > 0)) parts.push(`$${cost.toFixed(4)}`)

    this.usageTarget.textContent = parts.join(" · ")
    this.usageTarget.classList.remove("hidden")
  }

  // ── Parsing ────────────────────────────────────────────────────────────────

  _parse(text) {
    const fields = {}
    const tableRe = /^\|\s*\*\*?([^|*]+)\*\*?\s*\|\s*([^|]*?)\s*\|$/gm
    let m
    while ((m = tableRe.exec(text)) !== null) {
      fields[m[1].trim().toLowerCase().replace(/\s+/g, "_")] = m[2].trim()
    }
    const bodyMatch = text.match(/<(p|h[1-6]|blockquote|ul|ol)[\s>]/)
    fields._body = bodyMatch ? text.slice(text.indexOf(bodyMatch[0])).trim() : ""
    return fields
  }

  // ── Apply CMS fields ───────────────────────────────────────────────────────

  applyFields() {
    if (!this._parsed) return
    const f  = this._parsed
    const fm = this.hasFieldsValue ? this.fieldsValue : DEFAULT_FIELD_MAPPINGS

    Object.entries(fm).forEach(([ key, selector ]) => {
      if (key === "status") {
        if (!f.status) return
        const sel = document.querySelector(selector)
        if (!sel) return
        const target = f.status.toLowerCase()
        const opt = Array.from(sel.options).find(o => o.value === target)
        if (opt) sel.value = opt.value
      } else {
        this._fill(selector, f[key])
      }
    })

    this._setStatus("Fields applied")
  }

  _fill(selector, value) {
    if (!value) return
    const el = document.querySelector(selector)
    if (el) el.value = value
  }

  // ── Insert body into Lexxy editor ─────────────────────────────────────────

  insertBody() {
    if (!this._parsed || !this._parsed._body) return

    const lexxy = document.querySelector("lexxy-editor")
    if (!lexxy) { this._setStatus("Editor not found", true); return }

    lexxy.value = this._parsed._body
    this._bodyInserted = true
    this._setStatus("Inserted into editor")
  }
}
