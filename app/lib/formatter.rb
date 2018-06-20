# frozen_string_literal: true

require 'singleton'
require_relative './sanitize_config'

class Formatter
  include Singleton
  include RoutingHelper

  include ActionView::Helpers::TextHelper

  def format(status, **options)
    if status.reblog?
      prepend_reblog = status.reblog.account.acct
      status         = status.proper
    else
      prepend_reblog = false
    end

    raw_content = status.text

    return '' if raw_content.blank?

    unless status.local?
      html = reformat(raw_content)
      html = encode_custom_emojis(html, status.emojis) if options[:custom_emojify]
      return html.html_safe # rubocop:disable Rails/OutputSafety
    end

    linkable_accounts = status.mentions.map(&:account)
    linkable_accounts << status.account

    html = raw_content
    html = "RT @#{prepend_reblog} #{html}" if prepend_reblog
    html = encode_and_link_urls(html, linkable_accounts)
    html = encode_custom_emojis(html, status.emojis) if options[:custom_emojify]
    html = simple_format(html, {}, sanitize: false)
    html = encode_urn(html)
    html = html.delete("\n")

    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  def reformat(html)
    sanitize(html, Sanitize::Config::MASTODON_STRICT)
  end

  def plaintext(status)
    return status.text if status.local?

    text = status.text.gsub(/(<br \/>|<br>|<\/p>)+/) { |match| "#{match}\n" }
    strip_tags(text)
  end

  def simplified_format(account, **options)
    html = account.local? ? linkify(account.note) : reformat(account.note)
    html = encode_custom_emojis(html, account.emojis) if options[:custom_emojify]
    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  def sanitize(html, config)
    Sanitize.fragment(html, config)
  end

  def format_spoiler(status)
    html = encode(status.spoiler_text)
    html = encode_custom_emojis(html, status.emojis)
    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  def format_display_name(account, **options)
    html = encode(account.display_name.presence || account.username)
    html = encode_custom_emojis(html, account.emojis) if options[:custom_emojify]
    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  def format_field(account, str, **options)
    return reformat(str).html_safe unless account.local? # rubocop:disable Rails/OutputSafety
    html = encode_and_link_urls(str, me: true)
    html = encode_custom_emojis(html, account.emojis) if options[:custom_emojify]
    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  def linkify(text)
    html = encode_and_link_urls(text)
    html = simple_format(html, {}, sanitize: false)
    html = html.delete("\n")

    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  private

  def encode(html)
    HTMLEntities.new.encode(html)
  end

  def encode_and_link_urls(html, accounts = nil, options = {})
    entities = Extractor.extract_entities_with_indices(html, extract_url_without_protocol: false)

    if accounts.is_a?(Hash)
      options  = accounts
      accounts = nil
    end

    rewrite(html.dup, entities) do |entity|
      if entity[:url]
        link_to_url(entity, options)
      elsif entity[:hashtag]
        link_to_hashtag(entity)
      elsif entity[:screen_name]
        link_to_mention(entity, accounts)
      end
    end
  end

  def count_tag_nesting(tag)
    if tag[1] == '/' then -1
    elsif tag[-2] == '/' then 0
    else 1
    end
  end

  def encode_custom_emojis(html, emojis)
    return html if emojis.empty?

    emoji_map = emojis.map { |e| [e.shortcode, full_asset_url(e.image.url(:static))] }.to_h

    i                     = -1
    tag_open_index        = nil
    inside_shortname      = false
    shortname_start_index = -1
    invisible_depth       = 0

    while i + 1 < html.size
      i += 1

      if invisible_depth.zero? && inside_shortname && html[i] == ':'
        shortcode = html[shortname_start_index + 1..i - 1]
        emoji     = emoji_map[shortcode]

        if emoji
          replacement = "<img draggable=\"false\" class=\"emojione\" alt=\":#{shortcode}:\" title=\":#{shortcode}:\" src=\"#{emoji}\" />"
          before_html = shortname_start_index.positive? ? html[0..shortname_start_index - 1] : ''
          html        = before_html + replacement + html[i + 1..-1]
          i          += replacement.size - (shortcode.size + 2) - 1
        else
          i -= 1
        end

        inside_shortname = false
      elsif tag_open_index && html[i] == '>'
        tag = html[tag_open_index..i]
        tag_open_index = nil
        if invisible_depth.positive?
          invisible_depth += count_tag_nesting(tag)
        elsif tag == '<span class="invisible">'
          invisible_depth = 1
        end
      elsif html[i] == '<'
        tag_open_index   = i
        inside_shortname = false
      elsif !tag_open_index && html[i] == ':'
        inside_shortname      = true
        shortname_start_index = i
      end
    end

    html
  end

  URN_PATTERN = [
    {
      :re => /\Aietf:(rfc|bcp|std|fyi):(\d+)(#[a-zA-Z0-9.-]+)?\b/,
      :f => -> (nm) {
        f_part = nm[3]
        f_name = case f_part
        when /^#section-([\d.]*\d)/
          "§ #{$1}"
        when /^#appendix-(([A-Z])(\.[\d.]*\d)?)/
          "Appendix #{$1}"
        end
        {:url => "https://tools.ietf.org/html/#{nm[1]}#{nm[2]}#{f_part}", :name => [nm[1].upcase, nm[2], f_name].compact.join(' ') }
      }
    },
    {
      :re => /\Aisbn:(\d[\d-]+\d(?:-?X)?)\b/i,
      :f => -> (nm) {
        isbn = nm[1].delete('-')
        isbnlen = isbn.size
        return if ![10, 13].include?(isbnlen)
        if isbnlen == 13 && isbn.starts_with?("978")
          # ISBN13をAmazonリンク化するためISBN10化して検査数字再計算
          weight = 11
          isbn = isbn[3...-1]
          sum = 11 - isbn.split('').inject(0) do |sum, digit|
            weight = weight - 1
            sum + digit.to_i * weight
          end % 11
          sum = case sum
          when 11 then 0
          when 10 then 'X'
          else sum
          end.to_s
          isbn << sum
          isbnlen = 10
        end
        disp = "ISBN #{nm[1]}"
        url = case isbnlen
        when 10
          "https://www.amazon.co.jp/dp/#{isbn}"
        when 13
          "https://ja.wikipedia.org/wiki/%E7%89%B9%E5%88%A5:%E6%96%87%E7%8C%AE%E8%B3%87%E6%96%99/#{isbn}"
        end
        {:url => url, :name => disp}
      },
    },
    {
      :re => /\Aiso:std:(iso|iso-iec|iso-cie|iso-astm|iso-ieee|iec|iso-iec-ieee):(\d+)(?::(-[\da-z-]+))?(:[:\da-z.,-]*[\da-z])?\b/i,
      :f => -> (nm) {
        org = nm[1].upcase.gsub('-', '/')
        num = nm[2]
        part = nm[3]
        other = nm[4]
        {:url => "https://www.iso.org/obp/ui/\##{nm[0]}", :name => "#{org} #{num}#{part}"}
      },
    },
  ]
  def encode_urn(html)
    def linkify(text, cont = '')
      return cont + text unless scheme = text.match(/\burn:/)
      
      replacement = ''
      beginpos = nextpos = scheme.end(0)
      URN_PATTERN.each do |ptn|
        ptn[:re].match(text[nextpos..-1]) do |m|
          if replacement_data = ptn[:f].call(m)
            replacement = "<a title='urn:#{m[0]}' href='#{replacement_data[:url]}'>#{replacement_data[:name]}</a>"
            nextpos = beginpos + m.end(0)
            beginpos = scheme.begin(0)
            break
          end
        end
      end
      linkify(text[nextpos..-1], "#{cont}#{text[0...beginpos]}#{replacement}")
    end

    def fetch(html, cont = '')
      if begintag = html.index('<')
        raw = html.slice!(0...begintag)
        endtag = html.match(/\A<a .*?<\/a>/) ? $~.end(0) : html.index('>')
        tag = html.slice!(0...endtag)
        fetch(html, cont + linkify(raw) + tag)
      else
        linkify(html, cont)
      end
    end

    fetch(html)
  end

  def rewrite(text, entities)
    chars = text.to_s.to_char_a

    # Sort by start index
    entities = entities.sort_by do |entity|
      indices = entity.respond_to?(:indices) ? entity.indices : entity[:indices]
      indices.first
    end

    result = []

    last_index = entities.reduce(0) do |index, entity|
      indices = entity.respond_to?(:indices) ? entity.indices : entity[:indices]
      result << encode(chars[index...indices.first].join)
      result << yield(entity)
      indices.last
    end

    result << encode(chars[last_index..-1].join)

    result.flatten.join
  end

  def link_to_url(entity, options = {})
    url        = Addressable::URI.parse(entity[:url])
    html_attrs = { target: '_blank', rel: 'nofollow noopener' }

    html_attrs[:rel] = "me #{html_attrs[:rel]}" if options[:me]

    Twitter::Autolink.send(:link_to_text, entity, link_html(entity[:url]), url, html_attrs)
  rescue Addressable::URI::InvalidURIError, IDN::Idna::IdnaError
    encode(entity[:url])
  end

  def link_to_mention(entity, linkable_accounts)
    acct = entity[:screen_name]

    return link_to_account(acct) unless linkable_accounts

    account = linkable_accounts.find { |item| TagManager.instance.same_acct?(item.acct, acct) }
    account ? mention_html(account) : "@#{acct}"
  end

  def link_to_account(acct)
    username, domain = acct.split('@')

    domain  = nil if TagManager.instance.local_domain?(domain)
    account = EntityCache.instance.mention(username, domain)

    account ? mention_html(account) : "@#{acct}"
  end

  def link_to_hashtag(entity)
    hashtag_html(entity[:hashtag])
  end

  def link_html(url)
    url    = Addressable::URI.parse(url).to_s
    prefix = url.match(/\Ahttps?:\/\/(www\.)?/).to_s
    text   = url[prefix.length, 30]
    suffix = url[prefix.length + 30..-1]
    cutoff = url[prefix.length..-1].length > 30

    "<span class=\"invisible\">#{encode(prefix)}</span><span class=\"#{cutoff ? 'ellipsis' : ''}\">#{encode(text)}</span><span class=\"invisible\">#{encode(suffix)}</span>"
  end

  def hashtag_html(tag)
    "<a href=\"#{tag_url(tag.downcase)}\" class=\"mention hashtag\" rel=\"tag\">#<span>#{tag}</span></a>"
  end

  def mention_html(account)
    "<span class=\"h-card\"><a href=\"#{TagManager.instance.url_for(account)}\" class=\"u-url mention\">@<span>#{account.username}</span></a></span>"
  end
end
