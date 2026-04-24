LexxyAssistant::Engine.routes.draw do
  post "stream", to: "assistant#stream", as: :stream
end
