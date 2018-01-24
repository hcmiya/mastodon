def parse_proxy(proxy)
  return if !proxy || proxy.empty?

  proxy = URI.parse(proxy)
  raise Mastodon::ValidationError, "Unsupported proxy type: #{proxy.scheme}" unless ["http", "https"].include? proxy.scheme
  raise Mastodon::ValidationError, "No proxy host" unless proxy.host

  host = proxy.host
  host = host[1...-1] if host[0] == '[' #IPv6 address
  {proxy: ({ proxy_address: host, proxy_port: proxy.port, proxy_username: proxy.user, proxy_password: proxy.password }).compact}
end

Rails.application.configure do
  config.x.http_client_proxy = {
    "http" => parse_proxy(ENV['HTTP_PROXY']) || parse_proxy(ENV['http_proxy']) || {},
    "https" => parse_proxy(ENV['HTTPS_PROXY']) || parse_proxy(ENV['https_proxy']) || {},
  }
end

module Mastodon::Goldfinger
  def self.fetch(uri)
    ssl = !(/\.(onion|i2p)(:\d+)?$/ === uri)
    proxy = Rails.configuration.x.http_client_proxy[ssl ? 'https' : 'http']
    proxy[:ssl] = ssl
    ::Goldfinger.finger("acct:#{uri}", proxy)
  end
end
