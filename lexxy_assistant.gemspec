require_relative "lib/lexxy_assistant/version"

Gem::Specification.new do |spec|
  spec.name        = "lexxy-assistant"
  spec.version     = LexxyAssistant::VERSION
  spec.authors     = [ "Jérôme Sadou" ]
  spec.email       = [ "jerome@ohayostudio.com" ]
  spec.summary     = "LLM-agnostic writing assistant for Lexxy rich-text editors"
  spec.description = "A Rails engine that streams LLM responses into a Lexxy editor via SSE. " \
                     "Ships a Stimulus controller that fills form fields and inserts the generated body. " \
                     "Supports any LLM via an adapter interface; includes a built-in Claude adapter."
  spec.homepage    = "https://github.com/OhayoStudio/lexxy-assistant"
  spec.license     = "MIT"

  spec.required_ruby_version = ">= 3.1"

  spec.files = Dir[
    "app/**/*",
    "config/**/*",
    "lib/**/*",
    "LICENSE",
    "README.md"
  ]

  spec.add_dependency "railties", ">= 7.0", "< 9"

  # anthropic is optional — only needed when using Adapters::Claude
  spec.add_development_dependency "anthropic", "~> 0.3"
end
