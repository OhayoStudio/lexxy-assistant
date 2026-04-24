# lexxy-assistant

LLM-agnostic writing assistant for [Lexxy](https://github.com/OhayoStudio/lexxy) rich-text editors.

- Streams LLM responses directly into a Lexxy editor via Server-Sent Events
- Parses structured output (markdown table + HTML body) and fills form fields
- Works with **any LLM** — wire up Claude, OpenAI, Gemini, or your own via a simple adapter interface
- Ships a built-in [Claude](https://www.anthropic.com) adapter as a convenience

## Requirements

- Rails 7.0+
- [Lexxy](https://github.com/OhayoStudio/lexxy) (peer dependency)
- Importmap Rails (standard in Rails 7+)
- [Stimulus](https://stimulus.hotwired.dev) (Hotwire — standard in Rails 7+)

## Installation

```ruby
# Gemfile
gem "lexxy-assistant"

# If using the built-in Claude adapter:
gem "anthropic"
```

```bash
bundle install
```

## Setup

### 1. Mount the engine

```ruby
# config/routes.rb
mount LexxyAssistant::Engine, at: "/lexxy_assistant"
```

### 2. Configure the adapter

```ruby
# config/initializers/lexxy_assistant.rb
LexxyAssistant.configure do |c|
  # Required: the system prompt sent to the LLM on every request
  c.system_prompt = Rails.root.join("docs/writing_guide.md").read

  # Required: an adapter that streams text chunks
  c.adapter = LexxyAssistant::Adapters::Claude.new(
    api_key:    ENV["ANTHROPIC_API_KEY"],
    model:      "claude-opus-4-6",   # default
    max_tokens: 16_000               # default
  )

  # Optional: protect the streaming endpoint
  c.before_action :authenticate_admin!

  # Optional: override which form fields the "Apply fields" button fills
  # c.field_mappings = { title: "[name$='[title]']", ... }

  # Optional: hide token cost display (default: true)
  # c.show_usage = false
end
```

### 3. Pin the Stimulus controller

```ruby
# config/importmap.rb
pin "lexxy_assistant_controller", to: "lexxy_assistant_controller.js"
```

Register it with Stimulus:

```js
// app/javascript/controllers/index.js
import LexxyAssistantController from "lexxy_assistant_controller"
application.register("lexxy-assistant", LexxyAssistantController)
```

### 4. Add the panel to your form

The controller expects specific targets in the HTML. Minimal example:

```erb
<div data-controller="lexxy-assistant"
     data-lexxy-assistant-stream-url-value="<%= lexxy_assistant.stream_path %>"
     data-lexxy-assistant-fields-value="<%= LexxyAssistant.config.field_mappings.to_json %>">

  <%# Toggle button %>
  <button type="button" data-action="lexxy-assistant#toggle">
    Writing assistant <span data-lexxy-assistant-target="chevron">▸</span>
  </button>

  <%# Collapsible panel %>
  <div data-lexxy-assistant-target="panel" class="hidden">
    <textarea data-lexxy-assistant-target="prompt" placeholder="Describe the article…"></textarea>

    <button type="button" data-action="lexxy-assistant#generate"
            data-lexxy-assistant-target="generateBtn">Generate</button>

    <p data-lexxy-assistant-target="status"></p>
    <pre data-lexxy-assistant-target="output" class="hidden"></pre>
    <small data-lexxy-assistant-target="usage" class="hidden"></small>

    <button type="button" data-action="lexxy-assistant#applyFields"
            data-lexxy-assistant-target="applyBtn" class="hidden">Apply fields</button>
    <button type="button" data-action="lexxy-assistant#insertBody"
            data-lexxy-assistant-target="insertBtn" class="hidden">Insert into editor</button>
  </div>
</div>
```

#### Optional: persist the prompt automatically

Pass a `patch-url` if you want the prompt saved on each generation without requiring a form submit:

```erb
data-lexxy-assistant-patch-url-value="<%= patch_field_admin_article_path(@article) %>"
```

The endpoint should accept `PATCH` with params `field` and `value`.

## Writing a custom adapter

Any object responding to `#stream(prompt, system_prompt:, &block)` works:

```ruby
# Yield text chunks; return an optional usage hash
class MyOpenAIAdapter
  def stream(prompt, system_prompt:)
    client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])
    client.chat(
      parameters: {
        model:    "gpt-4o",
        stream:   proc { |chunk, _| yield chunk.dig("choices", 0, "delta", "content").to_s },
        messages: [
          { role: "system", content: system_prompt },
          { role: "user",   content: prompt }
        ]
      }
    )
    nil  # usage hash is optional
  end
end

LexxyAssistant.configure { |c| c.adapter = MyOpenAIAdapter.new }
```

## LLM output format

The assistant parses two things from the LLM response:

1. **A markdown table** for form fields:
   ```
   | **Field** | **Value** |
   | title | My Article Title |
   | subtitle | A short subtitle |
   ```
2. **HTML body** — everything from the first `<p>` tag to the end of the response.

Structure your system prompt to produce this format. See the built-in Claude adapter for a reference implementation.

## License

MIT
