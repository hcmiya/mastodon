# frozen_string_literal: true

module Mastodon
  module Version
    module_function

    def major
      2
    end

    def minor
      4
    end

    def patch
      0
    end

    def pre
      nil
    end

    def flags
      'rc1'
    end

    def to_a
      [major, minor, patch, pre].compact
    end

    def to_s
      [to_a.join('.'), flags, '~v6don-tor'].join
    end

    def source_base_url
      'https://js4.in/repo/gitweb.cgi/v6don'
    end

    # specify git tag or commit hash here
    def source_tag
      'refs/heads/tor'
    end

    def source_url
      if source_tag
        "#{source_base_url}/tree/#{source_tag}"
      else
        source_base_url
      end
    end
  end
end
