module LexxyAssistant
  module Adapters
    class Claude < Base
      def initialize(api_key:, model: "claude-opus-4-6", max_tokens: 16_000)
        @api_key    = api_key
        @model      = model
        @max_tokens = max_tokens
      end

      def stream(prompt, system_prompt:, &block)
        require "anthropic"
        client     = Anthropic::Client.new(api_key: @api_key)
        msg_stream = client.messages.stream(
          model:      @model.to_sym,
          max_tokens: @max_tokens,
          system_:    [ { type: "text", text: system_prompt, cache_control: { type: "ephemeral" } } ],
          messages:   [ { role: "user", content: prompt } ]
        )
        msg_stream.text.each { |chunk| block.call(chunk) }
        u = msg_stream.accumulated_message.usage
        {
          input_tokens:                u.input_tokens,
          output_tokens:               u.output_tokens,
          cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
          cache_read_input_tokens:     u.cache_read_input_tokens     || 0
        }
      end
    end
  end
end
