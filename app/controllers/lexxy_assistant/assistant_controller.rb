module LexxyAssistant
  class AssistantController < ApplicationController
    include ActionController::Live

    def stream
      response.headers["Content-Type"]      = "text/event-stream"
      response.headers["Cache-Control"]     = "no-cache"
      response.headers["X-Accel-Buffering"] = "no"

      prompt = params[:prompt].to_s.strip
      return head :bad_request if prompt.blank?

      cfg        = LexxyAssistant.config
      sys_prompt = cfg.system_prompt.respond_to?(:call) ? cfg.system_prompt.call : cfg.system_prompt.to_s

      usage = cfg.adapter.stream(prompt, system_prompt: sys_prompt) do |chunk|
        response.stream.write("data: #{chunk.gsub("\n", "\\n")}\n\n")
      end

      response.stream.write("event: done\ndata: #{(usage || {}).to_json}\n\n")
    rescue ActionController::Live::ClientDisconnected
      # client navigated away — normal
    rescue => e
      Rails.logger.error "[LexxyAssistant] #{e.class}: #{e.message}"
      response.stream.write("event: error\ndata: #{e.message.gsub("\n", " ")}\n\n")
    ensure
      response.stream.close
    end
  end
end
