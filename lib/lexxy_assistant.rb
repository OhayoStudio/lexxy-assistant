require "lexxy_assistant/version"
require "lexxy_assistant/configuration"
require "lexxy_assistant/adapters/base"
require "lexxy_assistant/adapters/claude"
require "lexxy_assistant/engine"

module LexxyAssistant
  class << self
    def config
      @config ||= Configuration.new
    end

    def configure
      yield config
    end

    def reset!
      @config = nil
    end
  end
end
