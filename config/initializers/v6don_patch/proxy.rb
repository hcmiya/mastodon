Rails.application.configure do
  def parse_proxy(name)
    strproxy = ENV[name]
    return if !strproxy || strproxy.empty?

    proxy = URI.parse(strproxy)
    raise Mastodon::ValidationError, "Unsupported proxy type: #{proxy.scheme}" unless ["http", "https"].include? proxy.scheme
    raise Mastodon::ValidationError, "No proxy host" unless proxy.host

    host = proxy.host
    host = host[1...-1] if host[0] == '[' #for IPv6 address
    {proxy: ({ proxy_address: host, proxy_port: proxy.port, proxy_username: proxy.user, proxy_password: proxy.password }).compact}
  end

  config.x.http_client_proxy = parse_proxy('HTTP_PROXY') || parse_proxy('http_proxy') || {}
end

module Goldfinger
  def self.finger(uri, opts = {})
    opts = opts.merge(Rails.configuration.x.http_client_proxy).merge(ssl: !/\.(onion|i2p)(:\d+)?$/.match(uri))
    Goldfinger::Client.new(uri, opts).finger
  end
end
