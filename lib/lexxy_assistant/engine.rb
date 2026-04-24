module LexxyAssistant
  class Engine < ::Rails::Engine
    isolate_namespace LexxyAssistant

    initializer "lexxy_assistant.importmap", before: "importmap" do |app|
      if app.config.respond_to?(:importmap)
        app.config.importmap.paths << root.join("config/importmap.rb")
        app.config.importmap.cache_sweepers << root.join("app/assets/javascripts")
      end
    end
  end
end

LexxyAssistant::Engine.routes.draw do
  post "stream", to: "assistant#stream", as: :stream
end
