module LexxyAssistant
  class ApplicationController < ActionController::Base
    protect_from_forgery with: :exception

    # Applied at class-load time so Zeitwerk reloads pick them up correctly.
    def self.inherited(subclass)
      super
      LexxyAssistant.config.before_actions.each { |a| subclass.before_action(a) }
    end
  end
end
