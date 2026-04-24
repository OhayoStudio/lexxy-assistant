module LexxyAssistant
  module Adapters
    class Base
      # Yield text chunks as they arrive, return an optional usage hash.
      #
      # usage hash keys (all optional):
      #   input_tokens, output_tokens,
      #   cache_creation_input_tokens, cache_read_input_tokens
      def stream(prompt, system_prompt:, &block)
        raise NotImplementedError, "#{self.class}#stream is not implemented"
      end
    end
  end
end
