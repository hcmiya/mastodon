module Mastodon::Version
  module_function

  def to_s
    @version ||= "#{to_a.join('.')}#{"-#{flags}" if flags.present?}+v6don.tor"
  end

  def source_base_url
    'https://js4.in/repo/gitweb.cgi/v6don'
  end

  def source_tag
    'refs/heads/tor'
  end
end
