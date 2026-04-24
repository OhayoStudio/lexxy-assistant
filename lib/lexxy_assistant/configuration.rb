module LexxyAssistant
  DEFAULT_FIELD_MAPPINGS = {
    title:            "[name$='[title]']",
    subtitle:         "[name$='[subtitle]']",
    excerpt:          "[name$='[excerpt]']",
    meta_description: "[name$='[meta_description]']",
    meta_keywords:    "[name$='[meta_keywords]']",
    reading_time:     "[name$='[reading_time]']",
    status:           "[name$='[status]']"
  }.freeze

  class Configuration
    attr_accessor :adapter, :system_prompt, :field_mappings, :show_usage

    def initialize
      @field_mappings = DEFAULT_FIELD_MAPPINGS.dup
      @show_usage     = true
      @before_actions = []
    end

    # Register before_actions the engine controllers should run.
    # Accepts a method name (Symbol) or a block, mirroring Rails' before_action API.
    def before_action(method_name = nil, &block)
      @before_actions << (method_name || block)
    end

    def before_actions
      @before_actions.dup.freeze
    end
  end
end
